import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../lib/api/envConfig';

export interface AffectedRoute {
  routeId: string;
  routeName: string;
  routeCode: string;
  status: 'NORMAL' | 'DELAY' | 'INTERRUPTED';
  observation?: string;
}

export interface TransitIncident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: string;
  active: boolean;
  type?: 'GENERAL' | 'LINE_STATUS';
  lineId?: string;
  lineName?: string;
  affectedRoutes?: AffectedRoute[];
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<TransitIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchIncidents = async () => {
      try {
        const url = getApiBaseUrl();
        const cleanUrl = url.replace(/\/$/, '');
        const incidentsEndpoint = cleanUrl.endsWith('/v1') ? `${cleanUrl}/transit/incidents` : `${cleanUrl}/v1/transit/incidents`;
        const res = await fetch(incidentsEndpoint);
        if (!res.ok) {
          throw new Error(`Error: ${res.status}`);
        }
        const data = await res.json();
        const incidentList = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
        if (mounted) {
          setIncidents(incidentList);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchIncidents();
    // Poll every 5 minutes
    const interval = setInterval(fetchIncidents, 300000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { incidents, isLoading, error };
}
