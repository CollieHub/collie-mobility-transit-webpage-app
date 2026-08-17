import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, ZoomControl, useMap, Tooltip, CircleMarker, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Clock, CloudDownload, Trash2, CheckCircle2, AlertCircle, X, Download, Search, MapPin, Users, Bell, BellOff, GitCommit } from 'lucide-react';
import { getPublicToken } from '../lib/api/publicToken';
import { getApiBaseUrl, getWsUrl } from '../lib/api/envConfig';
import { getStopIconSvgString } from './icons/StopIcon';
import { isHoliday } from '../lib/holidays';
import OfflineMapDownloader from './OfflineMapDownloader';
import { matchGpsToScheduledTrips } from '../lib/redsube/matchingEngine';
import { resolveCuandoSuboAlias } from '../lib/redsube/crossReferenceMap';
import { getInterpolatedVehiclePosition, getProjectedVehiclePosition } from '../lib/redsube/smoothMotion';

const ZARATE_CENTER: [number, number] = [-34.0970, -59.0300];
const CLIENT_VERSION = '1.0.92';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const nativeStopIconCache = new Map<string, L.Icon>();

const getNativeStopIcon = (color: string, direction: 'ida' | 'vuelta', size: number = 18): L.Icon => {
  const isIda = direction !== 'vuelta';
  const key = `${color}-${isIda}-${size}`;
  if (nativeStopIconCache.has(key)) {
    return nativeStopIconCache.get(key)!;
  }
  const svgCode = getStopIconSvgString(color, isIda, size);
  const iconUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgCode)}`;
  const icon = L.icon({
    iconUrl,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
  nativeStopIconCache.set(key, icon);
  return icon;
};

const createStopIcon = (color: string, direction: 'ida' | 'vuelta', size: number) => {
  return getNativeStopIcon(color, direction, size);
};

// Helper para normalizar nombres y comparar de manera flexible
function normalizeStopName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remover acentos
    .replace(/[^a-z0-9]/g, "") // remover caracteres especiales
    .trim();
}

function matchesDeclaredControlStop(declaredStr: string, stopId: string, stopName: string): boolean {
  if (!declaredStr) return false;
  
  // 1. Coincidencia exacta de ID
  if (stopId && declaredStr === stopId) return true;

  const normDeclared = normalizeStopName(declaredStr);
  const cleanDeclared = normalizeStopName(declaredStr.replace(/^\d+[\.\s\-]+\s*/, ''));

  const normStop = normalizeStopName(stopName);
  const cleanStop = normalizeStopName((stopName || '').replace(/^\d+[\.\s\-]+\s*/, ''));

  if (!normDeclared || !normStop) return false;

  // 2. Coincidencia exacta de texto normalizado o texto limpio sin prefijo numerico
  if (normDeclared === normStop || cleanDeclared === cleanStop || normDeclared === cleanStop || cleanDeclared === normStop) {
    return true;
  }

  // 3. Coincidencia por prefijo/subcadena para encabezados concisos (ej. "Estación", "Barrio España")
  if (normDeclared.length >= 4 && normStop.length >= 4) {
    if (normStop.startsWith(normDeclared) || normDeclared.startsWith(normStop) || cleanStop.startsWith(cleanDeclared) || cleanDeclared.startsWith(cleanStop)) {
      return true;
    }
  }

  return false;
}

// Verifica si la parada está configurada en la grilla de horarios de alguno de los ramales activos para la dirección dada
function isStopInSchedule(stopId: string, stopName: string, stopDirection: string, schedules: any): boolean {
  if (!schedules) return false;

  let scheduleEntries: any[] = [];
  if (Array.isArray(schedules)) {
    scheduleEntries = schedules;
  } else if (typeof schedules === 'object') {
    scheduleEntries = Object.values(schedules);
  }

  if (scheduleEntries.length === 0) return false;

  for (const s of scheduleEntries) {
    if (!s || typeof s !== 'object') continue;

    // Si la entrada contiene anidado s.schedules
    if (s.schedules && typeof s.schedules === 'object') {
      if (isStopInSchedule(stopId, stopName, stopDirection, s.schedules)) return true;
    }

    // 1. Mapeos de paradas asignadas (stopMappings)
    if (s.stopMappings && typeof s.stopMappings === 'object') {
      for (const mapKey in s.stopMappings) {
        if (matchesDeclaredControlStop(s.stopMappings[mapKey], stopId, stopName)) return true;
      }
    }

    // 2. Paradas asignadas (stopAddresses / stop_addresses_json)
    let addrs: string[] = [];
    try {
      addrs = Array.isArray(s.stopAddresses) ? s.stopAddresses : (typeof s.stop_addresses_json === 'string' ? JSON.parse(s.stop_addresses_json || '[]') : s.stop_addresses_json) || [];
    } catch (_) {}
    if (Array.isArray(addrs) && addrs.length > 0) {
      if (addrs.some((a: string) => matchesDeclaredControlStop(a, stopId, stopName))) return true;
    }

    // 3. Paradas de control declaradas (control_stops / controlStops)
    let ctrlStops: string[] = [];
    try {
      ctrlStops = Array.isArray(s.control_stops) ? s.control_stops : (Array.isArray(s.controlStops) ? s.controlStops : []);
    } catch (_) {}
    if (Array.isArray(ctrlStops) && ctrlStops.length > 0) {
      if (ctrlStops.some((cs: string) => matchesDeclaredControlStop(cs, stopId, stopName))) return true;
    }

    // 4. Encabezados de planilla (headers / headers_json)
    let hdrs: string[] = [];
    try {
      hdrs = Array.isArray(s.headers) ? s.headers : (typeof s.headers_json === 'string' ? JSON.parse(s.headers_json || '[]') : s.headers_json) || [];
    } catch (_) {}
    if (Array.isArray(hdrs) && hdrs.length > 0) {
      if (hdrs.some((h: string) => matchesDeclaredControlStop(h, stopId, stopName))) return true;
    }
  }

  return false;
}

const createStopSequenceIcon = (color: string, sequence: number | string, size: number) => {
  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid #ffffff;
      color: #ffffff;
      font-family: Arial, sans-serif;
      font-size: ${size * 0.45}px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    ">
      ${sequence}
    </div>
  `;
  return L.divIcon({ className: 'custom-stop-sequence', html: html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
};

const createWaypointCircleDotIcon = (color: string = '#f59e0b', size: number) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.45));">
      <circle cx="12" cy="12" r="10" fill="${color}" stroke="#ffffff" stroke-width="2.2" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="#ffffff" stroke-width="1.8" />
      <polyline points="12,7.5 12,12 14.5,14.5" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  `;
  return L.divIcon({ className: 'custom-stop-waypoint', html: svg, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
};

const createBusIcon = (color: string, isRealTelemetry = false) => {
    const strokeProps = isRealTelemetry ? 'stroke="#00ffcc" stroke-width="3"' : 'stroke="#ffffff" stroke-width="2"';
    const wave = isRealTelemetry ? `
        <path d="M8 -2 Q 12 -6 16 -2" fill="none" stroke="#00ffcc" stroke-width="2" stroke-linecap="round"/>
        <path d="M5 -5 Q 12 -11 19 -5" fill="none" stroke="#00ffcc" stroke-width="2" stroke-linecap="round"/>
    ` : '';
    
    const svgCode = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30">
    <rect width="20" height="22" x="2" y="1" rx="4" fill="${color}" ${strokeProps}/>
    <rect width="14" height="6" x="5" y="4" rx="1" fill="rgba(255,255,255,0.85)"/>
    <circle cx="7" cy="19" r="2" fill="#fcd34d"/>
    <circle cx="17" cy="19" r="2" fill="#fcd34d"/>
    ${wave}
    </svg>`;
    return L.divIcon({ className: 'custom-bus-icon', html: svgCode, iconSize: [30, 30], iconAnchor: [15, 15] });
};

const createCabeceraMarkerIcon = (type: 'inicio' | 'fin', color: string, size: number = 24) => {
    const indicatorColor = type === 'inicio' ? '#10b981' : '#ef4444';
    const svgCode = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
      <!-- Fondo del Icono -->
      <rect width="32" height="32" rx="8" fill="${color}"/>
      <!-- Borde interior blanco continuo -->
      <rect x="1.5" y="1.5" width="29" height="29" rx="6.5" fill="none" stroke="#ffffff" stroke-width="1.5" />
      <!-- Colectivo Blanco -->
      <g transform="translate(4,4)">
          <path fill="#FFFFFF" d="M4,16c0,0.88 0.39,1.67 1,2.22l0,1.78c0,0.55 0.45,1 1,1l1,0c0.55,0 1,-0.45 1,-1l0,-1l8,0l0,1c0,0.55 0.45,1 1,1l1,0c0.55,0 1,-0.45 1,-1l0,-1.78c0.61,-0.55 1,-1.34 1,-2.22L20,6c0,-3.5 -3.58,-4 -8,-4s-8,0.5 -8,4l0,10zM7.5,17c-0.83,0 -1.5,-0.67 -1.5,-1.5S6.67,14 7.5,14s1.5,0.67 1.5,1.5S8.33,17 7.5,17zM16.5,17c-0.83,0 -1.5,-0.67 -1.5,-1.5s0.67,-1.5 1.5,-1.5s1.5,0.67 1.5,1.5S17.33,17 16.5,17zM18,11L6,11L6,6l12,0L18,11z"/>
      </g>
      <!-- Indicador verde/rojo para cabeceras -->
      <circle cx="27" cy="5" r="4.5" fill="${indicatorColor}" stroke="#ffffff" stroke-width="1.5"/>
    </svg>`;
    return L.divIcon({ className: 'custom-cabecera-marker', html: svgCode, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
};

const createTextMarkerIcon = (text: string, color: string) => {
    const width = text === 'Inicio' ? 56 : 46;
    const svgCode = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 24" width="${width}" height="24">
        <rect width="${width-2}" height="22" x="1" y="1" rx="11" fill="${color}" stroke="#ffffff" stroke-width="2"/>
        <text x="${width/2}" y="16" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">${text}</text>
    </svg>`;
    return L.divIcon({ className: 'custom-text-marker', html: svgCode, iconSize: [width, 24], iconAnchor: [width/2, 12] });
};



// === Physics (pure functions, no data dependency) ===
function geoDistance(p1: [number, number], p2: [number, number]): number {
  const R = 6371000;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLng = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBearing(lat1: number, lng1: number, lat2: number, lng2: number) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}



function timeToMin(timeStr: string): number {
  if (!timeStr) return -1;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return -1;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function lerp(p1: [number, number], p2: [number, number], t: number): { lat: number; lng: number } {
  return { lat: p1[0] + (p2[0] - p1[0]) * t, lng: p1[1] + (p2[1] - p1[1]) * t };
}

interface RoutePathData {
  coordinates: [number, number][];
  cumulativeDistances: number[];
  totalDistance: number;
}

function getPositionAtDistance(pathData: RoutePathData, distance: number): { lat: number; lng: number } {
  const { coordinates, cumulativeDistances, totalDistance } = pathData;
  if (coordinates.length === 0) return { lat: ZARATE_CENTER[0], lng: ZARATE_CENTER[1] };
  if (coordinates.length === 1 || distance <= 0) return { lat: coordinates[0][0], lng: coordinates[0][1] };
  if (distance >= totalDistance) return { lat: coordinates[coordinates.length - 1][0], lng: coordinates[coordinates.length - 1][1] };

  let lo = 0, hi = cumulativeDistances.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (cumulativeDistances[mid] <= distance) lo = mid; else hi = mid;
  }
  const segStart = cumulativeDistances[lo], segEnd = cumulativeDistances[hi], segLen = segEnd - segStart;
  const t = segLen > 0 ? (distance - segStart) / segLen : 0;
  return lerp(coordinates[lo], coordinates[Math.min(hi, coordinates.length - 1)], t);
}


// === Map Centerer ===
function MapCenterer({ boundsObj }: { boundsObj: { bounds: [number, number][], t: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (boundsObj && boundsObj.bounds && boundsObj.bounds.length > 0) {
      const latLngBounds = L.latLngBounds(boundsObj.bounds);
      const isMobile = window.innerWidth <= 768;
      // Añadir padding superior pronunciado (140px) para que el encuadre quede más abajo en la pantalla,
      // evitando que los banners de anuncios o la barra superior tapen la traza enfocado
      const paddingTop = isMobile ? 150 : 110;
      const paddingBottom = isMobile ? 50 : 40;
      const paddingLeft = isMobile ? 20 : 380;
      const paddingRight = 20;

      map.fitBounds(latLngBounds, {
        paddingTopLeft: [paddingLeft, paddingTop],
        paddingBottomRight: [paddingRight, paddingBottom],
        maxZoom: 15
      });
    }
  }, [boundsObj, map]);
  return null;
}

// === Map Zoom Listener ===
function MapZoomListener({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };
    map.on('zoomend', handleZoom);
    // Execute initially
    handleZoom();
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);
  return null;
}

interface Bus {
  id?: string;
  routeId: string; name: string; code: string; color: string;
  pos: [number, number]; dir: 'ida' | 'vuelta'; dist: number;
  speed: number; nextStop: string; tripIdx: number;
  startTime?: string; endTime?: string;
  bearing?: number;
  dispatchOrder?: number;
  onboardCount?: number;
  lastUpdateLocal?: number;
  stopTimes?: Record<string, { time: string; dispatchOrder: number }>;
  isCrowdsourced?: boolean;
  isDeviated?: boolean;
  deviationDistance?: number;
  deviationProjPoint?: [number, number] | null;
}

interface StopWaypoint { name: string; pathDist: number; stopIdx: number; }

interface Props { 
  showRouteArrows: boolean;
  showStartEndMarkers?: boolean;
  showVehicleLabels?: boolean;
  selectedRouteIds: Set<string>; 
  visibleRouteIds: Set<string>;
  routeStopsIda: Record<string, boolean>;
  routeStopsVuelta: Record<string, boolean>;
  routeShowIda?: Record<string, boolean>;
  routeShowVuelta?: Record<string, boolean>;
  routeBusesIda?: Record<string, boolean>;
  routeBusesVuelta?: Record<string, boolean>;
  focusedRouteBounds?: { bounds: [number, number][], t: number } | null;
  transitRoutes: any[];
  transitStops: any[];
  showStops?: boolean;
  showUserLocation?: boolean;
  onViewSchedule?: (routeCode: string) => void;
  onLiveBusesUpdate?: (buses: any[]) => void;
  showStopSequences?: boolean;
  showWaypoints?: boolean;
  livePollingEnabled?: boolean;
  livePollingIntervalSec?: number;
  mapStyle?: 'argenmap' | 'cartodb' | 'osm';
  searchLocation?: { lat: number; lon: number; name: string } | null;
  onClearSearchLocation?: () => void;
  offlineDownloaderOpen?: boolean;
  onOfflineDownloaderClose?: () => void;
  hideOfflineButton?: boolean;
  calendarExceptions?: any[];
  sidebarOpen?: boolean;
  onNearbyStopChange?: (nearbyStop: any) => void;
  triggerNearbyStopToggle?: number;
  onSimulationLog?: (logMsg: string) => void;
  showStopProjections?: boolean;
  enableGpsMatching?: boolean;
  showRawGps?: boolean;
  isAdmin?: boolean;
  isPWA?: boolean;
  isCollaborativeGpsActive?: boolean;
}

// === Stop Info Popup Component ===
const StopInfoPopup = ({ 
  stop, 
  transitRoutesRef, 
  liveBuses, 
  routePathData, 
  onViewSchedule, 
  waitingCount, 
  subscribedStop, 
  setSubscribedStop, 
  busTrackerRef,
  onReportArrived,
  reportCooldown,
  lastReportedStopId
}: { 
  stop: any, 
  transitRoutesRef: any[], 
  liveBuses: any[], 
  routePathData: any, 
  onViewSchedule?: (routeCode: string) => void, 
  waitingCount?: number, 
  subscribedStop: any, 
  setSubscribedStop: (val: any) => void, 
  busTrackerRef?: React.MutableRefObject<Record<string, { lastSegIdx: number; dir?: string; routeId?: string }>>,
  onReportArrived?: (stop: any, route: any) => void,
  reportCooldown?: boolean,
  lastReportedStopId?: string | null
}) => {
  const map = useMap();
  const arrivals = useMemo(() => {
    if (!liveBuses || !routePathData) return [];
    
    const list: any[] = [];
    const dir = stop.direction || 'ida';
    
    transitRoutesRef.forEach((route: any) => {
      if (!route.stops) return;
      if (route.stops.findIndex((s: any) => s.name === stop.name && s.direction === dir) === -1) return;
      
      const routeStops = route.stops.filter((s: any) => s.direction === dir);
      const stopIdx = routeStops.findIndex((s: any) => s.name === stop.name);
      
      if (stopIdx === -1) return;
      
      const pathData = routePathData[route.id]?.[dir];
      if (!pathData || !pathData.coordinates || pathData.coordinates.length < 2) return;
      
      // Coordenadas reales o previamente proyectadas de la parada
      const stopPos: [number, number] = (stop.projLat !== undefined && stop.projLng !== undefined)
        ? [stop.projLat, stop.projLng]
        : [stop.lat, stop.lng];

      // Punto proyectado de la parada sobre el trazado exacto de la ruta
      const stopProj = projectOnPolyline(stopPos, pathData.coordinates);
      const stopProjPoint = stopProj.point;
      
      const cumulativeDistances = pathData.cumulativeDistances;
      const stopDistance = cumulativeDistances[stopProj.segIdx] + stopProj.t * ((cumulativeDistances[stopProj.segIdx + 1] || pathData.totalDistance) - cumulativeDistances[stopProj.segIdx]);
      
      const matchingBuses = liveBuses.filter((bus: any) => (bus.routeId === route.id || bus.code === route.code) && bus.dir === dir);
      
      matchingBuses.forEach((bus: any) => {
        if (!bus.pos) return;
        
        // Proyección del colectivo sobre el trazado de la ruta
        const proj = projectOnPolyline(bus.pos, pathData.coordinates);
        const nextSegIdx = proj.segIdx;
        const t = proj.t;
        
        const busDist = cumulativeDistances[nextSegIdx] + t * ((cumulativeDistances[nextSegIdx + 1] || pathData.totalDistance) - cumulativeDistances[nextSegIdx]);
        
        // Distancia directa del colectivo al punto proyectado de la parada en el recorrido
        const directDist = geoDistance(stopProjPoint, bus.pos);
        
        // Solo considerar colectivos en camino hacia el punto proyectado de la parada (o a <=60m de tolerancia)
        if (busDist <= stopDistance + 60 || directDist < 45) {
          const remainingDist = Math.max(0, stopDistance - busDist);
          
          let speedKmh = Number(bus.speed || 0);
          if (speedKmh <= 0 || isNaN(speedKmh)) speedKmh = 25;
          const speedMps = speedKmh / 3.6;
          
          const etaSeconds = remainingDist / speedMps;
          const etaMins = Math.max(0, Math.floor(etaSeconds / 60));
          
          list.push({
            bus,
            route,
            remainingDist,
            etaSeconds,
            etaMins
          });
        }
      });
    });
    
    return list.sort((a, b) => a.remainingDist - b.remainingDist);
  }, [stop, transitRoutesRef, liveBuses, routePathData]);

  // Obtener la línea de colectivo correspondiente
  const route = useMemo(() => {
    if (stop.routeId) {
      return transitRoutesRef.find((r: any) => r.id === stop.routeId);
    }
    return transitRoutesRef.find((r: any) => (r.color || '').toUpperCase() === (stop.color || '').toUpperCase());
  }, [stop.routeId, stop.color, transitRoutesRef]);

  const isWaitingThis = subscribedStop && subscribedStop.stopId === stop.id && subscribedStop.routeId === route?.id;

  const handleToggleWaiting = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isWaitingThis) {
      setSubscribedStop(null);
    } else {
      if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            console.log('Permiso de notificaciones otorgado.');
          }
        });
      }
      setSubscribedStop({
        stopId: stop.id,
        stopName: stop.name,
        routeId: route?.id || '',
        routeCode: route?.code || '',
        direction: stop.direction || 'ida'
      });
      // Cerrar popup de la parada tras anclarla
      map.closePopup();
    }
  };

  // Obtener la información del sentido (Origen -> Destino)
  const routeDirectionInfo = useMemo(() => {
    if (!route) return null;
    const cleanName = route.name.replace(route.code, '').trim();
    const parts = cleanName.split(/ - | – |-|–/);
    if (parts.length >= 2) {
      const origin = parts[0].trim();
      const destination = parts[1].trim();
      return stop.direction === 'ida' ? `${origin} ➔ ${destination}` : `${destination} ➔ ${origin}`;
    }
    return null;
  }, [stop.direction, route]);

  const stopColor = stop.color || '#3b82f6';

  // Obtener el número de secuencia de la parada en el recorrido
  const stopSequenceNumber = useMemo(() => {
    if (!route || !route.stops) return null;
    const dir = stop.direction || 'ida';
    const routeStops = route.stops.filter((s: any) => s.direction === dir);
    const idx = routeStops.findIndex((s: any) => s.name === stop.name);
    return idx !== -1 ? idx + 1 : null;
  }, [stop, route]);

  return (
    <div style={{ 
      fontFamily: "'Inter', -apple-system, sans-serif", 
      color: '#0f172a', 
      minWidth: '220px', 
      padding: '4px' 
    }}>
      {/* Cabecera del popup de parada */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '4px',
        paddingBottom: '8px', 
        borderBottom: '1px solid #e2e8f0', 
        marginBottom: '10px' 
      }}>
        {/* Fila del título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          {/* Círculo sólido del color de la parada */}
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: stopColor,
            flexShrink: 0
          }} />
          {/* Título: Compañía + Código (ej. SIT RZ01) */}
          <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#0f172a' }}>
            {route ? `${(route.company || 'SIT').replace(/\s*\([^)]*transporte\s+local[^)]*\)/gi, '').trim()} ${route.code || ''}` : 'Parada'}
          </div>
          {/* Secuencia de parada a la derecha (ej. #6) */}
          {stopSequenceNumber !== null && (
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginLeft: 'auto' }}>
              #{stopSequenceNumber}
            </div>
          )}
        </div>

        {/* Recorrido (Sentido) */}
        {routeDirectionInfo && (
          <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, marginBottom: '2px' }}>
            {routeDirectionInfo}
          </div>
        )}

        {/* Nombre/Descripción de la parada */}
        <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
          {stop.description || stop.name}
        </div>

        {waitingCount !== undefined && waitingCount > 0 && (
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: '0.78rem', 
            color: '#d97706', 
            background: 'rgba(217, 119, 6, 0.08)',
            padding: '4px 8px',
            borderRadius: '6px',
            marginTop: '6px',
            fontWeight: 600
          }}>
            <Users size={11} />
            <span>{waitingCount} {waitingCount === 1 ? 'persona esperando' : 'personas esperando'}</span>
          </div>
        )}
      </div>

      {/* Listado de arribos */}
      <div>
        <div style={{ 
          fontSize: '0.75rem', 
          fontWeight: 700, 
          color: '#94a3b8', 
          textTransform: 'uppercase', 
          letterSpacing: '0.5px',
          marginBottom: '6px'
        }}>
          Próximos arribos
        </div>

        {arrivals.length === 0 ? (
          <div style={{ 
            fontSize: '0.8rem', 
            color: '#64748b', 
            background: '#f8fafc',
            borderRadius: '6px',
            padding: '8px',
            textAlign: 'center',
            border: '1px dashed #cbd5e1'
          }}>
            No se detectan colectivos próximos en esta dirección.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {arrivals.map((arrival: any, idx: number) => {
              const { bus, route, remainingDist, etaMins, etaSeconds } = arrival;
              const lineName = route.code || bus.code || 'BUS';
              const routeColor = route.color || '#3b82f6';
              const distText = remainingDist > 1000 
                ? `${(remainingDist / 1000).toFixed(1)} km` 
                : `${Math.round(remainingDist)} m`;

              const isArriving = (etaSeconds !== undefined && etaSeconds <= 35) || remainingDist <= 120;

              return (
                <div 
                  key={`${bus.id}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: `1px solid ${isArriving ? '#22c55e30' : '#e2e8f0'}`,
                    transition: 'all 0.2s',
                    boxShadow: isArriving ? '0 0 8px rgba(34, 197, 94, 0.1)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Círculo de color de línea */}
                    <div style={{ 
                      width: '10px', 
                      height: '10px', 
                      borderRadius: '50%', 
                      background: routeColor,
                      flexShrink: 0
                    }} />
                    
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                        {lineName} {bus.dispatchOrder ? `#${bus.dispatchOrder}` : ''}
                      </strong>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        a {distText}
                      </span>
                    </div>
                  </div>

                  {/* Badge de tiempo */}
                  {isArriving ? (
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      color: '#22c55e',
                      background: '#22c55e15',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      animation: 'pulse-green 2s infinite'
                    }}>
                      Llegando
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: '#0284c7',
                      background: '#0284c710',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {etaMins} min
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contenedor de Botones en Fila */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginTop: '12px',
        width: '100%'
      }}>
        {/* Fila superior de botones: Horarios y Esperar */}
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          {onViewSchedule && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewSchedule(route ? route.id : '');
              }}
              style={{
                flex: 1,
                padding: '8px 10px',
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#e2e8f0';
                e.currentTarget.style.color = '#1e293b';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.color = '#475569';
              }}
            >
              <Clock size={12} /> Horarios
            </button>
          )}

          {/* Botón de suscripción/espera (Derecha) */}
          <button
            onClick={handleToggleWaiting}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: isWaitingThis ? '#10b981' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: isWaitingThis ? '0 2px 4px rgba(16, 185, 129, 0.2)' : '0 2px 4px rgba(59, 130, 246, 0.2)',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = isWaitingThis ? '#059669' : '#2563eb'}
            onMouseOut={(e) => e.currentTarget.style.background = isWaitingThis ? '#10b981' : '#3b82f6'}
          >
            {isWaitingThis ? <BellOff size={12} /> : <Bell size={12} />}
            <span>{isWaitingThis ? 'Esperando' : 'Esperar'}</span>
          </button>
        </div>

        
      </div>
    </div>
  );
};
function getClosestPointOnSegment(p: [number, number], a: [number, number], b: [number, number]): [number, number] {
  const latP = p[0], lngP = p[1];
  const latA = a[0], lngA = a[1];
  const latB = b[0], lngB = b[1];

  const dy = latB - latA;
  const dx = lngB - lngA;

  if (dy === 0 && dx === 0) return [latA, lngA];

  const t = ((latP - latA) * dy + (lngP - lngA) * dx) / (dy * dy + dx * dx);
  const clampedT = Math.max(0, Math.min(1, t));

  return [
    latA + clampedT * dy,
    lngA + clampedT * dx
  ];
}

