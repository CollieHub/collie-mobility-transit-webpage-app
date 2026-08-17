import { useState, useEffect } from 'react';
import { getPublicToken } from '../lib/api/publicToken';
import { getApiBaseUrl } from '../lib/api/envConfig';

export interface TransitAd {
  id: string;
  imageUrl?: string;
  redirectUrl?: string;
  title?: string;
  subtitle?: string;
  color?: string;
  border?: string;
  text?: string;
}

export function useTransitAds() {
  const [ads, setAds] = useState<TransitAd[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchAds = async () => {
      try {
        const url = getApiBaseUrl();
        const cleanUrl = url.replace(/\/$/, '');
        const token = await getPublicToken(cleanUrl);
        const adsEndpoint = cleanUrl.endsWith('/v1') ? `${cleanUrl}/transit/ads` : `${cleanUrl}/v1/transit/ads`;
        const res = await fetch(adsEndpoint, {
            headers: {
                'Accept': 'application/json',
                'Authorization': token
            }
        });
        if (res.ok) {
          const data = await res.json();
          const adsList = Array.isArray(data) ? data : (Array.isArray(data.ads) ? data.ads : (Array.isArray(data.data) ? data.data : []));
          if (mounted) {
            setAds(adsList);
          }
        }
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchAds();
    return () => { mounted = false; };
  }, []);

  return { ads, isLoading, error };
}
