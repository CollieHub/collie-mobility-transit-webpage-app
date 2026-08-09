let cachedToken: string | null = null;

export async function getPublicToken(baseUrl: string): Promise<string> {
    if (cachedToken) return cachedToken;
    
    const candidateUrls = [
        baseUrl,
        import.meta.env.VITE_TRANSIT_API_URL,
        'http://localhost:6005/v1'
    ].filter((u): u is string => Boolean(u));

    const uniqueUrls = Array.from(new Set(candidateUrls));

    for (const targetUrl of uniqueUrls) {
        try {
            const cleanUrl = targetUrl.replace(/\/$/, '');
            const handshakeEndpoint = cleanUrl.endsWith('/v1') ? `${cleanUrl}/handshake` : `${cleanUrl}/v1/handshake`;
            const res = await fetch(handshakeEndpoint, {
                method: 'POST',
                headers: { 
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Application-ID': 'COLLIE-TRANSIT-WEB'
                },
                body: JSON.stringify({
                    appSignature: 'browser',
                    timestamp: Math.floor(Date.now() / 1000)
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.token) {
                    cachedToken = data.token;
                    return cachedToken as string;
                }
            }
        } catch {
            // Intentar con el siguiente candidato
        }
    }

    cachedToken = "public_token";
    return cachedToken;
}