function getClosestPointOnPath(p: [number, number], path: [number, number][]): [number, number] {
  if (!path || path.length === 0) return p;
  if (path.length === 1) return path[0];

  let minSqDist = Infinity;
  let closestPoint = path[0];

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i+1];
    const pt = getClosestPointOnSegment(p, a, b);

    const sqDist = Math.pow(p[0] - pt[0], 2) + Math.pow(p[1] - pt[1], 2);
    if (sqDist < minSqDist) {
      minSqDist = sqDist;
      closestPoint = pt;
    }
  }

  return closestPoint;
}

// Proyecta un punto sobre la polyline y devuelve: segmentIndex, fracción dentro del segmento, y el punto proyectado
function projectOnPolyline(p: [number, number], path: [number, number][], lastSegIdx?: number): { segIdx: number; t: number; point: [number, number] } {
  if (!path || path.length === 0) return { segIdx: 0, t: 0, point: p };
  if (path.length === 1) return { segIdx: 0, t: 0, point: path[0] };

  let minSqDist = Infinity;
  let bestSegIdx = 0;
  let bestT = 0;
  let bestPoint: [number, number] = path[0];

  let startI = 0;
  let endI = path.length - 1;
  if (lastSegIdx !== undefined && lastSegIdx >= 0) {
    startI = Math.max(0, lastSegIdx - 2);
    endI = Math.min(path.length - 1, lastSegIdx + 5);
    if (startI >= endI) {
      startI = 0;
      endI = path.length - 1;
    }
  }

  for (let i = startI; i < endI; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dy = b[0] - a[0];
    const dx = b[1] - a[1];
    const lenSq = dy * dy + dx * dx;
    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dy + (p[1] - a[1]) * dx) / lenSq));
    }
    const pt: [number, number] = [a[0] + t * dy, a[1] + t * dx];
    const sqDist = Math.pow(p[0] - pt[0], 2) + Math.pow(p[1] - pt[1], 2);
    if (sqDist < minSqDist) {
      minSqDist = sqDist;
      bestSegIdx = i;
      bestT = t;
      bestPoint = pt;
    }
  }

  return { segIdx: bestSegIdx, t: bestT, point: bestPoint };
}

// Avanza una distancia (en metros) a lo largo de la polyline desde una posición dada (segIdx + t)
// Devuelve la nueva posición, bearing del segmento, y el nuevo segIdx + t
function advanceOnPolyline(
  path: [number, number][],
  segIdx: number,
  t: number,
  distMeters: number
): { pos: [number, number]; bearing: number; segIdx: number; t: number } {
  if (!path || path.length < 2) {
    return { pos: path?.[0] || [0, 0], bearing: 0, segIdx: 0, t: 0 };
  }

  let currentSeg = segIdx;
  let currentT = t;
  let remaining = distMeters;

  while (remaining > 0 && currentSeg < path.length - 1) {
    const a = path[currentSeg];
    const b = path[currentSeg + 1];
    const segLen = geoDistance(a, b);

    if (segLen < 0.01) {
      // Segmento de longitud cero, avanzar al siguiente
      currentSeg++;
      currentT = 0;
      continue;
    }

    const remainingSegDist = (1 - currentT) * segLen;

    if (remaining <= remainingSegDist) {
      // Terminamos dentro de este segmento
      currentT += remaining / segLen;
      remaining = 0;
    } else {
      // Consumimos el resto de este segmento y pasamos al siguiente
      remaining -= remainingSegDist;
      currentSeg++;
      currentT = 0;
    }
  }

  // Clampar al final de la polyline
  if (currentSeg >= path.length - 1) {
    currentSeg = path.length - 2;
    currentT = 1;
  }

  const a = path[currentSeg];
  const b = path[currentSeg + 1];
  const pos: [number, number] = [
    a[0] + currentT * (b[0] - a[0]),
    a[1] + currentT * (b[1] - a[1])
  ];
  const bearing = getBearing(a[0], a[1], b[0], b[1]);

  return { pos, bearing, segIdx: currentSeg, t: currentT };
}

const createBusTopDownSvg = (color = '#3b82f6') => {
  return `<svg width="18" height="40" viewBox="0 0 24 52" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
      <!-- Cuerpo del Colectivo (Vista superior) -->
      <rect x="2" y="2" width="20" height="48" rx="4" fill="${color}" stroke="#1e293b" stroke-width="2"/>
      <!-- Techo / Detalles superiores -->
      <rect x="4" y="10" width="16" height="28" rx="2" fill="rgba(255, 255, 255, 0.15)"/>
      <!-- Parabrisas delantero -->
      <rect x="4" y="5" width="16" height="3" rx="1" fill="#93c5fd" stroke="#1e293b" stroke-width="1"/>
      <!-- Luneta trasera -->
      <rect x="4" y="44" width="16" height="2" rx="0.5" fill="#93c5fd" stroke="#1e293b" stroke-width="1"/>
      <!-- Aire Acondicionado / Escotilla de techo -->
      <rect x="8" y="20" width="8" height="8" rx="1.5" fill="#ffffff" stroke="#1e293b" stroke-width="1.5"/>
      <!-- Luces delanteras de giro/faros -->
      <circle cx="5" cy="3" r="1" fill="#fbbf24"/>
      <circle cx="19" cy="3" r="1" fill="#fbbf24"/>
  </svg>`;
};

const getFormattedLineText = (lineName: string) => {
  if (!lineName) return '';
  if (/^(l[ií]nea\s+)/i.test(lineName)) {
    return lineName;
  }
  return `Línea ${lineName}`;
};

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

const createBusIconTopDown = (color: string, bearing: number, labelLine1: string, labelLine2: string, showLabel: boolean = true, endTime: string = '', isMoving: boolean = false, hasGpsMatch: boolean = false, isRawGps: boolean = false) => {
  const labelHtml = showLabel ? `
      <!-- Etiqueta flotante Premium -->
      <div style="position: absolute; bottom: 54px; background: ${color}; border: 1.5px solid #ffffff; color: #ffffff; font-family: 'Inter', -apple-system, sans-serif; font-size: 11px; font-weight: 800; padding: 4px 9px; border-radius: 6px; pointer-events: auto; text-align: center; white-space: nowrap; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4); z-index: 3000; line-height: 1.2;">
        ${labelLine1 ? `
          <div style="color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
            ${labelLine1}
          </div>
        ` : ''}
        ${labelLine2 ? `
          <div style="color: rgba(255, 255, 255, 0.95); font-size: 10.5px; font-weight: 600;">
            ${labelLine2}
          </div>
        ` : ''}
      </div>
  ` : '';

  const auraColor = isRawGps ? '#eab308' : (hasGpsMatch ? '#059669' : '#dc2626');
  const auraBg = isRawGps ? 'rgba(234, 179, 8, 0.15)' : (hasGpsMatch ? 'rgba(5, 150, 105, 0.15)' : 'rgba(220, 38, 38, 0.12)');
  const auraGlow = isRawGps ? '0 0 14px rgba(234, 179, 8, 0.75)' : (hasGpsMatch ? '0 0 14px rgba(5, 150, 105, 0.75), inset 0 0 6px rgba(5, 150, 105, 0.35)' : '0 0 12px rgba(220, 38, 38, 0.5)');

  const sonarHtml = (isMoving || isRawGps) ? `
      <!-- Aura/Sonar de movimiento -->
      <div class="bus-sonar-pulse" style="border-color: ${auraColor}; background: ${auraBg}; box-shadow: ${auraGlow};"></div>
  ` : '';

  const stopBadgeHtml = !isMoving ? `
      <!-- Cartelito de STOP a la derecha con animación de pulso -->
      <div style="position: absolute; left: 24px; top: 12px; background: #dc2626; border: 1.5px solid #ffffff; color: #ffffff; font-family: 'Inter', -apple-system, sans-serif; font-size: 9px; font-weight: 900; padding: 2px 7px; border-radius: 4px; pointer-events: auto; text-align: center; white-space: nowrap; z-index: 4000; display: flex; align-items: center; justify-content: center; letter-spacing: 0.5px; animation: stopPulse 1.2s infinite alternate; height: 16px;">
        STOP
      </div>
  ` : '';

  const htmlCode = `
    <div style="position: relative; width: 18px; height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      ${labelHtml}
      ${sonarHtml}
      ${stopBadgeHtml}
      <!-- Icono del bus con rotacion (el frente del bus se ancla en la línea del recorrido desplazado 1/4 hacia atrás) -->
      <div class="topdown-bus-vehicle" style="transform: rotate(${bearing}deg); transform-origin: 50% 37.5%; width: 18px; height: 40px; display: flex; align-items: center; justify-content: center; z-index: 2000;">
        ${createBusTopDownSvg(color)}
      </div>
    </div>
  `;
  return L.divIcon({ 
    className: 'topdown-bus-icon-container', 
    html: htmlCode, 
    iconSize: [18, 40], 
    iconAnchor: [9, 15] 
  });
};

interface LeafletVehicleMarkerProps {
  bus: Bus;
  shapeCoords: [number, number][] | null;
  isSelected?: boolean;
  showVehicleLabels?: boolean;
  lineName?: string;
  onViewSchedule?: (routeCode: string) => void;
  totalTrips?: string | number;
  routeDirectionInfo?: string;
  showWaypoints?: boolean;
}

const LeafletVehicleMarker = React.memo(({ bus, shapeCoords, isSelected = false, showVehicleLabels = true, lineName = '', onViewSchedule, totalTrips, routeDirectionInfo, showWaypoints = false }: LeafletVehicleMarkerProps) => {
  const markerRef = useRef<L.Marker>(null);
  const [showLocalLabel, setShowLocalLabel] = useState<boolean>(showVehicleLabels);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const frozenPosRef = useRef<[number, number] | null>(null);
  const currentSpeedRef = useRef<number>(0);
  const frozenBearingRef = useRef<number | null>(null);

  useEffect(() => {
    setShowLocalLabel(showVehicleLabels);
  }, [showVehicleLabels]);

  const targetRef = useRef({ pos: bus.pos, bearing: bus.bearing || 0, speed: bus.speed || 0 });
  const currentRef = useRef({ pos: bus.pos, bearing: bus.bearing || 0, lastTickTime: Date.now() });
  const polylineStateRef = useRef<{ segIdx: number; t: number } | null>(null);
  const targetProjRef = useRef<{ segIdx: number; t: number; pos: [number, number] } | null>(null);
  const lastApiPositionRef = useRef<{ pos: [number, number]; time: number } | null>(null);
  
  // Referencias para medir dinámicamente el intervalo de actualización de telemetría (polling)
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const pollingIntervalRef = useRef<number>(3.0); // 3 segundos por defecto en local

  useEffect(() => {
    const now = Date.now();
    
    // Medir la brecha temporal entre peticiones del backend
    const dtSeconds = (now - lastUpdateTimeRef.current) / 1000;
    if (dtSeconds > 0.5 && dtSeconds < 45.0) {
      pollingIntervalRef.current = dtSeconds;
    }
    lastUpdateTimeRef.current = now;

    let speed = bus.speed || 0;
    const currentPos = currentRef.current.pos;

    if (lastApiPositionRef.current) {
      const last = lastApiPositionRef.current;
      const dist = geoDistance(last.pos, bus.pos);
      const dtSecondsCalc = (now - last.time) / 1000;
      if (dtSecondsCalc > 1.0) {
        const calculatedSpeed = dist / dtSecondsCalc;
        if (calculatedSpeed < 36.0) {
          speed = calculatedSpeed;
        }
      }
    }

    lastApiPositionRef.current = { pos: bus.pos, time: now };
    targetRef.current = { pos: bus.pos, bearing: bus.bearing || 0, speed };

    // Actualizar la proyección sobre la polyline cuando llega nueva posición del backend
    if (shapeCoords && shapeCoords.length >= 2) {
      const lastIdx = polylineStateRef.current?.segIdx;
      const proj = projectOnPolyline(bus.pos, shapeCoords, lastIdx);
      
      if (!polylineStateRef.current) {
        polylineStateRef.current = { segIdx: proj.segIdx, t: proj.t };
        currentRef.current.pos = proj.point;
      } else {
        const distanceProj = geoDistance(currentPos, proj.point);
        const ahead = proj.segIdx > polylineStateRef.current.segIdx ||
          (proj.segIdx === polylineStateRef.current.segIdx && proj.t >= polylineStateRef.current.t);

        if (distanceProj > 120) {
          const shouldJump = !ahead || distanceProj > 300;
          if (shouldJump) {
            const el = markerRef.current?.getElement();
            if (el) {
              el.style.transition = 'opacity 0.2s ease-in-out';
              el.style.opacity = '0';
              setTimeout(() => {
                polylineStateRef.current = { segIdx: proj.segIdx, t: proj.t };
                currentRef.current.pos = proj.point;
                if (markerRef.current) {
                  markerRef.current.setLatLng(proj.point);
                }
                setTimeout(() => {
                  if (el) el.style.opacity = '1';
                }, 50);
              }, 200);
            } else {
              polylineStateRef.current = { segIdx: proj.segIdx, t: proj.t };
              currentRef.current.pos = proj.point;
            }
          }
        }
      }
      
      targetProjRef.current = { segIdx: proj.segIdx, t: proj.t, pos: proj.point };
    }
  }, [bus.pos, bus.speed, bus.bearing, shapeCoords]);

  useEffect(() => {
    let frameId: number;
    currentRef.current.lastTickTime = Date.now();

    const tick = () => {
      const current = currentRef.current;
      const target = targetRef.current;
      const now = Date.now();
      const dt = Math.max(0.001, Math.min(1.0, (now - current.lastTickTime) / 1000));
      current.lastTickTime = now;

      // === Interpolación sobre la polyline ===
      if (shapeCoords && shapeCoords.length >= 2 && polylineStateRef.current && targetProjRef.current && !bus.isDeviated) {
        const targetProj = targetProjRef.current;
        const distToTarget = geoDistance(current.pos, targetProj.pos);

        // Si la distancia es muy chica (menor a 0.1 metros), nos quedamos quietos o nos alineamos
        let currentSpeed = 0;
        if (distToTarget > 0.1) {
          // Determinar si el target está adelante en la polyline
          const ahead = targetProj.segIdx > polylineStateRef.current.segIdx ||
            (targetProj.segIdx === polylineStateRef.current.segIdx && targetProj.t >= polylineStateRef.current.t);

          // Velocidad base
          const baseSpeed = target.speed || 0;
          const pollingInterval = Math.max(0.5, pollingIntervalRef.current);
          const targetSpeed = distToTarget / pollingInterval;
          
          if (ahead) {
            if (distToTarget > 30.0) {
              // Catch-up activo: permitimos velocidad más alta para alcanzar el target en vuelo de forma continua, limitada a 40 km/h (11.11 m/s)
              const catchUpSpeed = distToTarget / pollingInterval;
              currentSpeed = Math.min(11.11, catchUpSpeed);
            } else {
              // Cerca del target: convergencia suave acotada a la velocidad de la API
              if (baseSpeed > 0) {
                const minAllowedSpeed = baseSpeed * 0.75;
                const maxAllowedSpeed = baseSpeed * 1.25;
                currentSpeed = Math.min(maxAllowedSpeed, Math.max(minAllowedSpeed, targetSpeed));
              } else {
                currentSpeed = Math.min(5.0, targetSpeed);
              }
            }
          } else {
            // El target está atrás (desvío temporal). Desaceleramos suavemente para dejar que el target vuelva a alinearse
            currentSpeed = Math.max(0, baseSpeed - (distToTarget / pollingInterval));
          }
          
          // Limitar la velocidad máxima a 40 km/h (11.11 m/s) en calles y avenidas
          currentSpeed = Math.min(currentSpeed, 11.11);
        }
        currentSpeedRef.current = currentSpeed;

        if (currentSpeed > 0.1) {
          const distToAdvance = currentSpeed * dt;
          const result = advanceOnPolyline(
            shapeCoords,
            polylineStateRef.current.segIdx,
            polylineStateRef.current.t,
            distToAdvance
          );
          
          polylineStateRef.current = { segIdx: result.segIdx, t: result.t };
          current.pos = result.pos;

          // Suavizar el bearing — factor alto para alinearse rápidamente con el segmento
          let diffB = result.bearing - current.bearing;
          if (diffB > 180) diffB -= 360;
          if (diffB < -180) diffB += 360;
          current.bearing = (current.bearing + diffB * 0.85 + 360) % 360;
        }

      } else if (!shapeCoords || shapeCoords.length < 2) {
        const rawSpeed = target.speed || 0;
        const speedKmh = rawSpeed * 3.6;
        let speedLimit = 40;
        if (speedKmh > 65) speedLimit = 90;
        else if (speedKmh > 40) speedLimit = 60;

        const speedLimitMps = speedLimit / 3.6;
        let currentSpeed = Math.min(rawSpeed, speedLimitMps);

        const distToTarget = geoDistance(current.pos, target.pos);

        // Si la distancia al target es muy grande (> 120m), reposicionar instantáneamente
        if (distToTarget > 120) {
          console.warn(`⚠️ [BUS_LOG:${bus.id}] ⚡ SALTO DETECTADO en fallback sin polyline (reposicionamiento por distancia > 120m): saltó ${distToTarget.toFixed(1)}m`);
          current.pos = [target.pos[0], target.pos[1]];
        } else if (distToTarget > 0.5) {
          // Asegurar una velocidad de convergencia proporcional si la velocidad de la API es muy baja o cero
          const finalSpeed = Math.max(currentSpeed, distToTarget / 3.0);
          currentSpeedRef.current = finalSpeed;
          const distToAdvance = finalSpeed * dt;
          const factor = Math.min(1.0, distToAdvance / distToTarget);
          current.pos[0] += (target.pos[0] - current.pos[0]) * factor;
          current.pos[1] += (target.pos[1] - current.pos[1]) * factor;
        } else {
          currentSpeedRef.current = 0;
        }

        // Bearing suave al target
        if (distToTarget > 1) {
          const bearingToTarget = getBearing(current.pos[0], current.pos[1], target.pos[0], target.pos[1]);
          let diffB = bearingToTarget - current.bearing;
          if (diffB > 180) diffB -= 360;
          if (diffB < -180) diffB += 360;
          current.bearing = (current.bearing + diffB * 0.15 + 360) % 360;
        }

        // Solo usar bearing del backend como guía cuando NO hay polyline
        if (target.bearing !== 0 && Math.abs(target.bearing - current.bearing) > 1) {
          let diffB = target.bearing - current.bearing;
          if (diffB > 180) diffB -= 360;
          if (diffB < -180) diffB += 360;
          current.bearing = (current.bearing + diffB * 0.08 + 360) % 360;
        }
      }

      // Mover marcador e icono de forma imperativa en Leaflet
      if (markerRef.current) {
        const lastLatLng = markerRef.current.getLatLng();
        const latDiff = Math.abs(lastLatLng.lat - current.pos[0]);
        const lngDiff = Math.abs(lastLatLng.lng - current.pos[1]);
        if (latDiff > 0.000001 || lngDiff > 0.000001) {
          markerRef.current.setLatLng(current.pos);
        }
        const el = markerRef.current.getElement();
        if (el) {
          const busOuter = el.querySelector('.topdown-bus-vehicle') as HTMLElement;
          if (busOuter) {
            const currentTransform = busOuter.style.transform;
            const targetTransform = `rotate(${current.bearing}deg)`;
            if (currentTransform !== targetTransform) {
              busOuter.style.transform = targetTransform;
            }
          }
        }
      }

      // Actualizar la velocidad mostrada en el Popup de forma imperativa si está abierto
      if (isPopupOpen) {
        const speedValEl = document.querySelector(`.bus-speed-val-${bus.id || 'unknown'}`);
        if (speedValEl) {
          const isSimulated = (bus.id || '').startsWith('sim-');
          let displaySpeed = 0;
          if (isSimulated) {
            // Para simulaciones locales, la velocidad instantánea de animación está en m/s en currentSpeedRef.
            // Si la velocidad calculada de la simulación es exactamente 0.0, mostramos 0.
            if (bus.speed === 0) {
              displaySpeed = 0;
            } else {
              displaySpeed = Math.round(currentSpeedRef.current * 3.6);
            }
          } else {
            // Colectivo real de producción
            displaySpeed = Math.round((bus.speed || 0) * 3.6);
          }
          speedValEl.textContent = `${displaySpeed} km/h`;
        }
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [bus.pos, bus.bearing, shapeCoords]);

  const color = isSelected ? '#10b981' : (bus.color || '#3b82f6');

  const getDestinationText = (rawCode: string, rawName: string, dir: string = 'ida', headsign?: string) => {
    const code = (rawCode || '').toUpperCase().trim();
    let dest = (headsign || '').trim();

    if (!dest && routeDirectionInfo) {
      const dirParts = routeDirectionInfo.split(/\s*(?:➔|->|–|—|-)\s*/);
      if (dirParts.length >= 2) {
        dest = dirParts[dirParts.length - 1].trim();
      }
    }

    if (!dest && rawName) {
      let cleanName = rawName.replace(/^(Línea|Linea)\s+/i, '').trim();
      const parenMatch = cleanName.match(/\(([^)]+)\)/);
      const textToExtract = parenMatch ? parenMatch[1].trim() : cleanName;

      let textWithoutCode = textToExtract;
      if (code && textWithoutCode.toUpperCase().startsWith(code)) {
        textWithoutCode = textWithoutCode.substring(code.length).trim().replace(/^[-–—:]\s*/, '');
      }

      const parts = textWithoutCode.split(/\s*[-–—]\s*/);
      if (parts.length >= 2) {
        const dNorm = String(dir || '').toLowerCase().trim();
        dest = (dNorm === 'vuelta' || dNorm === 'outbound' || dNorm === '1') ? parts[0].trim() : parts[1].trim();
      } else {
        dest = textWithoutCode;
      }
    }

    if (dest && code && dest.toUpperCase().startsWith(code)) {
      dest = dest.substring(code.length).trim().replace(/^[-–—:]\s*/, '');
    }
    return dest;
  };

  const destText = getDestinationText(bus.code, bus.name, bus.dir, (bus as any).headsign);
  const busCodeStr = (bus.code || 'BUS').toUpperCase().trim();
  const agencyStr = (lineName && lineName.toUpperCase() !== busCodeStr) ? lineName.trim() : '';

  // Línea 1: SIT - RZ02
  const labelLine1 = agencyStr ? `${agencyStr} - ${busCodeStr}` : busCodeStr;

  // Línea 2: -> Los Ceibos | # 15/20
  const destWithArrow = destText ? `-> ${destText}` : '';
  const unitLabel = bus.dispatchOrder ? `# ${bus.dispatchOrder}${totalTrips && Number(totalTrips) >= bus.dispatchOrder ? `/${totalTrips}` : ''}` : '';
  const labelLine2 = [destWithArrow, unitLabel].filter(Boolean).join(' | ');

  const isMoving = Number(bus.speed || 0) > 0.2;
  const isSimulatedBySchedule = (bus as any).isSimulated === true || (bus as any).is_simulated === true || bus.id?.startsWith('sim-') || (bus as any).originalId?.startsWith('sim-') || (bus as any).isGps === false;
  const hasGpsMatch = !isSimulatedBySchedule && !!((bus as any).isGps || (bus as any).hasRealGpsMatch);
  const isRawGps = !!((bus as any).isRawGps || (bus as any).isCuandoSuboRaw);
  const showSpeedInPopup = useMemo(() => typeof window !== 'undefined' && (localStorage.getItem('collie_admin_token') !== null || localStorage.getItem('developer_bypass') === 'true' || localStorage.getItem('is_logged_in') === 'true'), []);

  // Memoizar el icono para evitar que Leaflet lo recree en el DOM en cada tick de la simulación
  const busIcon = useMemo(() => {
    return createBusIconTopDown(
      color, 
      0, // bearing base 0, la rotación real se aplica de forma imperativa en el DOM
      labelLine1,
      labelLine2,
      showLocalLabel, 
      bus.endTime || '',
      isMoving,
      hasGpsMatch,
      isRawGps
    );
  }, [color, labelLine1, labelLine2, showLocalLabel, bus.endTime, isMoving, hasGpsMatch, isRawGps]);

  useEffect(() => {
    if (markerRef.current) {
      const el = markerRef.current.getElement();
      if (el) {
        const busOuter = el.querySelector('.topdown-bus-vehicle');
        if (busOuter) {
          (busOuter as HTMLElement).style.transform = `rotate(${currentRef.current.bearing}deg)`;
        }
      }
    }
  });

  return (
    <Marker 
      ref={markerRef}
      position={currentRef.current.pos} 
      icon={busIcon}
      zIndexOffset={2000}
      eventHandlers={{
        click: (e) => {
          e.target.openPopup();
        },
        popupopen: () => {
          setIsPopupOpen(true);
        },
        popupclose: () => {
          setIsPopupOpen(false);
        }
      }}
    >

      <Popup>
        <div style={{ color: '#0f172a', padding: '6px', minWidth: '160px', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color }}></div>
                <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#0f172a' }}>{lineName ? `${lineName} ${bus.code}` : bus.code}</div>
                {bus.dispatchOrder && <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginLeft: 'auto' }}>{unitLabel}</div>}
            </div>
            {routeDirectionInfo ? (
              <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '8px', fontWeight: 600 }}>{routeDirectionInfo}</div>
            ) : (
              bus.name && <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '8px', fontWeight: 600 }}>{bus.name}</div>
            )}
            
            {bus.startTime && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#334155', borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '6px' }}>
                    <span>Salida:</span>
                    <strong>{bus.startTime}</strong>
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#334155', marginTop: '4px' }}>
                <span>Llegada estimada:</span>
                <strong>{bus.endTime || '--:--'}</strong>
            </div>

            {bus.onboardCount !== undefined && bus.onboardCount > 0 && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '0.8rem', 
                  color: '#10b981', 
                  background: 'rgba(16, 185, 129, 0.08)',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  marginTop: '8px',
                  fontWeight: 600
                }}>
                  <Users size={12} />
                  <span>{bus.onboardCount} {bus.onboardCount === 1 ? 'pasajero colaborando' : 'pasajeros colaborando'}</span>
                </div>
            )}

            {bus.isDeviated && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '0.8rem', 
                  color: '#ef4444', 
                  background: 'rgba(239, 68, 68, 0.08)',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  marginTop: '8px',
                  fontWeight: 600
                }}>
                  <span style={{ fontSize: '14px' }}>⚠️</span>
                  <span>Desviado {Math.round(bus.deviationDistance || 0)} metros</span>
                </div>
            )}

            {showSpeedInPopup && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#3b82f6', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '8px', fontWeight: 700 }}>
                  <span>Velocidad:</span>
                  <span className={`bus-speed-val-${bus.id || 'unknown'}`}>
                    {(bus.id || '').startsWith('sim-') 
                      ? `${Number(bus.speed || 0).toFixed(0)} km/h` 
                      : `${Number((bus.speed || 0) * 3.6).toFixed(0)} km/h`
                    }
                  </span>
              </div>
            )}
            {onViewSchedule && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onViewSchedule(bus.code || bus.routeId);
                }}
                style={{
                  marginTop: '12px',
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--accent, #3b82f6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
                onMouseOut={(e) => e.currentTarget.style.background = 'var(--accent, #3b82f6)'}
              >
                <Clock size={12} /> Horarios
              </button>
            )}
        </div>
      </Popup>
    </Marker>
  );
});
LeafletVehicleMarker.displayName = 'LeafletVehicleMarker';

