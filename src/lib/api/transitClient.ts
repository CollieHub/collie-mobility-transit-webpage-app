// Transit API Client with session key rotation
// Handles handshake, key derivation, and encrypted data retrieval

const APP_SIGNATURE = 'collie-transit-web-2026';

// Derive key from master + context using HMAC-SHA256 (must match Go backend)
async function deriveKey(secret: string, context: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(context));
  return new Uint8Array(signature); // 32 bytes
}

// AES-GCM decrypt (nonce prepended to ciphertext, matching Go's gcm.Seal)
async function decryptAESGCM(key: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
  const importedKey = await crypto.subtle.importKey(
    'raw', key.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['decrypt']
  );
  // Go's gcm.Seal prepends the 12-byte nonce
  const nonce = ciphertext.slice(0, 12);
  const encrypted = ciphertext.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce }, importedKey, encrypted
  );
  return new Uint8Array(decrypted);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface TransitSession {
  sessionId: string;
  sessionKey: Uint8Array; // Decrypted AES-256 key
  expiresAt: number;
}

export interface TransitSyncInfo {
  version: string;
  hash: string;
}

export class TransitAPIClient {
  private baseUrl: string;
  private session: TransitSession | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  // Step 1: Perform handshake to get session-specific AES key
  async handshake(): Promise<TransitSession> {
    const timestamp = Math.floor(Date.now() / 1000);
    
    const res = await fetch(`${this.baseUrl}/handshake`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Application-ID': 'COLLIE-TRANSIT-WEB'
      },
      body: JSON.stringify({ appSignature: APP_SIGNATURE, timestamp }),
    });

    if (!res.ok) throw new Error(`Handshake failed: ${res.status}`);
    const data = await res.json();

    // Derive the same key the backend used to encrypt the session key
    // Backend: HMAC-SHA256(masterSecret, appSignature)
    // We derive locally: HMAC-SHA256(local_master, appSignature)
    const derivedKey = await deriveKey(
      'SIT-ZARATE-MASTER-2026-COLLIE-SECURE', // Must match backend's TRANSIT_MASTER_SECRET
      APP_SIGNATURE
    );

    // Decrypt the session key
    const encryptedKey = base64ToBytes(data.encryptedKey);
    const sessionKeyBytes = await decryptAESGCM(derivedKey, encryptedKey);

    this.session = {
      sessionId: data.sessionId,
      sessionKey: sessionKeyBytes,
      expiresAt: Date.now() + (data.expiresIn * 1000),
    };

    return this.session;
  }

  // Step 2: Check if we need to update
  async sync(currentHash?: string): Promise<TransitSyncInfo | null> {
    const headers: Record<string, string> = { 'X-Application-ID': 'COLLIE-TRANSIT-WEB' };
    if (currentHash) headers['If-None-Match'] = currentHash;

    const res = await fetch(`${this.baseUrl}/sync`, { headers });
    
    if (res.status === 304) return null; // Data hasn't changed
    if (res.status === 404) return null; // Data doesn't exist yet on backend
    if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
    
    return await res.json();
  }

  // Step 3: Download encrypted data and decrypt with session key
  async getData(): Promise<any> {
    if (!this.session || Date.now() > this.session.expiresAt) {
      await this.handshake();
    }

    const res = await fetch(`${this.baseUrl}/data`, {
      headers: { 
        'X-Session-ID': this.session!.sessionId,
        'X-Application-ID': 'COLLIE-TRANSIT-WEB'
      },
    });

    if (res.status === 401) {
      // Session expired, retry with new handshake
      await this.handshake();
      return this.getData();
    }

    if (!res.ok) throw new Error(`Data fetch failed: ${res.status}`);
    const { data: encryptedB64 } = await res.json();

    // Decrypt with session key
    const encrypted = base64ToBytes(encryptedB64);
    const decrypted = await decryptAESGCM(this.session!.sessionKey, encrypted);

    // The decrypted bytes are the original raw JSON (which was stored encrypted on the server)
    // But the server stored it double-encrypted: first with master key for storage,
    // then re-encrypted with session key for transit.
    // So what we get after decrypting is the raw transit data as stored
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  isSessionValid(): boolean {
    return this.session !== null && Date.now() < this.session.expiresAt;
  }
}
