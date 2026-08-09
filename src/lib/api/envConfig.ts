export type TargetEnv = 'local' | 'prod';

export function getTargetEnv(): TargetEnv {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const envParam = urlParams.get('env')?.toLowerCase();
    if (envParam === 'prod') return 'prod';
    if (envParam === 'local') return 'local';
    
    const stored = localStorage.getItem('collie_target_env')?.toLowerCase();
    if (stored === 'prod') return 'prod';
    if (stored === 'local') return 'local';
  }
  
  return 'prod';
}

export function setTargetEnv(env: TargetEnv) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('collie_target_env', env);
    window.location.reload();
  }
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.host;
    // Si estamos corriendo en la app aislada Full-Stack Edge (Vite/Wrangler o Dominio Edge Cloudflare)
    if (host.includes('5185') || host.includes('8787') || host.includes('transit.pordondeviene.ar') || host.includes('pages.dev') || host.includes('workers.dev')) {
      return `${window.location.protocol}//${host}/v1`;
    }
  }

  const env = getTargetEnv();
  if (env === 'local') {
    return 'http://localhost:6005/v1';
  }
  return import.meta.env.VITE_TRANSIT_API_URL || 'https://transit.pordondeviene.ar/v1';
}

export function getWsUrl(): string {
  const env = getTargetEnv();
  if (env === 'local') {
    return 'ws://localhost:6001';
  }
  return import.meta.env.VITE_TRANSIT_WS_URL || 'wss://ws.pordondeviene.ar';
}