function isRealTelemetryBus(bus: Bus): boolean {
  const id = (bus.id || '').toUpperCase();
  return id !== 'CROWDSOURCED' && !id.startsWith('SIM-') && !id.startsWith('WS-CROWDSOURCED') && !id.includes('CROWDSOURCED');
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

function SearchFlyController({ searchLocation, setSearchMarker }: { 
  searchLocation: { lat: number; lon: number; name: string } | null;
  setSearchMarker: (val: { lat: number; lon: number; name: string } | null) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (searchLocation) {
      setSearchMarker(searchLocation);
      map.flyTo([searchLocation.lat, searchLocation.lon], 16, { animate: true, duration: 1.5 });
    } else {
      setSearchMarker(null);
    }
  }, [searchLocation, map, setSearchMarker]);
  return null;
}

function UserLocationController({ showUserLocation, userPos }: { showUserLocation: boolean; userPos: [number, number] | null }) {
  const map = useMap();
  const activatedRef = useRef(false);
  const focusedForThisActivationRef = useRef(false);

  useEffect(() => {
    if (showUserLocation) {
      if (!activatedRef.current) {
        activatedRef.current = true;
        focusedForThisActivationRef.current = false;
      }
      if (userPos && !focusedForThisActivationRef.current) {
        focusedForThisActivationRef.current = true;
        map.setView(userPos, 16);
      }
    } else {
      activatedRef.current = false;
      focusedForThisActivationRef.current = false;
    }
  }, [showUserLocation, userPos, map]);

  return null;
}

const parseTimeToMins = (timeStr: string): number => {
  if (!timeStr || timeStr === '-' || timeStr === '') return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
};

const formatMinsToTime = (mins: number): string => {
  const normMins = (Math.round(mins) + 1440) % 1440;
  const hours = Math.floor(normMins / 60);
  const minutes = Math.floor(normMins % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};


interface RoutePathSegmentProps {
  route: any;
  dir: any;
  isVisible: boolean;
  pathData?: any;
  currentZoom: number;
  showRouteArrows: boolean;
  onViewSchedule?: (routeId: string) => void;
}

const RoutePathSegment = React.memo(({
  route,
  dir,
  isVisible,
  pathData,
  currentZoom,
  showRouteArrows,
  onViewSchedule
}: RoutePathSegmentProps) => {
  if (!isVisible || !dir.coordinates || dir.coordinates.length < 2) return null;

  // Separar origen y destino del nombre de la ruta para las etiquetas de cabeceras
  const routeParts = (route.name || '').split(' - ');
  let cabeceraInicio = 'Inicio';
  let cabeceraFin = 'Fin';
  if (routeParts.length >= 2) {
    const origen = routeParts[0].trim();
    const destino = routeParts[1].trim();
    if (dir.direction === 'ida') {
      cabeceraInicio = origen;
      cabeceraFin = destino;
    } else {
      cabeceraInicio = destino;
      cabeceraFin = origen;
    }
  } else {
    cabeceraInicio = route.name || 'Inicio';
    cabeceraFin = dir.direction === 'ida' ? 'Fin' : 'Inicio';
  }

  const routeDirectionInfo = routeParts.length >= 2 ? `${cabeceraInicio} ➔ ${cabeceraFin}` : (route.name || '');

  const arrowPolygons: any[] = [];
  if (showRouteArrows && currentZoom >= 14 && pathData && pathData.totalDistance > 0) {
    let spacing = 450; // metros entre flechas para zoom >= 16
    if (currentZoom === 15) spacing = 800;
    else if (currentZoom === 14) spacing = 1600;

    // Escala inversa de zoom para mantener un tamaño de pantalla de píxeles constante
    const scaleFactor = Math.pow(2, 16 - currentZoom);
    const L = 0.00016 * scaleFactor;
    const W = 0.00007 * scaleFactor;

    for (let d = 50; d < pathData.totalDistance - 50; d += spacing) {
      const p = getPositionAtDistance(pathData, d);
      const nextP = getPositionAtDistance(pathData, Math.min(d + 4, pathData.totalDistance));
      
      const dLat = nextP.lat - p.lat;
      const dLng = nextP.lng - p.lng;
      const length = Math.sqrt(dLat * dLat + dLng * dLng);
      if (length > 0) {
        const dirVec = { lat: dLat / length, lng: dLng / length };
        const norm = { lat: -dirVec.lng, lng: dirVec.lat };
        
        const pTip: [number, number] = [p.lat + dirVec.lat * L, p.lng + dirVec.lng * L];
        const pLeft: [number, number] = [p.lat - dirVec.lat * L * 0.3 + norm.lat * W, p.lng - dirVec.lng * L * 0.3 + norm.lng * W];
        const pRight: [number, number] = [p.lat - dirVec.lat * L * 0.3 - norm.lat * W, p.lng - dirVec.lng * L * 0.3 - norm.lng * W];
        
        arrowPolygons.push(
          <Polygon
            key={`arr-${route.id}-${dir.direction}-${d}`}
            positions={[pTip, pLeft, pRight]}
            pathOptions={{
              color: '#ffffff',
              weight: 1.5,
              fillColor: route.color,
              fillOpacity: 1.0
            }}
            interactive={false}
          />
        );
      }
    }
  }

  return (
    <React.Fragment>
      {/* Línea de fondo negra para el borde, solo si es de ida */}
      {dir.direction === 'ida' && (
        <Polyline positions={dir.coordinates}
          pathOptions={{ color: '#000000', weight: 6.0, opacity: 1.0, lineJoin: 'round', lineCap: 'round' }}
          interactive={false}
        />
      )}
      {/* Línea del color de la ruta */}
      <Polyline positions={dir.coordinates}
        pathOptions={{ 
          color: route.color, 
          weight: 4.5, 
          opacity: dir.direction === 'ida' ? 0.85 : 0.75, 
          dashArray: dir.direction === 'vuelta' ? '8, 6' : undefined, 
          lineJoin: 'round', 
          lineCap: 'round' 
        }}>
        <Popup>
          <div style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)', minWidth: '180px' }}>
            {/* Primera fila: La línea */}
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Línea {(route.company || 'SIT').replace(/\s*\([^)]*transporte\s+local[^)]*\)/gi, '').trim()}
            </div>
            {/* Segunda fila: Código de ramal y nombre */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ background: route.color, color: '#fff', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                {route.code}
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{routeDirectionInfo}</div>
            </div>
            {route.estimatedDuration && (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> {route.estimatedDuration}
              </div>
            )}
            {onViewSchedule && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewSchedule(route.id);
                }}
                style={{
                  marginTop: '12px',
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--accent, #3b82f6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
                onMouseOut={(e) => e.currentTarget.style.background = 'var(--accent, #3b82f6)'}
              >
                <Clock size={12} /> Horarios
              </button>
            )}
          </div>
        </Popup>
      </Polyline>
      {arrowPolygons}
    </React.Fragment>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.route.id === nextProps.route.id &&
    prevProps.route.color === nextProps.route.color &&
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.pathData === nextProps.pathData &&
    prevProps.currentZoom === nextProps.currentZoom &&
    prevProps.showRouteArrows === nextProps.showRouteArrows &&
    prevProps.dir.coordinates?.length === nextProps.dir.coordinates?.length
  );
});

