import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../lib/api/envConfig';
import { getPublicToken } from '../lib/api/publicToken';

export interface MeliProduct {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  redirectUrl: string;
  price: string;
  originalPrice?: string;
  discount?: string;
  badge?: string;
  installments?: string;
}

export function useMeliProducts() {
  const [products, setProducts] = useState<MeliProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchProducts = async () => {
      try {
        const url = getApiBaseUrl();
        const cleanUrl = url.replace(/\/$/, '');
        const token = await getPublicToken(cleanUrl);
        const endpoint = cleanUrl.endsWith('/v1') ? `${cleanUrl}/transit/meli/products` : `${cleanUrl}/v1/transit/meli/products`;
        
        const res = await fetch(endpoint, {
          headers: {
            'Accept': 'application/json',
            'Authorization': token
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (mounted && Array.isArray(data.products)) {
            setProducts(data.products);
          }
        }
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchProducts();
    return () => { mounted = false; };
  }, []);

  return { products, isLoading, error };
}
