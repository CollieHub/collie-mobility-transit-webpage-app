export type TargetEnv = 'prod';

export function getTargetEnv(): TargetEnv {
  return 'prod';
}

export function setTargetEnv(_env: TargetEnv) {
  // Always production
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.host}/v1`;
  }
  return import.meta.env.VITE_TRANSIT_API_URL || '/v1';
}

export function getWsUrl(): string {
  if (import.meta.env.VITE_TRANSIT_WS_URL) {
    return import.meta.env.VITE_TRANSIT_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'ws://localhost:6005/v1/ws';
    }
  }
  return 'wss://ws.pordondeviene.ar';
}
