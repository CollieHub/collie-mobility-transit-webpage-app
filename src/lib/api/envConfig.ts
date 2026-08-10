export type TargetEnv = 'prod';

export function getTargetEnv(): TargetEnv {
  return 'prod';
}

export function setTargetEnv(_env: TargetEnv) {
  // Always production
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.host;
    if (host.includes('pordondeviene') || host.includes('5185') || host.includes('8787') || host.includes('pages.dev') || host.includes('workers.dev')) {
      return `${window.location.protocol}//${host}/v1`;
    }
  }

  return import.meta.env.VITE_TRANSIT_API_URL || 'https://pordondeviene.ar/v1';
}

export function getWsUrl(): string {
  return import.meta.env.VITE_TRANSIT_WS_URL || 'wss://ws.pordondeviene.ar';
}
