// Browser-only AES-256-GCM encryption/decryption via Web Crypto API

const GEO_SECRET_FRAGMENT_1 = 'SIT-ZARATE-X9Z8-';
const GEO_SECRET_FRAGMENT_2 = '2026-KD82-V2';
const getGeoKey = () => GEO_SECRET_FRAGMENT_1 + GEO_SECRET_FRAGMENT_2;

function bufToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBuf(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export async function encryptData(data: any): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(getGeoKey().padEnd(32, '0').slice(0, 32));
    
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data)));
    
    const combined = new Uint8Array(12 + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), 12);
    return bufToBase64(combined.buffer);
}

export async function decryptData(base64Payload: string): Promise<any> {
    const combined = base64ToBuf(base64Payload);
    const iv = combined.slice(0, 12);
    const encDataWithTag = combined.slice(12);
    
    const keyData = new TextEncoder().encode(getGeoKey().padEnd(32, '0').slice(0, 32));
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encDataWithTag);
    return JSON.parse(new TextDecoder().decode(dec));
}