// === Componente principal ===
export default function TransitMap({ showRouteArrows, showStartEndMarkers = true, showVehicleLabels = true, selectedRouteIds, visibleRouteIds, routeStopsIda = {}, routeStopsVuelta = {}, routeShowIda = {}, routeShowVuelta = {}, routeBusesIda = {}, routeBusesVuelta = {}, focusedRouteBounds = null, transitRoutes, transitStops, showStops = true, showUserLocation = true, onViewSchedule, onLiveBusesUpdate, showStopSequences = false, showWaypoints = false, livePollingEnabled = false, livePollingIntervalSec = 60, mapStyle = 'argenmap', searchLocation = null, onClearSearchLocation, offlineDownloaderOpen, onOfflineDownloaderClose, hideOfflineButton, calendarExceptions = [], sidebarOpen, onNearbyStopChange, triggerNearbyStopToggle, onSimulationLog, showStopProjections = false, enableGpsMatching = true, showRawGps: showRawGpsProp, isAdmin: isAdminProp, isPWA = false, isCollaborativeGpsActive = false }: Props) {
  const [internalShowRawGps, setInternalShowRawGps] = useState<boolean>(false);
  const showRawGps = showRawGpsProp ?? internalShowRawGps;
  const [liveUsers, setLiveUsers] = useState<any[]>([]);
  const [liveBuses, setLiveBuses] = useState<Bus[]>([]);
  const [backendBuses, setBackendBuses] = useState<Bus[]>([]);
  const [simulatedBuses, setSimulatedBuses] = useState<Bus[]>([]);
  const [draggedPositions, setDraggedPositions] = useState<Record<string, [number, number]>>({});
  const isLoggedIn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const token = localStorage.getItem('collie_admin_token');
    const bypass = localStorage.getItem('developer_bypass') === 'true';
    const isLogged = localStorage.getItem('is_logged_in') === 'true';
    return (!!token && token.trim().length > 0 && token !== 'null' && token !== 'undefined') || bypass || isLogged;
  }, []);
  const isAdmin = isAdminProp !== undefined ? isAdminProp : isLoggedIn;

  useEffect(() => {
    onLiveBusesUpdate?.(liveBuses);
  }, [liveBuses, onLiveBusesUpdate]);

  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const userPosRef = useRef<{ lat: number; lng: number; speed: number | null; heading: number | null; accuracy: number | null; timestamp: number } | null>(null);
  const busTrackerRef = useRef<Record<string, { lastSegIdx: number; dir?: string; routeId?: string }>>({});
  const routesRef = useRef(transitRoutes);
  routesRef.current = transitRoutes;

  const [searchMarker, setSearchMarker] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [isLoadingBuses, setIsLoadingBuses] = useState<boolean>(false);
  const [lastUpdatedBuses, setLastUpdatedBuses] = useState<Date | null>(null);

  const getTodayDayLabel = useCallback((route: any) => {
    const now = new Date();

    if (calendarExceptions && calendarExceptions.length > 0) {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      let companyName = 'Otras';
      if (route) {
        const code = route.code || '';
        const isSIT = code.toLowerCase().startsWith('rz') || route.id?.toLowerCase().includes('sit');
        if (isSIT) companyName = 'SIT';
        else companyName = route.company || 'Otras';
      }

      const matchedException = calendarExceptions.find(
        (exc: any) => exc.date === dateStr && (exc.company === companyName || exc.company === 'all')
      );

      if (matchedException) {
        if (matchedException.overrideDayType === 'weekday') return 'weekday';
        if (matchedException.overrideDayType === 'saturday') return 'saturday';
        if (matchedException.overrideDayType === 'sunday') return 'sunday_holiday';
        return matchedException.overrideDayType;
      }
    }

    const day = now.getDay();
    if (day === 0) return 'sunday_holiday';
    if (day === 6) return 'saturday';

    return 'weekday';
  }, [calendarExceptions]);

  const simulateBusesLocally = useCallback((activeRoutes: any[]): Bus[] => {
    const simulated: Bus[] = [];
    const now = new Date();
    
    activeRoutes.forEach((route: any) => {
      const dayLabel = getTodayDayLabel(route);
      
      // Determinar el dayType base y el dayType de excepción
      let baseDayType = 'weekday';
      if (dayLabel === 'sunday_holiday') {
        baseDayType = 'sunday';
      } else if (dayLabel === 'saturday') {
        baseDayType = 'saturday';
      } else if (dayLabel !== 'weekday') {
        // Es un dayType especial de excepción (ej: special_lunes_a_viernes_invierno)
        // Determinar el base subyacente
        const lower = dayLabel.toLowerCase();
        if (lower.includes('lunes') || lower.includes('weekday') || lower.includes('invierno')) {
          baseDayType = 'weekday';
        } else if (lower.includes('sabado') || lower.includes('saturday')) {
          baseDayType = 'saturday';
        } else if (lower.includes('domingo') || lower.includes('sunday') || lower.includes('feriado') || lower.includes('holiday')) {
          baseDayType = 'sunday';
        }
      }
    
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const nowSecs = now.getSeconds();

      const schedulesList = route.schedulesList || [];
      
      schedulesList.forEach((sch: any, schIdx: number) => {
        const dirKey: 'ida' | 'vuelta' = sch.direction_id === '0' || sch.direction === 'ida' ? 'ida' : 'vuelta';
        
        const validStops = route.stops?.filter((s: any) => s.direction === dirKey) || [];
        const trips = sch.trips || [];
        
        // Primero intentar con el dayType exacto de la excepción (ej: special_lunes_a_viernes_invierno)
        let activeTrips = dayLabel !== baseDayType 
          ? trips.filter((t: any) => t.service_type === dayLabel)
          : [];
        
        // No utilizar fallbacks cruzados entre días distintos
        if (dayLabel !== baseDayType && activeTrips.length === 0) {
          // No simular viajes de otro tipo de día si no hay horarios cargados para este día especial
        }
        
        if (validStops.length < 2) {
          return;
        }
        
        activeTrips.forEach((trip: any, tripIdx: number) => {
          if (!trip.times || trip.times.length === 0) return;
          
          let firstTime = '';
          let lastTime = '';
          
          for (let i = 0; i < trip.times.length; i++) {
            if (trip.times[i] && trip.times[i] !== '-') {
              firstTime = trip.times[i];
              break;
            }
          }
          for (let i = trip.times.length - 1; i >= 0; i--) {
            if (trip.times[i] && trip.times[i] !== '-') {
              lastTime = trip.times[i];
              break;
            }
          }
          
          if (!firstTime || !lastTime || firstTime === lastTime) return;
          
          const startMins = parseTimeToMins(firstTime);
          const endMins = parseTimeToMins(lastTime);
          
          let duration = endMins - startMins;
          if (duration < 0) duration += 1440;
          if (duration <= 0) return;
          
          let elapsed = nowMins - startMins + nowSecs / 60;
          if (elapsed < 0 && (nowMins + 1440 - startMins) < duration) {
            elapsed += 1440;
          }
          
          const isActive = elapsed >= 0 && elapsed <= duration;
          if (isActive) {
            const progress = elapsed / duration;
            const pathData = routePathDataRef.current?.[route.id]?.[dirKey];
            
            // 1. Extraer los puntos de control con horarios definidos de la planilla (trip.times)
            // IMPORTANTE: trip.times tiene N columnas (control_stops del backend),
            // que son una selección de paradas de la ruta completa.
            // Necesitamos mapear el índice de columna al índice real de la parada en la ruta.
            const numTimeCols = trip.times.length;
            const numRouteStops = validStops.length;
            
            // Calcular los índices de parada reales que corresponden a cada columna del horario
            // (replica la lógica de generateTripsFromDB del backend)
            const colToStopIdx: number[] = [];
            if (numTimeCols <= 5 && numTimeCols <= numRouteStops) {
              // Si hay pocas columnas, mapean directamente si hay pocas paradas
              // o se distribuyen uniformemente
              if (numTimeCols <= numRouteStops && numRouteStops > numTimeCols) {
                // Distribución uniforme: cabecera, intermedios, cabecera final
                colToStopIdx.push(0); // Primera parada
                for (let ci = 1; ci < numTimeCols - 1; ci++) {
                  colToStopIdx.push(Math.round((numRouteStops - 1) * ci / (numTimeCols - 1)));
                }
                colToStopIdx.push(numRouteStops - 1); // Última parada
              } else {
                for (let ci = 0; ci < numTimeCols; ci++) {
                  colToStopIdx.push(ci);
                }
              }
            } else {
              // Distribución uniforme para cualquier cantidad de columnas
              for (let ci = 0; ci < numTimeCols; ci++) {
                if (numRouteStops <= numTimeCols) {
                  colToStopIdx.push(Math.min(ci, numRouteStops - 1));
                } else {
                  colToStopIdx.push(Math.round((numRouteStops - 1) * ci / (numTimeCols - 1)));
                }
              }
            }
            
            const controlPoints: { stopIdx: number; timeMins: number }[] = [];
            trip.times.forEach((t: string, idx: number) => {
              if (t && t !== '-') {
                controlPoints.push({
                  stopIdx: colToStopIdx[idx] !== undefined ? colToStopIdx[idx] : idx,
                  timeMins: parseTimeToMins(t)
                });
              }
            });

            // 2. Determinar en qué sub-tramo horario del viaje se encuentra el colectivo actualmente
            const currentMins = nowMins + nowSecs / 60;
            let activeIntervalIdx = -1;
            let progressInInterval = 0;
            let intervalDuration = 0;
            let elapsedInInterval = 0;
            
            for (let i = 0; i < controlPoints.length - 1; i++) {
              const p1 = controlPoints[i];
              const p2 = controlPoints[i + 1];
              
              let t1 = p1.timeMins;
              let t2 = p2.timeMins;
              if (t2 < t1) t2 += 1440; // Cruce de medianoche
              
              let cur = currentMins;
              if (cur < t1 && (cur + 1440) <= t2) {
                cur += 1440;
              }
              
              if (cur >= t1 && cur <= t2) {
                activeIntervalIdx = i;
                intervalDuration = t2 - t1;
                elapsedInInterval = cur - t1;
                progressInInterval = intervalDuration > 0 ? elapsedInInterval / intervalDuration : 0;
                break;
              }
            }

            // Fallback de contingencia ante desbordamientos mínimos de precisión
            if (activeIntervalIdx === -1 && elapsed >= 0 && elapsed <= duration) {
              activeIntervalIdx = Math.max(0, controlPoints.length - 2);
              progressInInterval = 1.0;
            }

            let lat = 0;
            let lng = 0;
            let bearing = 0;
            let stopIdx = 0;
            let nextStopName = 'Próxima parada';
            let simulatedBusSpeed = 25.0;
            let isStopped = false;
            
            if (activeIntervalIdx !== -1) {
              if (pathData && pathData.coordinates && pathData.coordinates.length >= 2) {
                const pStart = controlPoints[activeIntervalIdx];
                const pEnd = controlPoints[activeIntervalIdx + 1];

                const busId = `sim-${route.id}-${trip.trip_id || tripIdx}`;
                if (lastCheckedStopRef.current[busId] !== pStart.stopIdx) {
                  const crossedStop = validStops[pStart.stopIdx];
                  if (crossedStop) {
                    const planTimeStr = formatMinsToTime(pStart.timeMins);
                    const nowTimeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    
                    const diffMins = currentMins - pStart.timeMins;
                    const formattedDiff = diffMins.toFixed(1);
                    let diffStr = '';
                    let logColor = '#10b981'; // Green for 'en hora'

                    if (formattedDiff === '0.0' || formattedDiff === '-0.0') {
                      diffStr = `0.0m (en hora)`;
                      logColor = '#10b981';
                    } else if (diffMins > 0) {
                      diffStr = `+${formattedDiff}m (demorado)`;
                      logColor = '#ef4444'; // Red for 'demorado'
                    } else {
                      diffStr = `${formattedDiff}m (adelantado)`;
                      logColor = '#f59e0b'; // Orange for 'adelantado'
                    }
                    
                    const logMsg = `🚍 Coche ${trip.trip_id || tripIdx} (Ruta: ${route.code || route.id}, Sentido: ${dirKey}) cruzó punto de control: "${crossedStop.name}" | Plan: ${planTimeStr} | Real: ${nowTimeStr} | Desvío: ${diffStr}`;
                    
                    console.log(
                      `%c[Simulación 🚍] ${logMsg}`,
                      `color: ${logColor}; font-weight: bold; background-color: #f3f4f6; padding: 2px 5px; border-radius: 3px;`
                    );

                    if (onSimulationLog) {
                      onSimulationLog(logMsg);
                    }
                  }
                  lastCheckedStopRef.current[busId] = pStart.stopIdx;
                }
                
                // Distancias proyectadas de las paradas sobre la polilínea física
                const distStart = (pathData.stopDistances && pathData.stopDistances[pStart.stopIdx] !== undefined)
                  ? pathData.stopDistances[pStart.stopIdx]
                  : 0;
                const distEnd = (pathData.stopDistances && pathData.stopDistances[pEnd.stopIdx] !== undefined)
                  ? pathData.stopDistances[pEnd.stopIdx]
                  : pathData.totalDistance;
                
                let targetDist = 0;
                
                // Si la distancia entre cabecera/paradas coincide en las mismas coordenadas por error de base de datos (como RZ07),
                // realizamos un fallback suave: distribuimos uniformemente el progreso del viaje completo sobre la polilínea completa.
                if (distEnd <= distStart || (distEnd - distStart) < 0.05) {
                  const totalTripDuration = controlPoints[controlPoints.length - 1].timeMins - controlPoints[0].timeMins;
                  const totalTripElapsed = currentMins - controlPoints[0].timeMins;
                  const tripProgress = totalTripDuration > 0 ? totalTripElapsed / totalTripDuration : 0;
                  targetDist = Math.max(0, Math.min(tripProgress * pathData.totalDistance, pathData.totalDistance));
                  
                  if (totalTripDuration > 0) {
                    simulatedBusSpeed = (pathData.totalDistance * 0.06) / totalTripDuration;
                  }
                } else {
                  // Obtener todas las paradas en el intervalo de control actual
                  const intervalStops: { idx: number; dist: number }[] = [];
                  for (let sIdx = pStart.stopIdx; sIdx <= pEnd.stopIdx; sIdx++) {
                    const d = (pathData.stopDistances && pathData.stopDistances[sIdx] !== undefined)
                      ? pathData.stopDistances[sIdx]
                      : (distStart + (distEnd - distStart) * (sIdx - pStart.stopIdx) / Math.max(1, pEnd.stopIdx - pStart.stopIdx));
                    intervalStops.push({ idx: sIdx, dist: d });
                  }

                  const N = intervalStops.length - 1; // Cantidad de paradas con detención en este tramo (excluyendo la final)
                  const STOP_TIME = 0.25; // 15 segundos en minutos
                  
                  // Asegurar que el tiempo de parada no consuma más del 80% de la duración del tramo
                  let actualStopTime = STOP_TIME;
                  if (N * actualStopTime >= 0.8 * intervalDuration) {
                    actualStopTime = N > 0 ? (0.8 * intervalDuration) / N : 0;
                  }

                  const totalStopDuration = N * actualStopTime;
                  const T_mov = intervalDuration - totalStopDuration;

                  // Calcular tiempos de llegada y salida para cada parada en el tramo
                  const stopTimes: { llegada: number; salida: number }[] = [];
                  let currentSalida = pStart.timeMins;

                  for (let i = 0; i < intervalStops.length; i++) {
                    if (i === 0) {
                      stopTimes.push({
                        llegada: pStart.timeMins,
                        salida: pStart.timeMins + actualStopTime
                      });
                      currentSalida = pStart.timeMins + actualStopTime;
                    } else {
                      const prevStop = intervalStops[i - 1];
                      const currStop = intervalStops[i];
                      const distDiff = currStop.dist - prevStop.dist;
                      const totalDistRange = distEnd - distStart;
                      const travelTime = totalDistRange > 0 ? T_mov * (distDiff / totalDistRange) : 0;
                      
                      const llegada = currentSalida + travelTime;
                      const salida = llegada + actualStopTime;
                      
                      stopTimes.push({ llegada, salida });
                      currentSalida = salida;
                    }
                  }

                  // Obtener hora actual del simulador ajustada por cruce de medianoche
                  let cur = currentMins;
                  let t1 = pStart.timeMins;
                  let t2 = pEnd.timeMins;
                  if (t2 < t1) t2 += 1440;
                  if (cur < t1 && (cur + 1440) <= t2) {
                    cur += 1440;
                  }

                  isStopped = false;

                  if (cur <= stopTimes[0].salida) {
                    targetDist = intervalStops[0].dist;
                    isStopped = true;
                  } else if (cur >= stopTimes[stopTimes.length - 1].llegada) {
                    targetDist = intervalStops[intervalStops.length - 1].dist;
                    isStopped = true;
                  } else {
                    for (let i = 0; i < intervalStops.length - 1; i++) {
                      const stopA = intervalStops[i];
                      const stopB = intervalStops[i + 1];
                      const timesA = stopTimes[i];
                      const timesB = stopTimes[i + 1];

                      if (cur >= timesA.llegada && cur < timesA.salida) {
                        targetDist = stopA.dist;
                        isStopped = true;
                        break;
                      } else if (cur >= timesA.salida && cur < timesB.llegada) {
                        const subElapsed = (cur - timesA.salida) * 60; // en segundos
                        const subDuration = (timesB.llegada - timesA.salida) * 60; // en segundos
                        const D = stopB.dist - stopA.dist; // en metros
                        
                        // Constantes físicas
                        const a_acc = 1.0; // m/s^2
                        const a_dec = 1.2; // m/s^2
                        const K = 1 / (2 * a_acc) + 1 / (2 * a_dec);
                        
                        // Velocidad de crucero teórica (V_c) resolviendo la ecuación cuadrática: K * V_c^2 - subDuration * V_c + D = 0
                        const disc = subDuration * subDuration - 4 * K * D;
                        let V_c = 0;
                        if (disc >= 0 && subDuration > 0) {
                          V_c = (subDuration - Math.sqrt(disc)) / (2 * K);
                        } else {
                          // Perfil triangular de fallback si el tiempo es demasiado corto
                          V_c = (D / Math.max(1, subDuration)) * 2;
                        }
                        
                        // Acotar V_c a un rango físicamente realista (máximo 72 km/h = 20 m/s, mínimo 2 m/s)
                        V_c = Math.max(2.0, Math.min(V_c, 20.0));
                        
                        // Tiempos de cada fase
                        const t_acc = V_c / a_acc;
                        const t_dec = V_c / a_dec;
                        const t_cru = Math.max(0, subDuration - t_acc - t_dec);
                        
                        const t1 = t_acc;
                        const t2 = t_acc + t_cru;
                        
                        const d_acc = 0.5 * a_acc * t_acc * t_acc;
                        const d_cru = V_c * t_cru;
                        
                        let d_rel = 0;
                        let instantSpeedMps = 0;
                        
                        if (subElapsed < t1) {
                          // Fase 1: Aceleración
                          d_rel = 0.5 * a_acc * subElapsed * subElapsed;
                          instantSpeedMps = a_acc * subElapsed;
                        } else if (subElapsed < t2) {
                          // Fase 2: Crucero
                          d_rel = d_acc + V_c * (subElapsed - t1);
                          instantSpeedMps = V_c;
                        } else {
                          // Fase 3: Desaceleración
                          const t_d = Math.max(0, subElapsed - t2);
                          d_rel = d_acc + d_cru + (V_c * t_d - 0.5 * a_dec * t_d * t_d);
                          instantSpeedMps = Math.max(0, V_c - a_dec * t_d);
                        }
                        
                        d_rel = Math.max(0, Math.min(d_rel, D));
                        targetDist = stopA.dist + d_rel;
                        
                        // Guardar la velocidad instantánea teórica en m/s
                        simulatedBusSpeed = instantSpeedMps;
                        break;
                      }
                    }
                  }

                  if (isStopped) {
                    simulatedBusSpeed = 0.0;
                  }
                }
                
                // Encontrar el segmento físico correspondiente en la polilínea
                let segIdx = 0;
                for (let i = 0; i < pathData.cumulativeDistances.length - 1; i++) {
                  if (targetDist >= pathData.cumulativeDistances[i] && targetDist <= pathData.cumulativeDistances[i + 1]) {
                    segIdx = i;
                    break;
                  }
                }
                if (targetDist >= pathData.totalDistance) {
                  segIdx = pathData.coordinates.length - 2;
                }
                
                const p1 = pathData.coordinates[segIdx];
                const p2 = pathData.coordinates[segIdx + 1];
                const dist1 = pathData.cumulativeDistances[segIdx];
                const dist2 = pathData.cumulativeDistances[segIdx + 1];
                
                const segmentLen = dist2 - dist1;
                const fraction = segmentLen > 0 ? (targetDist - dist1) / segmentLen : 0;
                
                lat = p1[0] + (p2[0] - p1[0]) * fraction;
                lng = p1[1] + (p2[1] - p1[1]) * fraction;
                
                const dLon = (p2[1] - p1[1]) * Math.PI / 180;
                const lat1 = p1[0] * Math.PI / 180;
                const lat2 = p2[0] * Math.PI / 180;
                const y = Math.sin(dLon) * Math.cos(lat2);
                const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
                const bearingRad = Math.atan2(y, x);
                bearing = (bearingRad * 180 / Math.PI + 360) % 360;
                
                stopIdx = pStart.stopIdx;
                const nextStopObj = validStops[pEnd.stopIdx];
                if (nextStopObj) nextStopName = nextStopObj.name || nextStopName;
              } else {
                // Fallback de paradas si la polilínea no está disponible
                const totalSegments = validStops.length - 1;
                const rawIndex = progress * totalSegments;
                const idx = Math.min(Math.floor(rawIndex), totalSegments - 1);
                const fraction = rawIndex - idx;
                
                const currentStop = validStops[idx];
                const nextStop = validStops[idx + 1];
                
                if (!currentStop || !nextStop || currentStop.lat === undefined || nextStop.lat === undefined) return;
                
                lat = currentStop.lat + (nextStop.lat - currentStop.lat) * fraction;
                lng = currentStop.lng + (nextStop.lng - currentStop.lng) * fraction;
                
                const dLon = (nextStop.lng - currentStop.lng) * Math.PI / 180;
                const lat1 = currentStop.lat * Math.PI / 180;
                const lat2 = nextStop.lat * Math.PI / 180;
                const y = Math.sin(dLon) * Math.cos(lat2);
                const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
                const bearingRad = Math.atan2(y, x);
                bearing = (bearingRad * 180 / Math.PI + 360) % 360;
                
                stopIdx = idx;
                nextStopName = nextStop.name || nextStopName;
                
                // Calcular velocidad entre paradas en línea recta
                const subDistance = geoDistance([currentStop.lat, currentStop.lng], [nextStop.lat, nextStop.lng]);
                let subDuration = intervalDuration;
                if (subDuration <= 0) {
                  subDuration = duration / (validStops.length - 1);
                }
                if (subDuration > 0) {
                  simulatedBusSpeed = subDistance / (subDuration * 60);
                }
              }
            }
            
            // Acotar velocidad a un rango realista para transporte público urbano (solo si no está detenido)
            if (!isStopped) {
              simulatedBusSpeed = Math.max(3.3, Math.min(simulatedBusSpeed, 16.6));
            }
            
            const stopTimes: Record<string, { time: string; dispatchOrder: number }> = {};
            const dispatchOrder = tripIdx + 1;
            
            const hasStopMappings = sch.stopMappings && typeof sch.stopMappings === 'object' && Object.keys(sch.stopMappings).length > 0;
            const hasHeaders = Array.isArray(sch.headers) && sch.headers.length > 0;

            if (hasStopMappings) {
              trip.times.forEach((t: string, idx: number) => {
                if (t && t !== '-') {
                  const mappedVal = sch.stopMappings[idx];
                  if (typeof mappedVal === 'string') {
                    const normalizedMapped = normalizeStopName(mappedVal);
                    const stopObj = validStops.find((s: any) => 
                      s.id === mappedVal || 
                      normalizeStopName(s.name) === normalizedMapped
                    );
                    if (stopObj) {
                      const val = { time: t.trim(), dispatchOrder };
                      stopTimes[stopObj.name] = val;
                      if (stopObj.id) {
                        stopTimes[stopObj.id] = val;
                      }
                    }
                  }
                }
              });
            } else if (hasHeaders) {
              trip.times.forEach((t: string, idx: number) => {
                if (t && t !== '-') {
                  const headerVal = sch.headers[idx];
                  if (typeof headerVal === 'string') {
                    const normalizedHeader = normalizeStopName(headerVal);
                    const stopObj = validStops.find((s: any) => 
                      normalizeStopName(s.name) === normalizedHeader
                    );
                    if (stopObj) {
                      const val = { time: t.trim(), dispatchOrder };
                      stopTimes[stopObj.name] = val;
                      if (stopObj.id) {
                        stopTimes[stopObj.id] = val;
                      }
                    }
                  }
                }
              });
            }
            
            if (Object.keys(stopTimes).length === 0) {
              trip.times.forEach((t: string, idx: number) => {
                if (t && t !== '-') {
                  const stopIdx = colToStopIdx[idx];
                  const stopObj = validStops[stopIdx];
                  if (stopObj) {
                    const val = { time: t.trim(), dispatchOrder };
                    stopTimes[stopObj.name] = val;
                    if (stopObj.id) {
                      stopTimes[stopObj.id] = val;
                    }
                  }
                }
              });
            }

            simulated.push({
              id: `sim-${route.id}-${trip.trip_id || tripIdx}`,
              routeId: route.id,
              name: sch.headsign || route.name,
              code: route.code || 'SIT',
              color: route.color || '#3b82f6',
              pos: [lat, lng],
              dir: dirKey,
              dist: 0,
              speed: Number(simulatedBusSpeed.toFixed(1)),
              nextStop: nextStopName,
              tripIdx: stopIdx,
              bearing: bearing,
              startTime: firstTime,
              endTime: lastTime,
              dispatchOrder: tripIdx + 1,
              stopTimes
            });
          }
        });
      });
    });
    
    simulatedBusesRef.current = simulated;
    return simulated;
  }, [getTodayDayLabel]);



  const routePathData = useMemo(() => {
    const data: Record<string, { 
      ida: RoutePathData & { stopDistances: number[] }; 
      vuelta: RoutePathData & { stopDistances: number[] } 
    }> = {};

    transitRoutes.forEach(route => {
      const buildPathData = (coords: any[], dirKey: 'ida' | 'vuelta'): RoutePathData & { stopDistances: number[] } => {
        const cleanCoords: [number, number][] = coords.map((c: any) => {
          if (Array.isArray(c)) return [c[0], c[1]];
          return [c.lat, c.lng];
        });

        const cumulativeDistances: number[] = [0];
        for (let i = 1; i < cleanCoords.length; i++) {
          cumulativeDistances.push(cumulativeDistances[i - 1] + geoDistance(cleanCoords[i - 1], cleanCoords[i]));
        }
        const totalDistance = cumulativeDistances[cumulativeDistances.length - 1] || 0;

        const stopDistances: number[] = [];
        const routeStops = route.stops?.filter((s: any) => s.direction === dirKey) || [];

        routeStops.forEach((stop: any) => {
          const proj = projectOnPolyline([stop.lat, stop.lng], cleanCoords);

          const distStartSeg = cumulativeDistances[proj.segIdx];
          const distEndSeg = cumulativeDistances[proj.segIdx + 1] !== undefined ? cumulativeDistances[proj.segIdx + 1] : totalDistance;
          const stopDist = distStartSeg + proj.t * (distEndSeg - distStartSeg);

          stopDistances.push(stopDist);
        });

        if (stopDistances.length < 2) {
          stopDistances.length = 0;
          stopDistances.push(0, totalDistance);
        } else {
          stopDistances[0] = 0;
          stopDistances[stopDistances.length - 1] = totalDistance;
        }

        for (let i = 1; i < stopDistances.length; i++) {
          if (stopDistances[i] < stopDistances[i - 1]) stopDistances[i] = stopDistances[i - 1];
        }

        return { coordinates: cleanCoords, cumulativeDistances, totalDistance, stopDistances };
      };

      data[route.id] = {
        ida: buildPathData(route.directions?.find((d: any) => d.direction === 'ida')?.coordinates || [], 'ida'),
        vuelta: buildPathData(route.directions?.find((d: any) => d.direction === 'vuelta')?.coordinates || [], 'vuelta')
      };
    });
    return data;
  }, [transitRoutes]);

  // === Timer de Simulación Local por Horarios ===
  // Ejecuta simulateBusesLocally cada segundo para generar buses simulados
  // basados en los horarios de la base de datos D1
  useEffect(() => {
    const runSimulation = () => {
      const routes = transitRoutes;
      if (!routes || routes.length === 0) {
        setSimulatedBuses([]);
        return;
      }
      // Solo simular rutas que están seleccionadas/visibles
      const activeSelection = visibleRouteIds.size > 0 ? visibleRouteIds : selectedRouteIds;
      if (!activeSelection || activeSelection.size === 0) {
        setSimulatedBuses([]);
        return;
      }
      const selectedRoutes = routes.filter((r: any) => {
        if (!r) return false;
        const rIdLower = String(r.id || '').toLowerCase();
        const rCodeLower = String(r.code || '').toLowerCase();
        return Array.from(activeSelection).some(selId => {
          const selLower = String(selId).toLowerCase();
          return selLower === rIdLower || selLower === rCodeLower ||
                 `route-${selLower}` === rIdLower || selLower === `route-${rIdLower}`;
        });
      });
      if (selectedRoutes.length === 0) {
        setSimulatedBuses([]);
        return;
      }
      const simulated = simulateBusesLocally(selectedRoutes);
      setSimulatedBuses(simulated);
    };

    runSimulation();
    const simInterval = setInterval(runSimulation, 1000);
    return () => clearInterval(simInterval);
  }, [simulateBusesLocally, transitRoutes, visibleRouteIds, selectedRouteIds]);

  const combinedBuses = useMemo(() => {
    // Si el backend ya devuelve buses simulados, usar SOLO backendBuses como fuente autoritativa
    // para evitar duplicar conteos (el backend es la única fuente de verdad para la simulación)
    const backendHasSimulated = backendBuses.some((b: any) => b.is_simulated || b.isSimulated || String(b.id || '').startsWith('sim-'));
    const effectiveSimBuses = backendHasSimulated ? [] : simulatedBuses;

    if (!enableGpsMatching) {
      return effectiveSimBuses.concat(backendBuses);
    }

    const currentRoutes = routesRef.current || [];
    const ramalesMap: Record<string, { path?: any[]; stops?: any[] }> = {};

    currentRoutes.forEach((r: any) => {
      if (r.id) {
        const idaPath = routePathData[r.id]?.ida?.coordinates?.map((c: any) => ({ lat: c[0], lng: c[1] })) || [];
        ramalesMap[r.id] = { path: idaPath };
      }
    });

    const formattedGpsBuses = backendBuses.map((b: any) => {
      const alias = resolveCuandoSuboAlias(b.code || b.name || '', b.headsign || '');
      return {
        ...b,
        route_short_name: alias.route_short_name || b.code || '',
        trip_id: alias.trip_id || b.routeId || '',
        latitude: b.pos?.[0] || b.lat || 0,
        longitude: b.pos?.[1] || b.lng || 0
      };
    });

    const formattedSimBuses = effectiveSimBuses.map((sb: any) => ({
      ...sb,
      latitude: sb.pos?.[0] || 0,
      longitude: sb.pos?.[1] || 0,
      trip_id: sb.routeId
    }));

    const findMatchedRoute = (v: any) => {
      if (!v || !transitRoutes || transitRoutes.length === 0) return null;
      const targets = [
        v.route_code,
        v.code,
        v.route_short_name,
        v.routeId,
        v.route_id,
        v.trip_id
      ].filter(Boolean).map((s: any) => String(s).trim().toUpperCase());

      if (targets.length === 0) return null;

      let matched = transitRoutes.find((r: any) => {
        const rCode = (r.code || '').trim().toUpperCase();
        const rId = (r.id || '').trim().toUpperCase();
        return targets.some(t => t === rCode || t === rId);
      });

      if (matched) return matched;

      return transitRoutes.find((r: any) => {
        const rNum = (r.code || r.id || '').replace(/\D/g, '');
        if (!rNum) return false;
        return targets.some(t => {
          const vNum = t.replace(/\D/g, '');
          return vNum && (vNum === rNum || parseInt(vNum, 10) === parseInt(rNum, 10));
        });
      }) || null;
    };

    const matchResult = matchGpsToScheduledTrips(formattedSimBuses, formattedGpsBuses, ramalesMap);

    const smoothScheduledVehicles = matchResult.matchedScheduledVehicles.map((v: any) => {
      const matchedRoute = findMatchedRoute(v);
      const routeColor = matchedRoute?.color || v.color || '#800080';
      const tripId = v.trip_id || v.routeId;
      const path = tripId ? ramalesMap[tripId]?.path || [] : [];

      if (path && path.length > 1) {
        const rawPos: [number, number] = [v.latitude || v.lat || 0, v.longitude || v.lng || 0];
        const stableId = v.dispatchOrder ? `${v.routeId || 'route'}-${v.dispatchOrder}` : (v.id || v.matched_gps_id || 'veh');
        const interpolated = getInterpolatedVehiclePosition(
          stableId,
          rawPos,
          path,
          Number(v.speed) || 25,
          v.bearing || 0
        );

        return {
          ...v,
          color: routeColor,
          lat: interpolated.pos[0],
          lng: interpolated.pos[1],
          latitude: interpolated.pos[0],
          longitude: interpolated.pos[1],
          pos: interpolated.pos,
          bearing: interpolated.bearing
        };
      }

      return {
        ...v,
        color: routeColor
      };
    });

    let allVehicles: any[] = [];

    if (showRawGps) {
      // Modo + GPS activo: Muestra los colectivos por horario + los colectivos de GPS crudos no acoplados (con aura amarilla)
      const rawGpsVehicles = (matchResult.fallbackGpsVehicles || []).map((b: any) => {
        const matchedRoute = findMatchedRoute(b);
        const routeColor = matchedRoute?.color || b.color || '#800080';
        return {
          ...b,
          color: routeColor,
          isRawGps: true,
          hasRealGpsMatch: false
        };
      });
      allVehicles = smoothScheduledVehicles.concat(rawGpsVehicles);
    } else {
      // Modo Normal: Muestra colectivos de horario + colectivos con GPS real en la calle proyectados por desfasaje de timestamp
      const fallbackGpsVehicles = (matchResult.fallbackGpsVehicles || []).map((b: any) => {
        const matchedRoute = findMatchedRoute(b);
        const routeColor = matchedRoute?.color || b.color || '#800080';
        const tripId = b.trip_id || b.routeId;
        const path = tripId ? ramalesMap[tripId]?.path || [] : [];
        let projectedLat = b.latitude || b.lat || 0;
        let projectedLng = b.longitude || b.lng || 0;
        let projectedBearing = b.bearing || 0;
        let delaySec = 0;
        let isProj = false;

        if (path && path.length > 1) {
          const rawPos: [number, number] = [projectedLat, projectedLng];
          const pingTs = b.timestamp || b.lastLocationUpdateTime || b.lastUpdateMs;
          const projResult = getProjectedVehiclePosition(
            b.id || 'gps-veh',
            rawPos,
            path,
            Number(b.speed) || 25,
            b.bearing || 0,
            pingTs
          );
          projectedLat = projResult.pos[0];
          projectedLng = projResult.pos[1];
          projectedBearing = projResult.bearing;
          delaySec = projResult.delaySeconds;
          isProj = projResult.isProjected;
        }

        return {
          ...b,
          color: routeColor,
          lat: projectedLat,
          lng: projectedLng,
          latitude: projectedLat,
          longitude: projectedLng,
          pos: [projectedLat, projectedLng],
          bearing: projectedBearing,
          delaySeconds: delaySec,
          isProjected: isProj,
          isRawGps: false,
          hasRealGpsMatch: true
        };
      });
      allVehicles = enableGpsMatching ? smoothScheduledVehicles.concat(fallbackGpsVehicles) : smoothScheduledVehicles;
    }

    // Deduplicar vehículos para prevenir que la misma unidad/despacho aparezca duplicada en el mapa
    const seen = new Set<string>();
    const deduplicatedVehicles: any[] = [];

    allVehicles.forEach((veh: any) => {
      const codeOrRoute = veh.code || veh.route_short_name || veh.routeId || 'route';
      const dedupKey = veh.dispatchOrder 
        ? `${codeOrRoute}-${veh.dispatchOrder}-${veh.dir || 'ida'}`
        : (veh.id || `${veh.latitude}-${veh.longitude}`);

      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        deduplicatedVehicles.push(veh);
      }
    });

    return deduplicatedVehicles;
  }, [backendBuses, simulatedBuses, enableGpsMatching, routePathData, showRawGps]);

  useEffect(() => {
    setLiveBuses(combinedBuses);
  }, [combinedBuses]);

  const routePathDataRef = useRef(routePathData);
  useEffect(() => {
    routePathDataRef.current = routePathData;
  }, [routePathData]);

  const lastCheckedStopRef = useRef<Record<string, number>>({});
  const simulatedBusesRef = useRef<Bus[]>([]);

  useEffect(() => {
    (window as any).getSimulationReport = () => {
      console.log('%c📋 Reporte de Simulación Activa (Colectivos por Horarios) 📋', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
      const activeSims = simulatedBusesRef.current || [];
      if (activeSims.length === 0) {
        console.log('No hay colectivos simulados activos actualmente.');
        return;
      }
      
      const tableData = activeSims.map((bus: any) => {
        return {
          'Coche': bus.id.split('-').pop(),
          'Línea/Ramal': bus.routeId,
          'Sentido': bus.dir,
          'Velocidad (km/h)': bus.speed,
          'Próxima Parada': bus.nextStop,
          'Inicio Viaje': bus.startTime,
          'Fin Viaje': bus.endTime,
        };
      });
      console.table(tableData);
    };
    
    return () => {
      delete (window as any).getSimulationReport;
    };
  }, []);






  const [manualRefreshTrigger, setManualRefreshTrigger] = useState<number>(0);
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  // Smart Crowdsourced Telemetry Configuration & States
  const [crowdsourceConfig] = useState({
    probability: 0.10,             // 10% de probabilidad de ser elegido por ruta
    burstIntervalSeconds: 10,       // Intervalo de 10s en la ráfaga
    burstCount: 1,                 // 1 señal por ráfaga (máximo ahorro)
    sleepDurationSeconds: 300,     // Hibernar por 5 minutos
    maxDataUsageMb: 5.0,           // Límite mensual de 5 MB de datos
    maxSignalsPerHour: 10,         // Máximo 10 señales por hora por usuario
  });

  const [crowdsourceActive, setCrowdsourceActive] = useState<boolean>(isCollaborativeGpsActive);

  useEffect(() => {
    setCrowdsourceActive(isCollaborativeGpsActive);
  }, [isCollaborativeGpsActive]);
  const [crowdsourceState, setCrowdsourceState] = useState<'IDLE' | 'WAITING_AT_STOP' | 'ONBOARD_BUS'>('IDLE');
  const [crowdsourceRoute, setCrowdsourceRoute] = useState<string | null>(null);
  const [crowdsourceStopId, setCrowdsourceStopId] = useState<string | null>(null);
  const [dataConsumed, setDataConsumed] = useState<number>(() => {
    try {
      return parseFloat(localStorage.getItem('collie_transit_data_consumed') || '0');
    } catch {
      return 0;
    }
  });
  
  const [activeStops, setActiveStops] = useState<Record<string, number>>({});
  
  // Estado para la parada suscrita por el usuario
  const [subscribedStop, setSubscribedStop] = useState<{
    stopId: string;
    stopName: string;
    routeId: string;
    routeCode: string;
    direction: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('collie_subscribed_stop');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [lastReportedStopId, setLastReportedStopId] = useState<string | null>(null);
  const [reportCooldown, setReportCooldown] = useState<boolean>(false);

  const handleReportArrived = useCallback(async (stop: any, route: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert("⚠️ No hay conexión con el servidor. Intenta de nuevo en unos instantes.");
      return;
    }
    
    // Obtener coordenadas de usuario o de la parada si no hay userPos
    let lat = stop.lat;
    let lng = stop.lng;
    if (userPos) {
      lat = userPos[0];
      lng = userPos[1];
    }

    // Verificar si el usuario está físicamente cerca de la parada (umbral de 200m)
    const distToStop = geoDistance([stop.lat, stop.lng], [lat, lng]);
    if (distToStop > 200) { // geoDistance returns in meters
      alert("⚠️ Debes estar cerca de la parada para poder calibrar la posición del colectivo.");
      return;
    }

    let deviceId = localStorage.getItem('collie_transit_device_id');
    if (!deviceId) {
      deviceId = 'DEV_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      localStorage.setItem('collie_transit_device_id', deviceId);
    }

    // Payload de alta prioridad para corregir
    const payload = {
      action: 'crowdsource_telemetry',
      data: {
        device_id: deviceId,
        lat: lat,
        lng: lng,
        speed: 0.0,
        heading: 0.0,
        state: 'WAITING_AT_STOP',
        route_code: route.code,
        stop_id: stop.id,
        timestamp: Date.now(),
        role: 'FREQUENT_USER', // Rol cooperativo
        accuracy: 10,
        client_type: window.matchMedia('(display-mode: standalone)').matches ? 'PWA' : 'BROWSER',
        client_version: '1.0.0'
      }
    };

    console.log("📤 [WebSocket] Enviando reporte manual de arribo para calibración:", payload);
    wsRef.current.send(JSON.stringify(payload));
    
    // Activar cooldown visual
    setLastReportedStopId(stop.id);
    setReportCooldown(true);
    setTimeout(() => {
      setReportCooldown(false);
      setLastReportedStopId(null);
    }, 60000); // 60 segundos de cooldown
  }, [userPos]);

  // Guardar suscripción en localStorage
  useEffect(() => {
    try {
      if (subscribedStop) {
        localStorage.setItem('collie_subscribed_stop', JSON.stringify(subscribedStop));
      } else {
        localStorage.removeItem('collie_subscribed_stop');
      }
    } catch (e) {
      console.error(e);
    }
  }, [subscribedStop]);

  // Generador de sonido beep mediante Web Audio API
  const playBeepSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio Feedback no disponible:', e);
    }
  };

  // Ref para evitar disparar alertas repetidas para un mismo bus en aproximación
  const notifiedRef = useRef<string | null>(null);

  // Loop de monitoreo de llegada
  useEffect(() => {
    if (!subscribedStop || !backendBuses || !routePathData) return;

    const { stopName, routeId, routeCode, direction } = subscribedStop;
    const pathData = routePathData[routeId]?.[direction as 'ida' | 'vuelta'];
    if (!pathData || !pathData.stopDistances) return;

    // Buscar el recorrido y sus paradas
    const route = transitRoutes.find((r: any) => r.id === routeId);
    if (!route || !route.stops) return;
    const routeStops = route.stops.filter((s: any) => s.direction === direction);
    const stopIdx = routeStops.findIndex((s: any) => s.name === stopName);
    if (stopIdx === -1) return;

    const stopDistance = pathData.stopDistances[stopIdx];
    const matchingBuses = backendBuses.filter((bus: any) => bus.routeId === routeId && bus.dir === direction);

    let minEtaMins: number | null = null;
    let closestBusId: string | null = null;

    matchingBuses.forEach((bus: any) => {
      if (!bus.pos) return;
      
      const trackerEntry = busTrackerRef?.current?.[bus.id];
      const lastIdx = (trackerEntry && trackerEntry.dir === bus.dir && trackerEntry.routeId === bus.routeId)
        ? trackerEntry.lastSegIdx
        : undefined;
      const proj = projectOnPolyline(bus.pos, pathData.coordinates, lastIdx);
      const nextSegIdx = proj.segIdx;
      const t = proj.t;

      if (busTrackerRef?.current && bus.id) {
        busTrackerRef.current[bus.id] = { 
          lastSegIdx: nextSegIdx,
          dir: bus.dir,
          routeId: bus.routeId
        };
      }

      const busDist = pathData.cumulativeDistances[nextSegIdx] + t * ((pathData.cumulativeDistances[nextSegIdx + 1] || pathData.totalDistance) - pathData.cumulativeDistances[nextSegIdx]);
      const targetStop = routeStops[stopIdx];
      const directDist = geoDistance([targetStop.lat, targetStop.lng], bus.pos);

      if (busDist < stopDistance + 80 || directDist < 45) {
        let remainingDist = stopDistance - busDist;
        
        if (directDist < 200) {
          remainingDist = directDist;
        }
        
        if (busDist > stopDistance) {
          remainingDist = 0;
        }
        
        let speedKmh = Number(bus.speed || 0);
        if (speedKmh <= 0) speedKmh = 25;
        let speedMps = speedKmh / 3.6;
        if (speedMps < 2.0) speedMps = 7.0;

        let etaMins = Math.round((remainingDist / speedMps) / 60);
        if (directDist <= 80 || busDist > stopDistance) {
          etaMins = 0;
        }

        if (minEtaMins === null || etaMins < minEtaMins) {
          minEtaMins = etaMins;
          closestBusId = bus.id;
        }
      }
    });

    // Si el bus está a 3 minutos o menos del usuario
    if (minEtaMins !== null && minEtaMins <= 3 && closestBusId) {
      const alertKey = `${routeCode}-${closestBusId}`;
      if (notifiedRef.current !== alertKey) {
        notifiedRef.current = alertKey;

        // Feedback sonoro
        playBeepSound();

        // 1. Notificación HTML5
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(`🔔 ¡Colectivo aproximándose!`, {
              body: `La línea ${routeCode} está a aproximadamente ${minEtaMins} min de la parada.`,
            });
          } catch (e) {
            console.error(e);
          }
        }

        // 2. Alerta visual en la propia aplicación
        alert(`🔔 ¡Atención! Tu colectivo de la línea ${routeCode} está llegando a la parada (${minEtaMins} min).`);

        // Auto-limpiar suscripción tras el aviso
        setSubscribedStop(null);
      }
    }
  }, [backendBuses, routePathData, subscribedStop, transitRoutes]);

  const routeSelectionRef = useRef<Record<string, { chosen: boolean; lastBurstTime: number }>>({});

  // Refs para la máquina de estados del crowdsourcing y detección de pasajeros (Casos A, C, D, E, F)
  const waitingStopStartRef = useRef<{ stopId: string; startTime: number } | null>(null);
  const lastOnboardTimeRef = useRef<{ routeCode: string; endTime: number } | null>(null);
  const matchedBusTripIdRef = useRef<string | null>(null);
  const lastStateRef = useRef<'IDLE' | 'WAITING_AT_STOP' | 'ONBOARD_BUS'>('IDLE');
  const lastRouteCodeRef = useRef<string | null>(null);

  // Refs adicionales para los Casos G, H, I, J y Historial de Trayectoria Multi-Muestreo
  const trajectoryHistoryRef = useRef<{ lat: number; lng: number; speed: number; heading: number; timestamp: number; candidateRoute?: string; candidateDir?: string }[]>((() => {
    try {
      const saved = localStorage.getItem('collie_gps_trajectory_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })());
  const lastPingCoordsRef = useRef<[number, number] | null>(null);
  const lastPingTimeRef = useRef<number>(0);
  const stopHistoryRef = useRef<{ stopId: string; timestamp: number }[]>([]);
  const stationaryStartOutsideStopRef = useRef<number | null>(null);
  const consecutiveStationaryPingsRef = useRef<number>(0);
  const isTrafficJamRef = useRef<boolean>(false);
  const lastEvaluationTimeRef = useRef<number>(0);
  const signalTimestampsRef = useRef<number[]>([]);  // Timestamps de señales enviadas en la última hora

  // Helper geodésico para cálculo de distancias
  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Buscar parada cercana a menos de 30 metros del usuario
  const nearbyStop = useMemo(() => {
    if (!userPos || !transitStops || transitStops.length === 0) return null;
    
    let closest: any = null;
    let minDist = Infinity;
    
    transitStops.forEach((stop: any) => {
      const dist = getHaversineDistance(userPos[0], userPos[1], stop.lat, stop.lng);
      if (dist < minDist) {
        minDist = dist;
        closest = stop;
      }
    });
    
    // Si la distancia más cercana es menor o igual a 30 metros, la retornamos
    if (minDist <= 30.0) {
      return {
        stop: closest,
        distance: minDist
      };
    }
    
    return null;
  }, [userPos, transitStops]);

  const isNearbyStopWaiting = useMemo(() => {
    if (!nearbyStop) return false;
    const { stop } = nearbyStop;
    let route = null;
    const routes = transitRoutes || [];
    if (stop.routeId) {
      route = routes.find((r: any) => r.id === stop.routeId);
    } else {
      route = routes.find((r: any) => (r.color || '').toUpperCase() === (stop.color || '').toUpperCase());
    }
    return !!(subscribedStop && subscribedStop.stopId === stop.id && subscribedStop.routeId === route?.id);
  }, [nearbyStop, subscribedStop, transitRoutes]);

  const friendlyRouteName = useMemo(() => {
    if (!crowdsourceRoute) return '';
    const routes = transitRoutes || [];
    // Flexibilizar comparación de id con y sin prefijo route-
    const route = routes.find((r: any) => 
      r.id === crowdsourceRoute || 
      r.code === crowdsourceRoute || 
      r.id === crowdsourceRoute.replace('route-', '') || 
      `route-${r.id}` === crowdsourceRoute ||
      r.code === crowdsourceRoute.replace('route-', '')
    );
    if (!route) return crowdsourceRoute;
    
    // Obtener y formatear código (línea-ramal) y nombre del ramal
    const rawCode = route.code || route.shortName || '';
    const rawName = route.name || route.longName || '';
    
    const cleanCode = rawCode.replace(/\s*-\s*/g, '-').trim();
    const cleanName = rawName.trim();
    
    if (cleanCode && cleanName) {
      return `${cleanCode}-${cleanName}`;
    }
    return cleanCode || cleanName || crowdsourceRoute;
  }, [crowdsourceRoute, transitRoutes]);

  const handleToggleNearbyStopWaiting = () => {
    if (!nearbyStop) return;
    const { stop } = nearbyStop;
    
    // Buscar la ruta asociada
    let route = null;
    if (stop.routeId) {
      route = transitRoutes.find((r: any) => r.id === stop.routeId);
    } else {
      route = transitRoutes.find((r: any) => (r.color || '').toUpperCase() === (stop.color || '').toUpperCase());
    }
    
    const isWaitingThis = subscribedStop && subscribedStop.stopId === stop.id && subscribedStop.routeId === route?.id;
    
    if (isWaitingThis) {
      setSubscribedStop(null);
    } else {
      if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            console.log('Permiso de notificaciones otorgado.');
          }
        });
      }
      setSubscribedStop({
        stopId: stop.id,
        stopName: stop.name,
        routeId: route?.id || '',
        routeCode: route?.code || '',
        direction: stop.direction || 'ida'
      });
    }
  };

  // Escuchar trigger externo para alternar espera de parada cercana
  useEffect(() => {
    if (triggerNearbyStopToggle && triggerNearbyStopToggle > 0) {
      handleToggleNearbyStopWaiting();
    }
  }, [triggerNearbyStopToggle]);

  // Notificar parada cercana enriquecida cuando cambie nearbyStop o subscribedStop
  useEffect(() => {
    if (nearbyStop) {
      const { stop } = nearbyStop;
      let route = null;
      const routes = transitRoutes || [];
      if (stop.routeId) {
        route = routes.find((r: any) => r.id === stop.routeId);
      } else {
        route = routes.find((r: any) => (r.color || '').toUpperCase() === (stop.color || '').toUpperCase());
      }
      const isWaitingThis = subscribedStop && subscribedStop.stopId === stop.id && subscribedStop.routeId === route?.id;
      
      onNearbyStopChange?.({
        stop,
        distance: nearbyStop.distance,
        isWaiting: !!isWaitingThis,
        routeColor: route?.color || '#3b82f6'
      });
    } else {
      onNearbyStopChange?.(null);
    }
  }, [nearbyStop, subscribedStop, transitRoutes, onNearbyStopChange]);

  // Interpolar coordenada en la polilínea según un progreso de 0.0 a 1.0 (para validación de proximidad)
  const interpolatePointOnPolyline = (coords: [number, number][], progress: number) => {
    if (!coords || coords.length === 0) return null;
    if (coords.length === 1) return coords[0];
    if (progress <= 0) return coords[0];
    if (progress >= 1) return coords[coords.length - 1];

    let totalLength = 0;
    const segmentLengths: number[] = [];
    for (let i = 0; i < coords.length - 1; i++) {
      const d = getHaversineDistance(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
      totalLength += d;
      segmentLengths.push(d);
    }

    const targetDist = progress * totalLength;
    let currentDist = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const segLen = segmentLengths[i];
      if (currentDist + segLen >= targetDist) {
        const segProgress = (targetDist - currentDist) / segLen;
        const lat = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * segProgress;
        const lng = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * segProgress;
        return [lat, lng];
      }
      currentDist += segLen;
    }
    return coords[coords.length - 1];
  };

  // Función que envía ráfagas intermitentes por el WebSocket
  const triggerLocationBurst = (
    latitude: number,
    longitude: number,
    speedKmh: number,
    heading: number,
    state: 'WAITING_AT_STOP' | 'ONBOARD_BUS',
    routeCode: string,
    stopId: string | null,
    accuracy: number | null,
    isBoardingTransition: boolean = false
  ) => {
    // Control de límite horario: máximo 10 señales por hora por usuario
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    signalTimestampsRef.current = signalTimestampsRef.current.filter(t => t > oneHourAgo);
    if (signalTimestampsRef.current.length >= crowdsourceConfig.maxSignalsPerHour) {
      console.log(`⚠️ [Colaboración GPS] Límite horario alcanzado (${crowdsourceConfig.maxSignalsPerHour} señales/hora). Señal omitida.`);
      setCrowdsourceActive(false);
      return;
    }

    console.log(`🚀 Enviando señal de telemetría crowdsourced para ruta ${routeCode} (${signalTimestampsRef.current.length + 1}/${crowdsourceConfig.maxSignalsPerHour} esta hora)...`);
    let count = 0;
    
    const sendInterval = setInterval(async () => {
      if (count >= crowdsourceConfig.burstCount) {
        clearInterval(sendInterval);
        console.log(`💤 Ráfaga completada. Hibernando GPS de telemetría por ${crowdsourceConfig.sleepDurationSeconds / 60} minutos.`);
        setCrowdsourceActive(false);
        return;
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        let deviceId = localStorage.getItem('collie_transit_device_id');
        if (!deviceId) {
          deviceId = 'DEV_' + Math.random().toString(36).substring(2, 10).toUpperCase();
          localStorage.setItem('collie_transit_device_id', deviceId);
        }

        let batteryLevel: number | null = null;
        if ('getBattery' in navigator) {
          try {
            const battery: any = await (navigator as any).getBattery();
            batteryLevel = battery.level;
          } catch (err) {
            // ignore
          }
        }

        // Obtener el consumo actual más el nuevo payload estimado
        const basePayload = {
          action: 'crowdsource_telemetry',
          data: {
            device_id: deviceId,
            lat: latitude,
            lng: longitude,
            speed: speedKmh / 3.6,
            heading: heading,
            state: state,
            route_code: routeCode,
            stop_id: stopId,
            is_boarding_transition: isBoardingTransition,
            timestamp: Date.now(),
            role: 'FREQUENT_USER',
            battery_level: batteryLevel,
            data_consumed_mb: dataConsumed, // se actualizará abajo
            trip_id: matchedBusTripIdRef.current || undefined,
            accuracy: accuracy,
            traffic_jam: isTrafficJamRef.current || undefined,
            client_type: window.matchMedia('(display-mode: standalone)').matches ? 'PWA' : 'BROWSER',
            client_version: CLIENT_VERSION
          }
        };
        const estimatedBytes = JSON.stringify(basePayload).length;
        const nextData = dataConsumed + (estimatedBytes / (1024 * 1024));

        // Actualizar payload con el consumo final estimado
        basePayload.data.data_consumed_mb = nextData;

        wsRef.current.send(JSON.stringify(basePayload));
        signalTimestampsRef.current.push(Date.now());
        console.log(`📤 [WebSocket] Señal ${count + 1}/${crowdsourceConfig.burstCount} enviada (${signalTimestampsRef.current.length}/${crowdsourceConfig.maxSignalsPerHour} esta hora). Batería: ${batteryLevel !== null ? (batteryLevel * 100).toFixed(0) + '%' : 'N/A'}, Datos: ${nextData.toFixed(6)} MB`);

        setDataConsumed(nextData);
        localStorage.setItem('collie_transit_data_consumed', nextData.toString());
      } else {
        console.warn('⚠️ Conexión WebSocket cerrada. Ráfaga cancelada.');
        clearInterval(sendInterval);
      }
      count++;
    }, crowdsourceConfig.burstIntervalSeconds * 1000);
  };

  // Función de evaluación inteligente de geolocalización y consumo
  const evaluateSmartTracking = async (latitude: number, longitude: number, speed: number | null, heading: number | null, accuracy: number | null = null) => {
    // Retorno rápido si no hay ninguna ruta visible o seleccionada activa
    if ((!visibleRouteIds || visibleRouteIds.size === 0) && (!selectedRouteIds || selectedRouteIds.size === 0)) {
      if (lastStateRef.current !== 'IDLE') {
        setCrowdsourceState('IDLE');
        setCrowdsourceActive(false);
        lastStateRef.current = 'IDLE';
      }
      return;
    }

    // 1. Validar consumo de datos
    if (dataConsumed >= crowdsourceConfig.maxDataUsageMb) {
      console.log('⚠️ Límite de consumo de datos de telemetría alcanzado (5MB). Transmisión desactivada.');
      setCrowdsourceState('IDLE');
      setCrowdsourceActive(false);
      return;
    }

    // 2. Validar nivel de batería
    if ('getBattery' in navigator) {
      try {
        const battery: any = await (navigator as any).getBattery();
        if (battery.level < 0.20 && !battery.charging) {
          console.log('⚠️ Batería baja (<20%) y sin cargador. Transmisión de telemetría desactivada.');
          setCrowdsourceState('IDLE');
          setCrowdsourceActive(false);
          return;
        }
      } catch (err) {
        // ignore
      }
    }

    // ==========================================
    // %% CASO H: FILTRO DE RUIDO Y DRIFT GPS %%
    // ==========================================
    if (accuracy !== null && accuracy > 25.0) {
      console.warn(`⚠️ [Colaboración GPS] Señal descartada localmente: baja precisión del receptor GPS (${accuracy.toFixed(1)}m, requerido <= 25m).`);
      return;
    }

    const nowTimestamp = Date.now();
    if (lastPingCoordsRef.current && lastPingTimeRef.current > 0) {
      const timeDiff = (nowTimestamp - lastPingTimeRef.current) / 1000;
      const distDiff = getHaversineDistance(latitude, longitude, lastPingCoordsRef.current[0], lastPingCoordsRef.current[1]);
      const impliedSpeed = timeDiff > 0 ? (distDiff / timeDiff) * 3.6 : 0;

      if (timeDiff > 1.0 && impliedSpeed > 150.0) {
        console.warn(`⚠️ [Colaboración GPS] Señal descartada localmente: salto térmico/drift inestable detectado (Velocidad implícita: ${impliedSpeed.toFixed(1)} km/h).`);
        // Actualizar tiempo pero no coordenadas para darle oportunidad de estabilizarse
        lastPingTimeRef.current = nowTimestamp;
        return;
      }
    }
    lastPingCoordsRef.current = [latitude, longitude];
    lastPingTimeRef.current = nowTimestamp;

    // 3. Obtener estadísticas de uso de rutas desde localStorage
    let routeUsage: Record<string, number> = {};
    try {
      routeUsage = JSON.parse(localStorage.getItem('collie_transit_route_usage') || '{}');
    } catch {
      // ignore
    }

    // 4. Buscar paradas físicas linderas
    let nearestStop: any = null;
    let minStopDist = Infinity;
    let nearestStopActualDist = Infinity;
    
    if (transitStops && transitStops.length > 0) {
      const activeStops = transitStops.filter((stop: any) => {
        const stopRoute = stop.code || stop.routeId;
        return visibleRouteIds?.has(stopRoute) || selectedRouteIds?.has(stopRoute);
      });
      activeStops.forEach((stop: any) => {
        const dist = getHaversineDistance(latitude, longitude, stop.lat, stop.lng);
        let virtualDist = dist;

        const stopRoute = stop.code || stop.routeId;
        const isSelected = selectedRouteIds?.has(stopRoute) || visibleRouteIds?.has(stopRoute);
        const usageCount = routeUsage[stopRoute] || 0;
        const isFrequent = usageCount >= 5;

        // Ponderar distancia virtual para favorecer sin excluir
        if (isSelected) virtualDist *= 0.80; // Prioriza 20%
        if (isFrequent) virtualDist *= 0.85; // Prioriza 15%

        if (virtualDist < minStopDist) {
          minStopDist = virtualDist;
          nearestStop = stop;
          nearestStopActualDist = dist;
        }
      });
    }

    let currentSpeedKmh = (speed || 0) * 3.6;
    let newState: 'IDLE' | 'WAITING_AT_STOP' | 'ONBOARD_BUS' = 'IDLE';
    let matchedRouteCode: string | null = null;
    let matchedStopId: string | null = null;
    let bestMatchingBus: any = null;
    let minBusDist = Infinity;

    // Umbral de distancia dinámico no excluyente para parada
    let stopThreshold = 30.0;
    if (nearestStop) {
      const stopRoute = nearestStop.code || nearestStop.routeId;
      const isSelected = selectedRouteIds?.has(stopRoute) || visibleRouteIds?.has(stopRoute);
      const isFrequent = (routeUsage[stopRoute] || 0) >= 5;
      if (isSelected || isFrequent) {
        stopThreshold = 45.0; // flexibiliza a 45m si es favorita/activa
      }
    }

    // ==========================================
    // %% CASOS DE USO DE DETECCIÓN DE PASAJEROS %%
    // ==========================================

    // Caso A: Espera en Parada (Usuario en Tierra)
    // Condición: Permanencia consecutiva > 3 minutos a < 15 metros de la parada, o Caso F (Ruta Frecuente / Config Rutinaria)
    const isCloseToStop = nearestStop && nearestStopActualDist < 15.0;
    const isStationary = currentSpeedKmh < 3.0;

    if (isCloseToStop && isStationary) {
      if (!waitingStopStartRef.current || waitingStopStartRef.current.stopId !== nearestStop.id) {
        waitingStopStartRef.current = { stopId: nearestStop.id, startTime: Date.now() };
      }
      
      const elapsedSeconds = (Date.now() - waitingStopStartRef.current.startTime) / 1000;
      
      // Registrar parada visitada en el historial (Caso G: Firma de paradas)
      const stopRoute = nearestStop.code || nearestStop.routeId;
      const isAlreadyInHistory = stopHistoryRef.current.some(h => h.stopId === nearestStop.id);
      if (!isAlreadyInHistory) {
        stopHistoryRef.current.push({ stopId: nearestStop.id, timestamp: Date.now() });
      }
      
      // Caso F: Viaje rutinario o histórico (Saber si es frecuente en esa ruta)
      const isFrequentPattern = (routeUsage[stopRoute] || 0) >= 5;
      const requiredWaitTime = isFrequentPattern ? 30 : 180; // si es frecuente, bajamos a 30s de confirmación

      if (elapsedSeconds >= requiredWaitTime) {
        newState = 'WAITING_AT_STOP';
        matchedRouteCode = stopRoute;
        matchedStopId = nearestStop.id;
      }
    } else {
      waitingStopStartRef.current = null;
    }

    // Caso J: Ahorro de energía en atasco - Conteo de pings estacionarios
    if (isStationary) {
      consecutiveStationaryPingsRef.current += 1;
    } else {
      consecutiveStationaryPingsRef.current = 0;
    }

    // Buscar ruta física lindera
    let nearestRoute: any = null;
    let minRouteDist = Infinity;
    let nearestRouteActualDist = Infinity;
    let nearestRouteDir: string = 'ida';
    let nearestRouteCoords: [number, number][] = [];
    
    const activeRoutes = transitRoutes.filter((route: any) => 
      selectedRouteIds?.has(route.id) || 
      selectedRouteIds?.has(route.code) || 
      visibleRouteIds?.has(route.id) || 
      visibleRouteIds?.has(route.code)
    );
    activeRoutes.forEach((route: any) => {
      const directions = route.directions || [];
      directions.forEach((dir: any) => {
        const coords = dir.coordinates || [];
        // Muestrear 1 de cada 5 puntos para reducir cálculos de Haversine sin perder precisión útil
        for (let ci = 0; ci < coords.length; ci += 5) {
          const coord = coords[ci];
          const dist = getHaversineDistance(latitude, longitude, coord[0], coord[1]);
          let virtualDist = dist;

          const isSelected = selectedRouteIds?.has(route.code) || visibleRouteIds?.has(route.code);
          const usageCount = routeUsage[route.code] || 0;
          const isFrequent = usageCount >= 5;

          if (isSelected) virtualDist *= 0.80;
          if (isFrequent) virtualDist *= 0.85;

          if (virtualDist < minRouteDist) {
            minRouteDist = virtualDist;
            nearestRoute = route;
            nearestRouteActualDist = dist;
            nearestRouteDir = dir.type || 'ida';
            nearestRouteCoords = coords;
          }
        }
      });
    });

    let routeThreshold = 150.0;
    if (nearestRoute) {
      const isSelected = selectedRouteIds?.has(nearestRoute.code) || visibleRouteIds?.has(nearestRoute.code);
      const isFrequent = (routeUsage[nearestRoute.code] || 0) >= 5;
      if (isSelected || isFrequent) {
        routeThreshold = 200.0;
      }
    }

    // Caso G: Confirmación por Firma de Detención en Paradas
    // Limpiar paradas viejas (> 20 minutos) y evaluar firma de detención
    const cutoffTime = Date.now() - 1200000;
    stopHistoryRef.current = stopHistoryRef.current.filter(h => h.timestamp > cutoffTime);
    const distinctStopsCount = stopHistoryRef.current.map(h => h.stopId).filter((v, i, self) => self.indexOf(v) === i).length;
    const hasStopFirma = distinctStopsCount >= 2;

    // Guardar miga de pan en el historial de trayectoria local (localStorage + ref)
    const breadcrumb = {
      lat: latitude,
      lng: longitude,
      speed: currentSpeedKmh,
      heading: heading || 0,
      timestamp: nowTimestamp,
      candidateRoute: nearestRoute ? nearestRoute.code : undefined,
      candidateDir: nearestRouteDir
    };
    trajectoryHistoryRef.current.push(breadcrumb);
    if (trajectoryHistoryRef.current.length > 10) {
      trajectoryHistoryRef.current.shift();
    }
    try {
      localStorage.setItem('collie_gps_trajectory_history', JSON.stringify(trajectoryHistoryRef.current.slice(-10)));
    } catch (e) {
      // ignore
    }

    // Evaluacion multi-muestreo: Requerir al menos 3 pings consecutivos consistentes en la misma traza para confirmar alta precisión
    const recentSamples = trajectoryHistoryRef.current.slice(-3);
    const isMultiSampleTrajectoryConfirmed = recentSamples.length >= 3 && recentSamples.every(s => 
      s.candidateRoute && 
      s.candidateRoute === (nearestRoute ? nearestRoute.code : '') && 
      s.speed > 5.0
    );

    // Caso B: A bordo en movimiento (Usuario en viaje)
    const isMovingAtBusSpeed = currentSpeedKmh > 10.0;
    const isCloseToRoute = nearestRoute && nearestRouteActualDist < routeThreshold;

    const wasWaiting = lastStateRef.current === 'WAITING_AT_STOP';
    const isTransbordo = lastOnboardTimeRef.current && 
      ((Date.now() - lastOnboardTimeRef.current.endTime) / 1000 <= 300) &&
      lastOnboardTimeRef.current.routeCode !== (nearestRoute ? nearestRoute.code : '');

    if (isMovingAtBusSpeed && isCloseToRoute) {
      if (wasWaiting || hasStopFirma || isTransbordo || isMultiSampleTrajectoryConfirmed) {
        if (newState === 'IDLE' && (hasStopFirma || isMultiSampleTrajectoryConfirmed) && lastStateRef.current === 'IDLE') {
          console.log(`📈 [Colaboración GPS] Pasajero a bordo confirmado por trayectoria multi-muestreo (3 muestras consecutivas en traza ${nearestRoute.code}).`);
        }
        newState = 'ONBOARD_BUS';
        matchedRouteCode = nearestRoute.code;
      } else {
        newState = 'IDLE';
      }
    }

    // Caso C: Fin de Viaje / Descenso Autodetectado
    // Si estábamos onboard y nos desviamos > 250m de la traza, o nos movemos a velocidad de auto (> 35km/h) lejos de ella
    if (lastStateRef.current === 'ONBOARD_BUS' && lastRouteCodeRef.current) {
      const isFarFromRoute = !nearestRoute || (nearestRoute.code === lastRouteCodeRef.current && nearestRouteActualDist > 250.0);
      const isTooFastAndOffRoute = currentSpeedKmh > 35.0 && isFarFromRoute;

      if (isFarFromRoute || isTooFastAndOffRoute) {
        console.log('🚶‍♂️ [Colaboración GPS] Fin de viaje detectado (Pasajero descendió del colectivo). Deteniendo transmisión.');
        newState = 'IDLE';
        matchedRouteCode = null;
        matchedStopId = null;
        matchedBusTripIdRef.current = null;
      }
    }

    // Caso E: Emparejamiento por Sincronía con Colectivo en Pantalla
    if (newState === 'ONBOARD_BUS' && matchedRouteCode) {
      bestMatchingBus = null;
      minBusDist = 15.0; // radio estricto de 15 metros para considerar sincronía

      liveBuses.forEach((bus: any) => {
        if (bus.code === matchedRouteCode || bus.routeId === matchedRouteCode) {
          const dist = getHaversineDistance(latitude, longitude, bus.lat, bus.lng);
          if (dist < minBusDist) {
            minBusDist = dist;
            bestMatchingBus = bus;
          }
        }
      });

      if (bestMatchingBus) {
        if (matchedBusTripIdRef.current !== bestMatchingBus.tripId) {
          console.log(`🤝 [Colaboración GPS] Sincronía detectada con colectivo interno (TripID: ${bestMatchingBus.tripId}) a ${minBusDist.toFixed(1)} metros.`);
          matchedBusTripIdRef.current = bestMatchingBus.tripId;
        }
      } else {
        matchedBusTripIdRef.current = null;
      }

      // Caso I: Detección de Congestión (Detenido fuera de paradas durante > 3 min)
      if (isStationary) {
        const isFarFromStop = !nearestStop || nearestStopActualDist > 50.0;
        if (isFarFromStop) {
          if (stationaryStartOutsideStopRef.current === null) {
            stationaryStartOutsideStopRef.current = Date.now();
          }
          const timeStationary = (Date.now() - stationaryStartOutsideStopRef.current) / 1000;
          if (timeStationary >= 180.0) {
            if (!isTrafficJamRef.current) {
              console.log('⚠️ [Colaboración GPS] Alerta de congestión/tránsito pesado autodetectada localmente.');
            }
            isTrafficJamRef.current = true;
          }
        } else {
          stationaryStartOutsideStopRef.current = null;
          isTrafficJamRef.current = false;
        }
      } else {
        stationaryStartOutsideStopRef.current = null;
        isTrafficJamRef.current = false;
      }
    }

    // Actualizar historial del último estado para transiciones
    if (newState === 'ONBOARD_BUS' && lastStateRef.current !== 'ONBOARD_BUS') {
      // guardamos por si hay descenso futuro
    } else if (lastStateRef.current === 'ONBOARD_BUS' && newState !== 'ONBOARD_BUS' && lastRouteCodeRef.current) {
      lastOnboardTimeRef.current = { routeCode: lastRouteCodeRef.current, endTime: Date.now() };
    }
    lastStateRef.current = newState;
    lastRouteCodeRef.current = matchedRouteCode;

    setCrowdsourceState(newState);
    setCrowdsourceRoute(matchedRouteCode);
    setCrowdsourceStopId(matchedStopId);

    // ==========================================
    // %% VALIDACIONES DE PLANILLA HORARIA LOCAL %%
    // ==========================================
    if (newState !== 'IDLE' && matchedRouteCode) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const nowMinutes = currentHour * 60 + currentMinute;
      
      const day = now.getDay();
      let todayType = 'weekday';
      if (day === 0) todayType = 'sunday';
      else if (day === 6) todayType = 'saturday';

      // Buscar el objeto ruta
      const currentRoute = transitRoutes.find((r: any) => r.code === matchedRouteCode);
      let isScheduleActiveLocal = false;
      let theoreticalProgress = 0.0;

      if (currentRoute && currentRoute.schedules) {
        const scheduleKey = `${todayType}_${nearestRouteDir}`;
        const schedule = currentRoute.schedules[scheduleKey] || currentRoute.schedules[`weekday_${nearestRouteDir}`];
        
        if (schedule && schedule.matrix && schedule.matrix.length > 0) {
          // Recorrer los viajes para ver si alguno coincide con el horario del celular
          for (const trip of schedule.matrix) {
            const times = trip.times || [];
            if (times.length >= 2) {
              const parseTimeToMinutes = (tStr: string) => {
                const parts = tStr.split(':');
                return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
              };

              const startMin = parseTimeToMinutes(times[0]);
              const endMin = parseTimeToMinutes(times[times.length - 1]);

              // Ventana de tolerancia horaria: -10m salida a +15m llegada
              if (nowMinutes >= (startMin - 10) && nowMinutes <= (endMin + 15)) {
                isScheduleActiveLocal = true;
                
                // Calcular progreso teórico en base al tiempo transcurrido
                const elapsed = nowMinutes - startMin;
                const duration = endMin - startMin;
                theoreticalProgress = duration > 0 ? Math.max(0, Math.min(1, elapsed / duration)) : 0;
                break;
              }
            }
          }
        }
      }

      // 1. Control de Planilla Activa y Ventana Horaria en Cliente
      if (!isScheduleActiveLocal) {
        console.log(`🚫 [Colaboración GPS] Señal descartada localmente: no hay planilla horaria activa en el cliente para la ruta ${matchedRouteCode} en esta ventana.`);
        return;
      }

      // 2. Puerta de Proximidad Física en Cliente (Filtro de 10 Cuadras)
      if (isScheduleActiveLocal && nearestRouteCoords.length > 0) {
        const theoreticalPoint = interpolatePointOnPolyline(nearestRouteCoords, theoreticalProgress);
        if (theoreticalPoint) {
          const distToTheoreticalPoint = getHaversineDistance(latitude, longitude, theoreticalPoint[0], theoreticalPoint[1]);
          const maxDistanceAllowed = 1000.0; // 10 cuadras = 1000 metros
          
          if (distToTheoreticalPoint > maxDistanceAllowed) {
            console.log(`🚫 [Colaboración GPS] Señal descartada localmente: fuera de proximidad física de la planilla (desvío: ${distToTheoreticalPoint.toFixed(1)} metros, máx: 1000m).`);
            return;
          }
        }
      }

      // 3. Filtro de Redundancia Cooperativa (Evitar enviar si ya hay unidades en pantalla)
      const isRedundant = bestMatchingBus && !bestMatchingBus.id?.startsWith('sim-') && minBusDist < 100.0;
      if (isRedundant) {
        console.log(`🤫 [Colaboración GPS] Señal omitida: la unidad ya está siendo reportada en tiempo real (distancia: ${minBusDist.toFixed(1)}m).`);
        return;
      }

      // 4. Muestreo Intermitente por Ráfagas
      const nowTime = Date.now();
      const searchParams = new URLSearchParams(window.location.search);
      const isMockActive = searchParams.get('mock_gps') !== null;
      const deviceId = localStorage.getItem('collie_transit_device_id') || '';
      const isTestDevice = deviceId === 'TEST_PROD_DEVICE' || deviceId.startsWith('DEV_TEST');
      const isChosen = (isMockActive || isTestDevice) ? true : (Math.random() <= crowdsourceConfig.probability);
      
      routeSelectionRef.current[matchedRouteCode] = {
        chosen: isChosen,
        lastBurstTime: routeSelectionRef.current[matchedRouteCode]?.lastBurstTime || 0,
      };

      const session = routeSelectionRef.current[matchedRouteCode];
      if (session.chosen) {
        const elapsedSinceLastBurst = nowTime - session.lastBurstTime;
        if (elapsedSinceLastBurst >= crowdsourceConfig.sleepDurationSeconds * 1000) {
          setCrowdsourceActive(true);
          session.lastBurstTime = nowTime;
          const isTransition = newState === 'ONBOARD_BUS' && lastStateRef.current === 'WAITING_AT_STOP';
          triggerLocationBurst(latitude, longitude, currentSpeedKmh, heading || 0, newState, matchedRouteCode, matchedStopId, accuracy, isTransition);
        } else {
          setCrowdsourceActive(false); // en hibernación
        }
      } else {
        setCrowdsourceActive(false);
      }
    } else {
      setCrowdsourceActive(false);
    }
  };

  const [currentZoom, setCurrentZoom] = useState<number>(13);

  const stopIconSize = useMemo(() => {
    if (currentZoom < 13) return 0;
    if (currentZoom === 13) return 12;
    if (currentZoom === 14) return 16;
    if (currentZoom === 15) return 20;
    return 24; // Para zoom >= 16
  }, [currentZoom]);

  const evaluateSmartTrackingRef = useRef(evaluateSmartTracking);
  useEffect(() => {
    evaluateSmartTrackingRef.current = evaluateSmartTracking;
  }, [evaluateSmartTracking]);

  // === Geolocalización desacoplada: watchPosition solo actualiza el marcador visual ===
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mockGps = searchParams.get('mock_gps');

    if (mockGps) {
      console.log(`🎯 Mocking GPS location: ${mockGps}`);
      let mockLat = -34.11262;
      let mockLng = -59.01485;
      let mockSpeed = 0;
      let mockHeading = 0;

      if (mockGps === 'bus') {
        mockLat = -34.113738;
        mockLng = -59.016911;
        mockSpeed = 8.5; // ~30 km/h
        mockHeading = 90;
      }

      setUserPos([mockLat, mockLng]);
      userPosRef.current = { lat: mockLat, lng: mockLng, speed: mockSpeed, heading: mockHeading, accuracy: 10.0, timestamp: Date.now() };

      const intervalId = setInterval(() => {
        userPosRef.current = { lat: mockLat, lng: mockLng, speed: mockSpeed, heading: mockHeading, accuracy: 10.0, timestamp: Date.now() };
      }, 5000);

      return () => clearInterval(intervalId);
    }

    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserPos([lat, lng]);
          userPosRef.current = {
            lat,
            lng,
            speed: position.coords.speed,
            heading: position.coords.heading,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          };
        },
        (error) => {
          // kCLErrorLocationUnknown / TIMEOUT en navegadores de escritorio sin GPS
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // === Telemetría Exclusiva para el Botón "GPS Colaborativo" (isCollaborativeGpsActive) ===
  useEffect(() => {
    if (!isCollaborativeGpsActive) {
      setCrowdsourceActive(false);
      setCrowdsourceState('IDLE');
      return;
    }

    setCrowdsourceActive(true);
    setCrowdsourceState('ONBOARD_BUS');

    let deviceId = localStorage.getItem('collie_transit_device_id');
    if (!deviceId) {
      deviceId = 'DEV_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      localStorage.setItem('collie_transit_device_id', deviceId);
    }

    const sendCollaborativePing = async () => {
      let lat = userPosRef.current?.lat;
      let lng = userPosRef.current?.lng;
      let speed = userPosRef.current?.speed || 0.0;
      let heading = userPosRef.current?.heading || 0.0;
      let accuracy = userPosRef.current?.accuracy || 10.0;

      if (!lat || !lng) {
        if (userPos && userPos.length === 2 && userPos[0] && userPos[1]) {
          lat = userPos[0];
          lng = userPos[1];
        } else {
          lat = -34.11703;
          lng = -59.07735;
        }
      }

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      let batteryLevel: number | null = null;
      if ('getBattery' in navigator) {
        try {
          const battery: any = await (navigator as any).getBattery();
          batteryLevel = battery.level;
        } catch {
          // ignore
        }
      }

      let activeRouteCode = 'LINEA_A';
      if (selectedRouteIds && selectedRouteIds.size > 0) {
        activeRouteCode = Array.from(selectedRouteIds)[0];
      } else if (visibleRouteIds && visibleRouteIds.size > 0) {
        activeRouteCode = Array.from(visibleRouteIds)[0];
      }

      const payload = {
        action: 'crowdsource_telemetry',
        data: {
          device_id: deviceId,
          lat: lat,
          lng: lng,
          speed: speed,
          heading: heading,
          state: 'ONBOARD_BUS',
          route_code: activeRouteCode,
          timestamp: Date.now(),
          role: 'COLLABORATIVE_USER',
          battery_level: batteryLevel,
          accuracy: accuracy,
          client_type: window.matchMedia('(display-mode: standalone)').matches ? 'PWA' : 'BROWSER',
          client_version: CLIENT_VERSION
        }
      };

      wsRef.current.send(JSON.stringify(payload));
      signalTimestampsRef.current.push(Date.now());
      setCrowdsourceRoute(activeRouteCode);

      const estimatedBytes = JSON.stringify(payload).length;
      setDataConsumed(prev => {
        const next = prev + (estimatedBytes / (1024 * 1024));
        localStorage.setItem('collie_transit_data_consumed', next.toString());
        return next;
      });

      console.log(`📡 [GPS Colaborativo] Telemetría enviada por WebSocket (${(lat ?? 0).toFixed(5)}, ${(lng ?? 0).toFixed(5)}).`);
    };

    sendCollaborativePing();
    const intervalId = setInterval(sendCollaborativePing, 10000);

    return () => clearInterval(intervalId);
  }, [isCollaborativeGpsActive, selectedRouteIds, visibleRouteIds]);

  // Ref para mantener las rutas actualizadas sin disparar la reconexión de WebSocket

  // Ref para mantener wsStatus actualizado sin disparar el effect de fetch
  const wsStatusRef = useRef(wsStatus);
  useEffect(() => {
    wsStatusRef.current = wsStatus;
  }, [wsStatus]);

  // Actualizar estadísticas de uso de rutas para priorización inteligente (usuario frecuente)
  useEffect(() => {
    if (selectedRouteIds && selectedRouteIds.size > 0) {
      try {
        const usage = JSON.parse(localStorage.getItem('collie_transit_route_usage') || '{}');
        selectedRouteIds.forEach(id => {
          usage[id] = (usage[id] || 0) + 1;
        });
        localStorage.setItem('collie_transit_route_usage', JSON.stringify(usage));
      } catch (e) {
        // ignore
      }
    }
  }, [selectedRouteIds]);

  // WebSocket Live Realtime Connection Effect (con Controles Anti-Zombi)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 2000;
    const maxReconnectDelay = 15000;
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 5;

    const cleanUpWS = (socket: WebSocket | null) => {
      wsRef.current = null;
      if (socket) {
        try {
          socket.onopen = null;
          socket.onmessage = null;
          socket.onerror = null;
          socket.onclose = null;
          if (socket.readyState === WebSocket.OPEN) {
            socket.close();
          }
        } catch (_) {}
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('🙈 Pestaña oculta/en segundo plano: Pausando streaming en vivo para ahorar datos (Anti-Zombi).');
        cleanUpWS(ws);
        setWsStatus('disconnected');
      } else {
        console.log('👁️ Pestaña activa en primer plano: Reanudando streaming en vivo.');
        connectWS();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const connectWS = () => {
      if (document.hidden) {
        setWsStatus('disconnected');
        return;
      }
      if (!isMounted || import.meta.env.VITE_ENABLE_WS === 'false') {
        setWsStatus('disconnected');
        return;
      }
      
      const wsUrl = getWsUrl();
      
      if (!wsUrl || retryCount >= maxRetries) {
        setWsStatus('disconnected');
        return;
      }

      setWsStatus('connecting');

      // Limpiar conexión previa si estuviera abierta
      cleanUpWS(ws);

      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          console.log('🟢 Conexión WebSocket establecida con éxito.');
          setWsStatus('connected');
          reconnectDelay = 2000; // Reset delay
          retryCount = 0; // Reset retryCount
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const rawData = JSON.parse(event.data);
            if (rawData.type === 'FLEET_STATE_UPDATE' || rawData.type === 'fleet_update') {
              const fleetData = rawData.data || [];
              const mappedBuses: Bus[] = [];
              const currentRoutes = routesRef.current;

              // 1. Filtrar pasajeros y buses oficiales
              const passengers: any[] = [];
              const officialBuses: any[] = [];

              fleetData.forEach((s: any) => {
                if (!s.route_code) return;
                if (Math.abs(s.lat || 0) < 0.1 && Math.abs(s.lng || 0) < 0.1) return; // Omitir [0,0]

                const isPassenger = s.role === 'PASSENGER' || s.role === 'FREQUENT_USER' || s.role === 'COLLABORATIVE_USER' || s.role === 'USER' || s.state === 'ONBOARD_BUS';
                if (isPassenger && !s.is_crowdsourced) {
                  passengers.push(s);
                } else {
                  officialBuses.push(s);
                }
              });

              // Mapear buses oficiales primero
              officialBuses.forEach((s: any) => {
                const route = currentRoutes.find((r: any) => r.code === s.route_code);
                const routeId = route ? route.id : ("route-" + s.route_code);
                const routeName = route ? route.name : s.route_code;
                const routeColor = route ? route.color : "#000000";

                let dir: 'ida' | 'vuelta' = (s.dir === 'ida' || s.dir === 'vuelta') ? s.dir : 'ida';
                const busId = s.id?.startsWith('ws-') ? s.id : `ws-${s.route_code}-${s.id || s.device_id || ''}`;

                mappedBuses.push({
                  id: busId,
                  routeId: routeId,
                  name: routeName,
                  code: s.route_code,
                  color: routeColor,
                  pos: [s.lat, s.lng],
                  dir: dir,
                  dist: 0,
                  speed: s.speed || 20,
                  nextStop: s.next_stop || '',
                  tripIdx: 0,
                  bearing: s.bearing || 0,
                  dispatchOrder: s.dispatch_order || s.dispatchOrder,
                  startTime: s.startTime || s.start_time,
                  endTime: s.endTime || s.end_time,
                  onboardCount: s.onboard_count || s.onboardCount || 0,
                  isCrowdsourced: !!s.is_crowdsourced
                });
              });

              // 2. Agrupar pasajeros para generar colectivos virtuales
              const passengersByRoute: Record<string, any[]> = {};
              passengers.forEach(p => {
                const key = `${p.route_code}-${p.dir || 'ida'}`;
                if (!passengersByRoute[key]) passengersByRoute[key] = [];
                passengersByRoute[key].push(p);
              });

              Object.entries(passengersByRoute).forEach(([routeKey, list]) => {
                const [routeCode, dir] = routeKey.split('-');
                
                // Spatial clustering: agrupar a menos de 150m
                const clusters: any[][] = [];
                list.forEach(p => {
                  let added = false;
                  for (let i = 0; i < clusters.length; i++) {
                    const first = clusters[i][0];
                    if (geoDistance([p.lat, p.lng], [first.lat, first.lng]) <= 150) {
                      clusters[i].push(p);
                      added = true;
                      break;
                    }
                  }
                  if (!added) {
                    clusters.push([p]);
                  }
                });

                clusters.forEach(cluster => {
                  if (cluster.length >= 5) {
                    let sumLat = 0, sumLng = 0, sumSpeed = 0, sumHeading = 0;
                    cluster.forEach(p => {
                      sumLat += p.lat;
                      sumLng += p.lng;
                      sumSpeed += p.speed || 0;
                      sumHeading += p.bearing || p.heading || 0;
                    });
                    const avgLat = sumLat / cluster.length;
                    const avgLng = sumLng / cluster.length;
                    const avgSpeed = sumSpeed / cluster.length;
                    const avgHeading = sumHeading / cluster.length;

                    const dirKey = dir as 'ida' | 'vuelta';
                    const hasOfficialNearby = mappedBuses.some(b => 
                      b.code === routeCode && 
                      b.dir === dirKey && 
                      geoDistance([avgLat, avgLng], b.pos as [number, number]) <= 200
                    );

                    if (!hasOfficialNearby) {
                      const route = currentRoutes.find((r: any) => r.code === routeCode);
                      const routeId = route ? route.id : ("route-" + routeCode);
                      const routeName = route ? route.name : routeCode;
                      const routeColor = route ? route.color : "#000000";

                      mappedBuses.push({
                        id: `virtual-crowd-${routeCode}-${dirKey}`,
                        routeId: routeId,
                        name: routeName,
                        code: routeCode,
                        color: routeColor,
                        pos: [avgLat, avgLng],
                        dir: dirKey,
                        dist: 0,
                        speed: avgSpeed,
                        nextStop: 'Identificado por pasajeros',
                        tripIdx: 0,
                        bearing: avgHeading,
                        dispatchOrder: 0,
                        startTime: '',
                        endTime: '',
                        onboardCount: cluster.length,
                        isCrowdsourced: true
                      });
                      console.log(`[Client Crowdsourcing] Identified virtual bus on route ${routeCode} (${dirKey}) from ${cluster.length} users.`);
                    }
                  }
                });
              });

              if (rawData.active_stops) {
                setActiveStops(rawData.active_stops);
              }

              setBackendBuses(prevBuses => {
                const busesMap = new Map<string, Bus>();
                // Solo retener telemetría GPS real si hubo un breve delay, NO retener simulados finalizados
                prevBuses.forEach(b => {
                  if ((b as any).isGps && Date.now() - (b.lastUpdateLocal || 0) < 10000) {
                    busesMap.set(b.id || '', b);
                  }
                });

                // Integrar los nuevos buses reportados en este mensaje
                mappedBuses.forEach(newBus => {
                  const existing = busesMap.get(newBus.id || '');
                  if (existing) {
                    busesMap.set(newBus.id || '', {
                      ...newBus,
                      lastUpdateLocal: Date.now(),
                      dispatchOrder: existing.dispatchOrder || newBus.dispatchOrder,
                      startTime: existing.startTime || newBus.startTime,
                      endTime: existing.endTime || newBus.endTime,
                      name: existing.name || newBus.name,
                      color: existing.color || newBus.color,
                      tripIdx: existing.tripIdx || newBus.tripIdx
                    });
                  } else {
                    busesMap.set(newBus.id || '', {
                      ...newBus,
                      lastUpdateLocal: Date.now()
                    });
                  }
                });

                return Array.from(busesMap.values());
              });
              setLastUpdatedBuses(new Date());
            }
          } catch (err) {
            console.warn('Error parsing WebSocket fleet payload:', err);
          }
        };

        ws.onerror = (error) => {
          console.warn('⚠️ WebSocket error:', error);
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setWsStatus('disconnected');
          const currentDelay = reconnectDelay;
          reconnectDelay = Math.min(reconnectDelay * 1.5, maxReconnectDelay);

          console.log(`🔴 WebSocket cerrado. Intentando reconexión en ${currentDelay / 1000}s...`);
          
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            if (isMounted) {
              connectWS();
            }
          }, currentDelay);
        };
      } catch (wsErr) {
        console.error('Fatal error initializing WebSocket:', wsErr);
        if (isMounted) {
          setWsStatus('disconnected');
          retryCount++;
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectWS, reconnectDelay);
        }
      }
    };

    connectWS();

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanUpWS(ws);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []); // Se conecta una sola vez al montar

  const hasFilter = selectedRouteIds.size > 0;
  const routes = hasFilter ? transitRoutes.filter((r: any) => selectedRouteIds.has(r.id) && visibleRouteIds.has(r.id)) : [];

  const deduplicatedCabeceras = useMemo(() => {
    if (!showStartEndMarkers || currentZoom < 13) return [];
    
    const list: { position: [number, number]; label: string; type: 'inicio' | 'fin'; color: string; routeId: string }[] = [];
    
    routes.forEach((route: any) => {
      const dirs = route.directions?.filter((dir: any, index: number, self: any[]) => {
        const dirName = dir.direction || dir.name;
        return self.findIndex((d: any) => (d.direction || d.name) === dirName) === index;
      }) || [];
      
      dirs.forEach((dir: any) => {
        const isVisible = dir.direction === 'ida' ? (routeShowIda[route.id] ?? true) : (routeShowVuelta[route.id] ?? true);
        if (!isVisible || !dir.coordinates || dir.coordinates.length < 2) return;
        
        const routeParts = (route.name || '').split(' - ');
        let cabeceraInicio = 'Inicio';
        let cabeceraFin = 'Fin';
        if (routeParts.length >= 2) {
          const origen = routeParts[0].trim();
          const destino = routeParts[1].trim();
          if (dir.direction === 'ida') {
            cabeceraInicio = origen;
            cabeceraFin = destino;
          } else {
            cabeceraInicio = destino;
            cabeceraFin = origen;
          }
        } else {
          cabeceraInicio = route.name || 'Inicio';
          cabeceraFin = dir.direction === 'ida' ? 'Fin' : 'Inicio';
        }
        
        list.push({
          position: dir.coordinates[0],
          label: cabeceraInicio,
          type: 'inicio',
          color: route.color || '#3b82f6',
          routeId: route.id
        });
        
        list.push({
          position: dir.coordinates[dir.coordinates.length - 1],
          label: cabeceraFin,
          type: 'fin',
          color: route.color || '#3b82f6',
          routeId: route.id
        });
      });
    });
    
    const grouped: typeof list = [];
    
    list.forEach((item) => {
      let found = false;
      for (const existing of grouped) {
        const label1 = existing.label.toLowerCase().trim();
        const label2 = item.label.toLowerCase().trim();
        
        // Comparación inteligente de texto:
        // - Nombres idénticos
        // - Uno contiene al otro (ej. "Hospital" y "Hospital (Bosch)")
        // - Comparten la primera palabra significativa de más de 3 letras (ej. "Hospital" y "Hospital...")
        const word1 = label1.split(/[ \(\)-]+/)[0] || "";
        const word2 = label2.split(/[ \(\)-]+/)[0] || "";
        const hasCommonPrefix = word1 !== "" && word1 === word2 && word1.length > 3;
        
        const isSimilar = label1 === label2 || 
                          label1.includes(label2) || 
                          label2.includes(label1) ||
                          hasCommonPrefix;

        if (isSimilar) {
          const dist = geoDistance(existing.position, item.position);
          const thresholdMeters = 200.0; // Umbral de agrupación de 200 metros para evitar colisiones
          
          if (dist < thresholdMeters) {
            found = true;
            // Promediar la posición geográfica
            existing.position = [
              (existing.position[0] + item.position[0]) / 2,
              (existing.position[1] + item.position[1]) / 2
            ];
            // Conservar el nombre más corto y limpio
            if (item.label.trim().length < existing.label.trim().length) {
              existing.label = item.label.trim();
            }
            break;
          }
        }
      }
      if (!found) {
        grouped.push({ ...item, label: item.label.trim() });
      }
    });
    
    return grouped;
  }, [routes, routeShowIda, routeShowVuelta, showStartEndMarkers, currentZoom]);

  // REST API FALLBACK / MANUAL REFRESH TRIGGER & POLLING WHEN DISCONNECTED
  useEffect(() => {
    const baseUrl = getApiBaseUrl();

    const fetchLiveBuses = async () => {
      setIsLoadingBuses(true);
      const candidates = [
        baseUrl,
        import.meta.env.VITE_TRANSIT_API_URL
      ].filter(Boolean);
      const uniqueCandidates = Array.from(new Set(candidates));

      for (const targetUrl of uniqueCandidates) {
        try {
          const cleanUrl = (targetUrl as string).replace(/\/$/, '');
          const token = await getPublicToken(cleanUrl);
          const liveEndpoint = cleanUrl.endsWith('/v1') ? `${cleanUrl}/transit/buses/live` : `${cleanUrl}/v1/transit/buses/live`;
          const res = await fetch(liveEndpoint, {
            headers: { 
              'X-Application-ID': 'COLLIE-TRANSIT-WEB',
              'Authorization': token
            }
          });
          if (res.ok) {
            const rawData = await res.json();
            const currentRoutes = routesRef.current;
            const mappedData = rawData.map((s: any) => {
              if (!s) return null;
            const routeCode = s.route_code || s.code || s.line_code;
            const deviceId = s.device_id || s.deviceId || '';
            const route = currentRoutes.find((r: any) => r.code === routeCode);
            const routeId = route ? route.id : ("route-" + routeCode);
            const routeName = route ? route.name : routeCode;
            const routeColor = route ? route.color : "#000000";

            let dir: 'ida' | 'vuelta' = (s.dir === 'ida' || s.dir === 'vuelta') ? s.dir : 'ida';
            const lat = s.pos && s.pos.length >= 2 ? s.pos[0] : (s.lat || 0);
            const lng = s.pos && s.pos.length >= 2 ? s.pos[1] : (s.lng || 0);

            if (Math.abs(lat) < 0.1 && Math.abs(lng) < 0.1) return null; // Omitir telemetría en [0,0]

            const busId = s.id?.startsWith('ws-') 
              ? s.id 
              : `ws-${routeCode}-${s.id || deviceId}`;

            const isGps = s.is_gps === true || s.isGps === true;
            const isSimulated = s.is_simulated === true || s.isSimulated === true || (s.id && String(s.id).startsWith('sim-'));

            return {
              id: busId,
              originalId: s.id,
              isGps: isGps,
              isSimulated: isSimulated,
              gpsSource: s.gps_source || s.gpsSource || (isGps ? 'REAL_TELEMETRY' : 'SCHEDULE_SIMULATION'),
              hasRealGpsMatch: isGps,
              routeId: routeId,
              name: routeName,
              code: routeCode,
              color: routeColor,
              pos: [lat, lng],
              dir: dir,
              dist: s.dist || 0,
              speed: s.speed || 20,
              nextStop: s.nextStop || '',
              tripIdx: s.tripIdx || 0,
              bearing: s.bearing || 0,
              dispatchOrder: s.dispatch_order || s.dispatchOrder,
              startTime: s.startTime || s.start_time,
              endTime: s.endTime || s.end_time
            };
          });
          setBackendBuses(mappedData.filter(Boolean));
          setLastUpdatedBuses(new Date());
          setIsLoadingBuses(false);
          return;
        }
      } catch (err) {
        console.warn('Failed candidate in fetchLiveBuses:', targetUrl, err);
      }
    }
    setIsLoadingBuses(false);
  };

    fetchLiveBuses();

    // Polling adaptativo ultra-eficiente:
    // 1. Si el mapa está alejado (zoom <= 12) y sin selección: 20s (20000ms).
    // 2. Si el usuario está enfocado (zoom > 12) o sigue un colectivo/ramal: 5s (5000ms).
    let effectiveIntervalMs = 20000;
    if ((selectedRouteIds && selectedRouteIds.size > 0) || currentZoom > 12) {
      effectiveIntervalMs = 5000;
    }

    const pollInterval = setInterval(() => {
      fetchLiveBuses();
    }, effectiveIntervalMs);

    return () => {
      clearInterval(pollInterval);
    };
  }, [manualRefreshTrigger, livePollingEnabled, livePollingIntervalSec, simulateBusesLocally, wsStatus, currentZoom, selectedRouteIds]);

  // ----------------- PARADA ANCLADA (ESTILO ANDROID) -----------------
  const pinnedArrivals = useMemo(() => {
    if (!subscribedStop || !backendBuses || !routePathData) return [];

    const list: any[] = [];
    const dir = subscribedStop.direction || 'ida';
    const routeId = subscribedStop.routeId;

    const route = transitRoutes.find((r: any) => r.id === routeId);
    if (!route || !route.stops) return [];

    const routeStops = route.stops.filter((s: any) => s.direction === dir);
    const stopIdx = routeStops.findIndex((s: any) => s.name === subscribedStop.stopName);
    if (stopIdx === -1) return [];

    const pathData = routePathData[routeId]?.[dir as 'ida' | 'vuelta'];
    if (!pathData || !pathData.coordinates || pathData.coordinates.length < 2) return [];

    const targetStop = routeStops[stopIdx];
    const targetStopPos: [number, number] = (targetStop.projLat !== undefined && targetStop.projLng !== undefined)
      ? [targetStop.projLat, targetStop.projLng]
      : [targetStop.lat, targetStop.lng];

    const stopProj = projectOnPolyline(targetStopPos, pathData.coordinates);
    const stopProjPoint = stopProj.point;
    
    const cumulativeDistances = pathData.cumulativeDistances;
    const stopDistance = cumulativeDistances[stopProj.segIdx] + stopProj.t * ((cumulativeDistances[stopProj.segIdx + 1] || pathData.totalDistance) - cumulativeDistances[stopProj.segIdx]);
    
    const matchingBuses = combinedBuses.filter((bus: any) => (bus.routeId === routeId || bus.code === route.code) && bus.dir === dir);

    matchingBuses.forEach((bus: any) => {
      if (!bus.pos) return;

      const proj = projectOnPolyline(bus.pos, pathData.coordinates);
      const nextSegIdx = proj.segIdx;
      const t = proj.t;

      const busDist = cumulativeDistances[nextSegIdx] + t * ((cumulativeDistances[nextSegIdx + 1] || pathData.totalDistance) - cumulativeDistances[nextSegIdx]);
      const directDist = geoDistance(stopProjPoint, bus.pos);

      if (busDist <= stopDistance + 60 || directDist < 45) {
        const remainingDist = Math.max(0, stopDistance - busDist);

        let speedKmh = Number(bus.speed || 0);
        if (speedKmh <= 0 || isNaN(speedKmh)) speedKmh = 25;
        const speedMps = speedKmh / 3.6;

        const etaSeconds = remainingDist / speedMps;
        const etaMins = Math.max(0, Math.floor(etaSeconds / 60));

        list.push({
          bus,
          route,
          remainingDist,
          etaSeconds,
          etaMins
        });
      }
    });

    return list.sort((a, b) => a.remainingDist - b.remainingDist);
  }, [subscribedStop, transitRoutes, combinedBuses, routePathData]);
  // -------------------------------------------------------------------

  const allBuses = combinedBuses;
  const uiFilteredBuses = allBuses.filter((b: Bus) => {
    return true;
  });
  const visibleBuses = hasFilter ? uiFilteredBuses.filter(b => {
    if (!selectedRouteIds.has(b.routeId) || !visibleRouteIds.has(b.routeId)) return false;
    if (b.dir === 'ida') return routeBusesIda[b.routeId] ?? true;
    if (b.dir === 'vuelta') return routeBusesVuelta[b.routeId] ?? true;
    return true;
  }) : [];

  return (
    <div className="relative w-full h-full" style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Botón flotante Premium de actualización con Glassmorphism */}
      <div 
        style={{
          position: 'absolute',
          top: isPWA ? 'calc(20dvh + 12px)' : '16px',
          right: '16px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '6px',
          fontFamily: 'Inter, sans-serif'
        }}
      >


        {/* Etiqueta premium de última actualización */}
        {lastUpdatedBuses && (
          <div 
            style={{
              fontSize: '0.7rem',
              color: '#475569',
              background: 'rgba(255, 255, 255, 0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
              fontWeight: 500
            }}
          >
            {wsStatus === 'connected' 
              ? 'Conectado en vivo' 
              : `Última actualización: ${lastUpdatedBuses.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
          </div>
        )}
      </div>

      {/* Estilo CSS inyectado para la animación de spin y pulso de LED */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-led {
          0% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.4; transform: scale(0.9); }
        }
        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
          70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        @media (max-width: 768px) {
          .pinned-stop-card {
            width: 100% !important;
            max-width: 100% !important;
            right: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            border-radius: 16px 16px 0 0 !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
            padding: 8px 16px 10px 16px !important;
            gap: 4px !important;
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15) !important;
            z-index: 10000 !important;
          }
          .pinned-stop-card .arrival-row {
            padding: 5px 10px !important;
          }
          .pinned-stop-card .stop-info-header {
            margin-bottom: 0px !important;
          }
          .pinned-stop-card .stop-info-header span,
          .pinned-stop-card .stop-info-header div {
            font-size: 0.8rem !important;
          }
          .pinned-stop-card .arrivals-section {
            gap: 2px !important;
          }
          .arrivals-scroll-container {
            max-height: 75px !important;
            gap: 4px !important;
          }
          .pinned-stop-card .schedules-btn {
            padding: 5px 8px !important;
            margin-top: 2px !important;
            font-size: 0.72rem !important;
          }
        }
        /* Ocultar barra de scroll para el contenedor de arribos */
        .arrivals-scroll-container::-webkit-scrollbar {
          display: none !important;
        }
        .arrivals-scroll-container {
          -ms-overflow-style: none !important;  /* IE and Edge */
          scrollbar-width: none !important;  /* Firefox */
        }
        @keyframes sonar-pulse {
          0% {
            transform: scale(0.5);
            opacity: 0.85;
          }
          70% {
            opacity: 0.5;
          }
          100% {
            transform: scale(1.95);
            opacity: 0.1;
          }
        }
        .bus-sonar-pulse {
          position: absolute;
          top: 15px;
          left: 9px;
          width: 36px;
          height: 36px;
          margin-top: -18px;
          margin-left: -18px;
          border: 2.5px solid #059669;
          border-radius: 50%;
          pointer-events: none;
          z-index: 1000;
          animation: sonar-pulse 1.5s infinite linear;
        }
        .topdown-bus-icon-container {
          pointer-events: auto !important;
          cursor: pointer;
        }
        .stop-time-tooltip {
            background: rgba(15, 23, 42, 0.8) !important;
            backdrop-filter: blur(2px);
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            color: #ffffff !important;
            font-family: 'Inter', -apple-system, sans-serif !important;
            font-size: 12px !important;
            font-weight: 750 !important;
            border-radius: 4px !important;
            padding: 2px 5px !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
        }
        .stop-time-tooltip::before {
            display: none !important;
        }
        .bus-cardinal-tooltip {
            background: rgba(15, 23, 42, 0.95) !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            color: #ffffff !important;
            font-family: 'Inter', -apple-system, sans-serif !important;
            font-size: 11px !important;
            font-weight: 750 !important;
            border-radius: 4px !important;
            padding: 2px 4px !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
        }
        .bus-cardinal-tooltip::before {
            border-top-color: rgba(15, 23, 42, 0.95) !important;
        }
      `}</style>

      <MapContainer center={ZARATE_CENTER} zoom={13} style={{ width: '100%', height: '100%', borderRadius: '16px' }} zoomControl={false} preferCanvas={true}>
        <MapCenterer boundsObj={focusedRouteBounds} />
        <MapZoomListener onZoomChange={setCurrentZoom} />

        {mapStyle === 'argenmap' ? (
          <TileLayer 
            attribution='&copy; <a href="http://www.ign.gob.ar">Instituto Geográfico Nacional</a> - <a href="http://www.idera.gob.ar">IDERA</a>' 
            url="https://wms.ign.gob.ar/geoserver/gwc/service/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&LAYER=capabaseargenmap&STYLE=default&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png" 
          />
        ) : mapStyle === 'osm' ? (
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        ) : (
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
        )}
        
        {routes.map((route: any) => route.directions?.filter((dir: any, index: number, self: any[]) => {
          const dirName = dir.direction || dir.name;
          return self.findIndex((d: any) => (d.direction || d.name) === dirName) === index;
        }).map((dir: any) => {
          const isVisible = dir.direction === 'ida' ? (routeShowIda[route.id] ?? true) : (routeShowVuelta[route.id] ?? true);
          const pathData = routePathData[route.id]?.[dir.direction as 'ida' | 'vuelta'];
          return (
            <RoutePathSegment
              key={`${route.id}-${dir.direction}`}
              route={route}
              dir={dir}
              isVisible={isVisible}
              pathData={pathData}
              currentZoom={currentZoom}
              showRouteArrows={showRouteArrows}
              onViewSchedule={onViewSchedule}
            />
          );
        }))}

        {deduplicatedCabeceras.map((cab, idx) => (
          <Marker key={`cab-${idx}-${cab.label}`} position={cab.position} icon={createCabeceraMarkerIcon(cab.type, cab.color, stopIconSize)}>
            <Tooltip permanent direction="top" offset={[0, -10]} className="cabecera-tooltip">
              {cab.label}
            </Tooltip>
          </Marker>
        ))}

        {(() => {
          const sequenceCounters: Record<string, number> = {};
          
          return (showStops !== false || showStopProjections || showWaypoints) && (showWaypoints || currentZoom >= 13) && transitStops
            .filter((stop: any) => {
                if (visibleRouteIds.size === 0) return false; // PERFORMANCE FIX: Do not render all stops by default

                if (stop.routeId) {
                    if (!visibleRouteIds.has(stop.routeId)) return false;
                    const isStopsIdaOn = routeStopsIda[stop.routeId] ?? (routeShowIda[stop.routeId] ?? true);
                    const isStopsVueltaOn = routeStopsVuelta[stop.routeId] ?? (routeShowVuelta[stop.routeId] ?? true);
                    
                    if (stop.direction === 'ida' && !isStopsIdaOn) return false;
                    if (stop.direction === 'vuelta' && !isStopsVueltaOn) return false;
                    return true;
                }

                // Fallback por color para retrocompatibilidad
                const parentRoutes = transitRoutes.filter((r: any) => visibleRouteIds.has(r.id) && (r.color || '').toUpperCase() === (stop.color || '').toUpperCase());
                if (parentRoutes.length === 0) return false;
                
                return parentRoutes.some((route: any) => {
                  const isStopsIdaOn = routeStopsIda[route.id] ?? (routeShowIda[route.id] ?? true);
                  const isStopsVueltaOn = routeStopsVuelta[route.id] ?? (routeShowVuelta[route.id] ?? true);
                  
                  if (stop.direction === 'ida' && !isStopsIdaOn) return false;
                  if (stop.direction === 'vuelta' && !isStopsVueltaOn) return false;
                  return true;
                });
            })
            .map((stop: any) => {
              const route = transitRoutes.find((r: any) => 
                r.id === stop.routeId || 
                r.id === stop.branch_id ||
                (r.code && stop.routeId && (r.code === stop.routeId || stop.routeId.includes(r.code))) ||
                (r.color && stop.color && (r.color || '').toUpperCase() === (stop.color || '').toUpperCase())
              );
              const isControlPoint = Number(stop.is_control_point) === 1 || stop.is_control_point === true;
              
              // Determinar tamaño (al activar el botón de reloj showWaypoints se agranda a 1.4x; para usuarios normales es del mismo tamaño que las demás paradas)
              const size = (showWaypoints && isControlPoint) ? Math.round(stopIconSize * 1.4) : stopIconSize;
              
              // Determinar zIndexOffset
              const zIndex = isControlPoint ? 1000 : 0;
              
              // Determinar sequence number por recorrido (routeId + direction)
              const routeId = stop.routeId || (route ? route.id : 'unknown');
              const direction = stop.direction || 'ida';
              const key = `${routeId}_${direction}`;
              
              if (sequenceCounters[key] === undefined) {
                sequenceCounters[key] = 1;
              } else {
                sequenceCounters[key] += 1;
              }
              const seq = stop.sequence ?? sequenceCounters[key];
              
              // Determinar icono
              let markerIcon;
              if (showStopSequences) {
                markerIcon = createStopSequenceIcon(stop.color, seq, size);
              } else if (showWaypoints && isControlPoint) {
                markerIcon = createWaypointCircleDotIcon('#f59e0b', size);
              } else if (isControlPoint) {
                markerIcon = createStopIcon('#f59e0b', stop.direction, size);
              } else {
                markerIcon = createStopIcon(stop.color, stop.direction, size);
              }

              // Calculate active times for checkpoint Tooltip
              const activeTimes: string[] = [];
              if (isControlPoint && Array.isArray(combinedBuses)) {
                const normStopName = normalizeStopName(stop.name);
                const cleanStopName = normalizeStopName((stop.name || '').replace(/^\d+[\.\s\-]+\s*/, ''));

                combinedBuses.forEach((bus: any) => {
                  const busDir = (bus.dir || '').toLowerCase();
                  if (busDir && direction && busDir !== direction.toLowerCase()) return;

                  const routeMatch = (
                    bus.routeId === routeId ||
                    bus.routeId === stop.routeId ||
                    (bus.code && (bus.code === routeId || bus.code === stop.routeId || (stop.routeId || '').includes(bus.code))) ||
                    (bus.color && stop.color && (bus.color || '').toUpperCase() === (stop.color || '').toUpperCase())
                  );

                  if (!routeMatch) return;

                  let stopTimeObj = bus.stopTimes?.[stop.name] || bus.stopTimes?.[stop.id];

                  if (!stopTimeObj && bus.stopTimes && typeof bus.stopTimes === 'object') {
                    for (const stKey in bus.stopTimes) {
                      const normKey = normalizeStopName(stKey);
                      const cleanKey = normalizeStopName(stKey.replace(/^\d+[\.\s\-]+\s*/, ''));
                      if (normKey === normStopName || normKey === cleanStopName || cleanKey === cleanStopName || cleanKey === normStopName) {
                        stopTimeObj = bus.stopTimes[stKey];
                        break;
                      }
                    }
                  }

                  if (stopTimeObj && stopTimeObj.time) {
                    const lineCode = bus.code || (route ? route.code : 'SIT');
                    const busLabel = `${lineCode} #${stopTimeObj.dispatchOrder || bus.dispatchOrder || 1}`;
                    activeTimes.push(`${busLabel}: ${stopTimeObj.time}`);
                  }
                });
              }

              const uniqueTimes = Array.from(new Set(activeTimes)).sort();
              const hasTimes = uniqueTimes.length > 0;
              const tooltipHtml = uniqueTimes.join(', ');

              const stopKey = `stop-${stop.id || stop.name}-${stop.routeId || 'route'}-${direction}`;
              const markerPosition = draggedPositions[stopKey] || [stop.lat, stop.lng];

              // Calculate stop projection if enabled
              let projectionLine = null;
              let projectionPointMarker = null;

              if (showStopProjections) {
                const pathData = routePathData[routeId]?.[direction as 'ida' | 'vuelta'];
                if (pathData && pathData.coordinates && pathData.coordinates.length > 0) {
                  const proj = projectOnPolyline([stop.lat, stop.lng], pathData.coordinates);
                  if (proj && proj.point) {
                    const projPoint = proj.point;
                    if (showStops !== false) {
                      projectionLine = (
                        <Polyline
                          positions={[markerPosition, projPoint]}
                          pathOptions={{
                            color: '#22c55e',
                            weight: 1.5,
                            opacity: 0.8,
                            dashArray: '3, 4'
                          }}
                          interactive={false}
                        />
                      );
                    }
                    projectionPointMarker = (
                      <CircleMarker
                        center={projPoint}
                        radius={4}
                        pathOptions={{
                          fillColor: '#22c55e',
                          fillOpacity: 1.0,
                          color: '#ffffff',
                          weight: 1.2
                        }}
                        interactive={false}
                      />
                    );
                  }
                }
              }

              return (
                <React.Fragment key={stopKey}>
                  {projectionLine}
                  {projectionPointMarker}
                  {showStops !== false && (
                    <Marker 
                      position={markerPosition} 
                      icon={markerIcon}
                      zIndexOffset={zIndex}
                      draggable={showStopSequences}
                      eventHandlers={showStopSequences ? {
                        dragend: (e) => {
                          const marker = e.target;
                          const position = marker.getLatLng();
                          setDraggedPositions(prev => ({
                            ...prev,
                            [stopKey]: [position.lat, position.lng]
                          }));
                        }
                      } : undefined}
                    >
                      {(isControlPoint && showWaypoints) && (
                        <Tooltip 
                          permanent 
                          direction="top" 
                          offset={[0, -18]}
                          className="stop-time-tooltip"
                        >
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff', whiteSpace: 'nowrap' }}>
                            {hasTimes ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {uniqueTimes.map((timeStr, idx) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                                      {timeStr}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              (stop.name || '').replace(/^\d+[\.\s\-]+\s*/, '')
                            )}
                          </div>
                        </Tooltip>
                      )}
                      <Popup>
                        <StopInfoPopup 
                          stop={stop.direction ? stop : { ...stop, direction }} 
                          transitRoutesRef={transitRoutes} 
                          liveBuses={visibleBuses} 
                          routePathData={routePathData} 
                          onViewSchedule={onViewSchedule} 
                          waitingCount={activeStops[stop.id]}
                          subscribedStop={subscribedStop}
                          setSubscribedStop={setSubscribedStop}
                          busTrackerRef={busTrackerRef}
                          onReportArrived={handleReportArrived}
                          reportCooldown={reportCooldown}
                          lastReportedStopId={lastReportedStopId}
                        />
                      </Popup>
                    </Marker>
                  )}
                </React.Fragment>
              );
            });
        })()}

        {visibleBuses.map((bus, i) => {
          const route = transitRoutes.find((r: any) => r.id === bus.routeId);
          const direction = route?.directions?.find((d: any) => d.direction === bus.dir);
          const shapeCoords = direction?.coordinates || null;
          
          let totalTrips;
          let startTime = bus.startTime;
          let endTime = bus.endTime;

          if (route && route.schedules) {
            const todayType = getTodayDayLabel(route);
            const dirSuffix = `_${bus.dir}`;
            let scheduleForBus = route.schedules[`${todayType}${dirSuffix}`];

            if (!scheduleForBus) {
              const lowerDay = (todayType || '').toLowerCase();
              let specialPrefixes: string[] = [];
              if (lowerDay.includes('weekday') || lowerDay.includes('lunes_a_viernes') || lowerDay.includes('invierno')) {
                specialPrefixes = ['special_lunes_a_viernes_invierno', 'special_weekday_invierno', 'special_lunes_a_viernes', 'special_weekday'];
              } else if (lowerDay.includes('saturday') || lowerDay.includes('sabado')) {
                specialPrefixes = ['special_sabado_invierno', 'special_sabado', 'special_saturday'];
              } else if (lowerDay.includes('sunday') || lowerDay.includes('domingo') || lowerDay.includes('sunday_holiday')) {
                specialPrefixes = ['special_domingo_invierno', 'special_domingo', 'special_sunday'];
              } else if (lowerDay.includes('holiday') || lowerDay.includes('feriado')) {
                specialPrefixes = ['special_feriado_invierno', 'special_feriado', 'special_holiday'];
              }

              for (const prefix of specialPrefixes) {
                for (const key of Object.keys(route.schedules)) {
                  if (key.startsWith(prefix) && key.endsWith(dirSuffix)) {
                    scheduleForBus = route.schedules[key];
                    break;
                  }
                }
                if (scheduleForBus) break;
              }
            }

            if (!scheduleForBus && todayType === 'sunday_holiday') {
              scheduleForBus = route.schedules[`sunday_${bus.dir}`] || route.schedules[`holiday_${bus.dir}`];
            }
            
            if (!scheduleForBus) {
              scheduleForBus = route.schedules[`weekday_${bus.dir}`];
            }
            
            if (scheduleForBus && scheduleForBus.matrix && scheduleForBus.matrix.length > 0) {
              totalTrips = scheduleForBus.matrix.length;
              const matrix = scheduleForBus.matrix;
              let matchedRow: string[] | null = null;
              
              if (bus.dispatchOrder && bus.dispatchOrder >= 1 && bus.dispatchOrder <= matrix.length) {
                matchedRow = matrix[bus.dispatchOrder - 1];
              } else if (bus.startTime) {
                matchedRow = matrix.find((row: string[]) => {
                  const valid = row.filter((t: string) => t && t.trim() !== '' && t.includes(':'));
                  return valid.length > 0 && valid[0] === bus.startTime;
                }) || null;
              }
              
              if (!matchedRow) {
                // Match by current time
                const now = new Date();
                const currentMins = now.getHours() * 60 + now.getMinutes();
                
                const parseToMinutes = (timeStr: string) => {
                  if (!timeStr) return -1;
                  const [h, m] = timeStr.split(':').map(Number);
                  if (isNaN(h) || isNaN(m)) return -1;
                  return h * 60 + m;
                };

                let bestRow: string[] | null = null;
                let minDiff = Infinity;
                
                for (const row of matrix) {
                  const validTimes = row.filter((t: string) => t && t.trim() !== '' && t.includes(':'));
                  if (validTimes.length >= 2) {
                    const startMins = parseToMinutes(validTimes[0]);
                    const endMins = parseToMinutes(validTimes[validTimes.length - 1]);
                    
                    if (startMins !== -1 && endMins !== -1) {
                      const isWithinRange = endMins < startMins
                        ? (currentMins >= startMins || currentMins <= endMins)
                        : (currentMins >= startMins && currentMins <= endMins);
                      
                      if (isWithinRange) {
                        matchedRow = row;
                        break;
                      }
                      
                      const diff = Math.abs(startMins - currentMins);
                      if (diff < minDiff) {
                        minDiff = diff;
                        bestRow = row;
                      }
                    }
                  }
                }
                
                if (!matchedRow) {
                  matchedRow = bestRow;
                }
              }

              if (matchedRow && (!startTime || !endTime)) {
                const validTimes = matchedRow.filter((t: string) => t && t.trim() !== '' && t.includes(':'));
                if (validTimes.length >= 2) {
                  if (!startTime) startTime = validTimes[0];
                  if (!endTime) endTime = validTimes[validTimes.length - 1];
                }
              }
            }
          }

          const busWithEnrichedColor = {
            ...bus,
            color: route ? route.color : bus.color,
            code: route ? (route.code || (route as any).shortName || bus.code) : bus.code,
            startTime: startTime || bus.startTime,
            endTime: endTime || bus.endTime
          };

          let routeDirectionInfo = '';
          if (route) {
            const cleanName = route.name.replace(route.code, '').trim();
            const parts = cleanName.split(/ - | – |-|–/);
            if (parts.length >= 2) {
              const origin = parts[0].trim();
              const destination = parts[1].trim();
              routeDirectionInfo = bus.dir === 'ida' ? `${origin} ➔ ${destination}` : `${destination} ➔ ${origin}`;
            } else {
              routeDirectionInfo = route.name;
            }
          }

          return (
            <React.Fragment key={bus.id || `${bus.routeId}-${bus.dir}-${bus.startTime || 'time'}`}>
              <LeafletVehicleMarker 
                key={bus.id || `${bus.routeId}-${bus.dir}-${bus.startTime || 'time'}`} 
                bus={busWithEnrichedColor} 
                shapeCoords={shapeCoords} 
                showVehicleLabels={showVehicleLabels}
                lineName={route ? getLineName(route) : ''}
                onViewSchedule={onViewSchedule}
                totalTrips={totalTrips}
                routeDirectionInfo={routeDirectionInfo}
                showWaypoints={showWaypoints}
              />
              {bus.isDeviated && bus.pos && bus.deviationProjPoint && (
                <Polyline
                  positions={[bus.pos, bus.deviationProjPoint]}
                  pathOptions={{
                    color: '#ef4444',
                    weight: 2,
                    dashArray: '3, 6',
                    opacity: 0.8
                  }}
                  interactive={false}
                />
              )}
            </React.Fragment>
          );
        })}

        {liveUsers.map((u, i) => (
          <Marker 
            key={'live-user-' + i} 
            position={[u.lat, u.lng]} 
            icon={L.divIcon({ 
                className: 'custom-user-dot', 
                html: `<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="8" fill="#10b981" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#fff"/></svg>`, 
                iconSize: [24, 24], 
                iconAnchor: [12, 12] 
            })}
          >
            <Popup>
              <div style={{ fontFamily: 'Inter, sans-serif' }}>
                <strong>Usuario SIT</strong><br/>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>Velocidad: {Number(u.speed || 0).toFixed(1)} km/h</span>
              </div>
            </Popup>
          </Marker>
        ))}

        {userPos && showUserLocation && (
          <Marker
            position={userPos}
            icon={L.divIcon({
              className: 'user-location-dot',
              html: `
                <div style="position: relative; width: 24px; height: 24px;">
                  <div style="position: absolute; width: 24px; height: 24px; background: rgba(59, 130, 246, 0.4); border-radius: 50%; animation: pulse 2s infinite;"></div>
                  <div style="position: absolute; top: 6px; left: 6px; width: 12px; height: 12px; background: #3b82f6; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>
                </div>
              `,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })}
          >
            <Popup>
               <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Tu ubicación</div>
            </Popup>
          </Marker>
        )}
        {searchMarker && (
          <Marker 
            position={[searchMarker.lat, searchMarker.lon]}
            icon={L.divIcon({
              className: 'custom-search-marker',
              html: `
                <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
                  <div style="position: absolute; width: 30px; height: 30px; background: rgba(239, 68, 68, 0.2); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
              `,
              iconSize: [30, 30],
              iconAnchor: [15, 30]
            })}
          >
            <Popup closeOnClick={false}>
              <div style={{ fontFamily: 'Inter, sans-serif', padding: '2px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 500, color: '#1e293b' }}>{searchMarker.name}</p>
                <button 
                  onClick={() => onClearSearchLocation?.()}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    width: '100%',
                    fontWeight: 500,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#dc2626';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#ef4444';
                  }}
                >
                  Quitar marcador
                </button>
              </div>
            </Popup>
          </Marker>
        )}
        <SearchFlyController searchLocation={searchLocation} setSearchMarker={setSearchMarker} />
        <UserLocationController showUserLocation={showUserLocation} userPos={userPos} />
      </MapContainer>

      {/* Widget Premium de Telemetría Colaborativa (Crowdsourcing) - Solo usuarios autenticados con login */}
      {isAdmin && (
        <div 
          style={window.innerWidth > 768 ? {
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            width: '320px',
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: '12px 16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
            color: '#f8fafc',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            transition: 'all 0.3s ease'
          } : {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0 0 24px 24px',
            padding: '12px 16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
            color: '#f8fafc',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            transition: 'all 0.3s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Indicador de pulso animado */}
            <span 
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: crowdsourceActive ? '#10b981' : (crowdsourceState !== 'IDLE' ? '#f59e0b' : '#64748b'),
                boxShadow: crowdsourceActive ? '0 0 10px #10b981' : 'none',
                animation: crowdsourceActive ? 'pulse 1.5s infinite' : 'none',
                display: 'inline-block'
              }}
            />
            <style>{`
              @keyframes pulse {
                0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
                100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
              }
            `}</style>
            <span style={{ fontWeight: 600 }}>
              {crowdsourceActive ? 'Transmisión En Vivo (GPS Colaborativo)' : 'GPS Colaborativo (Desactivado)'}
            </span>
          </div>

          <div style={{ color: '#cbd5e1', fontSize: '0.75rem', lineHeight: '1.2' }}>
            {crowdsourceActive ? (
              <div>
                📡 Transmitiendo ubicación en vivo por WebSocket para la línea <strong style={{ color: '#38bdf8' }}>{friendlyRouteName}</strong>.
              </div>
            ) : (
              <div>
                💤 En espera. Haz clic en la pastilla 'GPS Colaborativo' en la pantalla principal para iniciar la transmisión.
              </div>
            )}
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            borderTop: '1px solid rgba(255, 255, 255, 0.08)', 
            paddingTop: '6px',
            fontSize: '0.7rem',
            color: '#94a3b8'
          }}>
            <span>Datos: {dataConsumed.toFixed(3)} / {crowdsourceConfig.maxDataUsageMb.toFixed(1)} MB</span>
            <span style={{ 
              background: crowdsourceState !== 'IDLE' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              color: crowdsourceState !== 'IDLE' ? '#38bdf8' : '#94a3b8',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: 500
            }}>
              {crowdsourceState}
            </span>
          </div>
        </div>
      )}

      {/* Tarjeta Flotante Premium de Parada Anclada (Estilo Android PWA) */}
      {subscribedStop && (
        <div 
          className="pinned-stop-card"
          style={{
            position: 'absolute',
            bottom: '24px',
            left: sidebarOpen ? '396px' : '16px',
            right: 'auto',
            zIndex: 10000,
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '16px',
            padding: '14px 16px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
            color: '#1e293b',
            fontFamily: 'Inter, sans-serif',
            width: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            transition: 'left 0.3s ease, bottom 0.3s ease, opacity 0.3s ease'
          }}
        >
          {/* Fila superior: Línea, Círculo y Botón Cerrar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div 
                style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  background: transitRoutes.find((r: any) => r.id === subscribedStop.routeId)?.color || '#3b82f6'
                }} 
              />
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                {subscribedStop.routeCode.startsWith('RZ') || subscribedStop.routeCode.startsWith('SIT') ? 'SIT ' : 'LÍNEA '}
                {subscribedStop.routeCode}
              </span>
            </div>
            <button 
              onClick={() => setSubscribedStop(null)}
              title="Desanclar Parada"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                e.currentTarget.style.color = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#64748b';
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Nombre de la Parada */}
          <div className="stop-info-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <MapPin size={14} style={{ color: '#3b82f6', marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                {subscribedStop.stopName}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                {(() => {
                  const r = transitRoutes.find((r: any) => r.id === subscribedStop.routeId);
                  if (!r) return '';
                  const cleanName = r.name.replace(r.code, '').trim();
                  const parts = cleanName.split(/ - | – |-|–/);
                  if (parts.length >= 2) {
                    const origin = parts[0].trim();
                    const destination = parts[1].trim();
                    return subscribedStop.direction === 'ida' ? `Hacia ${destination}` : `Hacia ${origin}`;
                  }
                  return r.name;
                })()}
              </div>
            </div>
          </div>

          {/* Separador */}
          <div style={{ height: '1px', background: 'rgba(0, 0, 0, 0.06)' }} />

          {/* Sección de arribos */}
          <div className="arrivals-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px' }}>
              Próximos Arribos
            </div>
            
            {pinnedArrivals.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: '#64748b', background: 'rgba(0,0,0,0.02)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                No se detectan colectivos próximos en esta dirección.
              </div>
            ) : (
              <div 
                className="arrivals-scroll-container"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '115px',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {pinnedArrivals.slice(0, 5).map((arr: any, idx: number) => {
                  const isArriving = arr.etaMins <= 1 || arr.remainingDist < 150;
                  
                  return (
                    <div 
                      className="arrival-row"
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        background: 'rgba(59, 130, 246, 0.04)', 
                        padding: '8px 10px', 
                        borderRadius: '8px',
                        border: '1px solid rgba(59, 130, 246, 0.06)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>
                          {arr.route.code} {arr.bus.dispatchOrder ? `#${arr.bus.dispatchOrder}` : ''}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          a {arr.remainingDist > 1000 
                            ? `${(arr.remainingDist / 1000).toFixed(1)} km` 
                            : `${Math.round(arr.remainingDist)} m`}
                        </span>
                      </div>
                      {isArriving ? (
                        <span 
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: '#d97706',
                            background: '#fef3c7',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #fde68a',
                            animation: 'pulse-led 2s infinite'
                          }}
                        >
                          Llegando
                        </span>
                      ) : (
                        <span 
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: '#0284c7',
                            background: '#e0f2fe',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #bae6fd'
                          }}
                        >
                          {arr.etaMins} min
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Botón Horarios */}
          {onViewSchedule && (
            <button
              className="schedules-btn"
              onClick={() => onViewSchedule(subscribedStop.routeId)}
              style={{
                width: '100%',
                padding: '8px',
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginTop: '4px',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.color = '#1e293b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.color = '#475569';
              }}
            >
              <Clock size={12} /> Horarios
            </button>
          )}
        </div>
      )}

      {/* Tarjeta Flotante Premium de Parada Cercana (Botón Esperar/Esperando en Pantalla Principal) */}
      {nearbyStop && (() => {
        const { stop } = nearbyStop;
        let route = null;
        const routes = transitRoutes || [];
        if (stop.routeId) {
          route = routes.find((r: any) => r.id === stop.routeId);
        } else {
          route = routes.find((r: any) => (r.color || '').toUpperCase() === (stop.color || '').toUpperCase());
        }
        const isWaitingThis = subscribedStop && subscribedStop.stopId === stop.id && subscribedStop.routeId === route?.id;
        
        // Si ya se está esperando esta parada, o si el menú lateral/drawer está abierto, ocultamos la tarjeta
        if (isWaitingThis || sidebarOpen) return null;
        
        const routeColor = route?.color || '#3b82f6';
        
        return (
          <div 
            className="nearby-stop-card"
            style={{
              position: 'absolute',
              bottom: '80px',
              left: '16px',
              right: 'auto',
              zIndex: 10000,
              background: 'rgba(255, 255, 255, 0.90)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              borderRadius: '16px',
              padding: '12px 14px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.10)',
              color: '#1e293b',
              fontFamily: 'Inter, sans-serif',
              width: '260px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              animation: 'fadeInScale 0.3s ease-out'
            }}
          >
            <style>{`
              @keyframes fadeInScale {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
            `}</style>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div 
                style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: routeColor,
                  flexShrink: 0
                }} 
              />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                Parada Cercana ({Math.round(nearbyStop.distance)}m)
              </span>
            </div>

            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', lineHeight: '1.2' }}>
              {stop.name}
            </div>

            <button
              onClick={handleToggleNearbyStopWaiting}
              style={{
                width: '100%',
                padding: '10px',
                background: isWaitingThis ? '#10b981' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: isWaitingThis ? '0 2px 8px rgba(16, 185, 129, 0.25)' : '0 2px 8px rgba(59, 130, 246, 0.25)',
                transition: 'all 0.2s ease-in-out'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = isWaitingThis ? '#059669' : '#2563eb';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = isWaitingThis ? '#10b981' : '#3b82f6';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {isWaitingThis ? <BellOff size={13} /> : <Bell size={13} />}
              <span>{isWaitingThis ? 'Esperando' : 'Esperar Colectivo'}</span>
            </button>
          </div>
        );
      })()}
    </div>
  );
}
