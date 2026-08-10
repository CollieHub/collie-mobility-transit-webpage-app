import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, Unlink, Bus, MapPin, Clock, ChevronRight, Layers, LocateFixed, X, Maximize2, ChevronDown, Check, CheckSquare, Square, AlertTriangle, Navigation, Flag, Tag, Star, Search, Eye, EyeOff, Image, Sparkles, RotateCw, Hash, Map, Sliders, Info, Wrench, CloudDownload, Download, Menu, Shield, Bell, BellOff, GitCommit, Radio, Share2 } from 'lucide-react';
import packageInfo from '../package.json';
// Feature branch transit-enhancements-20260716-v1
// Feature: transit-enhancements-20260723-v2


const InstagramIcon = ({ size = 20, color = '#334155' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
);

const FacebookIcon = ({ size = 20, color = '#334155' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
);

const XIconSocial = ({ size = 20, color = '#334155' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"></path><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path></svg>
);

const WhatsAppIcon = ({ size = 20, color = '#334155' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.707 1.458h.005c6.56 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
);
const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/ejemplo-canal-configurar'; // Reemplazar por la URL oficial cuando se cree el canal

import TransitMap from './components/TransitMap';
import { getApiBaseUrl } from './lib/api/envConfig';
import TimetableModal from './components/TimetableModal';
import DraggableBannerCarousel from './components/DraggableBannerCarousel';
import { isHoliday } from './lib/holidays';
import { getPublicToken } from './lib/api/publicToken';
import { StopIcon } from './components/icons/StopIcon';
import { useAppConfig, DEFAULT_PRIVACY_CONTENT, DEFAULT_TERMS_CONTENT } from './hooks/useAppConfig';
import { useTransitAds } from './hooks/useTransitAds';
import { useIncidents } from './hooks/useIncidents';
import AdminLoginView from './components/AdminLoginView';
import GoogleAd from './components/GoogleAd';
async function getSignedHeaders(method: string, path: string, token: string): Promise<Record<string, string>> {
  const timestamp = Date.now().toString();
  const appID = 'COLLIE-TRANSIT-WEB';
  const secret = 'web-public-secret-do-not-trust-fully';
  const payload = `${appID}:${timestamp}:${method.toUpperCase()}:${path}`;
  
  const adminToken = localStorage.getItem('collie_admin_token');
  const authHeaderValue = adminToken ? `Bearer ${adminToken}` : token;
  
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);
    
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await window.crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageData
    );
    
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return {
      'Accept': 'application/json',
      'Authorization': authHeaderValue,
      'x-application-id': appID,
      'x-app-timestamp': timestamp,
      'x-app-signature': signatureHex,
      'x-app-hash': 'browser'
    };
  } catch (e) {
    console.error("Error generating HMAC signature:", e);
    return {
      'Accept': 'application/json',
      'Authorization': authHeaderValue,
      'x-application-id': appID,
      'x-app-timestamp': timestamp,
      'x-app-signature': '',
      'x-app-hash': 'browser'
    };
  }
}

// Paleta de colores configurada para ramales seleccionados
export const ROUTE_COLORS_PALETTE = [
  '#880E4F',
  '#E65100',
  '#673AB7',
  '#009688',
  '#3F51B5',
  '#FF9800',
  '#0F9D58',
  '#A52714',
  '#F9A825',
  '#558B2F',
  '#311B92',
  '#006064',
  '#C2185B',
  '#0D47A1',
  '#1B5E20',
  '#B71C1C',
  '#E64A19',
  '#4A148C',
  '#00838F',
  '#F57C00'
];

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

function useIsMobile() {
  const width = useWindowWidth();
  return width < 768;
}

const CAROUSEL_BANNERS = [
  [
    { title: "Remisería Centro", subtitle: "Viajes de corta y larga distancia", color: "#fef3c7", text: "#b45309", border: "#fcd34d" },
    { title: "Panadería El Sol", subtitle: "Facturas calientes todo el día", color: "#e0e7ff", text: "#4338ca", border: "#a5b4fc" },
    { title: "Ferretería Los Hermanos", subtitle: "Todo para tu hogar", color: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
    { title: "Carnicería La Mejor", subtitle: "Cortes premium todos los días", color: "#dcfce7", text: "#15803d", border: "#86efac" },
    { title: "Kiosco El Paso", subtitle: "Abierto 24 horas", color: "#f3e8ff", text: "#7e22ce", border: "#d8b4fe" },
    { title: "Veterinaria Huellas", subtitle: "Clínica y pet shop", color: "#ecfccb", text: "#4d7c0f", border: "#bef264" },
  ],
  [
    { title: "Remisería La Rápida", subtitle: "Autos ejecutivos", color: "#ffe4e6", text: "#be123c", border: "#fda4af" },
    { title: "Panadería La Abuela", subtitle: "Especialidad en masas finas", color: "#e0f2fe", text: "#0369a1", border: "#7dd3fc" },
    { title: "Ferretería Industrial", subtitle: "Ventas por mayor y menor", color: "#fef9c3", text: "#a16207", border: "#fde047" },
    { title: "Carnicería El Torito", subtitle: "Ofertas de fin de semana", color: "#ffedd5", text: "#c2410c", border: "#fdba74" },
    { title: "Kiosco Open 25", subtitle: "Bebidas frías y snacks", color: "#cffafe", text: "#0f766e", border: "#67e8f9" },
    { title: "Veterinaria San Roque", subtitle: "Peluquería canina", color: "#fae8ff", text: "#a21caf", border: "#f0abfc" },
  ]
];


const getLineName = (route: any) => {
  if (route?.code?.toLowerCase().startsWith('rz') || route?.id?.toLowerCase().includes('sit')) {
    return 'SIT';
  }
  let name = route?.company || 'Otras';
  return name
    .replace(/^RedSube\s*-\s*/i, '')
    .replace(/^l[ií]nea\s+/i, 'Línea ')
    .replace(/Línea\s+(\d+[A-Za-z]?)/i, 'Línea $1');
};

const originalConsole = {
  log: typeof console !== 'undefined' ? console.log : () => {},
  info: typeof console !== 'undefined' ? console.info : () => {},
  warn: typeof console !== 'undefined' ? console.warn : () => {},
  error: typeof console !== 'undefined' ? console.error : () => {},
};

const hasAdminTokenInitially = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('collie_admin_token') !== null || localStorage.getItem('developer_bypass') === 'true';
};

if (!hasAdminTokenInitially()) {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
}

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('developer_bypass') === 'true') {
      return 'mock-admin-token';
    }
    return localStorage.getItem('collie_admin_token');
  });

  const isAdmin = useMemo(() => !!adminToken, [adminToken]);

  useEffect(() => {
    if (isAdmin) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    } else {
      console.log = () => {};
      console.info = () => {};
      console.warn = () => {};
      console.error = () => {};
    }
  }, [isAdmin]);

  // Google Analytics dynamic script injection
  useEffect(() => {
    const gaId = import.meta.env.VITE_GOOGLE_ANALYTICS_ID;
    if (gaId) {
      if (!document.getElementById('google-analytics-script')) {
        const script1 = document.createElement('script');
        script1.id = 'google-analytics-script';
        script1.async = true;
        script1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        document.head.appendChild(script1);

        const script2 = document.createElement('script');
        script2.id = 'google-analytics-init';
        script2.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `;
        document.head.appendChild(script2);
      }
    }
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('collie_admin_token');
    localStorage.removeItem('developer_bypass');
    window.location.href = '/';
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const { config, isLoading: isLoadingConfig } = useAppConfig();
  const { ads } = useTransitAds();
  const { incidents, isLoading: isLoadingIncidents } = useIncidents();
  const MAX_SELECTED_RAMALES = 20;
  const [headerAdState, setHeaderAdState] = useState<'loading' | 'filled' | 'unfilled' | 'blocked'>('loading');
  const [selectedRouteIds, setSelectedRouteIds] = useState<Set<string>>(new Set());
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [favoriteRoutes, setFavoriteRoutes] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('collie_favorite_routes');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const favorites = useMemo(() => new Set<string>(favoriteRoutes.map(r => r.id)), [favoriteRoutes]);
   const [showFavoritesOnly, setShowFavoritesOnly] = useState(() => {
    const stored = localStorage.getItem('collie_show_favorites_only');
    return stored !== null ? stored === 'true' : false;
  });
  const [selectBothDirections, setSelectBothDirections] = useState(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('collie_admin_token') === null && localStorage.getItem('developer_bypass') !== 'true') {
      return false; // Forzar desactivado para no admin
    }
    const stored = localStorage.getItem('collie_select_both_directions');
    return stored !== null ? stored === 'true' : false;
  });
  const [showStops, setShowStops] = useState(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('collie_admin_token') === null && localStorage.getItem('developer_bypass') !== 'true') {
      return true; // Forzar activo para no admin
    }
    const stored = localStorage.getItem('collie_show_stops');
    return stored !== null ? stored === 'true' : true;
  });
  const [showStopProjections, setShowStopProjections] = useState(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('collie_admin_token') === null && localStorage.getItem('developer_bypass') !== 'true') {
      return false; // Forzar desactivado para no admin
    }
    const stored = localStorage.getItem('collie_show_stop_projections');
    return stored !== null ? stored === 'true' : false;
  });
  const [showUserLocation, setShowUserLocation] = useState(() => {
    const stored = localStorage.getItem('collie_show_user_location');
    return stored !== null ? stored === 'true' : false;
  });
  const [enableGpsMatching, setEnableGpsMatching] = useState<boolean>(() => {
    const stored = localStorage.getItem('collie_enable_gps_matching');
    return stored !== null ? stored === 'true' : true;
  });
  const [isScreenProtected, setIsScreenProtected] = useState(false);

  useEffect(() => {
    const handleBeforePrint = () => setIsScreenProtected(true);
    const handleAfterPrint = () => setIsScreenProtected(false);

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);
  const [lineFilter, setLineFilter] = useState<string | null>(null);
  const [visibleRouteIds, setVisibleRouteIds] = useState<Set<string>>(new Set());
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({ 'SIT': true });
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('company') || params.get('line') || 'SIT';
  });
  useEffect(() => {
    if (searchQuery) {
      setExpandedLines(prev => ({ ...prev, [searchQuery]: true }));
    }
  }, [searchQuery]);
  const [detailedRoutes, setDetailedRoutes] = useState<Record<string, any>>({});
  const [liveBuses, setLiveBuses] = useState<any[]>([]);
  const [showStopSequences, setShowStopSequences] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('collie_admin_token') === null && localStorage.getItem('developer_bypass') !== 'true') {
      return false; // Forzar desactivado para no admin
    }
    return false;
  });
  const [showWaypoints, setShowWaypoints] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('collie_admin_token') === null && localStorage.getItem('developer_bypass') !== 'true') {
      return false; // Forzar desactivado para no admin
    }
    const stored = localStorage.getItem('collie_show_waypoints');
    return stored !== null ? stored === 'true' : false;
  });



  const [routeShowIda, setRouteShowIda] = useState<Record<string, boolean>>({});
  const [routeShowVuelta, setRouteShowVuelta] = useState<Record<string, boolean>>({});
  const [routeStopsIda, setRouteStopsIda] = useState<Record<string, boolean>>({});
  const [routeStopsVuelta, setRouteStopsVuelta] = useState<Record<string, boolean>>({});
  const [routeBusesIda, setRouteBusesIda] = useState<Record<string, boolean>>({});
  const [routeBusesVuelta, setRouteBusesVuelta] = useState<Record<string, boolean>>({});
      const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [nearbyStop, setNearbyStop] = useState<any>(null);
  const [toggleNearbyTrigger, setToggleNearbyTrigger] = useState<number>(0);
  const [viewingSchedule, setViewingSchedule] = useState<string | null>(null);
  const handleViewSchedule = useCallback((routeCode: string) => {
    setViewingSchedule(routeCode);
  }, []);
  const [timetableDetail, setTimetableDetail] = useState<any>(null);
  const [isTimetableLoading, setIsTimetableLoading] = useState(false);
  const [limitAlert, setLimitAlert] = useState<boolean>(false);
  const [lineDropdownOpen, setLineDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'recorridos' | 'informacion' | 'acerca_de'>('recorridos');
  const [showRawGps, setShowRawGps] = useState<boolean>(false);
  const [bannerStates, setBannerStates] = useState([0, 0]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bffRoutes, setBffRoutes] = useState<any[]>([]);
  const [isBffLoading, setIsBffLoading] = useState(false);
  const [availableLines, setAvailableLines] = useState<string[]>(['SIT']);
  const [calendarExceptions, setCalendarExceptions] = useState<any[]>([]);

  const [showDebugConsole, setShowDebugConsole] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'delayed' | 'ontime'>('all');

  const parseLogMessage = useCallback((log: string) => {
    if (!log || !log.includes('cruzó punto de control:')) return null;

    try {
      const parts = log.split('|');
      if (parts.length < 4) return null;

      const mainPart = parts[0];
      const cocheMatch = mainPart.match(/🚍 Coche\s+([^\s]+)/);
      const rutaMatch = mainPart.match(/\(Ruta:\s*([^,]+)/);
      const sentidoMatch = mainPart.match(/Sentido:\s*([^)]+)/);
      const puntoMatch = mainPart.match(/cruzó punto de control:\s*"([^"]+)"/);

      if (!cocheMatch || !rutaMatch || !sentidoMatch || !puntoMatch) return null;

      const coche = cocheMatch[1].replace('db-', '');
      const ruta = rutaMatch[1];
      const sentido = sentidoMatch[1].trim();
      const punto = puntoMatch[1];

      const plan = parts[1].replace('Plan:', '').trim();
      const real = parts[2].replace('Real:', '').trim();
      const desvio = parts[3].replace('Desvío:', '').trim();

      let type: 'en-hora' | 'demorado' | 'adelantado' = 'en-hora';
      if (desvio.includes('demorado')) {
        type = 'demorado';
      } else if (desvio.includes('adelantado')) {
        type = 'adelantado';
      }

      return {
        coche,
        ruta,
        sentido: sentido === 'ida' ? 'Ida' : 'Vuelta',
        punto,
        plan,
        real,
        desvio,
        type,
        raw: log
      };
    } catch (e) {
      console.error('Error parsing log message:', e);
      return null;
    }
  }, []);

  const filteredLogs = useMemo(() => {
    return simulationLogs
      .map(log => ({ raw: log, parsed: parseLogMessage(log) }))
      .filter(item => {
        if (logFilter === 'all') return true;
        if (!item.parsed) return logFilter === 'ontime';
        if (logFilter === 'delayed') return item.parsed.type === 'demorado';
        if (logFilter === 'ontime') return item.parsed.type === 'en-hora' || item.parsed.type === 'adelantado';
        return true;
      });
  }, [simulationLogs, logFilter, parseLogMessage]);

  const [isPWA, setIsPWA] = useState(false);
  useEffect(() => {
    const checkPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsPWA(checkPWA);
  }, []);

  useEffect(() => {
    const fetchExceptions = async () => {
      try {
        const baseUrl = getApiBaseUrl();
        const token = await getPublicToken(baseUrl);
        const signedHeaders = await getSignedHeaders('GET', '/catalog/public/data', token);
        console.log("📝 [fetchExceptions] Requesting /catalog/public/data");
        const res = await fetch(`${baseUrl}/catalog/public/data?summary=true&t=${Date.now()}`, {
          headers: signedHeaders
        });
        
        let json;
        if (res.ok) {
          json = await res.json();
        } else {
          console.warn(`[fetchExceptions] /catalog/public/data failed with status ${res.status}. Falling back to /calendar_exceptions...`);
          // Fallback para desarrollo local
          const fallbackRes = await fetch(`${baseUrl}/calendar_exceptions?t=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            json = { calendarExceptions: fallbackData };
          } else {
            console.error("[fetchExceptions] Fallback also failed:", fallbackRes.status);
          }
        }

        if (json && json.calendarExceptions) {
          console.log("📥 [App] Excepciones de calendario cargadas:", json.calendarExceptions);
          setCalendarExceptions(json.calendarExceptions);
        }
      } catch (err) {
        console.warn("Failed to fetch calendar exceptions:", err);
      }
    };
    fetchExceptions();
  }, []);

  const [offlineDownloaderOpen, setOfflineDownloaderOpen] = useState(false);
  const [isCollaborativeGpsActive, setIsCollaborativeGpsActive] = useState(false);
  const [showCollaborativeModal, setShowCollaborativeModal] = useState(false);

  // Límite de 50 minutos para el GPS Colaborativo (auto-desactivación)
  useEffect(() => {
    if (isCollaborativeGpsActive) {
      const COLLABORATIVE_TIMEOUT_MS = 50 * 60 * 1000; // 50 minutos
      const timer = setTimeout(() => {
        console.log("⏱️ [GPS Colaborativo] Límite de 50 minutos alcanzado. Desactivando automáticamente.");
        setIsCollaborativeGpsActive(false);
      }, COLLABORATIVE_TIMEOUT_MS);

      return () => clearTimeout(timer);
    }
  }, [isCollaborativeGpsActive]);

  // Estados y lógica para el Buscador de Direcciones en la Sidebar
  const [showAddressSearch, setShowAddressSearch] = useState(() => {
    const stored = localStorage.getItem('collie_show_address_search');
    return stored !== null ? stored === 'true' : false;
  });
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [searchQueryText, setSearchQueryText] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setSearchResults([]);
      return;
    }
    if (!searchQueryText.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchLocation && searchQueryText === searchLocation.name) {
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearchLoading(true);
      try {
        const viewbox = '-59.15,-34.05,-58.90,-34.15';
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQueryText)}&format=json&limit=5&countrycodes=ar&accept-language=es&viewbox=${viewbox}&bounded=1`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setSearchResults(data);
          } else {
            setSearchResults([]);
          }
        }
      } catch (err) {
        console.error('Error fetching Nominatim autocomplete:', err);
      } finally {
        setIsSearchLoading(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [searchQueryText, searchLocation, isAdmin]);

  const fetchAvailableLines = useCallback(async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const token = await getPublicToken(baseUrl);
      const res = await fetch(`${baseUrl}/catalog/public/lines?t=${Date.now()}`, {
        headers: await getSignedHeaders('GET', '/catalog/public/lines', token)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.lines) {
          console.log("📥 [App] Líneas disponibles cargadas desde el BFF:", json.lines);
          setAvailableLines(json.lines);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch available lines from BFF:", err);
    }
  }, []);

  useEffect(() => {
    fetchAvailableLines();
  }, [fetchAvailableLines]);

  useEffect(() => {
    if (!searchQuery) {
      setBffRoutes([]);
      return;
    }

    const loadBffRoutes = async () => {
      setIsBffLoading(true);
      const candidates = [
        getApiBaseUrl(),
        'http://localhost:6005/v1'
      ].filter((u): u is string => Boolean(u));
      const uniqueCandidates = Array.from(new Set(candidates));

      for (const targetUrl of uniqueCandidates) {
        try {
          const cleanUrl = targetUrl.replace(/\/$/, '');
          const token = await getPublicToken(cleanUrl);
          
          console.log(`📡 [App] Solicitando rutas del BFF para la línea: ${searchQuery} a ${cleanUrl}...`);
          const res = await fetch(`${cleanUrl}/catalog/public/data?company=${searchQuery}&summary=true&t=${Date.now()}`, {
            headers: await getSignedHeaders('GET', '/catalog/public/data', token)
          });
          
          if (res.ok) {
            const json = await res.json();
            if (json && json.routes) {
              console.log(`📥 [App] Cargadas ${json.routes.length} rutas del BFF para: ${searchQuery}`);
              setBffRoutes(json.routes);
              setIsBffLoading(false);
              return;
            }
          }
        } catch (err) {
          console.warn("Failed candidate in loadBffRoutes:", targetUrl, err);
        }
      }
      setIsBffLoading(false);
    };

    loadBffRoutes();
  }, [searchQuery]);

  const transitRoutes = useMemo(() => {
    let routes = [...bffRoutes];
    
    // Inyectar favoritas que no estén ya en routes
    favoriteRoutes.forEach((fav: any) => {
      if (!routes.some((r: any) => r.id === fav.id)) {
        routes.push(fav);
      }
    });

    if (routes.length === 0 && config.all_routes_state && config.all_routes_state.length > 0) {
      routes = [...config.all_routes_state];
    }

    // Enriquecer con los trazados y paradas detalladas
    routes = routes.map((r: any) => {
      const detail = detailedRoutes[r.id];
      if (detail) {
        let schedulesObj = detail.schedules || {};
        if (detail.schedulesList && Object.keys(schedulesObj).length === 0) {
          detail.schedulesList.forEach((item: any) => {
            if (item.schedules) {
              schedulesObj = {
                ...schedulesObj,
                ...item.schedules
              };
            }
          });
        }
        return {
          ...r,
          directions: detail.directions || r.directions,
          stops: detail.stops || r.stops,
          waypoints: detail.waypoints || r.waypoints,
          schedules: schedulesObj,
          schedulesList: detail.schedulesList
        };
      }
      return r;
    });

    const enabledRoutes = config.enabled_routes || [];
    if (enabledRoutes.length > 0) {
      const enabledCodes = new Set(
          (config.all_routes_state || [])
            .filter(rs => enabledRoutes.includes(rs.id))
            .map(rs => rs.code)
      );
      routes = routes.filter(r => r.id.startsWith('redsube-') || enabledRoutes.includes(r.id) || enabledCodes.has(r.code));
    }
    return routes.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [detailedRoutes, config.enabled_routes, config.all_routes_state, bffRoutes, favoriteRoutes]);

  const getRouteColor = (route: any, index: number) => {
    if (route?.color) return route.color;
    
    const code = route?.code || '';
    const match = code.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      const colorIndex = (num - 1) % ROUTE_COLORS_PALETTE.length;
      if (colorIndex >= 0 && colorIndex < ROUTE_COLORS_PALETTE.length) {
        return ROUTE_COLORS_PALETTE[colorIndex];
      }
    }
    return ROUTE_COLORS_PALETTE[index % ROUTE_COLORS_PALETTE.length] || '#3b82f6';
  };

  // Las rutas deben mantener el color original (predeterminado) que tenían antes de ser seleccionadas
  const enrichedTransitRoutes = useMemo(() => {
    return transitRoutes.map((r: any, idx: number) => ({
      ...r,
      color: getRouteColor(r, idx)
    }));
  }, [transitRoutes]);

  // Auto-seleccionar todas las rutas de SIT si mock_gps está activo en la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mock_gps') && enrichedTransitRoutes && enrichedTransitRoutes.length > 0) {
      setSelectedRouteIds(prev => {
        if (prev.size > 0) return prev;
        const newSet = new Set<string>();
        enrichedTransitRoutes.forEach((r: any) => {
          if (r.company === 'SIT' || r.agencyId === 'SIT' || getLineName(r) === 'SIT') {
            newSet.add(r.id);
          }
        });
        return newSet;
      });
      setVisibleRouteIds(prev => {
        if (prev.size > 0) return prev;
        const newSet = new Set<string>();
        enrichedTransitRoutes.forEach((r: any) => {
          if (r.company === 'SIT' || r.agencyId === 'SIT' || getLineName(r) === 'SIT') {
            newSet.add(r.id);
          }
        });
        return newSet;
      });

      enrichedTransitRoutes.forEach((r: any) => {
        if (r.company === 'SIT' || r.agencyId === 'SIT' || getLineName(r) === 'SIT') {
          setRouteShowIda(prev => ({ ...prev, [r.id]: true }));
          setRouteShowVuelta(prev => ({ ...prev, [r.id]: true }));
          setRouteStopsIda(prev => ({ ...prev, [r.id]: true }));
          setRouteStopsVuelta(prev => ({ ...prev, [r.id]: true }));
          setRouteBusesIda(prev => ({ ...prev, [r.id]: true }));
          setRouteBusesVuelta(prev => ({ ...prev, [r.id]: true }));
        }
      });
    }
  }, [enrichedTransitRoutes]);
  const handleRefreshActiveRoutes = useCallback(async () => {
    // Si no hay ninguna línea seleccionada en el combo, refrescar el listado de líneas disponibles
    if (!searchQuery) {
      setIsRefreshing(true);
      try {
        await fetchAvailableLines();
        console.log("📥 [App] Líneas disponibles refrescadas con éxito.");
      } finally {
        setIsRefreshing(false);
      }
      return;
    }

    if (selectedRouteIds.size === 0) {
      // Si hay una línea seleccionada en el combo pero no tiene ramales activos seleccionados,
      // refrescamos las rutas del BFF para esa línea
      setIsRefreshing(true);
      try {
        const baseUrl = getApiBaseUrl();
        const token = await getPublicToken(baseUrl);
        
        console.log(`📡 [App] Forzando refresco de rutas del BFF para la línea: ${searchQuery}...`);
        const res = await fetch(`${baseUrl}/catalog/public/data?company=${searchQuery}&summary=true&t=${Date.now()}`, {
          headers: await getSignedHeaders('GET', '/catalog/public/data', token)
        });
        
        if (res.ok) {
          const json = await res.json();
          if (json && json.routes) {
            console.log(`📥 [App] Refrescadas ${json.routes.length} rutas del BFF para: ${searchQuery}`);
            setBffRoutes(json.routes);
          }
        }
      } catch (err) {
        console.warn("Failed to refresh routes from BFF for company:", err);
      } finally {
        setIsRefreshing(false);
      }
      return;
    }
    
    setIsRefreshing(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = await getPublicToken(baseUrl);
      
      const idsToRefresh = Array.from(selectedRouteIds);
      console.log("🔄 [App] Forzando refresco de rutas en local:", idsToRefresh);

      for (const id of idsToRefresh) {
        const cacheKey = `collie_route_cache_${id}`;
        try {
          localStorage.removeItem(cacheKey);
        } catch (e) {}

        const resData = await fetch(`${baseUrl}/catalog/public/data?ids=${id}&t=${Date.now()}`, {
          headers: await getSignedHeaders('GET', '/catalog/public/data', token)
        });
        
        if (!resData.ok) continue;
        const jsonData = await resData.json();
        const routeData = jsonData?.routes?.[0];
        if (!routeData) continue;

        let routeIdParam = id;
        if (routeData.id.startsWith('redsube-')) {
          routeIdParam = routeData.id;
        } else {
          routeIdParam = routeData.code || routeData.id;
        }

        let sourceParam = '';
        if (getLineName(routeData) === 'SIT' || routeData.code === 'SIT' || (routeData.id && routeData.id.includes('SIT')) || routeData.code?.startsWith('RZ')) {
          sourceParam = '&source=ActiveSchedules';
        }

        const resTimetable = await fetch(`${baseUrl}/catalog/public/timetables?route_id=${routeIdParam}${sourceParam}`, {
          headers: await getSignedHeaders('GET', '/catalog/public/timetables', token)
        });
        
        let schedulesData = [];
        if (resTimetable.ok) {
          const jsonTimetable = await resTimetable.json();
          if (jsonTimetable.success && jsonTimetable.data) {
            schedulesData = jsonTimetable.data;
          }
        }

        const consolidated = {
          ...routeData,
          schedulesList: schedulesData
        };

        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: consolidated
          }));
        } catch (e) {}

        setDetailedRoutes(prev => ({ ...prev, [id]: consolidated }));
      }
      
      console.log("✅ [App] Refresco completado con éxito.");
    } catch (e) {
      console.warn("Failed to refresh active routes:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedRouteIds, searchQuery, fetchAvailableLines]);

  useEffect(() => {
    if (limitAlert) {
      const timer = setTimeout(() => setLimitAlert(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [limitAlert]);
  const [expandedBanner, setExpandedBanner] = useState<{slot: number, banner: number} | null>(null);
  const [infoModal, setInfoModal] = useState<'privacy' | 'terms' | 'pricing' | 'advertising_prices' | 'download' | null>(null);
  const [showTermsAcceptance, setShowTermsAcceptance] = useState<boolean>(false);
  const [termsChecked, setTermsChecked] = useState<boolean>(false);

  useEffect(() => {
    if (config && config.privacy_terms_enabled) {
      const acceptedVersion = localStorage.getItem('collie_accepted_terms_version');
      const currentVersion = config.privacy_terms_version || 'v1';
      if (acceptedVersion !== currentVersion) {
        setShowTermsAcceptance(true);
      }
    }
  }, [config]);

  const handleAcceptTerms = () => {
    const currentVersion = config.privacy_terms_version || 'v1';
    localStorage.setItem('collie_accepted_terms_version', currentVersion);
    setShowTermsAcceptance(false);
  };
  const deviceType = useMemo(() => {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    if (/android/i.test(ua)) {
      return 'android';
    }
    if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
      return 'ios';
    }
    return 'browser';
  }, []);

  const isPwaRunning = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (navigator as any).standalone === true;
    return isStandalone || isIOSStandalone;
  }, []);

  const handleInstallPWA = async () => {
    const promptEvent = (window as any).deferredPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        (window as any).deferredPrompt = null;
      }
    }
  };

  const [focusedRouteBounds, setFocusedRouteBounds] = useState<{ bounds: [number, number][], t: number } | null>(null);
  const [showRouteArrows, setShowRouteArrows] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('collie_admin_token') === null && localStorage.getItem('developer_bypass') !== 'true') {
      return true; // Forzar activo para no admin
    }
    const stored = localStorage.getItem('collie_show_route_arrows');
    return stored !== null ? stored === 'true' : false;
  });
  const [mapStyle, setMapStyle] = useState<'argenmap' | 'cartodb' | 'osm'>('argenmap');
  const [showStartEndMarkers, setShowStartEndMarkers] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('collie_admin_token') === null && localStorage.getItem('developer_bypass') !== 'true') {
      return true; // Forzar activo para no admin
    }
    const stored = localStorage.getItem('collie_show_start_end_markers');
    return stored !== null ? stored === 'true' : true;
  });
  const [showVehicleLabels, setShowVehicleLabels] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('collie_admin_token') === null && localStorage.getItem('developer_bypass') !== 'true') {
      return true; // Forzar activo para no admin
    }
    const stored = localStorage.getItem('collie_show_vehicle_labels');
    return stored !== null ? stored === 'true' : true;
  });
  const isMobile = useIsMobile();
  const windowWidth = useWindowWidth();
  const isTablet = windowWidth >= 768 && windowWidth < 1150;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchingRouteIds = useRef<Set<string>>(new Set());
  const mobileControlsRef = useRef<HTMLDivElement>(null);
  const desktopControlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('collie_show_favorites_only', String(showFavoritesOnly));
  }, [showFavoritesOnly]);

  useEffect(() => {
    if (showFavoritesOnly && favorites.size === 0 && searchQuery.trim() !== '') {
      setShowFavoritesOnly(false);
    }
  }, [searchQuery, favorites, showFavoritesOnly]);

  useEffect(() => {
    localStorage.setItem('collie_select_both_directions', String(selectBothDirections));
  }, [selectBothDirections]);

  useEffect(() => {
    localStorage.setItem('collie_show_stops', String(showStops));
  }, [showStops]);

  useEffect(() => {
    localStorage.setItem('collie_show_stop_projections', String(showStopProjections));
  }, [showStopProjections]);

  useEffect(() => {
    localStorage.setItem('collie_show_user_location', String(showUserLocation));
  }, [showUserLocation]);

  useEffect(() => {
    localStorage.setItem('collie_show_waypoints', String(showWaypoints));
  }, [showWaypoints]);

  useEffect(() => {
    localStorage.setItem('collie_show_address_search', String(showAddressSearch));
  }, [showAddressSearch]);

  useEffect(() => {
    localStorage.setItem('collie_show_route_arrows', String(showRouteArrows));
  }, [showRouteArrows]);



  useEffect(() => {
    localStorage.setItem('collie_show_start_end_markers', String(showStartEndMarkers));
  }, [showStartEndMarkers]);

  useEffect(() => {
    localStorage.setItem('collie_show_vehicle_labels', String(showVehicleLabels));
  }, [showVehicleLabels]);

  const setupDragScroll = (ref: React.RefObject<HTMLDivElement | null>) => {
    const handleMouseDown = (e: React.MouseEvent) => {
      if (!ref.current) return;
      const el = ref.current;
      el.dataset.isDown = 'true';
      el.dataset.startX = String(e.pageX - el.offsetLeft);
      el.dataset.scrollLeft = String(el.scrollLeft);
      el.style.cursor = 'grabbing';
      el.style.scrollBehavior = 'auto';
    };

    const handleMouseLeave = () => {
      if (!ref.current) return;
      const el = ref.current;
      el.dataset.isDown = 'false';
      el.style.cursor = 'grab';
      el.style.scrollBehavior = 'smooth';
    };

    const handleMouseUp = () => {
      if (!ref.current) return;
      const el = ref.current;
      el.dataset.isDown = 'false';
      el.style.cursor = 'grab';
      el.style.scrollBehavior = 'smooth';
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!ref.current) return;
      const el = ref.current;
      if (el.dataset.isDown !== 'true') return;
      e.preventDefault();
      const startX = parseFloat(el.dataset.startX || '0');
      const scrollLeft = parseFloat(el.dataset.scrollLeft || '0');
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5;
      el.scrollLeft = scrollLeft - walk;
    };

    return {
      onMouseDown: handleMouseDown,
      onMouseLeave: handleMouseLeave,
      onMouseUp: handleMouseUp,
      onMouseMove: handleMouseMove,
      style: { cursor: 'grab' }
    };
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setLineDropdownOpen(false);
      }
    };
    if (lineDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [lineDropdownOpen]);

  const dynamicBanners: any[][] = useMemo(() => {
    if (ads.length > 0) {
      const mid = Math.ceil(ads.length / 2);
      return [ads.slice(0, mid), ads.slice(mid)];
    }
    return CAROUSEL_BANNERS;
  }, [ads]);

  useEffect(() => {
    let tick = 0;
    const interval = setInterval(() => {
      const slotToMove = tick % 2;
      setBannerStates(prev => {
        const next = [...prev];
        if (dynamicBanners[slotToMove] && dynamicBanners[slotToMove].length > 0) {
          next[slotToMove] = (next[slotToMove] + 1) % dynamicBanners[slotToMove].length;
        }
        return next;
      });
      tick++;
    }, 8000);
    return () => clearInterval(interval);
  }, [dynamicBanners]);
  
  // Dynamic OTA Data

  useEffect(() => {
    if (!viewingSchedule) {
      setTimetableDetail(null);
      return;
    }

    const loadTimetable = async () => {
      setIsTimetableLoading(true);
      try {
        const route = transitRoutes.find((r: any) => r.code === viewingSchedule || r.id === viewingSchedule);
        
        const baseUrl = getApiBaseUrl();
        let routeIdParam = viewingSchedule;
        if (route) {
          routeIdParam = route.id || route.code;
        }

        // 1. Verificar si está guardado en la caché en memoria del cliente (10 minutos)
        const cachedClientData = getClientCachedTimetable(routeIdParam);
        if (cachedClientData) {
          setTimetableDetail(cachedClientData);
          setIsTimetableLoading(false);
          return;
        }

        // 2. Si expiró o no existe en cliente, consultar al backend (que consulta la caché KV del servidor / CDN)
        const token = await getPublicToken(baseUrl);
        const res = await fetch(`${baseUrl}/catalog/public/timetables?route_id=${routeIdParam}`, {
          headers: await getSignedHeaders('GET', '/catalog/public/timetables', token)
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const hasSchedules = json.data.some((item: any) => item.schedules && Object.keys(item.schedules).length > 0);
            let consolidatedRoute: any;
            if (hasSchedules) {
              consolidatedRoute = route ? { ...route, schedules: {} } : { id: routeIdParam, code: routeIdParam, schedules: {} };
              json.data.forEach((item: any) => {
                if (item.schedules) {
                  consolidatedRoute.schedules = {
                    ...consolidatedRoute.schedules,
                    ...item.schedules
                  };
                }
              });
            } else {
              consolidatedRoute = route || { id: routeIdParam, code: routeIdParam, schedules: {} };
            }
            // Guardar en la caché en memoria del cliente por 10 minutos
            setClientCachedTimetable(routeIdParam, consolidatedRoute);
            setTimetableDetail(consolidatedRoute);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch timetable details:', err);
      } finally {
        setIsTimetableLoading(false);
      }
    };

    loadTimetable();
  }, [viewingSchedule, detailedRoutes, transitRoutes]);



  useEffect(() => {
    const expandedRouteIds = new Set<string>();
    Object.entries(expandedLines).forEach(([line, isExpanded]) => {
      if (isExpanded) {
        const lineRoutes = transitRoutes.filter((r: any) => getLineName(r) === line);
        lineRoutes.forEach((r: any) => expandedRouteIds.add(r.id));
      }
    });

    const idsToLoad = new Set([
      ...Array.from(selectedRouteIds),
      ...Array.from(expandedRouteIds)
    ]);

    if (idsToLoad.size === 0) return;

    const missingIds = Array.from(idsToLoad).filter(id => !detailedRoutes[id] && !fetchingRouteIds.current.has(id));
    if (missingIds.length === 0) return;

    // Registrar sincrónicamente para evitar condiciones de carrera ante renders concurrentes
    missingIds.forEach(id => fetchingRouteIds.current.add(id));

    const fetchDetailedRoutes = async () => {
      try {
        const baseUrl = getApiBaseUrl();
        const token = await getPublicToken(baseUrl);
        
        for (const id of missingIds) {
          const cacheKey = `collie_route_cache_${id}`;
          try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed && parsed.data && parsed.data.directions) {
                const cacheDuration = window.location.hostname === 'localhost' ? 0 : 3600000; // 0 en local, 1 hora en producción
                const isExpired = parsed.timestamp ? (Date.now() - parsed.timestamp > cacheDuration) : true;
                const hasSchedules = parsed.data.schedulesList && parsed.data.schedulesList.length > 0;
                
                if (!isExpired && hasSchedules) {
                  console.log(`📦 [App] Cargando ruta ${id} desde la caché local.`);
                  setDetailedRoutes(prev => ({ ...prev, [id]: parsed.data }));
                  continue;
                } else {
                  console.log(`📦 [App] La caché local para la ruta ${id} ha expirado o no contiene horarios. Forzando recarga.`);
                }
              }
            }
          } catch (e) {
            // Ignorar errores de storage
          }

          console.log(`📡 [App] Solicitando detalles cartográficos y horarios para ${id} al servidor...`);
          
          try {
            const resData = await fetch(`${baseUrl}/catalog/public/data?ids=${id}&t=${Date.now()}`, {
              headers: await getSignedHeaders('GET', '/catalog/public/data', token)
            });
            
            if (!resData.ok) {
              setTimeout(() => {
                fetchingRouteIds.current.delete(id);
              }, 5000);
              continue;
            }
            const jsonData = await resData.json();
            const routeData = jsonData?.routes?.[0];
            if (!routeData) {
              setTimeout(() => {
                fetchingRouteIds.current.delete(id);
              }, 5000);
              continue;
            }

            let routeIdParam = id;
            if (routeData.id.startsWith('redsube-')) {
              routeIdParam = routeData.id;
            } else {
              routeIdParam = routeData.code || routeData.id;
            }

            let sourceParam = '';
            if (getLineName(routeData) === 'SIT' || routeData.code === 'SIT' || (routeData.id && routeData.id.includes('SIT')) || routeData.code?.startsWith('RZ')) {
              sourceParam = '&source=ActiveSchedules';
            }

            const resTimetable = await fetch(`${baseUrl}/catalog/public/timetables?route_id=${routeIdParam}${sourceParam}`, {
              headers: await getSignedHeaders('GET', '/catalog/public/timetables', token)
            });
            
            let schedulesData = [];
            if (resTimetable.ok) {
              const jsonTimetable = await resTimetable.json();
              if (jsonTimetable.success && jsonTimetable.data) {
                schedulesData = jsonTimetable.data;
              }
            }

            const consolidated = {
              ...routeData,
              schedulesList: schedulesData
            };

            try {
              localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: consolidated
              }));
            } catch (e) {
              // Ignorar
            }

            setDetailedRoutes(prev => ({ ...prev, [id]: consolidated }));
          } catch (fetchErr) {
            console.warn(`Failed fetch for route ${id}:`, fetchErr);
            setTimeout(() => {
              fetchingRouteIds.current.delete(id);
            }, 5000);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch detailed route data:', err);
      }
    };

    fetchDetailedRoutes();
  }, [selectedRouteIds, detailedRoutes, expandedLines, transitRoutes]);


  // Las constantes de rutas se movieron arriba para evitar TDZ

  const displayedRouteIds = useMemo(() => {
    const union = new Set<string>(selectedRouteIds);
    favorites.forEach(id => union.add(id));
    return union;
  }, [selectedRouteIds, favorites]);

  const displayedRoutes = useMemo(() => {
    return enrichedTransitRoutes.filter((r: any) => displayedRouteIds.has(r.id));
  }, [enrichedTransitRoutes, displayedRouteIds]);

  const lineFilteredRoutes = useMemo(() => {
    if (!lineFilter) return [];
    return enrichedTransitRoutes.filter((r: any) => getLineName(r) === lineFilter);
  }, [enrichedTransitRoutes, lineFilter]);



  const transitStops = useMemo(() => {
    const allStops: any[] = [];
    const seen = new Set<string>();

    if (enrichedTransitRoutes) {
      enrichedTransitRoutes.forEach((r: any) => {
        if (r.stops) {
          r.stops.forEach((s: any) => {
            const stopColor = s.color || r.color || '';
            const key = `${s.lat}-${s.lng}-${s.direction}-${stopColor}-${r.id}`;
            if (!seen.has(key)) {
              seen.add(key);
              allStops.push({
                ...s,
                color: stopColor,
                routeId: r.id
              });
            }
          });
        }
      });
    }

    return allStops;
  }, [enrichedTransitRoutes]);






  const routesByLine = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const publishedLines = availableLines && availableLines.length > 0 ? availableLines : ['SIT'];

    publishedLines.forEach(line => {
      const lineRoutes = enrichedTransitRoutes.filter((r: any) => getLineName(r) === line);
      if (lineRoutes.length > 0) {
        groups[line] = lineRoutes;
      }
    });
    return groups;
  }, [availableLines, enrichedTransitRoutes]);

  const filteredRoutesByLine = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filterFavorites = (groups: Record<string, any[]>) => {
      const favs: Record<string, any[]> = {};
      Object.entries(groups).forEach(([line, routes]) => {
        const matchingRoutes = routes.filter((r: any) => favorites.has(r.id));
        if (matchingRoutes.length > 0) {
          favs[line] = matchingRoutes;
        }
      });
      return favs;
    };

    if (showFavoritesOnly) {
      // Al mostrar favoritos, ignorar el query para mostrar favoritos de forma global
      return filterFavorites(routesByLine);
    }

    if (!query) {
      return {};
    }

    const filtered: Record<string, any[]> = {};
    Object.entries(routesByLine).forEach(([line, routes]) => {
      const matchingRoutes = routes.filter((r: any) => {
        const nameMatch = r.name ? r.name.toLowerCase().includes(query) : false;
        const codeMatch = r.code ? r.code.toLowerCase().includes(query) : false;
        const lineMatch = line ? line.toLowerCase().includes(query) : false;
        const isSIT = r.code?.toLowerCase().startsWith('rz') || r.id?.toLowerCase().includes('sit');
        const sitMatch = isSIT && ('sit'.includes(query) || 'sistema integrado de transporte'.includes(query));
        return nameMatch || codeMatch || lineMatch || sitMatch;
      });
      if (matchingRoutes.length > 0) {
        filtered[line] = matchingRoutes;
      }
    });
    return filtered;
  }, [routesByLine, searchQuery, showFavoritesOnly, favorites]);

  const filteredSelectedRouteIds = useMemo(() => {
    if (showFavoritesOnly) return favorites;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return selectedRouteIds;

    const matchingRouteIds = new Set<string>();
    Object.values(filteredRoutesByLine).forEach(routes => {
      routes.forEach(r => matchingRouteIds.add(r.id));
    });

    return new Set(Array.from(selectedRouteIds).filter(id => matchingRouteIds.has(id)));
  }, [selectedRouteIds, filteredRoutesByLine, searchQuery, showFavoritesOnly, favorites]);

  const filteredVisibleRouteIds = useMemo(() => {
    if (showFavoritesOnly) return favorites;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return visibleRouteIds;

    const matchingRouteIds = new Set<string>();
    Object.values(filteredRoutesByLine).forEach(routes => {
      routes.forEach(r => matchingRouteIds.add(r.id));
    });

    return new Set(Array.from(visibleRouteIds).filter(id => matchingRouteIds.has(id)));
  }, [visibleRouteIds, filteredRoutesByLine, searchQuery, showFavoritesOnly, favorites]);

  const allCurrentRoutes = useMemo(() => {
    return Object.values(filteredRoutesByLine).flat();
  }, [filteredRoutesByLine]);

  const areAllCurrentSelected = useMemo(() => {
    if (allCurrentRoutes.length === 0) return false;
    return allCurrentRoutes.every((r: any) => selectedRouteIds.has(r.id) && visibleRouteIds.has(r.id));
  }, [allCurrentRoutes, selectedRouteIds, visibleRouteIds]);

  const toggleSelectAllCurrent = () => {
    if (areAllCurrentSelected) {
      setSelectedRouteIds(prev => {
        const next = new Set(prev);
        allCurrentRoutes.forEach((r: any) => next.delete(r.id));
        return next;
      });
      setVisibleRouteIds(prev => {
        const next = new Set(prev);
        allCurrentRoutes.forEach((r: any) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedRouteIds(prev => {
        const next = new Set(prev);
        allCurrentRoutes.forEach((r: any) => next.add(r.id));
        return next;
      });
      setVisibleRouteIds(prev => {
        const next = new Set(prev);
        allCurrentRoutes.forEach((r: any) => next.add(r.id));
        return next;
      });
      allCurrentRoutes.forEach((r: any) => {
        setRouteShowIda(prev => ({ ...prev, [r.id]: true }));
        setRouteShowVuelta(prev => ({ ...prev, [r.id]: true }));
        setRouteStopsIda(prev => ({ ...prev, [r.id]: true }));
        setRouteStopsVuelta(prev => ({ ...prev, [r.id]: true }));
        setRouteBusesIda(prev => ({ ...prev, [r.id]: true }));
        setRouteBusesVuelta(prev => ({ ...prev, [r.id]: true }));
      });
    }
  };

  const prevSearchQueryRef = useRef('');

  useEffect(() => {
    const prevQuery = prevSearchQueryRef.current.trim().toLowerCase();
    const query = searchQuery.trim().toLowerCase();

    if (query !== prevQuery) {
      if (query.length > 0) {
        const keys = Object.keys(filteredRoutesByLine);
        setExpandedLines(prev => {
          const next = { ...prev };
          keys.forEach(k => {
            next[k] = true;
          });
          return next;
        });

        // Auto-seleccionar primer recorrido de la línea si no es admin
        if (!isAdmin) {
          const firstCompanyKey = keys.find(k => k.toLowerCase() === query || (filteredRoutesByLine[k] && filteredRoutesByLine[k].length > 0));
          if (firstCompanyKey) {
            const firstRoute = filteredRoutesByLine[firstCompanyKey][0];
            if (firstRoute) {
              selectRoute(firstRoute.id);
              setExpandedRouteId(firstRoute.id);
            }
          }
        }
      } else {
        // Si no se realiza ninguna búsqueda (se acaba de limpiar), no se tiene que mostrar ninguna línea en el mapa
        setSelectedRouteIds(prev => {
          if (prev.size === 0) return prev;
          return new Set();
        });
        setVisibleRouteIds(prev => {
          if (prev.size === 0) return prev;
          return new Set();
        });
        setExpandedRouteId(null);
      }
      prevSearchQueryRef.current = searchQuery;
    }
  }, [searchQuery, filteredRoutesByLine, isAdmin]);

  const selectRoute = (routeId: string) => {
    setLastSelectedRouteId(routeId);
    if (!isAdmin && !config?.anonymous_selection_enabled) {
      setSelectedRouteIds(new Set([routeId]));
      setVisibleRouteIds(new Set([routeId]));
      setExpandedRouteId(routeId); // Expandir al seleccionar
      if (!selectBothDirections && !config?.anonymous_selection_enabled) {
        setRouteShowIda({[routeId]: true});
        setRouteShowVuelta({[routeId]: false});
        setRouteStopsIda({[routeId]: true});
        setRouteStopsVuelta({[routeId]: false});
        setRouteBusesIda({[routeId]: true});
        setRouteBusesVuelta({[routeId]: false});
      } else {
        setRouteShowIda({[routeId]: true});
        setRouteShowVuelta({[routeId]: true});
        setRouteStopsIda({[routeId]: true});
        setRouteStopsVuelta({[routeId]: true});
        setRouteBusesIda({[routeId]: true});
        setRouteBusesVuelta({[routeId]: true});
      }
      return;
    }

    const isSelected = selectedRouteIds.has(routeId);
    if (!isSelected) {
      if (selectedRouteIds.size >= MAX_SELECTED_RAMALES) {
        setLimitAlert(true);
        return;
      }
      setSelectedRouteIds(prev => {
        const next = new Set(prev);
        next.add(routeId);
        return next;
      });
      setVisibleRouteIds(prev => {
        const next = new Set(prev);
        next.add(routeId);
        return next;
      });
      const route = transitRoutes.find((r: any) => r.id === routeId);
      if (!selectBothDirections && !config?.anonymous_selection_enabled) {
        setRouteShowIda(prev => ({...prev, [routeId]: true}));
        setRouteShowVuelta(prev => ({...prev, [routeId]: false}));
        setRouteStopsIda(prev => ({...prev, [routeId]: true}));
        setRouteStopsVuelta(prev => ({...prev, [routeId]: false}));
        setRouteBusesIda(prev => ({...prev, [routeId]: true}));
        setRouteBusesVuelta(prev => ({...prev, [routeId]: false}));
      } else {
        setRouteShowIda(prev => ({...prev, [routeId]: true}));
        setRouteShowVuelta(prev => ({...prev, [routeId]: true}));
        setRouteStopsIda(prev => ({...prev, [routeId]: true}));
        setRouteStopsVuelta(prev => ({...prev, [routeId]: true}));
        setRouteBusesIda(prev => ({...prev, [routeId]: true}));
        setRouteBusesVuelta(prev => ({...prev, [routeId]: true}));
      }
    } else {
      if (!isAdmin && !config?.anonymous_selection_enabled) {
        // Si ya está seleccionado, permitir colapsar/expandir el acordeón en la barra lateral
        setExpandedRouteId(prev => prev === routeId ? null : routeId);
      } else {
        // Si la selección múltiple está activa (para admin o anónimo habilitado) y ya está seleccionado, deseleccionar
        setSelectedRouteIds(prev => {
          const next = new Set(prev);
          next.delete(routeId);
          return next;
        });
        setVisibleRouteIds(prev => {
          const next = new Set(prev);
          next.delete(routeId);
          return next;
        });
      }
    }
  };

  const toggleRoute = (routeId: string) => {
    const isSelected = selectedRouteIds.has(routeId);
    if (isSelected) {
      if (!isAdmin && !config?.anonymous_selection_enabled) {
        return; // Evitar deseleccionar para no-admins
      }
      setSelectedRouteIds(prev => {
        const next = new Set(prev);
        next.delete(routeId);
        return next;
      });
      setVisibleRouteIds(prev => {
        const next = new Set(prev);
        next.delete(routeId);
        return next;
      });
    } else {
      if (!isAdmin) {
        setSelectedRouteIds(new Set([routeId]));
        setVisibleRouteIds(new Set([routeId]));
        if (!selectBothDirections && !config?.anonymous_selection_enabled) {
          setRouteShowIda({[routeId]: true});
          setRouteShowVuelta({[routeId]: false});
          setRouteStopsIda({[routeId]: true});
          setRouteStopsVuelta({[routeId]: false});
          setRouteBusesIda({[routeId]: true});
          setRouteBusesVuelta({[routeId]: false});
        } else {
          setRouteShowIda({[routeId]: true});
          setRouteShowVuelta({[routeId]: true});
          setRouteStopsIda({[routeId]: true});
          setRouteStopsVuelta({[routeId]: true});
          setRouteBusesIda({[routeId]: true});
          setRouteBusesVuelta({[routeId]: true});
        }
        return;
      }
      if (selectedRouteIds.size >= MAX_SELECTED_RAMALES) {
        setLimitAlert(true);
        return;
      }
      setSelectedRouteIds(prev => {
        const next = new Set(prev);
        next.add(routeId);
        return next;
      });
      setVisibleRouteIds(prev => {
        const next = new Set(prev);
        next.add(routeId);
        return next;
      });
      const route = transitRoutes.find((r: any) => r.id === routeId);
      if (!selectBothDirections && !config?.anonymous_selection_enabled) {
        setRouteShowIda(prev => ({...prev, [routeId]: true}));
        setRouteShowVuelta(prev => ({...prev, [routeId]: false}));
        setRouteStopsIda(prev => ({...prev, [routeId]: true}));
        setRouteStopsVuelta(prev => ({...prev, [routeId]: false}));
        setRouteBusesIda(prev => ({...prev, [routeId]: true}));
        setRouteBusesVuelta(prev => ({...prev, [routeId]: false}));
      } else {
        setRouteShowIda(prev => ({...prev, [routeId]: true}));
        setRouteShowVuelta(prev => ({...prev, [routeId]: true}));
        setRouteStopsIda(prev => ({...prev, [routeId]: true}));
        setRouteStopsVuelta(prev => ({...prev, [routeId]: true}));
        setRouteBusesIda(prev => ({...prev, [routeId]: true}));
        setRouteBusesVuelta(prev => ({...prev, [routeId]: true}));
      }
    }
  };

  const toggleFavorite = (route: any) => {
    const routeId = route.id;
    const isFav = favorites.has(routeId);
    if (isFav) {
      setFavoriteRoutes(prev => {
        const next = prev.filter(r => r.id !== routeId);
        try {
          localStorage.setItem('collie_favorite_routes', JSON.stringify(next));
        } catch (e) {}
        return next;
      });
      if (!visibleRouteIds.has(routeId)) {
        setSelectedRouteIds(prev => {
          const next = new Set(prev);
          next.delete(routeId);
          return next;
        });
      }
    } else {
      setFavoriteRoutes(prev => {
        const next = [...prev, route];
        try {
          localStorage.setItem('collie_favorite_routes', JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }
  };

  const toggleVisibility = (routeId: string) => {
    const isVisible = visibleRouteIds.has(routeId);
    if (isVisible) {
      if (!isAdmin && !config?.anonymous_selection_enabled) {
        return; // Evitar ocultar para no-admins
      }
      setVisibleRouteIds(prev => {
        const next = new Set(prev);
        next.delete(routeId);
        return next;
      });
      if (!favorites.has(routeId)) {
        setSelectedRouteIds(prev => {
          const next = new Set(prev);
          next.delete(routeId);
          return next;
        });
      }
    } else {
      if (!isAdmin && !config?.anonymous_selection_enabled) {
        setSelectedRouteIds(new Set([routeId]));
        setVisibleRouteIds(new Set([routeId]));
        if (!selectBothDirections && !config?.anonymous_selection_enabled) {
          setRouteShowIda({[routeId]: true});
          setRouteShowVuelta({[routeId]: false});
          setRouteStopsIda({[routeId]: true});
          setRouteStopsVuelta({[routeId]: false});
          setRouteBusesIda({[routeId]: true});
          setRouteBusesVuelta({[routeId]: false});
        } else {
          setRouteShowIda({[routeId]: true});
          setRouteShowVuelta({[routeId]: true});
          setRouteStopsIda({[routeId]: true});
          setRouteStopsVuelta({[routeId]: true});
          setRouteBusesIda({[routeId]: true});
          setRouteBusesVuelta({[routeId]: true});
        }
        return;
      }
      if (selectedRouteIds.size >= MAX_SELECTED_RAMALES && !selectedRouteIds.has(routeId)) {
        setLimitAlert(true);
        return;
      }
      setVisibleRouteIds(prev => {
        const next = new Set(prev);
        next.add(routeId);
        return next;
      });
      setSelectedRouteIds(prev => {
        const next = new Set(prev);
        next.add(routeId);
        return next;
      });
      const route = transitRoutes.find((r: any) => r.id === routeId);
      if (!selectBothDirections && !config?.anonymous_selection_enabled) {
        setRouteShowIda(prevIda => ({...prevIda, [routeId]: true}));
        setRouteShowVuelta(prevVuelta => ({...prevVuelta, [routeId]: false}));
        setRouteStopsIda(prev => ({...prev, [routeId]: true}));
        setRouteStopsVuelta(prev => ({...prev, [routeId]: false}));
        setRouteBusesIda(prev => ({...prev, [routeId]: true}));
        setRouteBusesVuelta(prev => ({...prev, [routeId]: false}));
      } else {
        setRouteShowIda(prevIda => ({...prevIda, [routeId]: true}));
        setRouteShowVuelta(prevVuelta => ({...prevVuelta, [routeId]: true}));
        setRouteStopsIda(prev => ({...prev, [routeId]: true}));
        setRouteStopsVuelta(prev => ({...prev, [routeId]: true}));
        setRouteBusesIda(prev => ({...prev, [routeId]: true}));
        setRouteBusesVuelta(prev => ({...prev, [routeId]: true}));
      }
    }
  };

  const toggleDirection = (e: React.MouseEvent, routeId: string, dir: 'ida' | 'vuelta') => {
    e.stopPropagation();
    if (dir === 'ida') {
      const currentVal = routeShowIda[routeId] ?? true;
      if (!isAdmin && !config?.anonymous_selection_enabled && currentVal) {
        return; // Evitar desactivar si ya está activo para no-admins
      }
      const nextVal = !currentVal;
      setRouteShowIda(prev => ({...prev, [routeId]: nextVal}));
      setRouteStopsIda(prev => ({...prev, [routeId]: nextVal}));
      setRouteBusesIda(prev => ({...prev, [routeId]: nextVal}));
      
      if (nextVal && !selectBothDirections && !config?.anonymous_selection_enabled) {
        // Exclusividad: si se activa ida, se desactiva vuelta
        setRouteShowVuelta(prev => ({...prev, [routeId]: false}));
        setRouteStopsVuelta(prev => ({...prev, [routeId]: false}));
        setRouteBusesVuelta(prev => ({...prev, [routeId]: false}));
      }
      
      if (nextVal) {
        setVisibleRouteIds(prev => {
          const next = new Set(prev);
          next.add(routeId);
          return next;
        });
      }
    } else {
      const currentVal = routeShowVuelta[routeId] ?? true;
      if (!isAdmin && !config?.anonymous_selection_enabled && currentVal) {
        return; // Evitar desactivar si ya está activo para no-admins
      }
      const nextVal = !currentVal;
      setRouteShowVuelta(prev => ({...prev, [routeId]: nextVal}));
      setRouteStopsVuelta(prev => ({...prev, [routeId]: nextVal}));
      setRouteBusesVuelta(prev => ({...prev, [routeId]: nextVal}));
      
      if (nextVal && !selectBothDirections && !config?.anonymous_selection_enabled) {
        // Exclusividad: si se activa vuelta, se desactiva ida
        setRouteShowIda(prev => ({...prev, [routeId]: false}));
        setRouteStopsIda(prev => ({...prev, [routeId]: false}));
        setRouteBusesIda(prev => ({...prev, [routeId]: false}));
      }
      
      if (nextVal) {
        setVisibleRouteIds(prev => {
          const next = new Set(prev);
          next.add(routeId);
          return next;
        });
      }
    }
  };

  const toggleStops = (routeId: string, dir: 'ida' | 'vuelta') => {
    if (dir === 'ida') {
      setRouteStopsIda(prev => ({...prev, [routeId]: !(prev[routeId] ?? false)}));
    } else {
      setRouteStopsVuelta(prev => ({...prev, [routeId]: !(prev[routeId] ?? false)}));
    }
  };

  const toggleBuses = (routeId: string, dir: 'ida' | 'vuelta') => {
    if (dir === 'ida') {
      setRouteBusesIda(prev => ({...prev, [routeId]: !(prev[routeId] ?? true)}));
    } else {
      setRouteBusesVuelta(prev => ({...prev, [routeId]: !(prev[routeId] ?? true)}));
    }
  };

    const [lastSelectedRouteId, setLastSelectedRouteId] = useState<string | null>(null);

  const focusRoute = (route: any) => {
    if (route?.id) {
      setLastSelectedRouteId(route.id);
    }
    const allCoords: [number, number][] = [];
    route.directions?.forEach((d: any) => {
      const isVisible = d.direction === 'ida' ? (routeShowIda[route.id] ?? true) : (routeShowVuelta[route.id] ?? true);
      if (isVisible && d.coordinates) {
        allCoords.push(...d.coordinates);
      }
    });
    if (allCoords.length > 0) {
      setFocusedRouteBounds({ bounds: allCoords, t: Date.now() });
    }
  };

  const handleMiraClick = () => {
    let routeToFocus = null;
    if (lastSelectedRouteId) {
      routeToFocus = enrichedTransitRoutes.find((r: any) => r.id === lastSelectedRouteId);
    }
    if (!routeToFocus && expandedRouteId) {
      routeToFocus = enrichedTransitRoutes.find((r: any) => r.id === expandedRouteId);
    }
    if (!routeToFocus && selectedRouteIds.size > 0) {
      const selectedArray = Array.from(selectedRouteIds);
      const lastId = selectedArray[selectedArray.length - 1];
      routeToFocus = enrichedTransitRoutes.find((r: any) => r.id === lastId);
    }
    if (!routeToFocus && visibleRouteIds.size > 0) {
      const visibleArray = Array.from(visibleRouteIds);
      const firstId = visibleArray[0];
      routeToFocus = enrichedTransitRoutes.find((r: any) => r.id === firstId);
    }
    if (!routeToFocus && enrichedTransitRoutes && enrichedTransitRoutes.length > 0) {
      routeToFocus = enrichedTransitRoutes[0];
    }
    if (routeToFocus) {
      focusRoute(routeToFocus);
    }
  };

  const handleShareClick = () => {
    const shareMessage = `Hola! Bajate la app ¿Por dónde viene? Tu app de transportes. Consulta horarios y recorridos de colectivo que estas esperando.\nwww.pordondeviene.com.ar`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  const selectAll = () => setSelectedRouteIds(new Set());
  const hasFilter = selectedRouteIds.size > 0;

  const selectedRoutes = useMemo(
    () => enrichedTransitRoutes.filter((r: any) => selectedRouteIds.has(r.id)),
    [selectedRouteIds, enrichedTransitRoutes]
  );

  const [devAccess, setDevAccess] = useState(() => {
    // En producción o si el portal de desarrollo no está explícitamente activado, permitir acceso público directo
    if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_DEV_GATE !== 'true') {
      return true;
    }
    return localStorage.getItem('dev_access') === 'true';
  });
  const [devPassword, setDevPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // === EARLY RETURNS (must be after ALL hooks) ===
  if (currentPath === '/login') {
    return (
      <AdminLoginView 
        onLoginSuccess={(token) => {
          localStorage.setItem('collie_admin_token', token);
          window.location.href = '/';
        }}
        onCancel={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  if (!devAccess) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)', flexDirection: 'column', fontFamily: 'sans-serif' }}>
        <h2 style={{ marginBottom: '20px' }}>Entorno Protegido</h2>
        <div style={{ position: 'relative', marginBottom: '10px', width: '250px' }}>
          <input 
            type={showPassword ? "text" : "password"} 
            placeholder="Contraseña de acceso"
            value={devPassword}
            onChange={e => setDevPassword(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && devPassword === 'collie2026') {
                localStorage.setItem('dev_access', 'true');
                setDevAccess(true);
              }
            }}
            style={{ 
              padding: '12px 40px 12px 12px', 
              borderRadius: '8px', 
              border: '1px solid var(--border)', 
              width: '100%', 
              background: 'var(--bg-card)', 
              color: 'var(--text-primary)', 
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.6,
              transition: 'opacity 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.opacity = '1'}
            onMouseOut={e => e.currentTarget.style.opacity = '0.6'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <button 
          onClick={() => {
            if (devPassword === 'collie2026') {
              localStorage.setItem('dev_access', 'true');
              setDevAccess(true);
            } else {
              alert('Contraseña incorrecta');
            }
          }}
          style={{ padding: '12px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', width: '250px', fontWeight: 'bold' }}
        >
          Ingresar al Desarrollo
        </button>
      </div>
    );
  }



  const renderRouteCard = (route: any, idx: number) => {
    const isRouteSelected = selectedRouteIds.has(route.id);
    const isFavorite = favorites.has(route.id);
    const isVisible = visibleRouteIds.has(route.id);
    const routeBusesCount = liveBuses.filter((bus: any) => bus.routeId === route.id || bus.code === route.code).length;
    const isRealGpsBus = (bus: any) => bus && (bus.isGps === true || bus.is_gps === true) && bus.isSimulated !== true && bus.is_simulated !== true && !bus.id?.startsWith('sim-') && !bus.originalId?.startsWith('sim-');
    const routeMatchedGpsCount = liveBuses.filter((bus: any) => (bus.routeId === route.id || bus.code === route.code) && isRealGpsBus(bus)).length;
    const routeTotalGpsCount = liveBuses.filter((bus: any) => (bus.routeId === route.id || bus.code === route.code) && isRealGpsBus(bus)).length;
    const routeGpsText = isAdmin ? `${routeMatchedGpsCount}/${routeTotalGpsCount} GPS` : `${routeMatchedGpsCount > 0 ? routeMatchedGpsCount : routeTotalGpsCount} GPS`;
    const routeGpsStyle = routeTotalGpsCount === 0 
      ? { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }
      : (routeMatchedGpsCount < routeTotalGpsCount 
        ? { bg: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }
        : { bg: 'rgba(4, 120, 87, 0.15)', color: '#047857' });
    return (
      <div
        key={route.id}
        style={{
          width: '100%',
          padding: '8px 10px',
          marginBottom: '2px',
          background: `${route.color}08`,
          border: `1px solid ${route.color}25`,
          borderRadius: '8px',
          transition: 'all 0.2s',
          animation: `fadeInUp 0.3s ease ${idx * 0.05}s both`,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}
        onMouseOver={e => { e.currentTarget.style.background = `${route.color}15`; }}
        onMouseOut={e => { e.currentTarget.style.background = `${route.color}08`; }}
      >
        {/* Fila 1: Código + Título completo + Checkbox de visibilidad */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <div 
            onClick={() => selectRoute(route.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, cursor: 'pointer' }}
          >
            {/* Badge código */}
            <div
              style={{
                minWidth: '46px', height: '28px', padding: '0 6px', borderRadius: '6px',
                background: `${route.color}22`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0
              }}
            >
              <span style={{ fontWeight: 800, fontSize: '0.75rem', color: route.color, whiteSpace: 'nowrap' }}>{route.code}</span>
            </div>

            {/* Nombre completo */}
            <span title={route.name} style={{
              fontWeight: 600, fontSize: '0.88rem',
              color: route.color,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              flex: 1
            }}>
              {route.name}
            </span>
          </div>

          {/* Checkbox visibilidad a la derecha en la Fila 1 */}
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              if (isAdmin || config?.anonymous_selection_enabled) {
                toggleVisibility(route.id);
              } else {
                selectRoute(route.id);
              }
            }}
            style={{
              width: '18px', height: '18px', borderRadius: '4px',
              border: `2px solid ${route.color}`,
              background: isVisible ? `${route.color}35` : 'transparent',
              flexShrink: 0, cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
            }}
          >
            {isVisible && <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: route.color }} />}
          </button>
        </div>

        {/* Fila 2: Estado operativo a la izquierda, botones inline a la derecha */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          {/* Cartel de Estado Operativo + Contador de unidades activas al lado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {(() => {
              const lineAlert = (incidents || []).find(inc => inc.type === 'LINE_STATUS' && inc.active && inc.affectedRoutes?.some(r => r.routeId === route.id));
              const affectedRoute = lineAlert?.affectedRoutes?.find(r => r.routeId === route.id);
              let status = affectedRoute?.status || 'NORMAL';
              const observation = affectedRoute?.observation;

              // REGLA 4: Si se informa "fuera de servicio" (INTERRUPTED) y hay colectivos con GPS transmitiendo en vivo para esta línea,
              // se acomoda la notificación a "NORMAL".
              const activeGpsBusesCount = liveBuses.filter((bus: any) => (bus.routeId === route.id || bus.code === route.code) && (bus.isGps || bus.hasRealGpsMatch || bus.isCuandoSubo || bus.gps_source)).length;
              if (status === 'INTERRUPTED' && activeGpsBusesCount > 0) {
                status = 'NORMAL';
              }

              let badgeBg = '#007a33';
              let statusText = 'NORMAL';
              
              if (status === 'DELAY') {
                badgeBg = '#d97706';
                statusText = 'DEMORAS';
              } else if (status === 'INTERRUPTED') {
                badgeBg = '#dc2626';
                statusText = 'SIN SERVICIO';
              }

              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ 
                    padding: '2px 6px',
                    borderRadius: '3px',
                    background: badgeBg,
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    letterSpacing: '0.5px'
                  }}>
                    {statusText}
                  </span>
                  {observation && (
                    <span style={{ 
                      fontSize: '0.62rem', 
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      fontWeight: 'bold',
                      maxWidth: '100px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }} title={observation}>
                      - {observation}
                    </span>
                  )}
                </div>
              );
            })()}
            
            {routeBusesCount > 0 && (
              <span style={{
                fontSize: '0.68rem',
                background: isRouteSelected ? `${route.color}22` : 'var(--success-glow)',
                color: isRouteSelected ? route.color : 'var(--success)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 750,
                whiteSpace: 'nowrap',
                letterSpacing: '0.2px'
              }}>
                {routeBusesCount} {routeBusesCount === 1 ? 'unidad activa' : 'unidades activas'}
              </span>
            )}
            {isAdmin && (routeBusesCount > 0 || routeTotalGpsCount > 0) && (
              <span style={{
                fontSize: '0.68rem',
                background: routeGpsStyle.bg,
                color: routeGpsStyle.color,
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                letterSpacing: '0.2px',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {routeGpsText}
              </span>
            )}
          </div>

          {/* Botones de acción compactos alineados a la derecha */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => toggleFavorite(route)}
              style={{ padding: '3px', border: 'none', background: 'transparent', cursor: 'pointer', color: isFavorite ? '#fbbf24' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <Star size={15} fill={isFavorite ? '#fbbf24' : 'none'} />
            </button>

            {!isMobile && (
              <button onClick={() => focusRoute(route)}
                style={{ padding: '3px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                onMouseOver={(e) => { e.currentTarget.style.color = route.color; }}
                onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                title="Enfocar recorrido"
              >
                <LocateFixed size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Panel expandido compacto */}
        {((isAdmin || config?.anonymous_selection_enabled) ? isRouteSelected : (expandedRouteId === route.id)) && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${route.color}20`, animation: 'fadeIn 0.2s ease' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
              {[...(route.directions || [])].sort((a: any, b: any) => a.direction === 'ida' ? -1 : 1).map((d: any, i: number) => {
                const isDirVisible = d.direction === 'ida' ? (routeShowIda[route.id] ?? true) : (routeShowVuelta[route.id] ?? true);
                const isStopsVisible = d.direction === 'ida' ? (routeStopsIda[route.id] ?? false) : (routeStopsVuelta[route.id] ?? false);
                const isIda = d.direction === 'ida';
                const dotColor = isIda ? '#3b82f6' : '#a855f7';
                const routeDirectionBusesCount = liveBuses.filter((bus: any) => (bus.routeId === route.id || bus.code === route.code) && bus.dir === d.direction).length;
                let targetDest = d.destination || d.headsign || (d.stops && d.stops.length > 0 ? d.stops[d.stops.length - 1]?.name : null);
                const routeTitle = route.title || route.name || '';
                if (routeTitle && (routeTitle.includes('-') || routeTitle.includes('–') || routeTitle.includes('—'))) {
                  let cleanTitle = routeTitle;
                  if (route.code && cleanTitle.startsWith(route.code)) {
                    cleanTitle = cleanTitle.replace(route.code, '').trim();
                  }
                  const parts = cleanTitle.split(/\s*[-–—]\s*/);
                  if (parts.length >= 2) {
                    let rawDest = isIda ? parts[parts.length - 1].trim() : parts[0].trim();
                    if (!isIda) {
                      rawDest = rawDest.replace(/^(COMUN|DIRECTO|EXPRESO|DIFERENCIAL|LOCAL)\s+/i, '').trim();
                    }
                    if (rawDest) {
                      targetDest = rawDest;
                    }
                  }
                }
                if (targetDest) {
                  targetDest = targetDest.replace(/\s*\(.*?\)/g, '').trim();
                }
                const dirLabel = targetDest ? `➔ ${targetDest}` : (isIda ? '➔ Ida' : '➔ Vuelta');
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
                    <button
                      onClick={(e) => toggleDirection(e, route.id, d.direction as 'ida' | 'vuelta')}
                      style={{
                        flex: 1, height: '30px', padding: '0 6px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: isDirVisible ? `${dotColor}15` : 'rgba(0,0,0,0.03)',
                        opacity: isDirVisible ? 1 : 0.45, transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, justifyContent: 'center'
                      }}
                      title={dirLabel}
                    >
                      <span style={{ fontSize: '0.78rem', color: dotColor, fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {dirLabel}
                        {routeDirectionBusesCount > 0 && ` (${routeDirectionBusesCount})`}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
            
            {/* Botón horarios compacto de 100% de ancho abajo */}
            <button
              onClick={(e) => { e.stopPropagation(); setViewingSchedule(route.id); }}
              style={{
                width: '100%', marginTop: '8px', padding: '6px 10px',
                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                borderRadius: '6px', color: 'var(--text-muted)',
                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--hover-light)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-primary)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <Clock size={12} /> Horarios
            </button>
          </div>
        )}
      </div>
    );
  };

  // ========== IOS STYLE SWITCH COMPONENT ==========
  const IOSSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
    <div 
      onClick={onChange}
      style={{
        width: '42px',
        height: '24px',
        borderRadius: '12px',
        background: checked ? 'var(--accent)' : '#d1d5db',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        flexShrink: 0
      }}
    >
      <div style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: '#fff',
        position: 'absolute',
        top: '2px',
        left: checked ? '20px' : '2px',
        transition: 'left 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }} />
    </div>
  );

  // ========== FILTERS CONTENT (mobile drawer tab content) ==========
  const filtersContent = (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 4px', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
        Mi Ubicación y Favoritos
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mostrar mi ubicación en el mapa</span>
        </div>
        <IOSSwitch checked={showUserLocation} onChange={() => setShowUserLocation(!showUserLocation)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Star size={16} color="#eab308" fill={showFavoritesOnly ? '#eab308' : 'none'} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mostrar solo líneas favoritas</span>
        </div>
        <IOSSwitch checked={showFavoritesOnly} onChange={() => setShowFavoritesOnly(!showFavoritesOnly)} />
      </div>

      {isAdmin && (
        <>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '24px', marginBottom: '8px' }}>
            Capas del Mapa
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Tag size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mostrar número de colectivos en vivo</span>
            </div>
            <IOSSwitch checked={showVehicleLabels} onChange={() => setShowVehicleLabels(!showVehicleLabels)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ color: 'var(--text-muted)', display: 'flex' }}><Bus size={16} /></div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mostrar paradas de colectivos</span>
            </div>
            <IOSSwitch checked={showStops} onChange={() => setShowStops(!showStops)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Flag size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mostrar cabeceras (Inicio / Fin)</span>
            </div>
            <IOSSwitch checked={showStartEndMarkers} onChange={() => setShowStartEndMarkers(!showStartEndMarkers)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ transform: 'rotate(45deg)', display: 'flex' }}><Navigation size={16} color="var(--text-muted)" /></div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mostrar flechas de dirección de rutas</span>
            </div>
            <IOSSwitch checked={showRouteArrows} onChange={() => setShowRouteArrows(!showRouteArrows)} />
          </div>


          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Clock size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mostrar paradas con horarios fijos</span>
            </div>
            <IOSSwitch checked={showWaypoints} onChange={() => setShowWaypoints(!showWaypoints)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Hash size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mostrar secuencia numérica de paradas</span>
            </div>
            <IOSSwitch checked={showStopSequences} onChange={() => setShowStopSequences(!showStopSequences)} />
          </div>

          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '24px', marginBottom: '8px' }}>
            Configuraciones de Línea
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Link size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Seleccionar sentidos Ida/Vuelta juntos</span>
            </div>
            <IOSSwitch checked={selectBothDirections} onChange={() => setSelectBothDirections(!selectBothDirections)} />
          </div>
        </>
      )}



      {isAdmin && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', marginBottom: '16px' }}>
          <button 
            onClick={toggleSelectAllCurrent}
            style={{
              flex: 1, padding: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: '10px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            {areAllCurrentSelected ? <Square size={16} /> : <CheckSquare size={16} />}
            {areAllCurrentSelected ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
          </button>
        </div>
      )}
    </div>
  );

  // ========== ROUTE LIST CONTENT (shared between sidebar and drawer) ==========
  const routeListContent = (
    <>
      {/* Buscador de Direcciones Nominatim */}
      {false && (
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          {/* Input de Búsqueda */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '12px 14px', 
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            boxShadow: 'var(--shadow-sm)',
            height: '43px',
            position: 'relative'
          }}>
            <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input 
              type="text"
              value={searchQueryText}
              onChange={(e) => {
                setSearchQueryText(e.target.value);
                setIsSearchOpen(true);
              }}
              placeholder="Buscar dirección o lugar..."
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                width: '100%',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                padding: 0
              }}
            />
            {isSearchLoading && (
              <div 
                style={{ 
                  animation: 'spin 1s linear infinite',
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(100, 116, 139, 0.2)',
                  borderTopColor: '#64748b',
                  borderRadius: '50%',
                  flexShrink: 0
                }}
              />
            )}
            {searchQueryText && !isSearchLoading && (
              <button 
                onClick={() => {
                  setSearchQueryText('');
                  setSearchResults([]);
                  setSearchLocation(null);
                }} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  padding: 0, 
                  display: 'flex', 
                  alignItems: 'center',
                  flexShrink: 0
                }}
              >
                <X size={14} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>

          {/* Sugerencias de Autocompletado */}
          {isSearchOpen && searchResults.length > 0 && (
            <div 
              style={{
                position: 'absolute',
                top: '47px',
                left: 0,
                right: 0,
                maxHeight: '180px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
                zIndex: 20
              }}
            >
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const lat = parseFloat(item.lat);
                    const lon = parseFloat(item.lon);
                    if (!isNaN(lat) && !isNaN(lon)) {
                      setSearchLocation({ lat, lon, name: item.display_name });
                      setSearchQueryText(item.display_name);
                      setIsSearchOpen(false);
                    }
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    width: '100%',
                    boxSizing: 'border-box',
                    transition: 'background 0.2s',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    borderBottom: idx < searchResults.length - 1 ? '1px solid var(--border-light)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  <MapPin size={13} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--text-muted)' }} />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                    {item.display_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Buscador de Líneas y Ramales con Botón Refrescar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        marginBottom: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--bg-card)',
        paddingTop: '8px',
        paddingBottom: '8px'
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <select 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 40px 12px 40px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 500,
              outline: 'none',
              boxShadow: 'var(--shadow-sm)',
              appearance: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <option value="">Seleccione una línea</option>
            {availableLines.map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>
          <Search 
            size={16} 
            color="var(--text-muted)" 
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} 
          />
          <ChevronDown 
            size={16} 
            color="var(--text-muted)" 
            style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} 
          />
        </div>

        {/* Botón Refrescar */}
        <button
          onClick={handleRefreshActiveRoutes}
          disabled={isRefreshing}
          title="Refrescar horarios y recorridos locales"
          style={{
            padding: '12px',
            height: '43px',
            width: '43px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text-muted)',
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.2s',
            opacity: isRefreshing ? 0.6 : 1
          }}
          onMouseOver={e => { if(!isRefreshing) e.currentTarget.style.background = 'var(--hover-light)'; }}
          onMouseOut={e => { if(!isRefreshing) e.currentTarget.style.background = 'var(--bg-card)'; }}
        >
          <RotateCw 
            size={16} 
            style={{
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
            }}
          />
        </button>
      </div>

      {/* Alert Banner for limit */}
      {limitAlert && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px', marginBottom: '12px',
          background: 'rgba(254, 242, 242, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          animation: 'fadeInUp 0.3s ease',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: '0.78rem', color: '#991b1b', fontWeight: 600, lineHeight: 1.3 }}>
            Límite alcanzado: solo puedes seleccionar un máximo de {MAX_SELECTED_RAMALES} ramales simultáneamente.
          </div>
          <button
            onClick={() => setLimitAlert(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#991b1b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              opacity: 0.7,
              transition: 'opacity 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.opacity = '1'}
            onMouseOut={e => e.currentTarget.style.opacity = '0.7'}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {/* Árbol de Acordeones por Línea */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {searchQuery === "" && (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
            fontSize: '0.82rem',
            lineHeight: '1.4'
          }}>
            Por favor, seleccione una línea para visualizar sus recorridos y horarios.
          </div>
        )}
        {Object.entries(filteredRoutesByLine).map(([line, routes]) => {
          const isExpanded = expandedLines[line] ?? (showFavoritesOnly ? true : false);
          
          const total = routes.length;
          const active = routes.filter((r: any) => selectedRouteIds.has(r.id)).length;
          
          const lineRouteIds = routes.map((r: any) => r.id);
          const lineRouteCodes = routes.map((r: any) => r.code);
          const activeBusesCount = liveBuses.filter((bus: any) => lineRouteIds.includes(bus.routeId) || lineRouteCodes.includes(bus.code)).length;
          const lineIsRealGpsBus = (bus: any) => bus && (bus.isGps === true || bus.is_gps === true) && bus.isSimulated !== true && bus.is_simulated !== true && !bus.id?.startsWith('sim-') && !bus.originalId?.startsWith('sim-');
          const lineMatchedGpsCount = liveBuses.filter((bus: any) => (lineRouteIds.includes(bus.routeId) || lineRouteCodes.includes(bus.code)) && lineIsRealGpsBus(bus)).length;
          const lineTotalGpsCount = liveBuses.filter((bus: any) => (lineRouteIds.includes(bus.routeId) || lineRouteCodes.includes(bus.code)) && lineIsRealGpsBus(bus)).length;
          const lineGpsText = isAdmin ? `${lineMatchedGpsCount}/${lineTotalGpsCount} GPS` : `${lineMatchedGpsCount > 0 ? lineMatchedGpsCount : lineTotalGpsCount} GPS`;
          const lineGpsStyle = lineTotalGpsCount === 0 
            ? { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }
            : (lineMatchedGpsCount < lineTotalGpsCount 
              ? { bg: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }
              : { bg: 'rgba(4, 120, 87, 0.15)', color: '#047857' });
          
          return (
            <div 
              key={line} 
              style={{ 
                background: 'transparent', 
                border: 'none', 
                borderRadius: '0px', 
                overflow: 'visible',
                transition: 'all 0.2s'
              }}
            >
              {/* Cabecera del Acordeón (Fila Nodo Árbol) */}
              <div
                onClick={() => {
                  setExpandedLines(prev => ({ ...prev, [line]: !isExpanded }));
                }}
                style={{
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'transparent',
                  transition: 'background 0.2s',
                  userSelect: 'none'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    transform: isExpanded ? 'rotate(90deg)' : 'none', 
                    transition: 'transform 0.2s',
                    color: 'var(--text-muted)'
                  }}>
                    <ChevronRight size={16} />
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {line.replace(/\s*\([Tt]ransporte\s+local\)/gi, '').trim()}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    background: activeBusesCount > 0 ? 'var(--success-glow)' : 'var(--bg-secondary)', 
                    color: activeBusesCount > 0 ? 'var(--success)' : 'var(--text-muted)',
                    padding: '2px 6px', 
                    borderRadius: '4px', 
                    fontWeight: 700,
                    border: activeBusesCount > 0 ? 'none' : '1px solid var(--border)',
                    transition: 'all 0.2s'
                  }}>
                     {activeBusesCount} {activeBusesCount === 1 ? 'unidad activa' : 'unidades activas'}
                  </span>

                  {isAdmin && (activeBusesCount > 0 || lineTotalGpsCount > 0) && (
                    <span style={{ 
                      fontSize: '0.72rem', 
                      background: lineGpsStyle.bg, 
                      color: lineGpsStyle.color,
                      padding: '2px 6px', 
                      borderRadius: '4px', 
                      fontWeight: 500,
                      border: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}>
                      {lineGpsText}
                    </span>
                  )}
                </div>
              </div>

              {/* Ramales dentro de la Línea (Hijos Indentados con Conector dashed) */}
              {isExpanded && (
                <div style={{ 
                  padding: '4px 0 8px 16px', 
                  marginLeft: '15px', 
                  borderLeft: '1px dashed var(--border)',
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px', 
                  background: 'transparent' 
                }}>
                  {routes.map((route: any, idx: number) => renderRouteCard(route, idx))}
                </div>
              )}
            </div>
          );
        })}

        {isBffLoading ? (
          <div style={{
            padding: '36px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <RotateCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
            Cargando recorridos del servidor...
          </div>
        ) : Object.keys(filteredRoutesByLine).length === 0 && searchQuery.trim().length > 0 && (
          <div style={{
            padding: '36px 20px',
            textAlign: 'center',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
            fontSize: '0.8rem'
          }}>
            No se encontraron líneas o ramales que coincidan con la búsqueda.
          </div>
        )}
      </div>
    </>
  );

  const infoContent = (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 800, margin: 0 }}>
          Referencias del Mapa
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
          El color del círculo alrededor de cada colectivo indica su tipo de seguimiento:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          {/* Verde: GPS en tiempo real */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: 'rgba(5, 150, 105, 0.25)',
              border: '2.5px solid #059669',
              boxShadow: '0 0 6px rgba(5, 150, 105, 0.5)',
              flexShrink: 0
            }} />
            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
              <strong style={{ color: '#059669' }}>Círculo Verde:</strong> Ubicación en tiempo real (máxima precisión disponible).
            </div>
          </div>

          {/* Rojo: Horario estimado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: 'rgba(220, 38, 38, 0.20)',
              border: '2.5px solid #dc2626',
              boxShadow: '0 0 6px rgba(220, 38, 38, 0.4)',
              flexShrink: 0
            }} />
            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
              <strong style={{ color: '#dc2626' }}>Círculo Rojo:</strong> Posición estimada según horarios.
            </div>
          </div>

          {/* Amarillo: Horario estimado mejorado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: 'rgba(234, 179, 8, 0.25)',
              border: '2.5px solid #eab308',
              boxShadow: '0 0 6px rgba(234, 179, 8, 0.5)',
              flexShrink: 0
            }} />
            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
              <strong style={{ color: '#d97706' }}>Círculo Amarillo:</strong> Posición estimada por horario más GPS colaborativo.
            </div>
          </div>
        </div>

        <div style={{
          fontSize: '0.76rem',
          color: 'var(--text-muted)',
          lineHeight: 1.45,
          fontStyle: 'italic',
          background: 'rgba(148, 163, 184, 0.08)',
          padding: '8px 12px',
          borderRadius: '8px',
          borderLeft: '3px solid var(--text-muted)',
          marginTop: '2px'
        }}>
          <strong>NOTA:</strong> Las posiciones de los colectivos son aproximadas y pueden no ser exactas en cualquiera de los casos.
        </div>
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 800, margin: 0 }}>Estado del Tránsito</h3>
          
          {(() => {
            const generalIncidents = (incidents || []).filter(inc => inc.type !== 'LINE_STATUS');

            if (isLoadingIncidents) {
              return <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando estado...</div>;
            }

            if (generalIncidents.length === 0) {
              return (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                  No hay alertas de servicio reportadas.
                </div>
              );
            }

            return generalIncidents.map((incident, idx) => {
              let bgColor = 'rgba(16, 185, 129, 0.08)';
              let borderColor = 'rgba(16, 185, 129, 0.15)';
              let iconColor = '#10b981';
              let titleColor = '#10b981';
              let textColor = 'var(--text-secondary)';
              let Icon = CheckSquare;

              if (incident.severity === 'medium') {
                bgColor = 'rgba(245, 158, 11, 0.08)';
                borderColor = 'rgba(245, 158, 11, 0.15)';
                iconColor = '#f59e0b';
                titleColor = '#f59e0b';
                textColor = 'var(--text-secondary)';
                Icon = Clock;
              } else if (incident.severity === 'high') {
                bgColor = 'rgba(239, 68, 68, 0.08)';
                borderColor = 'rgba(239, 68, 68, 0.15)';
                iconColor = '#ef4444';
                titleColor = '#ef4444';
                textColor = 'var(--text-secondary)';
                Icon = AlertTriangle;
              }

              return (
                <div key={incident.id || idx} style={{ 
                  padding: '16px', 
                  background: bgColor, 
                  border: `1px solid ${borderColor}`, 
                  borderRadius: '12px', 
                  display: 'flex', 
                  gap: '12px', 
                  alignItems: 'flex-start',
                  flexDirection: 'column',
                  width: '100%'
                }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', width: '100%' }}>
                    <Icon size={20} color={iconColor} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', color: titleColor, fontSize: '0.9rem', marginBottom: '4px' }}>{incident.title}</strong>
                      <span style={{ fontSize: '0.8rem', color: textColor, lineHeight: '1.4' }}>{incident.description}</span>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );

  const acercaDeContent = (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', justifyContent: 'space-between', alignItems: 'center', gap: '20px', boxSizing: 'border-box', padding: '16px 8px' }}>
      
      {!isMobile && (
        <div style={{ width: '100%', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/assets/images/bus-icon.png" alt="Logo" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'contain' }} draggable={false} />
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>¿Por dónde viene?</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '1px 0 0', paddingLeft: '8px', fontWeight: 500 }}>Tu app de transportes</p>
          </div>
        </div>
      )}

      {/* Content Blocks */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, justifyContent: 'center' }}>
        <div style={{
          padding: '24px 20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <span style={{ fontSize: '0.95rem', lineHeight: '1.6', display: 'block', color: 'var(--text-primary)', fontWeight: 500 }}>
            Esta es una aplicación <strong style={{ color: 'var(--accent)', fontWeight: 700 }}>completamente independiente</strong>, desarrollada para facilitar y agilizar la movilidad urbana.
          </span>
        </div>

        <div style={{
          padding: '20px',
          background: 'rgba(245, 158, 11, 0.02)',
          border: '1px solid rgba(245, 158, 11, 0.12)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          textAlign: 'left',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.01)'
        }}>
          <AlertTriangle size={18} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', lineHeight: '1.45', color: 'var(--text-secondary)' }}>
              No está asociada, patrocinada, ni afiliada a ninguna empresa de transporte público específica ni a ningún ente u organismo gubernamental.
            </span>
            <span style={{ fontSize: '0.78rem', lineHeight: '1.4', color: 'var(--text-muted)', opacity: 0.85 }}>
              Las marcas registradas y nombres de líneas pertenecen a sus respectivos propietarios y se utilizan únicamente con fines informativos.
            </span>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div style={{
          width: '100%',
          padding: '16px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#10b981', fontWeight: 700, fontSize: '0.9rem' }}>
            <Shield size={16} />
            <span>Administrador Activo</span>
          </div>
          <button 
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '10px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
            onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
          >
            Cerrar Sesión
          </button>
        </div>
      )}

      {!isMobile && (
        <div style={{
          width: '100%',
          borderTop: '1px solid var(--border-light)',
          paddingTop: '16px',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          lineHeight: '1.5',
          marginTop: '16px'
        }}>
          Para más información revisar los <span style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }} onClick={() => setInfoModal('terms')}>Términos y Condiciones</span> y <span style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }} onClick={() => setInfoModal('privacy')}>Privacidad</span>.
        </div>
      )}
    </div>
  );

  // ========== UNIFIED LAYOUT ==========
  return (
    <div style={{ position: 'relative', height: isMobile ? '100dvh' : '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {isMobile ? (
        <>
          {/* Full-screen Map */}
        <div style={{ position: 'absolute', inset: '0' }}>
          <TransitMap showUserLocation={showUserLocation} showStops={showStops} showRouteArrows={showRouteArrows} showStartEndMarkers={showStartEndMarkers} showVehicleLabels={showVehicleLabels} selectedRouteIds={filteredSelectedRouteIds} visibleRouteIds={filteredVisibleRouteIds} routeStopsIda={routeStopsIda} routeStopsVuelta={routeStopsVuelta} routeShowIda={routeShowIda} routeShowVuelta={routeShowVuelta} routeBusesIda={routeBusesIda} routeBusesVuelta={routeBusesVuelta} transitRoutes={enrichedTransitRoutes} transitStops={transitStops} focusedRouteBounds={focusedRouteBounds} onViewSchedule={handleViewSchedule} onLiveBusesUpdate={setLiveBuses} showStopSequences={showStopSequences} showWaypoints={showWaypoints} mapStyle={mapStyle} searchLocation={searchLocation} onClearSearchLocation={() => setSearchLocation(null)} offlineDownloaderOpen={offlineDownloaderOpen} onOfflineDownloaderClose={() => setOfflineDownloaderOpen(false)} hideOfflineButton={isMobile} calendarExceptions={calendarExceptions} sidebarOpen={mobileDrawerOpen} onNearbyStopChange={setNearbyStop} triggerNearbyStopToggle={toggleNearbyTrigger} onSimulationLog={(msg) => setSimulationLogs(prev => [msg, ...prev].slice(0, 100))} showStopProjections={showStopProjections} enableGpsMatching={enableGpsMatching} showRawGps={showRawGps} isAdmin={isAdmin} isPWA={isPWA} isCollaborativeGpsActive={isCollaborativeGpsActive} />
        </div>

        <div style={{ position: 'absolute', bottom: '16px', left: '16px', zIndex: 999, pointerEvents: 'none', opacity: (isPWA || isMobile) ? 0.95 : 0.6, fontFamily: 'Inter, sans-serif', color: (isPWA || isMobile) ? '#ffffff' : '#1e293b', userSelect: 'none', WebkitUserSelect: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
          <div style={{ 
            fontWeight: 900, 
            fontSize: '1.2rem', 
            lineHeight: '1.1', 
            color: '#ffffff', 
            WebkitTextStroke: '0.8px #000000',
            textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.6)'
          }}>¿Por dónde viene?</div>
          <div style={{ 
            fontWeight: 700, 
            fontSize: '0.85rem', 
            opacity: 0.95, 
            paddingLeft: '8px', 
            marginBottom: '2px', 
            color: '#ffffff',
            WebkitTextStroke: '0.6px #000000',
            textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.6)'
          }}>Tu app de transportes</div>
        </div>

        <div style={{ position: 'absolute', bottom: '24px', right: '16px', zIndex: 1000, pointerEvents: 'auto', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="https://www.instagram.com/pordondeviene/" target="_blank" rel="noopener noreferrer" style={{ display: 'flex' }}><InstagramIcon size={18} color="#334155" /></a>
          <a href="#" style={{ display: 'flex' }}><FacebookIcon size={18} color="#334155" /></a>
          <a href="https://x.com/pordondeviene" target="_blank" rel="noopener noreferrer" style={{ display: 'flex' }}><XIconSocial size={18} color="#334155" /></a>
          <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'flex' }}><WhatsAppIcon size={18} color="#334155" /></a>
        </div>

        {/* Botones flotantes del mapa (Mobile) */}
        {!mobileDrawerOpen && (
          <div 
            className="mobile-map-controls"
            style={{
              position: 'absolute',
              bottom: '76px',
              right: '16px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            {/* Botón Compartir (Arriba del de Descargar) */}
            <button
              onClick={handleShareClick}
              style={{
                background: '#ffffff',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                color: '#3b82f6',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s',
              }}
              title="Compartir Aplicación"
            >
              <Share2 size={20} color="#3b82f6" />
            </button>

            {/* Botón Descargar App (Arriba del de Ubicación) */}
            <button
              onClick={() => setInfoModal('download')}
              style={{
                background: '#ffffff',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                color: 'var(--accent)',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s',
              }}
              title="Descargar Aplicación"
            >
              <Download size={20} />
            </button>

            {/* Botón GPS Colaborativo / Compartir mi Ubicación (Abajo de Descargar) */}
            <button
              onClick={() => {
                if (isCollaborativeGpsActive) {
                  setIsCollaborativeGpsActive(false);
                } else {
                  setShowCollaborativeModal(true);
                }
              }}
              style={{
                background: isCollaborativeGpsActive ? '#10b981' : '#ffffff',
                border: '1px solid ' + (isCollaborativeGpsActive ? '#059669' : 'rgba(226, 232, 240, 0.8)'),
                color: isCollaborativeGpsActive ? '#ffffff' : '#d97706',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: isCollaborativeGpsActive ? '0 0 14px rgba(16, 185, 129, 0.65)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s',
                animation: isCollaborativeGpsActive ? 'pulse-green 2s infinite' : 'none'
              }}
              title={isCollaborativeGpsActive ? 'Desactivar GPS Colaborativo' : 'Compartir mi ubicación en el colectivo (GPS Colaborativo)'}
            >
              <Radio size={20} color={isCollaborativeGpsActive ? '#ffffff' : '#d97706'} />
            </button>

            {/* Botón azul (Mi Ubicación) */}
            <button
              onClick={() => setShowUserLocation(!showUserLocation)}
              style={{
                background: '#ffffff',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s',
              }}
              title={showUserLocation ? 'Ocultar Mi Ubicación' : 'Mostrar Mi Ubicación'}
            >
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: showUserLocation ? '#3b82f6' : 'var(--text-muted)',
                transition: 'background 0.2s'
              }} />
            </button>

            {/* Botón Mira (Abajo del botón azul, enfoca el último ramal seleccionado) */}
            <button
              onClick={handleMiraClick}
              style={{
                background: '#ffffff',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                color: '#3b82f6',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s',
              }}
              title="Mira (Enfocar recorrido del último ramal seleccionado)"
            >
              <LocateFixed size={20} color="#3b82f6" />
            </button>



            {/* Botón flotante para abrir el menú (Drawer) */}
            <button
              onClick={() => {
                setActiveTab('recorridos');
                setMobileDrawerOpen(true);
              }}
              style={{
                background: '#ffffff',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                color: 'var(--accent)',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s',
              }}
              title="Abrir Menú"
            >
              <Menu size={20} />
            </button>
          </div>
        )}

        {/* Google Ad de Cabecera */}
        {config.google_ads_enabled && !isLoadingConfig && (
          <div style={isPWA ? {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: '20dvh',
            maxHeight: '20dvh',
            opacity: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? 1 : 0,
            visibility: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? 'visible' : 'hidden',
            pointerEvents: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? 'auto' : 'none',
            zIndex: 1000,
            overflow: 'hidden',
            background: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
            backdropFilter: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? 'blur(8px)' : 'none',
            WebkitBackdropFilter: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? 'blur(8px)' : 'none',
            borderBottom: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? '1px solid rgba(0, 0, 0, 0.1)' : 'none',
            boxShadow: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? '4px 8px' : '0px',
            boxSizing: 'border-box',
            transition: 'opacity 0.3s ease'
          } : {
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90%',
            maxWidth: '468px',
            height: '50px',
            maxHeight: '50px',
            opacity: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? 1 : 0,
            visibility: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? 'visible' : 'hidden',
            pointerEvents: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? 'auto' : 'none',
            zIndex: 1000,
            overflow: 'hidden',
            background: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
            backdropFilter: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? 'blur(8px)' : 'none',
            WebkitBackdropFilter: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? 'blur(8px)' : 'none',
            borderRadius: '8px',
            boxShadow: (headerAdState === 'filled' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
            transition: 'opacity 0.3s ease'
          }}>
            <GoogleAd 
              adSlot={config.google_ad_slot_header || '9343844412'} 
              style={{ width: '100%', height: '100%', maxHeight: '100%' }} 
              onAdStateChange={setHeaderAdState}
            />
          </div>
        )}

        {/* Banners on Mobile */}
        {config.banners_webpage_enabled && !isPWA && (
          <div style={{ position: 'absolute', top: '20px', left: '16px', right: '16px', height: '100px', zIndex: 1000, pointerEvents: 'none' }}>
            <DraggableBannerCarousel 
              key="mobile-banner"
              slotIndex={0}
              activeBanner={bannerStates[0]}
              banners={dynamicBanners[0] || []}
              onBannerChange={(newIdx) => {
                setBannerStates(prev => {
                  const next = [...prev];
                  next[0] = newIdx;
                  return next;
                });
              }}
              onBannerDoubleClick={(bannerIdx) => setExpandedBanner({ slot: 0, banner: bannerIdx })}
            />
          </div>
        )}



        {/* Modal Bottom Sheet */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
          opacity: mobileDrawerOpen ? 1 : 0,
          pointerEvents: mobileDrawerOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s'
        }} onClick={() => setMobileDrawerOpen(false)}>
          
          <div style={{
            position: 'absolute',
            bottom: mobileDrawerOpen ? 0 : '-100%',
            left: 0, right: 0,
            height: activeTab === 'acerca_de' ? '100dvh' : '83.33dvh',
            maxHeight: activeTab === 'acerca_de' ? '100dvh' : '83.33dvh',
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border)',
            borderRadius: activeTab === 'acerca_de' ? '0' : '24px 24px 0 0',
            padding: activeTab === 'acerca_de' ? '0' : '20px 16px 0',
            display: 'flex', flexDirection: 'column',
            transition: 'bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            {activeTab === 'acerca_de' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src="/assets/images/bus-icon.png" alt="Logo" style={{ width: '38px', height: '38px', borderRadius: '6px', objectFit: 'contain' }} draggable={false} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>¿Por dónde viene?</h3>
                      {isAdmin && (
                        <span style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          color: '#fff',
                          background: '#10b981',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          <Shield size={8} />
                          <span>Admin</span>
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '1px 0 0', paddingLeft: '4px', fontWeight: 500 }}>Tu app de transportes</p>
                  </div>
                </div>
                <button onClick={() => setActiveTab('recorridos')} style={{
                  background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
                  width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-primary)', cursor: 'pointer'
                }}>
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '28px' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>¿Por dónde viene?</h2>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, paddingLeft: '10px', margin: 0 }}>
                    Tu app de transportes
                  </div>
                </div>
                <button onClick={() => setMobileDrawerOpen(false)} style={{
                  background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
                  width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-primary)', cursor: 'pointer'
                }}>
                  <X size={18} />
                </button>
              </div>
            )}

            {activeTab !== 'acerca_de' && nearbyStop && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--success-glow)',
                border: '1px solid rgba(16, 185, 129, 0.15)',
                borderRadius: '12px',
                padding: '8px 12px',
                marginBottom: '16px',
                animation: 'fadeInScale 0.2s ease-out'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '65%' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--success)', letterSpacing: '0.5px' }}>
                    📍 Parada Cercana ({Math.round(nearbyStop.distance)}m)
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nearbyStop.stop.name}
                  </span>
                </div>
                <button
                  onClick={() => setToggleNearbyTrigger(prev => prev + 1)}
                  style={{
                    padding: '6px 12px',
                    background: nearbyStop.isWaiting ? 'var(--success)' : 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: nearbyStop.isWaiting ? '0 2px 4px rgba(16, 185, 129, 0.2)' : '0 2px 4px rgba(59, 130, 246, 0.2)',
                    transition: 'background 0.2s'
                  }}
                >
                  {nearbyStop.isWaiting ? <BellOff size={11} /> : <Bell size={11} />}
                  <span>{nearbyStop.isWaiting ? 'Esperando' : 'Esperar'}</span>
                </button>
              </div>
            )}

            {activeTab !== 'acerca_de' && (
              <>
                <div 
                  ref={mobileControlsRef}
                  className="no-scrollbar" 
                  onMouseDown={(e) => setupDragScroll(mobileControlsRef).onMouseDown(e)}
                  onMouseLeave={() => setupDragScroll(mobileControlsRef).onMouseLeave()}
                  onMouseUp={() => setupDragScroll(mobileControlsRef).onMouseUp()}
                  onMouseMove={(e) => setupDragScroll(mobileControlsRef).onMouseMove(e)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '14px 16px', gap: '12px', overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', scrollbarWidth: 'none', msOverflowStyle: 'none', cursor: 'grab' }}
                >
                {isAdmin && (
                  <button 
                    onClick={() => setShowRawGps(!showRawGps)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: '24px', padding: '0 8px', border: showRawGps ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                      borderRadius: '12px',
                      background: showRawGps ? 'rgba(234, 179, 8, 0.25)' : 'var(--bg-primary)',
                      color: showRawGps ? '#f59e0b' : 'var(--text-muted)',
                      cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.72rem', fontWeight: 700,
                      whiteSpace: 'nowrap',
                      gap: '4px',
                      boxShadow: showRawGps ? '0 0 8px rgba(245, 158, 11, 0.3)' : 'none'
                    }}
                    title={showRawGps ? 'Ocultar colectivos GPS adicionales de CuandoSUBO (+ GPS ACTIVO)' : 'Mostrar colectivos GPS adicionales de CuandoSUBO con aura amarilla (+ GPS)'}
                  >
                    <Radio size={13} style={{ color: showRawGps ? '#f59e0b' : 'currentColor' }} />
                    <span>+ GPS</span>
                  </button>
                )}

              {isAdmin && (
                <button 
                  onClick={toggleSelectAllCurrent}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '22px', height: '22px', border: 'none',
                    background: 'transparent',
                    cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                    opacity: areAllCurrentSelected ? 1 : 0.5
                  }}
                  title={areAllCurrentSelected ? 'Deseleccionar todos los ramales' : 'Seleccionar todos los ramales'}
                >
                  <img src={areAllCurrentSelected ? "/assets/images/check-square.svg" : "/assets/images/square.svg"} style={{ width: '16px', height: '16px', display: 'block' }} alt="Select All" />
                </button>
              )}
              <button 
                onClick={() => setShowUserLocation(!showUserLocation)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '22px', height: '22px', border: 'none',
                  background: 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                  opacity: showUserLocation ? 1 : 0.5
                }}
                title={showUserLocation ? 'Ocultar Mi Ubicación' : 'Mostrar Mi Ubicación'}
              >
                <img src="/assets/images/user-location.svg" style={{ width: '16px', height: '16px', display: 'block' }} alt="My Location" />
              </button>
              <button 
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '22px', height: '22px', border: 'none',
                  background: 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                  opacity: showFavoritesOnly ? 1 : 0.5
                }}
                title={showFavoritesOnly ? 'Mostrar todas las líneas' : 'Mostrar favoritas'}
              >
                <img src={showFavoritesOnly ? "/assets/images/star-filled.svg" : "/assets/images/star.svg"} style={{ width: '16px', height: '16px', display: 'block' }} alt="Favorites" />
              </button>

              {isAdmin && (
                <>
                  <button 
                    onClick={() => {
                      const next = !enableGpsMatching;
                      setEnableGpsMatching(next);
                      localStorage.setItem('collie_enable_gps_matching', String(next));
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: '24px', padding: '0 8px', border: '1px solid var(--border)',
                      borderRadius: '12px',
                      background: enableGpsMatching ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.05)',
                      color: enableGpsMatching ? '#00e676' : 'var(--text-muted)',
                      cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.72rem', fontWeight: 600,
                      gap: '4px'
                    }}
                    title={enableGpsMatching ? 'Apareamiento GPS Automático Activado' : 'Apareamiento GPS Automático Desactivado'}
                  >
                    <Radio size={12} style={{ color: enableGpsMatching ? '#00e676' : 'var(--text-muted)' }} />
                    <span>{enableGpsMatching ? 'GPS Auto' : 'GPS Off'}</span>
                  </button>

                  <span style={{ color: 'var(--border)', alignSelf: 'center', pointerEvents: 'none', userSelect: 'none' }}>|</span>
                </>
              )}
              {isAdmin && (
                <button 
                  onClick={() => setShowVehicleLabels(!showVehicleLabels)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '22px', height: '22px', border: 'none',
                    background: 'transparent',
                    cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                    opacity: showVehicleLabels ? 1 : 0.5
                  }}
                  title={showVehicleLabels ? 'Ocultar Etiquetas' : 'Mostrar Etiquetas'}
                >
                  <img src="/assets/images/tag.svg" style={{ width: '16px', height: '16px', display: 'block' }} alt="Tags" />
                </button>
              )}
              {isAdmin && (
                <>
                  <button 
                    onClick={() => setShowStops(!showStops)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '22px', height: '22px', border: 'none',
                      background: 'transparent',
                      cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                      opacity: showStops ? 1 : 0.5
                    }}
                    title={showStops ? 'Ocultar Paradas' : 'Mostrar Paradas'}
                  >
                    <img src="/assets/images/bus.svg" style={{ width: '22px', height: '22px', display: 'block', borderRadius: '5px' }} alt="Stops" />
                  </button>
                  <button 
                    onClick={() => setShowStartEndMarkers(!showStartEndMarkers)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '22px', height: '22px', border: 'none',
                      background: 'transparent',
                      cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                      opacity: showStartEndMarkers ? 1 : 0.5
                    }}
                    title={showStartEndMarkers ? 'Ocultar Cabeceras' : 'Mostrar Cabeceras'}
                  >
                    <img src="/assets/images/flag.svg" style={{ width: '16px', height: '16px', display: 'block' }} alt="Headers" />
                  </button>
                  <button 
                    onClick={() => setShowStopProjections(!showStopProjections)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '22px', height: '22px', border: 'none',
                      background: 'transparent',
                      cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                      opacity: showStopProjections ? 1 : 0.5,
                      color: showStopProjections ? 'var(--accent)' : 'inherit'
                    }}
                    title={showStopProjections ? 'Ocultar Proyecciones' : 'Mostrar Proyecciones'}
                  >
                    <GitCommit size={16} style={{ display: 'block' }} />
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => setShowRouteArrows(!showRouteArrows)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '22px', height: '22px', border: 'none',
                        background: 'transparent',
                        cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                        opacity: showRouteArrows ? 1 : 0.5,
                        transform: 'rotate(45deg)'
                      }}
                      title={showRouteArrows ? 'Ocultar Flechas de Dirección' : 'Mostrar Flechas de Dirección'}
                    >
                      <img src="/assets/images/navigation.svg" style={{ width: '16px', height: '16px', display: 'block' }} alt="Directions" />
                    </button>
                  )}
                </>
              )}


              {isAdmin && (
                <>
                  <span style={{ color: 'var(--border)', alignSelf: 'center', pointerEvents: 'none', userSelect: 'none' }}>|</span>
                  <button 
                    onClick={() => setShowStopSequences(!showStopSequences)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '22px', height: '22px', border: 'none',
                      background: 'transparent',
                      cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                      opacity: showStopSequences ? 1 : 0.5
                    }}
                    title={showStopSequences ? 'Mostrar paradas normales' : 'Mostrar secuencia de paradas (números)'}
                  >
                    <img src="/assets/images/hash.svg" style={{ width: '16px', height: '16px', display: 'block' }} alt="Sequences" />
                  </button>
                  <button 
                    onClick={() => setSelectBothDirections(!selectBothDirections)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '22px', height: '22px', border: 'none',
                      background: 'transparent',
                      cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                      opacity: selectBothDirections ? 1 : 0.5
                    }}
                    title={selectBothDirections ? 'Selección individual de ramales' : 'Seleccionar Ida y Vuelta juntos'}
                  >
                    <img src={selectBothDirections ? "/assets/images/link.svg" : "/assets/images/unlink.svg"} style={{ width: '16px', height: '16px', display: 'block' }} alt="Link" />
                  </button>
                  <button 
                    onClick={() => setShowWaypoints(!showWaypoints)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '22px', height: '22px', border: 'none',
                      background: 'transparent',
                      cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                      opacity: showWaypoints ? 1 : 0.5
                    }}
                    title={showWaypoints ? 'Ocultar paradas de horarios' : 'Mostrar paradas de horarios'}
                  >
                    <img src="/assets/images/clock.svg" style={{ width: '16px', height: '16px', display: 'block' }} alt="Timetables" />
                  </button>
                </>
              )}
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
              <button 
                onClick={() => setActiveTab('recorridos')}
                style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: activeTab === 'recorridos' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'recorridos' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: activeTab === 'recorridos' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem', outline: 'none' }}
              >Recorridos</button>
              <button 
                onClick={() => setActiveTab('informacion')}
                style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: activeTab === 'informacion' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'informacion' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: activeTab === 'informacion' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem', outline: 'none' }}
              >Información</button>
            </div>
          </>
        )}

            {/* Modal Content */}
            <div style={{ overflowY: 'auto', paddingRight: '4px', flex: 1, padding: activeTab === 'acerca_de' ? '16px' : '0' }}>
              {activeTab === 'recorridos' ? routeListContent : 
               activeTab === 'informacion' ? infoContent : acercaDeContent}
            </div>

            {/* Footer */}
             <div style={{
              padding: activeTab === 'acerca_de' ? '12px 20px 4px' : '16px 20px 10px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
            }}>
              {activeTab === 'acerca_de' ? (
                <>
                  <div style={{
                    width: '100%',
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    lineHeight: '1.5',
                    opacity: 0.9,
                    marginBottom: '4px'
                  }}>
                    Para más información revisar los <span style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }} onClick={() => setInfoModal('terms')}>Términos y Condiciones</span> y <span style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }} onClick={() => setInfoModal('privacy')}>Privacidad</span>.
                  </div>
                  <span 
                    onClick={() => setActiveTab('recorridos')}
                    style={{ fontSize: '0.85rem', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                  >
                    Volver a Recorridos
                  </span>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span 
                    onClick={() => setActiveTab('acerca_de')}
                    style={{ fontSize: '0.8rem', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    Acerca de
                  </span>
                  {isAdmin && (
                    <>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>•</span>
                      <span 
                        onClick={handleLogout}
                        style={{ fontSize: '0.8rem', color: '#ef4444', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                      >
                        Cerrar sesión
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
        {/* Timetable Modal (Mobile) */}
        {viewingSchedule && (
          <TimetableModal 
            routeCode={viewingSchedule} 
            routeData={timetableDetail}
            routeObj={transitRoutes.find((r: any) => r.code === viewingSchedule || r.id === viewingSchedule)}
            isLoadingDetail={isTimetableLoading}
            calendarExceptions={calendarExceptions}
            onClose={() => setViewingSchedule(null)} 
          />
        )}
      </>
      ) : (
      <>
        {/* Map Area - Full background */}
        <div style={{ position: 'absolute', inset: '0 0 32px 0', zIndex: 1 }}>
        <TransitMap showUserLocation={showUserLocation} showStops={showStops} showRouteArrows={showRouteArrows} showStartEndMarkers={showStartEndMarkers} showVehicleLabels={showVehicleLabels} selectedRouteIds={filteredSelectedRouteIds} visibleRouteIds={filteredVisibleRouteIds} routeStopsIda={routeStopsIda} routeStopsVuelta={routeStopsVuelta} routeShowIda={routeShowIda} routeShowVuelta={routeShowVuelta} routeBusesIda={routeBusesIda} routeBusesVuelta={routeBusesVuelta} transitRoutes={enrichedTransitRoutes} transitStops={transitStops} focusedRouteBounds={focusedRouteBounds} onViewSchedule={handleViewSchedule} onLiveBusesUpdate={setLiveBuses} showStopSequences={showStopSequences} showWaypoints={showWaypoints} mapStyle={mapStyle} searchLocation={searchLocation} onClearSearchLocation={() => setSearchLocation(null)} calendarExceptions={calendarExceptions} sidebarOpen={sidebarOpen} onNearbyStopChange={setNearbyStop} triggerNearbyStopToggle={toggleNearbyTrigger} onSimulationLog={() => {}} showStopProjections={showStopProjections} enableGpsMatching={enableGpsMatching} showRawGps={showRawGps} isAdmin={isAdmin} isPWA={isPWA} />

        {false && (
          <div style={{
            position: 'absolute',
            top: '80px',
            right: '16px',
            bottom: '120px',
            width: '360px',
            background: 'rgba(31, 41, 55, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1001,
            pointerEvents: 'auto'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(17, 24, 39, 0.4)',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.1rem' }}>📋</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f3f4f6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Bitácora de Control
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => {
                    const text = simulationLogs.join('\n');
                    navigator.clipboard.writeText(text);
                    alert('¡Logs copiados al portapapeles!');
                  }}
                  disabled={simulationLogs.length === 0}
                  style={{
                    padding: '4px 8px',
                    background: '#10b981',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    cursor: simulationLogs.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: simulationLogs.length === 0 ? 0.6 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  Copiar
                </button>
                <button
                  onClick={() => setSimulationLogs([])}
                  style={{
                    padding: '4px 8px',
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Limpiar
                </button>
                <button
                  onClick={() => setShowDebugConsole(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9ca3af',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    padding: '2px 6px'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            {/* Barra de Filtros */}
            <div style={{
              display: 'flex',
              gap: '6px',
              padding: '8px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(17, 24, 39, 0.2)'
            }}>
              {(['all', 'delayed', 'ontime'] as const).map((filter) => {
                const isActive = logFilter === filter;
                const label = filter === 'all' ? 'Todos' : filter === 'delayed' ? 'Demorados' : 'En Hora / Adelantados';
                const count = filter === 'all' 
                  ? simulationLogs.length 
                  : simulationLogs.filter(log => {
                      const p = parseLogMessage(log);
                      return filter === 'delayed' ? p?.type === 'demorado' : (p?.type === 'en-hora' || p?.type === 'adelantado');
                    }).length;

                let colorTheme = '#6b7280';
                let activeBg = 'rgba(255, 255, 255, 0.08)';
                if (filter === 'delayed') {
                  colorTheme = '#ef4444';
                  activeBg = 'rgba(239, 68, 68, 0.15)';
                } else if (filter === 'ontime') {
                  colorTheme = '#10b981';
                  activeBg = 'rgba(16, 185, 129, 0.15)';
                }

                return (
                  <button
                    key={filter}
                    onClick={() => setLogFilter(filter)}
                    style={{
                      padding: '4px 8px',
                      background: isActive ? activeBg : 'transparent',
                      border: `1px solid ${isActive ? colorTheme : 'rgba(255, 255, 255, 0.1)'}`,
                      borderRadius: '6px',
                      color: isActive ? '#ffffff' : '#9ca3af',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span>{label}</span>
                    <span style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '1px 4px',
                      borderRadius: '4px',
                      fontSize: '0.6rem',
                      color: isActive ? '#ffffff' : '#9ca3af'
                    }}>{count}</span>
                  </button>
                );
              })}
            </div>
            {/* Logs List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontFamily: 'sans-serif',
              fontSize: '0.75rem',
              color: '#cbd5e1'
            }}>
              {filteredLogs.length === 0 ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#9ca3af',
                  fontSize: '0.75rem',
                  fontFamily: 'sans-serif',
                  textAlign: 'center',
                  padding: '20px'
                }}>
                  {simulationLogs.length === 0 
                    ? 'Esperando cruce de puntos de control...\n(Asegurate de que las líneas estén simulando)' 
                    : 'No hay cruces que coincidan con el filtro...'
                  }
                </div>
              ) : (
                filteredLogs.map((item, idx) => {
                  if (!item.parsed) {
                    return (
                      <div 
                        key={idx} 
                        style={{
                          padding: '8px',
                          background: 'rgba(17, 24, 39, 0.3)',
                          borderRadius: '8px',
                          borderLeft: '3px solid #6b7280',
                          lineHeight: '1.4',
                          wordBreak: 'break-word',
                          fontFamily: 'sans-serif',
                          fontSize: '0.72rem'
                        }}
                      >
                        {item.raw}
                      </div>
                    );
                  }

                  const p = item.parsed;
                  let borderCol = '#10b981'; // Green for 'en-hora'
                  let badgeBg = 'rgba(16, 185, 129, 0.08)';
                  let badgeTextCol = '#10b981';

                  if (p.type === 'demorado') {
                    borderCol = '#ef4444';
                    badgeBg = 'rgba(239, 68, 68, 0.08)';
                    badgeTextCol = '#ef4444';
                  } else if (p.type === 'adelantado') {
                    borderCol = '#f59e0b';
                    badgeBg = 'rgba(245, 158, 11, 0.08)';
                    badgeTextCol = '#f59e0b';
                  }

                  return (
                    <div 
                      key={idx} 
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(30, 41, 59, 0.45)',
                        borderRadius: '10px',
                        borderLeft: `4.5px solid ${borderCol}`,
                        lineHeight: '1.4',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '0.75rem',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.12)',
                        transition: 'transform 0.15s ease'
                      }}
                    >
                      {/* Fila superior: Coche, Sentido y Ruta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ 
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#f8fafc',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.68rem',
                          letterSpacing: '0.5px'
                        }}>
                          🚌 {p.ruta}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                          Int. {p.coche.split('-').pop()}
                        </span>
                        <span style={{ 
                          color: '#64748b', 
                          fontSize: '0.65rem',
                          marginLeft: 'auto',
                          background: 'rgba(255,255,255,0.03)',
                          padding: '1px 5px',
                          borderRadius: '3px'
                        }}>
                          {p.sentido}
                        </span>
                      </div>

                      {/* Fila del punto de control */}
                      <div style={{ color: '#f1f5f9', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: borderCol, fontSize: '0.85rem' }}>📍</span>
                        <span style={{ wordBreak: 'break-word' }}>{p.punto}</span>
                      </div>

                      {/* Fila inferior: Horas y Desvío */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '0.7rem' }}>
                          <span>Plan:</span>
                          <strong style={{ color: '#cbd5e1' }}>{p.plan}</strong>
                          <span style={{ color: '#475569', margin: '0 2px' }}>|</span>
                          <span>Real:</span>
                          <strong style={{ color: '#cbd5e1' }}>{p.real}</strong>
                        </div>
                        <div style={{ 
                          background: badgeBg,
                          color: badgeTextCol,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: 800,
                          fontSize: '0.68rem',
                          letterSpacing: '0.3px',
                          border: `1px solid rgba(${p.type === 'demorado' ? '239, 68, 68' : p.type === 'adelantado' ? '245, 158, 11' : '16, 185, 129'}, 0.15)`
                        }}>
                          {p.desvio}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        
        {/* Google Ads Adicionales en Escritorio (Browser) */}
        {!isPWA && !isMobile && config.google_ads_enabled && !isLoadingConfig && (
          <div style={{ 
            position: 'absolute', 
            top: '16px', 
            right: '16px', 
            zIndex: 1000, 
            width: isTablet ? '220px' : '300px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px', 
            justifyContent: 'flex-start', 
            pointerEvents: 'auto', 
            transition: 'width 0.3s',
            overflow: 'hidden',
            paddingRight: '4px'
          }}>
            <GoogleAd adSlot={config.google_ad_slot_sidebar || '9343844412'} style={{ height: '250px', width: '100%', flexShrink: 0 }} />
          </div>
        )}


        <div style={{ position: 'absolute', bottom: '36px', right: '16px', zIndex: 1000, pointerEvents: 'auto', opacity: 0.85, fontFamily: 'Inter, sans-serif', userSelect: 'none', WebkitUserSelect: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a href="https://www.instagram.com/pordondeviene/" target="_blank" rel="noopener noreferrer" style={{ display: 'flex' }}><InstagramIcon size={20} color="#334155" /></a>
            <a href="#" style={{ display: 'flex' }}><FacebookIcon size={20} color="#334155" /></a>
            <a href="https://x.com/pordondeviene" target="_blank" rel="noopener noreferrer" style={{ display: 'flex' }}><XIconSocial size={20} color="#334155" /></a>
            <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'flex' }}><WhatsAppIcon size={20} color="#334155" /></a>
          </div>
        </div>
      </div>

      {/* Floating Sidebar Container */}
      <div style={{
        position: 'absolute',
        top: '16px', left: '16px', bottom: '48px',
        width: sidebarOpen ? (isTablet ? '320px' : '380px') : '0px',
        zIndex: 10,
        background: 'var(--bg-card)',
        borderRadius: '24px',
        border: '3px solid var(--success)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        pointerEvents: sidebarOpen ? 'auto' : 'none',
        opacity: sidebarOpen ? 1 : 0,
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(16, 185, 129, 0.05))'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <img src="/assets/images/bus-icon.png" alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '10px', objectFit: 'contain' }} draggable={false} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                  ¿Por dónde viene?
                </h1>
                {isAdmin && (
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#fff',
                    background: '#10b981',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                  }}>
                    <Shield size={10} />
                    <span>Admin</span>
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '2px 0 0', paddingLeft: '8px', fontWeight: 500 }}>Tu app de transportes</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 10px', background: 'var(--success-glow)', borderRadius: 'var(--radius-sm)',
              width: 'fit-content'
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {availableLines.length} {availableLines.length === 1 ? 'LÍNEA ACTIVA' : 'LÍNEAS ACTIVAS'}
              </span>
            </div>

          </div>

          {nearbyStop && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--success-glow)',
              border: '1px solid rgba(16, 185, 129, 0.15)',
              borderRadius: '12px',
              padding: '8px 12px',
              marginTop: '12px',
              animation: 'fadeInScale 0.2s ease-out'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '65%' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--success)', letterSpacing: '0.5px' }}>
                  📍 Parada Cercana ({Math.round(nearbyStop.distance)}m)
                </span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nearbyStop.stop.name}
                </span>
              </div>
              <button
                onClick={() => setToggleNearbyTrigger(prev => prev + 1)}
                style={{
                  padding: '6px 12px',
                  background: nearbyStop.isWaiting ? 'var(--success)' : 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: nearbyStop.isWaiting ? '0 2px 4px rgba(16, 185, 129, 0.2)' : '0 2px 4px rgba(59, 130, 246, 0.2)',
                  transition: 'background 0.2s'
                }}
              >
                {nearbyStop.isWaiting ? <BellOff size={11} /> : <Bell size={11} />}
                <span>{nearbyStop.isWaiting ? 'Esperando' : 'Esperar'}</span>
              </button>
            </div>
          )}
        </div>

        <div 
          ref={desktopControlsRef}
          className="no-scrollbar" 
          onMouseDown={(e) => setupDragScroll(desktopControlsRef).onMouseDown(e)}
          onMouseLeave={() => setupDragScroll(desktopControlsRef).onMouseLeave()}
          onMouseUp={() => setupDragScroll(desktopControlsRef).onMouseUp()}
          onMouseMove={(e) => setupDragScroll(desktopControlsRef).onMouseMove(e)}
          style={{ display: 'flex', justifyContent: 'flex-start', padding: '6px 16px', gap: '12px', overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', scrollbarWidth: 'none', msOverflowStyle: 'none', cursor: 'grab' }}
        >
          {isAdmin && (
            <button 
              onClick={() => setShowRawGps(!showRawGps)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '24px', padding: '0 8px', border: showRawGps ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                borderRadius: '12px',
                background: showRawGps ? 'rgba(234, 179, 8, 0.25)' : 'var(--bg-primary)',
                color: showRawGps ? '#f59e0b' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.72rem', fontWeight: 700,
                whiteSpace: 'nowrap',
                gap: '4px',
                boxShadow: showRawGps ? '0 0 8px rgba(245, 158, 11, 0.3)' : 'none'
              }}
              title={showRawGps ? 'Ocultar colectivos GPS adicionales de CuandoSUBO (+ GPS ACTIVO)' : 'Mostrar colectivos GPS adicionales de CuandoSUBO con aura amarilla (+ GPS)'}
            >
              <Radio size={13} style={{ color: showRawGps ? '#f59e0b' : 'currentColor' }} />
              <span>+ GPS</span>
            </button>
          )}

          {isAdmin && (
            <button 
              onClick={toggleSelectAllCurrent}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px', border: 'none',
                background: 'transparent',
                cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                opacity: areAllCurrentSelected ? 1 : 0.5,
                color: areAllCurrentSelected ? '#3b82f6' : 'var(--text-muted)'
              }}
              title={areAllCurrentSelected ? 'Deseleccionar todos los ramales' : 'Seleccionar todos los ramales'}
            >
              {areAllCurrentSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
          )}

          {!isPWA && (
            <button 
              onClick={() => setShowUserLocation(!showUserLocation)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px', border: 'none',
                background: 'transparent',
                cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                opacity: showUserLocation ? 1 : 0.5,
                color: showUserLocation ? '#3b82f6' : 'var(--text-muted)'
              }}
              title={showUserLocation ? 'Ocultar Mi Ubicación' : 'Mostrar Mi Ubicación'}
            >
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: showUserLocation ? '#3b82f6' : 'var(--text-muted)',
                transition: 'background 0.2s'
              }} />
            </button>
          )}


          {isAdmin && (
            <button 
              onClick={() => setShowVehicleLabels(!showVehicleLabels)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px', border: 'none',
                background: 'transparent',
                cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                opacity: showVehicleLabels ? 1 : 0.5,
                color: showVehicleLabels ? 'var(--accent)' : 'var(--text-muted)'
              }}
              title={showVehicleLabels ? 'Ocultar Etiquetas' : 'Mostrar Etiquetas'}
            >
              <Tag size={16} />
            </button>
          )}
          {isAdmin && (
            <>
              <button 
                onClick={() => setShowStops(!showStops)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '22px', height: '22px', border: 'none',
                  background: 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                  opacity: showStops ? 1 : 0.5,
                  color: showStops ? 'var(--accent)' : 'var(--text-muted)'
                }}
                title={showStops ? 'Ocultar Paradas' : 'Mostrar Paradas'}
              >
                <StopIcon color={showStops ? 'var(--accent)' : '#94a3b8'} size={18} />
              </button>
              <button 
                onClick={() => setShowStartEndMarkers(!showStartEndMarkers)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '22px', height: '22px', border: 'none',
                  background: 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                  opacity: showStartEndMarkers ? 1 : 0.5,
                  color: showStartEndMarkers ? 'var(--accent)' : 'var(--text-muted)'
                }}
                title={showStartEndMarkers ? 'Ocultar Cabeceras' : 'Mostrar Cabeceras'}
              >
                <Flag size={16} />
              </button>
              <button 
                onClick={() => setShowStopProjections(!showStopProjections)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '22px', height: '22px', border: 'none',
                  background: 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                  opacity: showStopProjections ? 1 : 0.5,
                  color: showStopProjections ? 'var(--accent)' : 'var(--text-muted)'
                }}
                title={showStopProjections ? 'Ocultar Proyecciones' : 'Mostrar Proyecciones'}
              >
                <GitCommit size={16} />
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setShowRouteArrows(!showRouteArrows)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '22px', height: '22px', border: 'none',
                    background: 'transparent',
                    cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                    opacity: showRouteArrows ? 1 : 0.5,
                    color: showRouteArrows ? 'var(--accent)' : 'var(--text-muted)',
                    transform: 'rotate(45deg)'
                  }}
                  title={showRouteArrows ? 'Ocultar Flechas de Dirección' : 'Mostrar Flechas de Dirección'}
                >
                  <Navigation size={16} />
                </button>
              )}
            </>
          )}


          {isAdmin && (
            <>
              <span style={{ color: 'var(--border)', alignSelf: 'center', pointerEvents: 'none', userSelect: 'none' }}>|</span>
              <button 
                onClick={() => setShowStopSequences(!showStopSequences)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '22px', height: '22px', border: 'none',
                  background: 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                  opacity: showStopSequences ? 1 : 0.5,
                  color: showStopSequences ? 'var(--accent)' : 'var(--text-muted)'
                }}
                title={showStopSequences ? 'Mostrar paradas normales' : 'Mostrar secuencia de paradas (números)'}
              >
                <Hash size={16} />
              </button>
              <button 
                onClick={() => setSelectBothDirections(!selectBothDirections)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '22px', height: '22px', border: 'none',
                  background: 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                  opacity: selectBothDirections ? 1 : 0.5,
                  color: selectBothDirections ? '#3b82f6' : 'var(--text-muted)'
                }}
                title={selectBothDirections ? 'Selección individual de ramales' : 'Seleccionar Ida y Vuelta juntos'}
              >
                {selectBothDirections ? <Link size={16} /> : <Unlink size={16} />}
              </button>
              <button 
                onClick={() => setShowWaypoints(!showWaypoints)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '22px', height: '22px', border: 'none',
                  background: 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                  opacity: showWaypoints ? 1 : 0.5,
                  color: showWaypoints ? 'var(--accent)' : 'var(--text-muted)'
                }}
                title={showWaypoints ? 'Ocultar paradas de horarios' : 'Mostrar paradas de horarios'}
              >
                <Clock size={16} />
              </button>
            </>
          )}
        </div>

        {/* Sidebar Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <button 
            onClick={() => setActiveTab('recorridos')}
            style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: activeTab === 'recorridos' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'recorridos' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: activeTab === 'recorridos' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem', outline: 'none' }}
          >Recorridos</button>
          <button 
            onClick={() => setActiveTab('informacion')}
            style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: activeTab === 'informacion' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'informacion' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: activeTab === 'informacion' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem', outline: 'none' }}
          >Información</button>
        </div>

        {/* Route List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {activeTab === 'recorridos' ? routeListContent : activeTab === 'informacion' ? infoContent : acercaDeContent}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '16px', borderTop: '1px solid var(--border)' }}>
          {activeTab === 'acerca_de' ? (
            <span 
              onClick={() => setActiveTab('recorridos')}
              style={{ fontSize: '0.8rem', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
            >
              Volver a Recorridos
            </span>
          ) : (
            <span 
              onClick={() => setActiveTab('acerca_de')}
              style={{ fontSize: '0.8rem', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
            >
              Acerca de
            </span>
          )}
          {isAdmin && (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>•</span>
              <span 
                onClick={handleLogout}
                style={{ fontSize: '0.8rem', color: '#ef4444', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
              >
                Cerrar sesión
              </span>
            </>
          )}
        </div>
      </div>

      {/* Toggle sidebar button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'absolute', left: sidebarOpen ? '404px' : '16px',
          top: '24px',
          zIndex: 20, width: '40px', height: '40px',
          background: '#ffffff', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: 'var(--shadow-sm)'
        }}
        title={sidebarOpen ? "Ocultar panel" : "Mostrar panel"}
      >
        <ChevronRight size={20} style={{ transform: sidebarOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
      </button>


      {/* Timetable Modal (Desktop) */}
      {viewingSchedule && (
        <TimetableModal 
          routeCode={viewingSchedule} 
          routeData={timetableDetail}
          routeObj={transitRoutes.find((r: any) => r.code === viewingSchedule || r.id === viewingSchedule)}
          isLoadingDetail={isTimetableLoading}
          calendarExceptions={calendarExceptions}
          onClose={() => setViewingSchedule(null)} 
        />
      )}
      
      {/* Expanded Banner Modal */}
      {expandedBanner && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease', cursor: 'zoom-out'
        }} onClick={() => setExpandedBanner(null)}>
          <div style={{
            background: dynamicBanners[expandedBanner.slot][expandedBanner.banner].color || '#fff', 
            border: `4px solid ${dynamicBanners[expandedBanner.slot][expandedBanner.banner].border || '#ccc'}`,
            borderRadius: '24px', padding: '40px',
            width: '80%', maxWidth: '800px', aspectRatio: '16/9',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden', cursor: 'default', position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            {dynamicBanners[expandedBanner.slot][expandedBanner.banner].imageUrl ? (
              <img src={dynamicBanners[expandedBanner.slot][expandedBanner.banner].imageUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Ad Expanded" draggable={false} />
            ) : (
              <>
                <span style={{ fontSize: '3.5rem', fontWeight: 900, color: dynamicBanners[expandedBanner.slot][expandedBanner.banner].text, textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', marginBottom: '24px' }}>
                  {dynamicBanners[expandedBanner.slot][expandedBanner.banner].title}
                </span>
                <span style={{ fontSize: '1.8rem', fontWeight: 600, color: dynamicBanners[expandedBanner.slot][expandedBanner.banner].text, opacity: 0.8, textAlign: 'center' }}>
                  {dynamicBanners[expandedBanner.slot][expandedBanner.banner].subtitle}
                </span>
              </>
            )}
            <button 
              onClick={() => setExpandedBanner(null)}
              style={{
                position: 'absolute', top: '24px', right: '24px',
                background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
                width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#475569', cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Admin-style Status Bar Footer */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '32px',
        background: '#111827', color: '#9ca3af', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif',
        WebkitUserSelect: 'none', userSelect: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontWeight: 800, color: '#f3f4f6' }}>¿Por dónde viene?</span>
          {!isMobile && <span style={{ opacity: 0.8 }}>Tu app de transportes.</span>}
          <span style={{ opacity: 0.7, fontWeight: 500, marginLeft: isMobile ? '6px' : '0' }}>v{packageInfo.version}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>© 2026 CollieTech. Todos los derechos reservados.</span>
          <a href="#" onClick={(e) => { e.preventDefault(); setInfoModal('privacy'); }} style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}>Privacidad</a>
          <a href="#" onClick={(e) => { e.preventDefault(); setInfoModal('terms'); }} style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}>Términos</a>
          <a href="#" onClick={(e) => { e.preventDefault(); setInfoModal('pricing'); }} style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}>Contáctanos</a>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>Español</a>
        </div>
      </div>
      </>
      )}

      {/* Popup de Descargas Compacto Central */}
      {infoModal === 'download' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)', zIndex: 3000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
          WebkitUserSelect: 'none', userSelect: 'none'
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '24px',
            padding: '28px',
            width: '100%',
            maxWidth: '400px',
            position: 'relative',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setInfoModal(null)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'rgba(0, 0, 0, 0.05)', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <X size={18} />
            </button>

            {/* Header info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/assets/images/bus-icon.png" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain' }} draggable={false} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 850, fontSize: '1.15rem', color: 'var(--text-primary)', lineHeight: '1.2' }}>¿Por dónde viene?</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tu app de transportes</span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Descarga la app oficial en tu dispositivo
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Botón PWA (Solo si no es iOS y no está corriendo en PWA instalada) */}
              {deviceType !== 'ios' && !isPwaRunning && (
                <button
                  onClick={handleInstallPWA}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.15)'
                  }}
                >
                  <Download size={16} />
                  Instalar Web App
                </button>
              )}

              {/* Guía de instalación manual en Safari para iOS (Solo si es iOS y no está en PWA) */}
              {deviceType === 'ios' && !isPwaRunning && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.4'
                }}>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '6px' }}>Instalación en iOS (Safari):</strong>
                  <ol style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li>Pulsá el botón <strong>Compartir</strong> (<span style={{ fontSize: '1rem' }}>⎋</span>) abajo en Safari.</li>
                    <li>Seleccioná la opción <strong>"Agregar a inicio"</strong>.</li>
                  </ol>
                </div>
              )}

              {/* Botón Android APK (Solo si es browser o android) */}
              {(deviceType === 'browser' || deviceType === 'android') && (
                <button
                  onClick={() => window.open('/downloads/por-donde-viene-latest.apk', '_blank')}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.15)'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '2px' }}>
                    <path d="M2.76 3.061a.5.5 0 0 1 .679.2l1.283 2.352A8.94 8.94 0 0 1 8 5c1.15 0 2.23.22 3.218.613L12.56 3.26a.5.5 0 1 1 .88.475l-1.28 2.347A8.96 8.96 0 0 1 14 11.5a.5.5 0 0 1-1 0A7.96 7.96 0 0 0 8 4a7.96 7.96 0 0 0-5 7.5.5.5 0 0 1-1 0A8.96 8.96 0 0 1 2.76 3.06Z"/>
                  </svg>
                  Descargar para Android
                </button>
              )}

              {/* Botón iOS App Store (Solo si es browser o ios) */}
              {(deviceType === 'browser' || deviceType === 'ios') && (
                <button
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'var(--border)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '2px' }}>
                    <path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516.024.034 1.52.087 2.475-1.258.955-1.345.762-2.391.728-2.43Zm3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422.212-2.189 1.675-2.789 1.698-2.854-.023-.065-.597-.79-1.254-1.157a3.692 3.692 0 0 0-2.922-.192c-.224.096-.994.545-1.43.545-.436 0-1.156-.465-1.536-.465C5.811 4.197 4.093 5.922 4.093 8.784c0 2.863 1.956 5.862 3.197 7.07 1.24 1.209 2.112 1.134 2.584 1.134.472 0 1.217-.6 1.92-.6.702 0 1.345.545 1.968.545.623 0 1.706-1.109 2.37-2.185.663-1.076.903-2.124.912-2.173-.009-.049-.009-.049-.636-.788Z"/>
                  </svg>
                  Descargar para iOS (Muy pronto)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Modal (Privacy & Terms) */}
      {infoModal && infoModal !== 'download' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: '32px',
          background: 'var(--bg-primary)', zIndex: 1999,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          WebkitUserSelect: 'none', userSelect: 'none'
        }}>
          {/* Sticky Header */}
          <div style={{
            position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 10,
            borderBottom: '1px solid var(--border)', padding: '16px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img src="/assets/images/bus-icon.png" alt="Logo" style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'contain' }} draggable={false} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--text-primary)', lineHeight: '1.2' }}>¿Por dónde viene?</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, paddingLeft: '13px' }}>Tu app de transportes</span>
              </div>
            </div>
            <button 
              onClick={() => setInfoModal(null)}
              style={{
                background: 'rgba(0, 0, 0, 0.05)',
                border: 'none',
                borderRadius: '20px',
                padding: '8px 20px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              Cerrar
            </button>
          </div>

          <div style={{
            background: '#ffffff', width: '100%', maxWidth: '800px', margin: '0 auto',
            minHeight: 'calc(100vh - 32px - 65px)', padding: '40px 24px', display: 'flex', flexDirection: 'column',
            position: 'relative'
          }}>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '2rem', fontWeight: 900 }}>
                {infoModal === 'privacy' ? 'Políticas de Privacidad' : infoModal === 'pricing' ? 'Contáctanos' : 'Términos y Condiciones'}
              </h2>
            </div>
            <div style={{ flex: 1, color: '#334155', fontSize: '0.95rem', lineHeight: '1.7', paddingBottom: '60px' }}>
              <p style={{ marginBottom: '32px', fontSize: '1.1rem', color: '#0f172a', fontWeight: 700 }}>
                Última actualización: 22 de julio de 2026
              </p>
              {infoModal === 'pricing' ? (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                      Soluciones diseñadas tanto para negocios locales como para empresas de transporte de pasajeros.
                    </p>
                  </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginTop: '32px' }}>
                      {/* Plan Publicitario */}
                      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>Plan Publicitario</h3>
                        <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '8px' }}>
                          Consultar
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', minHeight: '40px' }}>Promociona tu comercio para llegar a miles de usuarios diarios.</p>
                        
                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                          <li style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}><Check size={16} color="var(--accent)"/> Banners destacados en la app</li>
                          <li style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}><Check size={16} color="var(--accent)"/> Redirección a WhatsApp o Web</li>
                        </ul>
                      </div>

                      {/* Plan Flota Privada */}
                      <div style={{ background: 'var(--accent)', border: 'none', borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 10px 30px rgba(59, 130, 246, 0.3)', opacity: 0.95 }}>
                        <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Próximamente</div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>Plan Corporativo</h3>
                        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginBottom: '24px', minHeight: '40px' }}>Seguimiento para transporte privado de pasajeros (Ej. Servicio de transportes laborales).</p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                          <li style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#fff', fontSize: '0.9rem' }}><Check size={16} color="#fff"/> Telemetría y monitoreo en vivo</li>
                          <li style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#fff', fontSize: '0.9rem' }}><Check size={16} color="#fff"/> Recorridos privados y seguros</li>
                          <li style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#fff', fontSize: '0.9rem' }}><Check size={16} color="#fff"/> Panel de control y alertas</li>
                          <li style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#fff', fontSize: '0.9rem' }}><Check size={16} color="#fff"/> Soporte dedicado y marca blanca</li>
                        </ul>
                        <button disabled={true} style={{ width: '100%', padding: '12px', background: 'rgba(255, 255, 255, 0.25)', border: 'none', borderRadius: '8px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 800, cursor: 'not-allowed' }}>No Disponible</button>
                      </div>
                    </div>
                  </>
              ) : infoModal === 'privacy' ? (
                <div className="legal-content-container" dangerouslySetInnerHTML={{ __html: config?.privacy_content || DEFAULT_PRIVACY_CONTENT }} />
              ) : (
                <div className="legal-content-container" dangerouslySetInnerHTML={{ __html: config?.terms_content || DEFAULT_TERMS_CONTENT }} />
              )}
            </div>
          </div>
        </div>
      )}

      {showTermsAcceptance && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', zIndex: 10000,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '16px', boxSizing: 'border-box',
          fontFamily: 'Inter, sans-serif',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            maxWidth: '460px', width: '100%',
            background: 'var(--bg-primary, #ffffff)',
            borderRadius: '20px', border: '1px solid var(--border)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
            maxHeight: '90vh'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/assets/images/bus-icon.png" alt="Logo" style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'contain' }} draggable={false} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)', lineHeight: '1.2' }}>¿Por dónde viene?</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, paddingLeft: '11px' }}>Tu app de transportes</span>
              </div>
            </div>

            {/* Separador */}
            <div style={{ height: '1px', background: 'var(--border)' }} />

            {/* Texto de términos */}
            <div style={{ 
              fontSize: '0.88rem', color: '#1e293b', lineHeight: '1.6', 
              maxHeight: '45vh', overflowY: 'auto', paddingRight: '6px'
            }}>
              <h3 style={{ fontSize: '1.02rem', fontWeight: 800, margin: '0 0 12px 0', color: '#0f172a' }}>Términos y condiciones de uso</h3>
              Bienvenido a ¿Por dónde viene? Tu app de transportes. Para poder utilizar la aplicación, por favor acepta nuestros términos y condiciones de uso y políticas de privacidad.
              
              <div style={{ marginTop: '16px', fontSize: '0.85rem' }}>
                Podés consultar los detalles completos en nuestros{' '}
                <span 
                  style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }} 
                  onClick={() => setInfoModal('terms')}
                >
                  Términos y Condiciones
                </span>
                {' '}y la{' '}
                <span 
                  style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }} 
                  onClick={() => setInfoModal('privacy')}
                >
                  Política de Privacidad
                </span>.
              </div>
            </div>

            {/* Separador */}
            <div style={{ height: '1px', background: 'var(--border)' }} />

            {/* Checkbox de aceptación */}
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0', cursor: 'pointer', userSelect: 'none' }} 
              onClick={() => setTermsChecked(!termsChecked)}
            >
              <input 
                type="checkbox" 
                checked={termsChecked} 
                onChange={() => {}} 
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  border: '2px solid var(--border)',
                  cursor: 'pointer'
                }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                Acepto los términos y condiciones de uso
              </span>
            </div>

            {/* Separador */}
            <div style={{ height: '1px', background: 'var(--border)' }} />

            {/* Footer / Botón de aceptar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <button
                onClick={() => {
                  if (termsChecked) handleAcceptTerms();
                }}
                disabled={!termsChecked}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  background: termsChecked ? 'var(--accent, #3b82f6)' : 'var(--border, #cbd5e1)',
                  color: termsChecked ? '#ffffff' : 'var(--text-muted, #64748b)',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: termsChecked ? 'pointer' : 'not-allowed',
                  boxShadow: termsChecked ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)' : 'none',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: termsChecked ? 1 : 0.7
                }}
                onMouseOver={(e) => {
                  if (termsChecked) {
                    e.currentTarget.style.background = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseOut={(e) => {
                  if (termsChecked) {
                    e.currentTarget.style.background = 'var(--accent, #3b82f6)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                Aceptar y Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {isScreenProtected && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: '#000000',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '24px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            maxWidth: '320px',
            width: '90%'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: '#ef4444'
            }}>
              <EyeOff size={24} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.01em' }}>
              Pantalla Protegida
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
              El contenido no está disponible temporalmente para prevenir capturas o grabaciones de pantalla no autorizadas.
            </p>
          </div>
        </div>
      )}

      {/* Modal Explicativo de GPS Colaborativo */}
      {showCollaborativeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-primary, #ffffff)',
            color: 'var(--text-primary, #0f172a)',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            fontFamily: 'Inter, system-ui, sans-serif'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981'
                }}>
                  <Radio size={22} color="#10b981" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>GPS Colaborativo</h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Comunidad de Pasajeros</span>
                </div>
              </div>
              <button
                onClick={() => setShowCollaborativeModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Explicación */}
            <p style={{ fontSize: '0.88rem', lineHeight: '1.5', color: 'var(--text-primary)', margin: '0 0 16px 0' }}>
              Al activar el <strong>GPS Colaborativo</strong>, tu celular compartirá la posición en vivo mientras viajás a bordo de un colectivo.
            </p>

            <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '12px', padding: '14px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem' }}>
                <span style={{ color: '#10b981', fontWeight: 900, fontSize: '1rem' }}>✓</span>
                <span><strong>100% Anónimo:</strong> No guardamos tus datos ni identidad.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem' }}>
                <span style={{ color: '#d97706', fontWeight: 900, fontSize: '1rem' }}>🟡</span>
                <span>Alimenta el <strong>Círculo Amarillo</strong> en el mapa para informar a otros pasajeros la posición del colectivo.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem' }}>
                <span style={{ color: '#3b82f6', fontWeight: 900, fontSize: '1rem' }}>⚡</span>
                <span><strong>Mínimo consumo:</strong> Se apaga automáticamente a los 50 minutos para ahorrar batería.</span>
              </div>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowCollaborativeModal(false)}
                style={{
                  flex: 1, padding: '12px', background: 'transparent', border: '1px solid #cbd5e1',
                  borderRadius: '12px', fontWeight: 600, fontSize: '0.88rem', color: '#64748b', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setIsCollaborativeGpsActive(true);
                  setShowUserLocation(true);
                  setShowCollaborativeModal(false);
                }}
                style={{
                  flex: 1.4, padding: '12px', background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '0.88rem',
                  color: '#ffffff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                }}
              >
                Activar y Compartir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Caché en Memoria del Cliente (10 minutos / 600.000 ms)
const TIMETABLE_CLIENT_CACHE: Record<string, { data: any; timestamp: number }> = {};
const CLIENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

function getClientCachedTimetable(cacheKey: string) {
  const entry = TIMETABLE_CLIENT_CACHE[cacheKey];
  if (entry && (Date.now() - entry.timestamp) < CLIENT_CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
}

function setClientCachedTimetable(cacheKey: string, data: any) {
  TIMETABLE_CLIENT_CACHE[cacheKey] = { data, timestamp: Date.now() };
}

export default App;
