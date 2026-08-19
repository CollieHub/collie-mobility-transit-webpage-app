import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Polygon, Marker, Popup, CircleMarker, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Route as RouteIcon,
  MapPin,
  Plus,
  Trash2,
  Undo,
  Save,
  Compass,
  Search,
  ArrowUpDown,
  X,
  Settings,
  Maximize2,
  Edit3,
  Layers,
  Copy,
  Wand2,
  GitCompare,
  Navigation,
  Lock,
  Unlock,
  Hash,
  FileCode,
  LocateFixed,
  Check,
  Footprints
} from 'lucide-react';
import { KmlMyMapsIngestor } from './KmlMyMapsIngestor';
import RedSubeV3Panel, { getBranchColor } from './RedSubeV3Panel';
import type { V3Route } from './RedSubeV3Panel';
import { getStopIconSvgString } from '../icons/StopIcon';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ZARATE_CENTER: [number, number] = [-34.0970, -59.0300];

function createBusVehicleIcon(linea: string, bearing: number = 0, isSelected: boolean = false) {
  const lineText = (linea || 'SUBE').slice(0, 7);
  const safeBearing = typeof bearing === 'number' && !isNaN(bearing) ? bearing : 0;
  const hasBearing = safeBearing !== 0;

  const bgGradient = isSelected
    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)';

  const shadowEffect = isSelected
    ? '0 0 12px rgba(245, 158, 11, 0.8), 0 3px 8px rgba(0, 0, 0, 0.6)'
    : '0 2px 8px rgba(0, 0, 0, 0.4), 0 0 10px rgba(2, 132, 199, 0.5)';

  const arrowColor = isSelected ? '#f59e0b' : '#38bdf8';

  // Flecha orbital que apunta hacia el rumbo (bearing) de avance de la unidad
  const bearingArrowHtml = `
    <div style="
      position: absolute;
      width: 48px;
      height: 48px;
      top: -13px;
      left: -6px;
      transform: rotate(${safeBearing}deg);
      transform-origin: center center;
      pointer-events: none;
      z-index: 2;
    ">
      <!-- Borde exterior de contraste blanco/oscuro -->
      <div style="
        position: absolute;
        top: -2px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 7px solid transparent;
        border-right: 7px solid transparent;
        border-bottom: 11px solid #ffffff;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.7));
      "></div>
      <!-- Punta de flecha direccional brillante -->
      <div style="
        position: absolute;
        top: 0px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-bottom: 8px solid ${arrowColor};
      "></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-vehicle-icon',
    html: `
      <div style="position: relative; width: 36px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;">
        ${hasBearing ? bearingArrowHtml : ''}
        <div style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: ${bgGradient};
          color: #ffffff;
          padding: 2px 6px;
          min-width: 24px;
          border-radius: 11px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: -0.2px;
          border: 1.5px solid #ffffff;
          box-shadow: ${shadowEffect};
          white-space: nowrap;
          cursor: pointer;
          pointer-events: auto;
          text-align: center;
          position: relative;
          z-index: 1;
        ">
          ${lineText}
        </div>
      </div>
    `,
    iconSize: [36, 22],
    iconAnchor: [18, 11]
  });
}

function MapInstanceCapture({ onMapReady }: { onMapReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);
  return null;
}

function MapBoundsListener({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
  const map = useMap();
  useMapEvents({
    moveend() {
      onBoundsChange(map.getBounds());
    },
    zoomend() {
      onBoundsChange(map.getBounds());
    }
  });
  useEffect(() => {
    onBoundsChange(map.getBounds());
  }, [map, onBoundsChange]);
  return null;
}

function createWaypointIcon(orderNum: number, isStart: boolean, isEnd: boolean, isSelected: boolean = false, showNumbers: boolean = true) {
  const size = isSelected ? 30 : 26;
  const bgColor = isStart ? '#10b981' : isEnd ? '#ef4444' : '#0284c7';
  const borderColor = isSelected ? '#38bdf8' : '#ffffff';
  const strokeWidth = isSelected ? 3 : 2;

  if (!showNumbers) {
    return L.divIcon({
      className: 'custom-waypoint-icon',
      html: `<div style="
        width: ${isSelected ? '18px' : '14px'};
        height: ${isSelected ? '18px' : '14px'};
        background-color: ${bgColor};
        border: ${strokeWidth}px solid ${borderColor};
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.6);
        cursor: grab;
      "></div>`,
      iconSize: [isSelected ? 18 : 14, isSelected ? 18 : 14],
      iconAnchor: [isSelected ? 9 : 7, isSelected ? 9 : 7]
    });
  }

  const svgCode = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" style="cursor: grab; filter: drop-shadow(0px 2px 6px rgba(0,0,0,0.6));">
      <circle cx="16" cy="16" r="14" fill="${bgColor}"/>
      <circle cx="16" cy="16" r="14" fill="none" stroke="${borderColor}" stroke-width="${strokeWidth}"/>
      <text x="16" y="21" font-size="13" font-weight="900" font-family="system-ui, -apple-system, sans-serif" fill="#ffffff" text-anchor="middle">${orderNum}</text>
    </svg>`;

  return L.divIcon({
    className: 'custom-waypoint-number-icon',
    html: svgCode,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function createStopIcon(color: string = '#ea580c', isIda: boolean = true, size: number = 18) {
  const svgCode = getStopIconSvgString(color, isIda, size);
  return L.divIcon({
    className: 'custom-stop-icon',
    html: svgCode,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
}

function createStopIconWithNumber(orderNum: number, color: string = '#ea580c', isIda: boolean = true, size: number = 18) {
  const svgCode = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" style="cursor: grab; filter: drop-shadow(0px 1px 3px rgba(0,0,0,0.5));">
      <rect width="32" height="32" rx="8" fill="${color}"/>
      <rect x="1.5" y="1.5" width="29" height="29" rx="6.5" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-dasharray="${!isIda ? '3,2' : 'none'}" />
      <text x="16" y="21" font-size="14" font-weight="900" font-family="system-ui, -apple-system, sans-serif" fill="#ffffff" text-anchor="middle">${orderNum}</text>
    </svg>`;
  return L.divIcon({
    className: 'custom-stop-number-icon',
    html: svgCode,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
}

function createTerminalIcon(name: string, isStart: boolean, color: string = '#f59e0b') {
  const cleanName = (name || (isStart ? 'Inicio' : 'Destino')).replace(/^\d+[\.\s\-]+\s*/, '').trim();
  return L.divIcon({
    className: 'custom-terminal-marker',
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%);
        pointer-events: auto;
        cursor: pointer;
      ">
        <div style="
          background: rgba(15, 23, 42, 0.94);
          color: #ffffff;
          font-size: 11px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
          white-space: nowrap;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <span>${cleanName}</span>
        </div>
        <div style="
          width: 26px;
          height: 26px;
          background: ${color};
          border: 2px solid #ffffff;
          border-radius: 7px;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6v6"></path>
            <path d="M15 6v6"></path>
            <path d="M2 12h19.6"></path>
            <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path>
            <circle cx="7" cy="18" r="2"></circle>
            <path d="M9 18h6"></path>
            <circle cx="17" cy="18" r="2"></circle>
          </svg>
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
}

function createSearchedPinIcon() {
  const size = 32;
  const svgCode = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="${size}" height="${size * 1.3}" style="filter: drop-shadow(0px 4px 10px rgba(0,0,0,0.6));">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26C32 7.163 24.837 0 16 0z" fill="#0284c7" stroke="#ffffff" stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="#ffffff"/>
    </svg>`;
  return L.divIcon({
    className: 'custom-search-pin-icon',
    html: svgCode,
    iconSize: [size, size * 1.3],
    iconAnchor: [size / 2, size * 1.3]
  });
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function projectPointOnPolyline(pt: [number, number], path: [number, number][]): [number, number] {
  if (!path || path.length === 0) return pt;
  if (path.length === 1) return path[0];

  let minSqDist = Infinity;
  let bestPt = path[0];

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dy = b[0] - a[0];
    const dx = b[1] - a[1];
    const lenSq = dy * dy + dx * dx;

    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dy + (pt[1] - a[1]) * dx) / lenSq));
    }
    const proj: [number, number] = [a[0] + t * dy, a[1] + t * dx];
    const distSq = Math.pow(pt[0] - proj[0], 2) + Math.pow(pt[1] - proj[1], 2);
    if (distSq < minSqDist) {
      minSqDist = distSq;
      bestPt = proj;
    }
  }
  return bestPt;
}

// Offset a coordinate point 6 meters to the RIGHT-HAND SIDE of the route travel direction
function offsetPointToRightOfPolyline(
  pt: [number, number],
  polyline: [number, number][],
  offsetMeters: number = 6
): [number, number] {
  if (!polyline || polyline.length < 2) return pt;

  let minSqDist = Infinity;
  let segIdx = 0;
  let projPt: [number, number] = pt;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const dy = b[0] - a[0];
    const dx = b[1] - a[1];
    const lenSq = dy * dy + dx * dx;

    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dy + (pt[1] - a[1]) * dx) / lenSq));
    }
    const proj: [number, number] = [a[0] + t * dy, a[1] + t * dx];
    const distSq = Math.pow(pt[0] - proj[0], 2) + Math.pow(pt[1] - proj[1], 2);
    if (distSq < minSqDist) {
      minSqDist = distSq;
      segIdx = i;
      projPt = proj;
    }
  }

  const a = polyline[segIdx];
  const b = polyline[segIdx + 1];

  const midLat = (a[0] + b[0]) / 2;
  const radLat = (midLat * Math.PI) / 180;
  const cosLat = Math.cos(radLat);

  // Scaled direction vector components in meters-equivalent space
  const dx = (b[1] - a[1]) * cosLat;
  const dy = b[0] - a[0];
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return projPt;

  // Unit vector of forward travel direction (ux, uy)
  const ux = dx / len;
  const uy = dy / len;

  // Clockwise 90-degree right-hand perpendicular unit vector (nx, ny)
  // For forward vector (ux, uy), right vector is (uy, -ux)
  const nx = uy;
  const ny = -ux;

  // Convert offsetMeters to degrees latitude and longitude
  const deltaDeg = offsetMeters / 111320;
  const rightLat = projPt[0] + ny * deltaDeg;
  const rightLng = projPt[1] + (nx * deltaDeg) / cosLat;

  return [rightLat, rightLng];
}

function perpendicularDistanceKm(pt: [number, number], lineStart: [number, number], lineEnd: [number, number]): number {
  const dx = lineEnd[1] - lineStart[1];
  const dy = lineEnd[0] - lineStart[0];
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return calculateDistanceKm(pt[0], pt[1], lineStart[0], lineStart[1]);

  const u = ((pt[1] - lineStart[1]) * dx + (pt[0] - lineStart[0]) * dy) / (mag * mag);
  const clampedU = Math.max(0, Math.min(1, u));
  const projLat = lineStart[0] + clampedU * dy;
  const projLng = lineStart[1] + clampedU * dx;
  return calculateDistanceKm(pt[0], pt[1], projLat, projLng);
}

// Ramer-Douglas-Peucker algorithm to extract significant control waypoints from dense shape nodes
function simplifyPolylineRdp(points: [number, number][], epsilonKm: number = 0.005): [number, number][] {
  if (points.length <= 2) return points;

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistanceKm(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilonKm) {
    const recResults1 = simplifyPolylineRdp(points.slice(0, index + 1), epsilonKm);
    const recResults2 = simplifyPolylineRdp(points.slice(index), epsilonKm);
    return [...recResults1.slice(0, recResults1.length - 1), ...recResults2];
  } else {
    return [points[0], points[end]];
  }
}

interface OsrmRouteResult {
  points: [number, number][];
  distanceKm: number;
}

// Multi-waypoint OSRM routing in a single query to prevent detour loops and calculate exact road distance
async function fetchOsrmFullRoute(controls: [number, number][]): Promise<OsrmRouteResult> {
  if (controls.length < 2) {
    return { points: controls, distanceKm: 0 };
  }

  if (controls.length <= 80) {
    try {
      const coordString = controls.map(c => `${c[1]},${c[0]}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords = route.geometry?.coordinates || [];
          const points: [number, number][] = coords.map((c: [number, number]) => [c[1], c[0]]);
          const distanceKm = Math.round((route.distance / 1000) * 100) / 100;
          return { points: points.length > 0 ? points : controls, distanceKm };
        }
      }
    } catch (err) {
      console.warn('Error en ruteo OSRM multi-punto:', err);
    }
  }

  try {
    let fullPoints: [number, number][] = [];
    let totalMeters = 0;
    const chunkSize = 50;

    for (let i = 0; i < controls.length - 1; i += chunkSize - 1) {
      const chunk = controls.slice(i, i + chunkSize);
      const coordString = chunk.map(c => `${c[1]},${c[0]}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          totalMeters += route.distance || 0;
          const coords = route.geometry?.coordinates || [];
          const pts: [number, number][] = coords.map((c: [number, number]) => [c[1], c[0]]);
          if (fullPoints.length > 0 && pts.length > 0) {
            fullPoints = [...fullPoints, ...pts.slice(1)];
          } else {
            fullPoints = [...fullPoints, ...pts];
          }
        }
      }
    }

    const distanceKm = Math.round((totalMeters / 1000) * 100) / 100;
    return { points: fullPoints.length > 0 ? fullPoints : controls, distanceKm };
  } catch (err) {
    console.warn('Error en ruteo OSRM por lotes:', err);
  }

  let sum = 0;
  for (let i = 0; i < controls.length - 1; i++) {
    sum += calculateDistanceKm(controls[i][0], controls[i][1], controls[i + 1][0], controls[i + 1][1]);
  }
  return { points: controls, distanceKm: Math.round(sum * 100) / 100 };
}

function MapClickHandler({
  isEditingEnabled,
  activeTool,
  rightDockTab,
  isPolylineClickRef,
  onAddWaypoint,
  onAddStop
}: {
  isEditingEnabled: boolean;
  activeTool: 'none' | 'draw_route' | 'add_stop';
  rightDockTab: 'paradas' | 'recorrido';
  isPolylineClickRef: React.RefObject<boolean>;
  onAddWaypoint: (point: [number, number]) => void;
  onAddStop: (point: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      if (!isEditingEnabled) return;
      if (isPolylineClickRef.current) {
        // Ignorar click del mapa si provino de tocar la linea del recorrido
        return;
      }
      if (rightDockTab === 'paradas' || activeTool === 'add_stop') {
        onAddStop([e.latlng.lat, e.latlng.lng]);
      } else {
        onAddWaypoint([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

function LeafletStreetSearch({
  onSelectLocation
}: {
  onSelectLocation: (coords: [number, number], displayName: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const viewbox = '-59.25,-34.25,-58.80,-33.95';
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=ar&accept-language=es&viewbox=${viewbox}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
          setIsOpen(true);
        }
      } catch (err) {
        console.warn('Error en búsqueda de calles:', err);
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div
      style={{
        position: 'absolute',
        top: '14px',
        left: '14px',
        zIndex: 1000,
        width: '320px',
        maxWidth: 'calc(100% - 28px)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: 'rgba(17, 24, 39, 0.92)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '0.5rem 0.75rem',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)'
        }}
      >
        <Search size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar calle o dirección..."
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            fontSize: '0.82rem',
            fontWeight: 500
          }}
        />
        {isLoading && (
          <div
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid #38bdf8',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }}
          />
        )}
        {query && !isLoading && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            style={{ backgroundColor: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0 }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          style={{
            marginTop: '0.4rem',
            backgroundColor: 'rgba(17, 24, 39, 0.96)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
            maxHeight: '260px',
            overflowY: 'auto'
          }}
        >
          {results.map((item, idx) => (
            <div
              key={`search_item_${idx}`}
              onClick={() => {
                const lat = parseFloat(item.lat);
                const lon = parseFloat(item.lon);
                onSelectLocation([lat, lon], item.display_name);
                setQuery(item.display_name.split(',')[0]);
                setIsOpen(false);
              }}
              style={{
                padding: '0.6rem 0.85rem',
                fontSize: '0.78rem',
                color: '#e2e8f0',
                cursor: 'pointer',
                borderBottom: idx < results.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.18)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <MapPin size={14} color="#38bdf8" style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.display_name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MapFocusController({ focusCoords, bounds }: { focusCoords: [number, number] | null; bounds?: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (focusCoords && Array.isArray(focusCoords) && typeof focusCoords[0] === 'number' && typeof focusCoords[1] === 'number' && !isNaN(focusCoords[0]) && !isNaN(focusCoords[1])) {
      try {
        map.flyTo(focusCoords, 16, { duration: 1 });
      } catch (_) {}
    }
  }, [focusCoords, map]);

  useEffect(() => {
    if (bounds && Array.isArray(bounds) && bounds.length >= 2) {
      try {
        const validBounds = bounds.filter(p => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number' && !isNaN(p[0]) && !isNaN(p[1]));
        if (validBounds.length >= 2) {
          const lBounds = L.latLngBounds(validBounds.map(p => L.latLng(p[0], p[1])));
          if (lBounds.isValid()) {
            map.fitBounds(lBounds, { padding: [60, 60], maxZoom: 15, duration: 1 });
          }
        }
      } catch (_) {}
    }
  }, [bounds, map]);

  return null;
}

function MapZoomListener({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };
    map.on('zoomend', handleZoom);
    handleZoom();
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);
  return null;
}

function getPositionAtDistance(
  pathData: { coordinates: [number, number][]; cumulativeDistances: number[]; totalDistance: number },
  distance: number
): { lat: number; lng: number } {
  const { coordinates, cumulativeDistances, totalDistance } = pathData;
  if (coordinates.length === 0) return { lat: -34.118, lng: -59.02 };
  if (coordinates.length === 1 || distance <= 0) return { lat: coordinates[0][0], lng: coordinates[0][1] };
  if (distance >= totalDistance) return { lat: coordinates[coordinates.length - 1][0], lng: coordinates[coordinates.length - 1][1] };

  let lo = 0, hi = cumulativeDistances.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (cumulativeDistances[mid] <= distance) lo = mid; else hi = mid;
  }
  const segStart = cumulativeDistances[lo], segEnd = cumulativeDistances[hi], segLen = segEnd - segStart;
  const t = segLen > 0 ? (distance - segStart) / segLen : 0;
  const p1 = coordinates[lo];
  const p2 = coordinates[Math.min(hi, coordinates.length - 1)];
  return { lat: p1[0] + (p2[0] - p1[0]) * t, lng: p1[1] + (p2[1] - p1[1]) * t };
}

function RouteDirectionArrows({
  coordinates,
  color,
  direction
}: {
  coordinates: [number, number][];
  color: string;
  direction: 'ida' | 'vuelta';
}) {
  const map = useMap();
  const [zoom, setZoom] = useState<number>(map.getZoom());

  useMapEvents({
    zoomend() {
      setZoom(map.getZoom());
    }
  });

  const arrowPolygons = useMemo(() => {
    if (!coordinates || coordinates.length < 2 || zoom < 9) return [];

    const validCoords = coordinates.filter(p => Array.isArray(p) && typeof p[0] === 'number' && !isNaN(p[0]));
    if (validCoords.length < 2) return [];

    const cumulativeDistances: number[] = [0];
    for (let i = 1; i < validCoords.length; i++) {
      const prev = validCoords[i - 1];
      const curr = validCoords[i];
      const dist = calculateDistanceKm(prev[0], prev[1], curr[0], curr[1]) * 1000;
      cumulativeDistances.push(cumulativeDistances[i - 1] + dist);
    }
    const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
    if (totalDistance <= 0) return [];

    const pathData = { coordinates: validCoords, cumulativeDistances, totalDistance };

    let spacing = 350; // metros entre flechas
    if (zoom >= 16) spacing = 280;
    else if (zoom === 15) spacing = 450;
    else if (zoom === 14) spacing = 800;
    else if (zoom === 13) spacing = 1500;
    else if (zoom === 12) spacing = 2600;
    else if (zoom === 11) spacing = 4500;
    else if (zoom <= 10) spacing = 8000;

    const scaleFactor = Math.pow(2, 16 - Math.min(18, Math.max(9, zoom)));
    const L = 0.00018 * scaleFactor;
    const W = 0.000085 * scaleFactor;

    const polygons: any[] = [];
    for (let d = spacing * 0.4; d < totalDistance - spacing * 0.2; d += spacing) {
      const p = getPositionAtDistance(pathData, d);
      const nextP = getPositionAtDistance(pathData, Math.min(d + 4, totalDistance));

      const dLat = nextP.lat - p.lat;
      const dLng = nextP.lng - p.lng;
      const length = Math.sqrt(dLat * dLat + dLng * dLng);
      if (length > 0) {
        const dirVec = { lat: dLat / length, lng: dLng / length };
        const norm = { lat: -dirVec.lng, lng: dirVec.lat };

        const pTip: [number, number] = [p.lat + dirVec.lat * L, p.lng + dirVec.lng * L];
        const pLeft: [number, number] = [p.lat - dirVec.lat * L * 0.4 + norm.lat * W, p.lng - dirVec.lng * L * 0.4 + norm.lng * W];
        const pRight: [number, number] = [p.lat - dirVec.lat * L * 0.4 - norm.lat * W, p.lng - dirVec.lng * L * 0.4 - norm.lng * W];

        polygons.push(
          <Polygon
            key={`route_arrow_${direction}_${Math.round(d)}`}
            positions={[pTip, pLeft, pRight]}
            pathOptions={{
              color: '#ffffff',
              weight: 1.5,
              fillColor: color,
              fillOpacity: 1.0
            }}
            interactive={false}
          />
        );
      }
    }
    return polygons;
  }, [coordinates, color, direction, zoom]);

  return <>{arrowPolygons}</>;
}

interface StopItem {
  id: string;
  branch_id: string;
  direction: 'ida' | 'vuelta';
  stop_order: number;
  name: string;
  lat: number;
  lng: number;
  proj_lat?: number;
  proj_lng?: number;
}

interface RadarViewProps {
  linesList?: any[];
  branchesList?: any[];
  selectedSource?: string;
  showNotification?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export default function RadarView({ linesList = [], branchesList = [], selectedSource: propSelectedSource, showNotification }: RadarViewProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [direction, setDirection] = useState<'ida' | 'vuelta'>('ida');
  const [isEditingEnabled, setIsEditingEnabled] = useState<boolean>(false);
  const isPolylineClickRef = useRef<boolean>(false);
  const initialBranchSetRef = useRef<boolean>(false);

  const [activeSidebarTab, setActiveSidebarTab] = useState<'lineas' | 'paradas'>('lineas');
  const [selectedLineFilterId, setSelectedLineFilterId] = useState<string>('all');
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({ SIT: true, all: true });

  const [activeTool, setActiveTool] = useState<'none' | 'draw_route' | 'add_stop'>('none');
  const [selectedSource, setSelectedSource] = useState<'core' | 'redsube'>(() => {
    return propSelectedSource === 'redsube' ? 'redsube' : 'core';
  });

  useEffect(() => {
    if (propSelectedSource) {
      setSelectedSource(propSelectedSource === 'redsube' ? 'redsube' : 'core');
    }
  }, [propSelectedSource]);

  const [redSubeBranchesList, setRedSubeBranchesList] = useState<any[]>([]);

  useEffect(() => {
    fetch('/v1/admin/table/arg.redsube.branches?limit=5000')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.rows) {
          setRedSubeBranchesList(data.rows);
        }
      })
      .catch(() => {});
  }, []);

  const [telemetryVehicles, setTelemetryVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [vehicleModalTab, setVehicleModalTab] = useState<'info' | 'json'>('info');
  const [vehicleJsonCopied, setVehicleJsonCopied] = useState<boolean>(false);
  const [showGpsTraces, setShowGpsTraces] = useState<boolean>(true);
  const [showRawGpsPoints, setShowRawGpsPoints] = useState<boolean>(false);
  const [gpsTraces, setGpsTraces] = useState<Record<string, {
    points: Array<{
      lat: number;
      lng: number;
      speed?: number;
      bearing?: number;
      timestamp?: number;
      intern?: string;
      linea?: string;
      route_short_name?: string;
    }>;
    streetPath: [number, number][];
  }>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem('collie_radar_gps_traces_v1');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      const normalized: Record<string, { points: any[]; streetPath: [number, number][] }> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (Array.isArray(v)) {
          normalized[k] = { points: v, streetPath: v.map((p: any) => [p.lat, p.lng]) };
        } else if (v && typeof v === 'object' && Array.isArray((v as any).points)) {
          normalized[k] = {
            points: (v as any).points,
            streetPath: Array.isArray((v as any).streetPath) && (v as any).streetPath.length > 0
              ? (v as any).streetPath
              : (v as any).points.map((p: any) => [p.lat, p.lng])
          };
        }
      }
      return normalized;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('collie_radar_gps_traces_v1', JSON.stringify(gpsTraces));
    } catch (_) {}
  }, [gpsTraces]);

  // Ruteo por calles OSRM automático para trazas existentes que tengan puntos sin ruteo detallado
  useEffect(() => {
    let isCancelled = false;
    const computeStreetRoutes = async () => {
      for (const [k, trace] of Object.entries(gpsTraces)) {
        if (trace && trace.points.length >= 2 && (!trace.streetPath || trace.streetPath.length <= trace.points.length)) {
          const controls: [number, number][] = trace.points.map(p => [p.lat, p.lng]);
          try {
            const osrmRes = await fetchOsrmFullRoute(controls);
            if (!isCancelled && osrmRes && osrmRes.points.length > 0) {
              setGpsTraces(prev => {
                const cur = prev[k];
                if (!cur) return prev;
                return {
                  ...prev,
                  [k]: {
                    ...cur,
                    streetPath: osrmRes.points
                  }
                };
              });
            }
          } catch (_) {}
        }
      }
    };
    computeStreetRoutes();
    return () => { isCancelled = true; };
  }, []);

  const handleClearGpsTraces = useCallback(() => {
    setGpsTraces({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('collie_radar_gps_traces_v1');
    }
    showNotification?.('info', 'Historial de camino recorrido por unidades limpiado');
  }, [showNotification]);

  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [useStreetRouting, setUseStreetRouting] = useState<boolean>(true);
  const [stopIconMode, setStopIconMode] = useState<'icon' | 'number'>('icon');
  const [isRouting, setIsRouting] = useState<boolean>(false);

  const executeIfEditing = useCallback((action: () => void) => {
    if (!isEditingEnabled) {
      showNotification?.('error', 'Haz clic en "🔒 Habilitar Edición: NO" en el panel izquierdo para activar la edición');
      return;
    }
    action();
  }, [isEditingEnabled, showNotification]);

  // Control waypoints: High-level control handles (5-15 points max)
  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  // Full polyline path: Detailed OSRM curve geometry coordinates for clean street polyline rendering
  const [fullPolylinePath, setFullPolylinePath] = useState<[number, number][]>([]);
  const [idaPolylinePath, setIdaPolylinePath] = useState<[number, number][]>([]);
  const [vueltaPolylinePath, setVueltaPolylinePath] = useState<[number, number][]>([]);
  // Exact road distance calculated by OSRM or Haversine
  const [routeDistanceKm, setRouteDistanceKm] = useState<number>(0);

  const [existingShapeId, setExistingShapeId] = useState<string | null>(null);

  const [allBranchStops, setAllBranchStops] = useState<StopItem[]>([]);
  const [idaWaypointsCount, setIdaWaypointsCount] = useState<number>(0);
  const [vueltaWaypointsCount, setVueltaWaypointsCount] = useState<number>(0);

  const [currentZoom, setCurrentZoom] = useState<number>(13);

  const stopIconSize = useMemo(() => {
    if (currentZoom < 13) return 0;
    if (currentZoom === 13) return 12;
    if (currentZoom === 14) return 16;
    if (currentZoom === 15) return 20;
    return 24; // Para zoom >= 16
  }, [currentZoom]);

  const idaStopsCount = useMemo(() => {
    return allBranchStops.filter(s => s.direction === 'ida').length;
  }, [allBranchStops]);

  const vueltaStopsCount = useMemo(() => {
    return allBranchStops.filter(s => s.direction === 'vuelta').length;
  }, [allBranchStops]);

  const stops = useMemo(() => {
    return allBranchStops.filter(s => s.direction === direction).sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0));
  }, [allBranchStops, direction]);

  const setStops = useCallback((updater: StopItem[] | ((prev: StopItem[]) => StopItem[])) => {
    setAllBranchStops(prev => {
      const currentDirectionStops = prev.filter(s => s.direction === direction).sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0));
      const nextDirectionStops = typeof updater === 'function' ? updater(currentDirectionStops) : updater;
      const otherDirectionStops = prev.filter(s => s.direction !== direction);
      return [...otherDirectionStops, ...nextDirectionStops];
    });
  }, [direction]);

  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [editingStopName, setEditingStopName] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [focusCoords, setFocusCoords] = useState<[number, number] | null>(null);
  const [routeBounds, setRouteBounds] = useState<[number, number][] | null>(null);
  const [searchedLocation, setSearchedLocation] = useState<{ coords: [number, number]; name: string } | null>(null);

  const handleSelectSearchedStreet = useCallback((coords: [number, number], name: string) => {
    setFocusCoords(coords);
    setSearchedLocation({ coords, name });
    showNotification?.('success', `📍 Centrado en: ${name.split(',')[0]}`);
  }, [showNotification]);
  const [selectedWaypointIdx, setSelectedWaypointIdx] = useState<number | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [showRightDock, setShowRightDock] = useState<boolean>(true);
  const [rightDockTab, setRightDockTab] = useState<'paradas' | 'recorrido'>('paradas');
  const [showMyMapsIngestorModal, setShowMyMapsIngestorModal] = useState<boolean>(false);

  const kmlInputRef = useRef<HTMLInputElement>(null);

  const handleKmlFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedBranchId) {
      showNotification?.('error', 'Por favor selecciona un ramal primero');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const xmlText = event.target?.result as string;
        if (!xmlText) throw new Error('El archivo KML está vacío');

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        const parserError = xmlDoc.getElementsByTagName('parsererror');
        if (parserError.length > 0) {
          throw new Error('Formato XML/KML inválido');
        }

        const extractedStops: Array<{ name: string; lat: number; lng: number }> = [];

        // 1. Extraer Placemarks con <Point>
        const placemarks = Array.from(xmlDoc.getElementsByTagName('Placemark'));
        placemarks.forEach((pm, idx) => {
          const nameEl = pm.getElementsByTagName('name')[0];
          let name = nameEl ? nameEl.textContent?.trim() || '' : '';
          name = name.replace(/<[^>]*>?/gm, '').trim();
          if (!name) name = `Parada KML ${idx + 1}`;

          const pointEl = pm.getElementsByTagName('Point')[0];
          if (pointEl) {
            const coordEl = pointEl.getElementsByTagName('coordinates')[0];
            if (coordEl && coordEl.textContent) {
              const rawCoords = coordEl.textContent.trim().split(',');
              if (rawCoords.length >= 2) {
                const lng = parseFloat(rawCoords[0]);
                const lat = parseFloat(rawCoords[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                  extractedStops.push({ name, lat, lng });
                }
              }
            }
          }
        });

        // 2. Si no se especificaron etiquetas <Point>, buscar en cualquier nodo <coordinates>
        if (extractedStops.length === 0) {
          const coordTags = Array.from(xmlDoc.getElementsByTagName('coordinates'));
          coordTags.forEach((cTag, cIdx) => {
            const rawText = cTag.textContent || '';
            const tokens = rawText.trim().split(/\s+/);
            tokens.forEach((tok, tIdx) => {
              const parts = tok.split(',');
              if (parts.length >= 2) {
                const lng = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                  extractedStops.push({ name: `Parada KML ${cIdx + 1}.${tIdx + 1}`, lat, lng });
                }
              }
            });
          });
        }

        if (extractedStops.length === 0) {
          showNotification?.('error', 'No se encontraron paradas ni coordenadas válidas en el archivo KML');
          return;
        }

        // Convertir puntos a objetos StopItem
        const newStops: StopItem[] = extractedStops.map((s, idx) => ({
          id: `kml-stop-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          branch_id: selectedBranchId,
          direction: direction,
          stop_order: idx + 1,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          is_control_point: idx === 0 || idx === extractedStops.length - 1 ? 1 : 0
        }));

        setStops(newStops);
        if (extractedStops.length > 0) {
          setFocusCoords([extractedStops[0].lat, extractedStops[0].lng]);
        }
        showNotification?.('success', `¡Éxito! Se cargaron ${extractedStops.length} paradas desde el archivo KML. Recuerda hacer clic en 'Guardar' para publicar.`);

      } catch (err: any) {
        showNotification?.('error', `Error al procesar el archivo KML: ${err.message}`);
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  // Waypoint Undo History Stack
  const [undoStack, setUndoStack] = useState<[number, number][][]>([]);

  const pushUndoState = useCallback(() => {
    setWaypoints(currentWaypoints => {
      setUndoStack(prev => [...prev.slice(-30), [...currentWaypoints]]);
      return currentWaypoints;
    });
  }, []);

  // Assistant Modals State
  const [showReplicateModal, setShowReplicateModal] = useState<boolean>(false);
  const [replicateTargetBranchId, setReplicateTargetBranchId] = useState<string>('');
  const [replicateTargetDirection, setReplicateTargetDirection] = useState<'ida' | 'vuelta'>('ida');

  const [showAutoStopsModal, setShowAutoStopsModal] = useState<boolean>(false);
  const [autoStopsIntervalMeters, setAutoStopsIntervalMeters] = useState<number>(250);
  const [showReverseStopsModal, setShowReverseStopsModal] = useState<boolean>(false);
  const [showProjectStopsModal, setShowProjectStopsModal] = useState<boolean>(false);
  const [showSortStopsModal, setShowSortStopsModal] = useState<boolean>(false);
  const [showClearStopsModal, setShowClearStopsModal] = useState<boolean>(false);
  const [showClearRouteModal, setShowClearRouteModal] = useState<boolean>(false);
  const [showReverseRouteModal, setShowReverseRouteModal] = useState<boolean>(false);

  // Smooth Route Modal State
  const [showSmoothRouteModal, setShowSmoothRouteModal] = useState<boolean>(false);
  const [smoothStartIdx, setSmoothStartIdx] = useState<number>(0);
  const [smoothEndIdx, setSmoothEndIdx] = useState<number>(0);
  const [smoothSimplification, setSmoothSimplification] = useState<'auto' | 'min' | 'all'>('auto');
  const [isSmoothing, setIsSmoothing] = useState<boolean>(false);

  const nestedBranchesForCombo = useMemo(() => {
    if (selectedLineFilterId === 'all') return branchesList;
    return branchesList.filter(b => b.line_id === selectedLineFilterId);
  }, [branchesList, selectedLineFilterId]);

  const groupedBranches = useMemo(() => {
    const groups: Record<string, any[]> = {};
    nestedBranchesForCombo.forEach(b => {
      let key = 'SIT';
      if (b.line_id && b.line_id.includes('campana')) key = 'Campana';
      else if (b.line_id && b.line_id.includes('san_nicolas')) key = 'San Nicolás';
      else if (b.code && b.code.startsWith('228')) key = 'Metropolitana';
      else if (b.company_id) key = b.company_id;

      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    });
    return groups;
  }, [nestedBranchesForCombo]);

  // Seleccionar la línea SIT por defecto ÚNICAMENTE en la carga inicial
  useEffect(() => {
    if (selectedSource === 'redsube') return;
    if (initialBranchSetRef.current) return;
    if (linesList.length === 0 && branchesList.length === 0) return;

    if (linesList.length > 0 && selectedLineFilterId === 'all') {
      const sitLine = linesList.find(l =>
        l.id === 'linea_sit' ||
        l.code === 'SIT' ||
        (l.name && l.name.toLowerCase().includes('sit'))
      );

      if (sitLine) {
        setSelectedLineFilterId(sitLine.id);
        const sitBranch = branchesList.find(b => b.line_id === sitLine.id);
        if (sitBranch) {
          setSelectedBranchId(sitBranch.id);
          initialBranchSetRef.current = true;
        }
      } else if (branchesList.length > 0) {
        setSelectedBranchId(branchesList[0].id);
        initialBranchSetRef.current = true;
      }
    } else if (branchesList.length > 0) {
      setSelectedBranchId(branchesList[0].id);
      initialBranchSetRef.current = true;
    }
  }, [linesList, branchesList, selectedLineFilterId, selectedSource]);

  const updateFullPolylinePathFromControls = useCallback(async (controls: [number, number][]) => {
    if (controls.length < 2) {
      setFullPolylinePath(controls);
      setRouteDistanceKm(0);
      return;
    }

    if (!useStreetRouting) {
      setFullPolylinePath(controls);
      let sum = 0;
      for (let i = 0; i < controls.length - 1; i++) {
        sum += calculateDistanceKm(controls[i][0], controls[i][1], controls[i + 1][0], controls[i + 1][1]);
      }
      setRouteDistanceKm(Math.round(sum * 100) / 100);
      return;
    }

    setIsRouting(true);
    try {
      const res = await fetchOsrmFullRoute(controls);
      setFullPolylinePath(res.points);
      setRouteDistanceKm(res.distanceKm);
    } catch (_) {
      setFullPolylinePath(controls);
    } finally {
      setIsRouting(false);
    }
  }, [useStreetRouting]);

  const loadBranchData = useCallback(async () => {
    if (!selectedBranchId) {
      setWaypoints([]);
      setFullPolylinePath([]);
      setIdaPolylinePath([]);
      setVueltaPolylinePath([]);
      setRouteDistanceKm(0);
      setExistingShapeId(null);
      setAllBranchStops([]);
      setIdaWaypointsCount(0);
      setVueltaWaypointsCount(0);
      return;
    }

    const shapesTable = selectedSource === 'redsube' ? 'arg.redsube.route_shapes' : 'route_shapes';
    const stopsTable = selectedSource === 'redsube' ? 'arg.redsube.stops' : 'stops';

    try {
      const res = await fetch(`/v1/admin/table/${shapesTable}?branch_id=${encodeURIComponent(selectedBranchId)}&limit=5000`);
      if (res.ok) {
        const data = await res.json();
        const rows = data.rows || [];
        const idaMatch = rows.find((r: any) => r.branch_id === selectedBranchId && r.direction === 'ida');
        const vueltaMatch = rows.find((r: any) => r.branch_id === selectedBranchId && r.direction === 'vuelta');

        let parsedIdaCoords: [number, number][] = [];
        let parsedVueltaCoords: [number, number][] = [];

        if (idaMatch && idaMatch.coordinates_json) {
          try {
            const parsed = JSON.parse(idaMatch.coordinates_json);
            parsedIdaCoords = (Array.isArray(parsed) ? parsed : []).map((pt: any) => {
              if (Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number' && !isNaN(pt[0]) && !isNaN(pt[1])) return [pt[0], pt[1]] as [number, number];
              if (typeof pt === 'object' && pt && typeof pt.lat === 'number' && typeof pt.lng === 'number' && !isNaN(pt.lat) && !isNaN(pt.lng)) return [pt.lat, pt.lng] as [number, number];
              return null;
            }).filter(Boolean) as [number, number][];
            setIdaPolylinePath(parsedIdaCoords);
            setIdaWaypointsCount(parsedIdaCoords.length);
          } catch (_) { setIdaPolylinePath([]); setIdaWaypointsCount(0); }
        } else { setIdaPolylinePath([]); setIdaWaypointsCount(0); }

        if (vueltaMatch && vueltaMatch.coordinates_json) {
          try {
            const parsed = JSON.parse(vueltaMatch.coordinates_json);
            parsedVueltaCoords = (Array.isArray(parsed) ? parsed : []).map((pt: any) => {
              if (Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number' && !isNaN(pt[0]) && !isNaN(pt[1])) return [pt[0], pt[1]] as [number, number];
              if (typeof pt === 'object' && pt && typeof pt.lat === 'number' && typeof pt.lng === 'number' && !isNaN(pt.lat) && !isNaN(pt.lng)) return [pt.lat, pt.lng] as [number, number];
              return null;
            }).filter(Boolean) as [number, number][];
            setVueltaPolylinePath(parsedVueltaCoords);
            setVueltaWaypointsCount(parsedVueltaCoords.length);
          } catch (_) { setVueltaPolylinePath([]); setVueltaWaypointsCount(0); }
        } else { setVueltaPolylinePath([]); setVueltaWaypointsCount(0); }

        const match = rows.find((r: any) => r.branch_id === selectedBranchId && r.direction === direction);
        if (match && match.coordinates_json) {
          try {
            const formatted = direction === 'ida' ? parsedIdaCoords : parsedVueltaCoords;
            setFullPolylinePath(formatted);
            // Conservar puntos de control de alta fidelidad
            const controls = formatted.length <= 80 ? formatted : simplifyPolylineRdp(formatted, 0.005);
            setWaypoints(controls);
            setUndoStack([]);
            setExistingShapeId(match.id);

            if (match.total_distance_km && match.total_distance_km > 0) {
              setRouteDistanceKm(match.total_distance_km);
            } else if (formatted.length >= 2) {
              let sum = 0;
              for (let i = 0; i < formatted.length - 1; i++) {
                sum += calculateDistanceKm(formatted[i][0], formatted[i][1], formatted[i + 1][0], formatted[i + 1][1]);
              }
              setRouteDistanceKm(Math.round(sum * 100) / 100);
            }
          } catch (_) {
            setWaypoints([]);
            setFullPolylinePath([]);
            setRouteDistanceKm(0);
            setExistingShapeId(null);
          }
        } else {
          setWaypoints([]);
          setFullPolylinePath([]);
          setRouteDistanceKm(0);
          setExistingShapeId(null);
        }
      }
    } catch (_) {
      setWaypoints([]);
      setFullPolylinePath([]);
      setIdaPolylinePath([]);
      setVueltaPolylinePath([]);
      setRouteDistanceKm(0);
      setExistingShapeId(null);
    }

    try {
      const res = await fetch(`/v1/admin/table/${stopsTable}?branch_id=${encodeURIComponent(selectedBranchId)}&limit=5000`);
      if (res.ok) {
        const data = await res.json();
        const rows = data.rows || [];
        setAllBranchStops(rows);
      }
    } catch (_) {
      setAllBranchStops([]);
    }
  }, [selectedBranchId, direction, selectedSource]);

  const handleFocusCurrentRoute = useCallback(() => {
    const allCoords = [...idaPolylinePath, ...vueltaPolylinePath, ...fullPolylinePath];
    if (allCoords.length >= 2) {
      setRouteBounds([...allCoords]);
    } else if (allBranchStops.length > 0) {
      const stopCoords = allBranchStops.map(s => [s.lat, s.lng] as [number, number]);
      setRouteBounds(stopCoords);
    }
  }, [idaPolylinePath, vueltaPolylinePath, fullPolylinePath, allBranchStops]);

  useEffect(() => {
    loadBranchData();
  }, [loadBranchData]);

  // Tecla rápida Ctrl+Z / Cmd+Z para Deshacer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        if (isEditingEnabled && undoStack.length > 0) {
          e.preventDefault();
          handleUndoWaypoint();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditingEnabled, undoStack]);

  const displayPolylinePath = useMemo(() => {
    return fullPolylinePath.length > 0 ? fullPolylinePath : waypoints;
  }, [fullPolylinePath, waypoints]);

  const totalDistanceKm = useMemo(() => {
    return routeDistanceKm;
  }, [routeDistanceKm]);

  // 1. Clic en el mapa: Suma un punto de control al recorrido
  const handleAddWaypoint = async (pt: [number, number]) => {
    pushUndoState();
    const updatedControls = [...waypoints, pt];
    setWaypoints(updatedControls);
    await updateFullPolylinePathFromControls(updatedControls);
  };

  // 2. Clic directo sobre la línea del recorrido: Inserta un punto de control intermedio (SIN RECALCULAR RECORRIDO COMPLETO)
  const handleInsertPolylineWaypoint = (clickPt: [number, number]) => {
    if (waypoints.length < 2) {
      handleAddWaypoint(clickPt);
      return;
    }

    let minDistance = Infinity;
    let insertIdx = 1;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      const proj = projectPointOnPolyline(clickPt, [a, b]);
      const dist = calculateDistanceKm(clickPt[0], clickPt[1], proj[0], proj[1]);
      if (dist < minDistance) {
        minDistance = dist;
        insertIdx = i + 1;
      }
    }

    pushUndoState();
    const updatedControls = [...waypoints];
    updatedControls.splice(insertIdx, 0, clickPt);
    setWaypoints(updatedControls);
    // No se recalcula la polyline al insertar un punto intermedio sobre el trazado existente
    showNotification?.('success', `Punto intermedio insertado`);
  };

  // 3. Clic y mantener presionado (Drag & Drop): Recalcula ÚNICAMENTE el tramo entre los puntos contiguos
  const handleWaypointDragEnd = async (idx: number, newPt: [number, number]) => {
    pushUndoState();
    const updatedControls = [...waypoints];
    updatedControls[idx] = newPt;
    setWaypoints(updatedControls);

    if (!useStreetRouting || updatedControls.length < 2) {
      await updateFullPolylinePathFromControls(updatedControls);
      showNotification?.('success', `Punto #${idx + 1} movido`);
      return;
    }

    setIsRouting(true);
    try {
      const startIdx = Math.max(0, idx - 1);
      const endIdx = Math.min(updatedControls.length - 1, idx + 1);
      const segmentControls = updatedControls.slice(startIdx, endIdx + 1);

      // Recalcular con OSRM únicamente la porción contigua que cambió
      const segmentRes = await fetchOsrmFullRoute(segmentControls);

      const pStart = updatedControls[startIdx];
      const pEnd = updatedControls[endIdx];

      const findNearestIdx = (target: [number, number], path: [number, number][]) => {
        let minDist = Infinity;
        let bestIdx = 0;
        for (let i = 0; i < path.length; i++) {
          const d = calculateDistanceKm(target[0], target[1], path[i][0], path[i][1]);
          if (d < minDist) {
            minDist = d;
            bestIdx = i;
          }
        }
        return bestIdx;
      };

      if (fullPolylinePath.length > 0) {
        const startPathIdx = findNearestIdx(pStart, fullPolylinePath);
        const endPathIdx = findNearestIdx(pEnd, fullPolylinePath);

        if (startPathIdx <= endPathIdx) {
          const newPath = [
            ...fullPolylinePath.slice(0, startPathIdx),
            ...segmentRes.points,
            ...fullPolylinePath.slice(endPathIdx + 1)
          ];
          setFullPolylinePath(newPath);

          let sum = 0;
          for (let i = 0; i < newPath.length - 1; i++) {
            sum += calculateDistanceKm(newPath[i][0], newPath[i][1], newPath[i + 1][0], newPath[i + 1][1]);
          }
          setRouteDistanceKm(Math.round(sum * 100) / 100);
        } else {
          await updateFullPolylinePathFromControls(updatedControls);
        }
      } else {
        await updateFullPolylinePathFromControls(updatedControls);
      }
    } catch (_) {
      await updateFullPolylinePathFromControls(updatedControls);
    } finally {
      setIsRouting(false);
      showNotification?.('success', `Punto #${idx + 1} movido`);
    }
  };

  // 4. Clic y mantener presionado (Drag & Drop) de una Parada
  const handleStopDragEnd = (stopId: string, newPt: [number, number]) => {
    let projLat = newPt[0];
    let projLng = newPt[1];
    let markerPt: [number, number] = newPt;

    if (displayPolylinePath.length >= 2) {
      const proj = projectPointOnPolyline(newPt, displayPolylinePath);
      projLat = proj[0];
      projLng = proj[1];
      markerPt = offsetPointToRightOfPolyline(newPt, displayPolylinePath, 6);
    }
    setStops(prev => prev.map(st => st.id === stopId ? { ...st, lat: markerPt[0], lng: markerPt[1], proj_lat: projLat, proj_lng: projLng } : st));
    showNotification?.('success', 'Parada posicionada a la derecha del sentido de circulación');
  };

  const handleUndoWaypoint = async () => {
    if (undoStack.length === 0) {
      showNotification?.('error', 'No hay modificaciones anteriores para deshacer');
      return;
    }
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setWaypoints(previousState);
    await updateFullPolylinePathFromControls(previousState);
    showNotification?.('success', 'Deshecha la última modificación del recorrido');
  };

  const handleClearWaypoints = () => {
    pushUndoState();
    setWaypoints([]);
    setFullPolylinePath([]);
    setRouteDistanceKm(0);
  };

  const handleDeleteWaypointIndex = async (idx: number) => {
    pushUndoState();
    const updatedControls = waypoints.filter((_, i) => i !== idx);
    setWaypoints(updatedControls);
    if (selectedWaypointIdx === idx) {
      setSelectedWaypointIdx(null);
    } else if (selectedWaypointIdx !== null && selectedWaypointIdx > idx) {
      setSelectedWaypointIdx(selectedWaypointIdx - 1);
    }
    await updateFullPolylinePathFromControls(updatedControls);
    showNotification?.('success', `Punto #${idx + 1} eliminado del recorrido`);
  };

  const handleReverseRouteShape = async () => {
    if (waypoints.length < 2) {
      showNotification?.('error', 'Se requieren al menos 2 puntos para invertir el trazado');
      return;
    }
    pushUndoState();
    const reversedControls = [...waypoints].reverse();
    setWaypoints(reversedControls);
    await updateFullPolylinePathFromControls(reversedControls);
    showNotification?.('success', 'Trazado invertido (ideal para configurar Vuelta)');
  };

  const handleOpenSmoothModal = () => {
    if (waypoints.length < 2) {
      showNotification?.('error', 'Se requieren al menos 2 puntos de control para suavizar el recorrido');
      return;
    }
    setSmoothStartIdx(0);
    setSmoothEndIdx(waypoints.length - 1);
    setShowSmoothRouteModal(true);
  };

  const handleApplySmoothRoute = async () => {
    if (smoothStartIdx >= smoothEndIdx) {
      showNotification?.('error', 'El punto inicial debe ser menor al punto final');
      return;
    }
    if (smoothEndIdx - smoothStartIdx < 1) {
      showNotification?.('error', 'Selecciona un tramo de al menos 2 puntos');
      return;
    }

    setIsSmoothing(true);
    try {
      const segment = waypoints.slice(smoothStartIdx, smoothEndIdx + 1);
      const osrmRes = await fetchOsrmFullRoute(segment);
      const rawPoints = osrmRes.points;

      if (!rawPoints || rawPoints.length === 0) {
        showNotification?.('error', 'No se pudo obtener el trazado OSRM para el tramo seleccionado');
        setIsSmoothing(false);
        return;
      }

      let smoothedControls: [number, number][] = rawPoints;
      if (smoothSimplification === 'auto') {
        smoothedControls = simplifyPolylineRdp(rawPoints, 0.015);
      } else if (smoothSimplification === 'min') {
        smoothedControls = simplifyPolylineRdp(rawPoints, 0.035);
      } else {
        smoothedControls = rawPoints;
      }

      if (smoothedControls.length > 0) {
        smoothedControls[0] = segment[0];
        smoothedControls[smoothedControls.length - 1] = segment[segment.length - 1];
      }

      pushUndoState();
      const nextWaypoints = [
        ...waypoints.slice(0, smoothStartIdx),
        ...smoothedControls,
        ...waypoints.slice(smoothEndIdx + 1)
      ];

      setWaypoints(nextWaypoints);
      await updateFullPolylinePathFromControls(nextWaypoints);
      showNotification?.('success', 'Tramo suavizado vialmente con éxito usando OSRM');
      setShowSmoothRouteModal(false);
    } catch (err: any) {
      console.error('Error al suavizar recorrido:', err);
      showNotification?.('error', 'Error al intentar suavizar el tramo del recorrido');
    } finally {
      setIsSmoothing(false);
    }
  };

  const handleAddStop = (pt: [number, number]) => {
    if (!selectedBranchId) return;

    let projLat = pt[0];
    let projLng = pt[1];
    let markerPt: [number, number] = pt;

    if (displayPolylinePath.length >= 2) {
      const proj = projectPointOnPolyline(pt, displayPolylinePath);
      projLat = proj[0];
      projLng = proj[1];
      markerPt = offsetPointToRightOfPolyline(pt, displayPolylinePath, 6);
    }

    const newOrder = stops.length + 1;
    const newStop: StopItem = {
      id: `stp_${selectedBranchId}_${direction}_${Date.now()}`,
      branch_id: selectedBranchId,
      direction: direction,
      stop_order: newOrder,
      name: `Parada ${newOrder}`,
      lat: markerPt[0],
      lng: markerPt[1],
      proj_lat: projLat,
      proj_lng: projLng
    };

    setStops(prev => [...prev, newStop]);
    showNotification?.('success', `Parada #${newOrder} añadida a la derecha del sentido de circulación`);
  };

  const handleDeleteStop = (stopId: string) => {
    setStops(prev => {
      const remaining = prev.filter(s => s.id !== stopId);
      return remaining.map((s, idx) => ({ ...s, stop_order: idx + 1 }));
    });
    if (selectedStopId === stopId) {
      setSelectedStopId(null);
    }
    showNotification?.('success', 'Parada eliminada');
  };

  // Keyboard shortcut listener to delete selected stop on Delete / Backspace / Del key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Del') {
        if (selectedStopId && isEditingEnabled) {
          e.preventDefault();
          const targetStop = stops.find(s => s.id === selectedStopId);
          handleDeleteStop(selectedStopId);
          setSelectedStopId(null);
          if (targetStop) {
            showNotification?.('success', `🗑️ Parada "${targetStop.name}" eliminada`);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStopId, isEditingEnabled, stops, showNotification]);

  const handleReverseStops = () => {
    setStops(prev => {
      const reversed = [...prev].reverse();
      return reversed.map((s, idx) => ({ ...s, stop_order: idx + 1 }));
    });
    showNotification?.('success', 'Orden de paradas invertido');
  };

  const handleSortStopsByPathDistance = () => {
    if (displayPolylinePath.length < 2 || stops.length < 2) {
      showNotification?.('error', 'Se requiere un trazado y al menos 2 paradas para reordenar');
      return;
    }

    const findPolylineDistanceKm = (pt: [number, number], path: [number, number][]) => {
      let minDistSq = Infinity;
      let nearestSegIdx = 0;
      let nearestProj: [number, number] = pt;

      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        const dy = b[0] - a[0];
        const dx = b[1] - a[1];
        const lenSq = dy * dy + dx * dx;

        let t = 0;
        if (lenSq > 0) {
          t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dy + (pt[1] - a[1]) * dx) / lenSq));
        }
        const proj: [number, number] = [a[0] + t * dy, a[1] + t * dx];
        const distSq = Math.pow(pt[0] - proj[0], 2) + Math.pow(pt[1] - proj[1], 2);
        if (distSq < minDistSq) {
          minDistSq = distSq;
          nearestSegIdx = i;
          nearestProj = proj;
        }
      }

      let accDist = 0;
      for (let i = 0; i < nearestSegIdx; i++) {
        accDist += calculateDistanceKm(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
      }
      accDist += calculateDistanceKm(path[nearestSegIdx][0], path[nearestSegIdx][1], nearestProj[0], nearestProj[1]);

      return accDist;
    };

    setStops(prev => {
      const withDistance = prev.map(s => ({
        stop: s,
        distKm: findPolylineDistanceKm([s.proj_lat || s.lat, s.proj_lng || s.lng], displayPolylinePath)
      }));

      withDistance.sort((a, b) => a.distKm - b.distKm);

      return withDistance.map((item, idx) => {
        const currentPt: [number, number] = [item.stop.lat, item.stop.lng];
        const projOnLine = projectPointOnPolyline(currentPt, displayPolylinePath);
        const rightOffset = offsetPointToRightOfPolyline(currentPt, displayPolylinePath, 6);

        return {
          ...item.stop,
          lat: rightOffset[0],
          lng: rightOffset[1],
          proj_lat: projOnLine[0],
          proj_lng: projOnLine[1],
          stop_order: idx + 1
        };
      });
    });

    showNotification?.('success', 'Paradas reordenadas y acomodadas a 6m a la derecha del recorrido');
  };

  const handleProjectStopsOnRoute = () => {
    if (displayPolylinePath.length < 2) {
      showNotification?.('error', 'Crea o carga un trazado primero para proyectar las paradas');
      return;
    }
    setStops(prev => {
      return prev.map(s => {
        const proj = projectPointOnPolyline([s.lat, s.lng], displayPolylinePath);
        return { ...s, proj_lat: proj[0], proj_lng: proj[1] };
      });
    });
    showNotification?.('success', `${stops.length} paradas proyectadas sobre el trazado`);
  };

  const handleClearAllStops = () => {
    setStops([]);
    showNotification?.('success', 'Todas las paradas eliminadas');
  };

  const handleExecuteReplicateStops = async () => {
    if (!replicateTargetBranchId) {
      showNotification?.('error', 'Selecciona el ramal destino');
      return;
    }
    if (stops.length === 0) {
      showNotification?.('error', 'No hay paradas en el ramal origen para replicar');
      return;
    }

    const newStopsToReplicate: StopItem[] = stops.map((st, idx) => ({
      id: `stp_${replicateTargetBranchId}_${replicateTargetDirection}_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
      branch_id: replicateTargetBranchId,
      direction: replicateTargetDirection,
      stop_order: idx + 1,
      name: st.name,
      lat: st.lat,
      lng: st.lng,
      proj_lat: st.proj_lat || st.lat,
      proj_lng: st.proj_lng || st.lng
    }));

    try {
      const res = await fetch('/v1/admin/stops/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: replicateTargetBranchId,
          direction: replicateTargetDirection,
          stops: newStopsToReplicate
        })
      });

      const data = await res.json();
      if (data.success) {
        if (replicateTargetBranchId === selectedBranchId) {
          setAllBranchStops(prev => {
            const others = prev.filter(s => s.direction !== replicateTargetDirection);
            return [...others, ...newStopsToReplicate];
          });
        }
        showNotification?.('success', `¡${stops.length} paradas replicadas exitosamente!`);
        setShowReplicateModal(false);
      } else {
        throw new Error(data.error || 'Error al replicar paradas');
      }
    } catch (err: any) {
      showNotification?.('error', `Error al replicar paradas: ${err.message}`);
    }
  };

  // 2. Tool Assistant: Auto-generador masivo de paradas cada X metros sobre el trazado
  const handleExecuteAutoStopsGenerator = () => {
    if (displayPolylinePath.length < 2) {
      showNotification?.('error', 'Se requiere una traza dibujada para autogenerar paradas');
      return;
    }

    const intervalKm = autoStopsIntervalMeters / 1000;
    const newStopsList: StopItem[] = [];

    // Origin Stop
    newStopsList.push({
      id: `stp_${selectedBranchId}_${direction}_${Date.now()}_orig`,
      branch_id: selectedBranchId,
      direction: direction,
      stop_order: 1,
      name: 'Origen / Cabecera',
      lat: displayPolylinePath[0][0],
      lng: displayPolylinePath[0][1],
      proj_lat: displayPolylinePath[0][0],
      proj_lng: displayPolylinePath[0][1]
    });

    let currentAccumulatedKm = 0;
    let nextTargetKm = intervalKm;

    for (let i = 0; i < displayPolylinePath.length - 1; i++) {
      const p1 = displayPolylinePath[i];
      const p2 = displayPolylinePath[i + 1];
      const segDist = calculateDistanceKm(p1[0], p1[1], p2[0], p2[1]);

      while (currentAccumulatedKm + segDist >= nextTargetKm) {
        const remainingForNext = nextTargetKm - currentAccumulatedKm;
        const ratio = segDist > 0 ? remainingForNext / segDist : 0;

        const stopLat = p1[0] + ratio * (p2[0] - p1[0]);
        const stopLng = p1[1] + ratio * (p2[1] - p1[1]);

        const orderNum = newStopsList.length + 1;
        newStopsList.push({
          id: `stp_${selectedBranchId}_${direction}_${Date.now()}_${orderNum}`,
          branch_id: selectedBranchId,
          direction: direction,
          stop_order: orderNum,
          name: `Parada Altura ${Math.round(nextTargetKm * 1000)}m`,
          lat: stopLat,
          lng: stopLng,
          proj_lat: stopLat,
          proj_lng: stopLng
        });

        nextTargetKm += intervalKm;
      }
      currentAccumulatedKm += segDist;
    }

    // Destination Stop
    const lastPt = displayPolylinePath[displayPolylinePath.length - 1];
    newStopsList.push({
      id: `stp_${selectedBranchId}_${direction}_${Date.now()}_dest`,
      branch_id: selectedBranchId,
      direction: direction,
      stop_order: newStopsList.length + 1,
      name: 'Destino / Terminal',
      lat: lastPt[0],
      lng: lastPt[1],
      proj_lat: lastPt[0],
      proj_lng: lastPt[1]
    });

    const finalOffsetStops = newStopsList.map(st => {
      const rightPt = offsetPointToRightOfPolyline([st.lat, st.lng], displayPolylinePath, 6);
      return {
        ...st,
        lat: rightPt[0],
        lng: rightPt[1]
      };
    });

    setStops(finalOffsetStops);
    showNotification?.('success', `¡${finalOffsetStops.length} paradas autogeneradas a la derecha del sentido de circulación!`);
    setShowAutoStopsModal(false);
  };

  const handleSaveAll = async () => {
    if (!selectedBranchId) {
      showNotification?.('error', 'Selecciona un ramal');
      return;
    }

    setIsSaving(true);
    try {
      const shapesTable = selectedSource === 'redsube' ? 'arg.redsube.route_shapes' : 'route_shapes';
      const pathToSave = displayPolylinePath.length > 0 ? displayPolylinePath : waypoints;
      if (pathToSave.length >= 2) {
        const shapeId = existingShapeId || `shp_${selectedBranchId}_${direction}_${Date.now()}`;
        const shapePayload = {
          id: shapeId,
          branch_id: selectedBranchId,
          direction: direction,
          coordinates_json: JSON.stringify(pathToSave),
          total_distance_km: totalDistanceKm
        };

        const shapeUrl = existingShapeId
          ? `/v1/admin/table/${shapesTable}/${encodeURIComponent(existingShapeId)}`
          : `/v1/admin/table/${shapesTable}`;
        const shapeMethod = existingShapeId ? 'PUT' : 'POST';

        await fetch(shapeUrl, {
          method: shapeMethod,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shapePayload)
        });
        setExistingShapeId(shapeId);
      }

      const stopRes = await fetch('/v1/admin/stops/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: selectedBranchId,
          direction: direction,
          stops: stops,
          schema_target: selectedSource
        })
      });

      const stopData = await stopRes.json();
      if (!stopData.success) {
        throw new Error(stopData.error || 'Error al guardar paradas');
      }

      await fetch('/v1/admin/cache/purge');
      showNotification?.('success', `¡Recorrido y ${stops.length} paradas guardados correctamente en D1 (${shapesTable})!`);
    } catch (err: any) {
      showNotification?.('error', `Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBranchObj = useMemo(() => {
    const list = selectedSource === 'redsube' ? (redSubeBranchesList.length > 0 ? redSubeBranchesList : branchesList) : branchesList;
    return list.find(b => b.id === selectedBranchId);
  }, [branchesList, redSubeBranchesList, selectedBranchId, selectedSource]);

  const currentStops = useMemo(() => {
    return allBranchStops
      .filter(st => st.direction === direction && typeof st.lat === 'number' && typeof st.lng === 'number' && !isNaN(st.lat) && !isNaN(st.lng))
      .sort((a, b) => (a.stop_order || 0) - (b.stop_order || 0));
  }, [allBranchStops, direction]);

  const terminalStart = useMemo(() => {
    if (!selectedBranchId) return null;
    const branchName = selectedBranchObj?.name || '';
    const parts = branchName.split(/\s*(?:⇄|--|-)\s*/);
    const fallbackName = direction === 'ida' ? (selectedBranchObj?.headsign_ida || parts[0] || 'Inicio') : (selectedBranchObj?.headsign_vuelta || parts[1] || parts[0] || 'Inicio');

    if (currentStops.length > 0) {
      return {
        pos: [currentStops[0].lat, currentStops[0].lng] as [number, number],
        name: currentStops[0].name || fallbackName
      };
    }
    if (displayPolylinePath.length > 0 && Array.isArray(displayPolylinePath[0]) && typeof displayPolylinePath[0][0] === 'number') {
      return {
        pos: displayPolylinePath[0],
        name: fallbackName
      };
    }
    return null;
  }, [selectedBranchId, selectedBranchObj, currentStops, displayPolylinePath, direction]);

  const terminalEnd = useMemo(() => {
    if (!selectedBranchId) return null;
    const branchName = selectedBranchObj?.name || '';
    const parts = branchName.split(/\s*(?:⇄|--|-)\s*/);
    const fallbackName = direction === 'ida' ? (selectedBranchObj?.headsign_vuelta || parts[1] || parts[0] || 'Destino') : (selectedBranchObj?.headsign_ida || parts[0] || 'Destino');

    if (currentStops.length > 1) {
      const last = currentStops[currentStops.length - 1];
      return {
        pos: [last.lat, last.lng] as [number, number],
        name: last.name || fallbackName
      };
    }
    if (displayPolylinePath.length > 1) {
      const last = displayPolylinePath[displayPolylinePath.length - 1];
      if (Array.isArray(last) && typeof last[0] === 'number') {
        return {
          pos: last,
          name: fallbackName
        };
      }
    }
    return null;
  }, [selectedBranchId, selectedBranchObj, currentStops, displayPolylinePath, direction]);

  return (
    <div style={{ display: 'flex', gap: '1rem', height: 'calc(100vh - 120px)', width: '100%', position: 'relative' }}>
      
      {/* 2. SIDEBAR IZQUIERDO */}
      <div style={{
        width: '340px',
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Encabezado de Edición Unificado */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', backgroundColor: '#161e2e' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RouteIcon size={18} style={{ color: '#38bdf8' }} /> Editor de Recorridos
            </h2>
            <span style={{
              fontSize: '0.65rem',
              backgroundColor: isEditingEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: isEditingEnabled ? '#10b981' : '#f59e0b',
              padding: '0.15rem 0.5rem',
              borderRadius: '6px',
              fontWeight: 700
            }}>
              {isEditingEnabled ? 'EDICIÓN ACTIVA' : 'SOLO LECTURA'}
            </span>
          </div>

          {/* Habilitar Edicion Toggle Button */}
          <button
            onClick={() => setIsEditingEnabled(!isEditingEnabled)}
            className={isEditingEnabled ? "btn-animated btn-animated-success" : "btn-animated btn-animated-dark"}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              marginBottom: '0.5rem',
              borderRadius: '8px',
              border: isEditingEnabled ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
              backgroundColor: isEditingEnabled ? 'rgba(16, 185, 129, 0.15)' : '#1f2937',
              color: isEditingEnabled ? '#10b981' : '#9ca3af',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            {isEditingEnabled ? <Unlock size={14} /> : <Lock size={14} />}
            <span>{isEditingEnabled ? '✏️ Habilitar Edición: SÍ' : '🔒 Habilitar Edición: NO'}</span>
          </button>

          {/* Quick Actions Bar: Importar My Maps, Importar KML, Guardar, Descartar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
              <button
                onClick={() => executeIfEditing(() => setShowMyMapsIngestorModal(true))}
                disabled={!isEditingEnabled}
                title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Importar My Maps (Ingestador de Recorridos)'}
                style={{
                  backgroundColor: isEditingEnabled ? 'rgba(236, 72, 153, 0.14)' : '#1e293b',
                  color: isEditingEnabled ? '#f472b6' : '#64748b',
                  border: isEditingEnabled ? '1px solid rgba(236, 72, 153, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  padding: '0.45rem 0.5rem',
                  cursor: isEditingEnabled ? 'pointer' : 'not-allowed',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  opacity: isEditingEnabled ? 1 : 0.4,
                  transition: 'all 0.2s'
                }}
              >
                <MapPin size={13} color={isEditingEnabled ? '#f472b6' : '#64748b'} /> Importar My Maps
              </button>
              <button
                onClick={() => executeIfEditing(() => kmlInputRef.current?.click())}
                disabled={!isEditingEnabled}
                title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Importar paradas desde archivo KML'}
                style={{
                  backgroundColor: isEditingEnabled ? 'rgba(56, 189, 248, 0.12)' : '#1e293b',
                  color: isEditingEnabled ? '#38bdf8' : '#64748b',
                  border: isEditingEnabled ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  padding: '0.45rem 0.5rem',
                  cursor: isEditingEnabled ? 'pointer' : 'not-allowed',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  opacity: isEditingEnabled ? 1 : 0.4
                }}
              >
                <FileCode size={13} /> Importar KML
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleSaveAll}
                disabled={isSaving || !isEditingEnabled}
                className="btn-animated btn-animated-success"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  backgroundColor: isEditingEnabled ? '#10b981' : '#334155',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: isEditingEnabled ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
              >
                <Save size={14} /> Guardar
              </button>
              <button
                onClick={() => executeIfEditing(loadBranchData)}
                disabled={!isEditingEnabled}
                title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Descartar cambios no guardados'}
                className="btn-animated btn-animated-danger"
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: isEditingEnabled ? 'rgba(239, 68, 68, 0.15)' : '#1e293b',
                  color: isEditingEnabled ? '#ef4444' : '#64748b',
                  border: isEditingEnabled ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  opacity: isEditingEnabled ? 1 : 0.4,
                  cursor: isEditingEnabled ? 'pointer' : 'not-allowed'
                }}
              >
                Descartar
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', backgroundColor: '#111827' }}>
          <button
            onClick={() => setActiveSidebarTab('lineas')}
            style={{
              flex: 1,
              padding: '0.65rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeSidebarTab === 'lineas' ? '#38bdf8' : '#9ca3af',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              borderBottom: activeSidebarTab === 'lineas' ? '2px solid #38bdf8' : 'none'
            }}
          >
            🚌 Líneas
          </button>
          <button
            onClick={() => setActiveSidebarTab('paradas')}
            style={{
              flex: 1,
              padding: '0.65rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeSidebarTab === 'paradas' ? '#38bdf8' : '#9ca3af',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              borderBottom: activeSidebarTab === 'paradas' ? '2px solid #38bdf8' : 'none'
            }}
          >
            🚏 Paradas ({allBranchStops.length})
          </button>
        </div>

        {/* Cuerpo del Sidebar */}
        {activeSidebarTab === 'lineas' ? (
          selectedSource === 'redsube' ? (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <RedSubeV3Panel
                showNotification={showNotification}
                onRouteToggle={(ramal, isChecked, routeData) => {
                  if (!isChecked) {
                    setSelectedBranchId('');
                    return;
                  }
                  const activeBranches = redSubeBranchesList.length > 0 ? redSubeBranchesList : branchesList;
                  const matchedBranch = activeBranches.find(b => 
                    (b.code && b.code.toUpperCase() === ramal.toUpperCase()) || 
                    (b.name && b.name.toUpperCase().includes(ramal.toUpperCase()))
                  );
                  if (matchedBranch) {
                    setSelectedBranchId(matchedBranch.id);
                    if (routeData?.headsignIda) {
                      setDirection('ida');
                    }
                  }
                }}
                onSelectDirection={(ramal, dir) => {
                  setDirection(dir);
                  const activeBranches = redSubeBranchesList.length > 0 ? redSubeBranchesList : branchesList;
                  const matchedBranch = activeBranches.find(b => 
                    (b.code && b.code.toUpperCase() === ramal.toUpperCase()) || 
                    (b.name && b.name.toUpperCase().includes(ramal.toUpperCase()))
                  );
                  if (matchedBranch && selectedBranchId !== matchedBranch.id) {
                    setSelectedBranchId(matchedBranch.id);
                  }
                }}
                onFocusRoute={(ramal, routeData) => {
                  const activeBranches = redSubeBranchesList.length > 0 ? redSubeBranchesList : branchesList;
                  const matchedBranch = activeBranches.find(b => 
                    (b.code && b.code.toUpperCase() === ramal.toUpperCase()) || 
                    (b.name && b.name.toUpperCase().includes(ramal.toUpperCase()))
                  );
                  if (matchedBranch) {
                    setSelectedBranchId(matchedBranch.id);
                  }
                  handleFocusCurrentRoute();
                }}
                onUnitsUpdate={(units) => {
                  const mappedUnits = units.map((u: any) => ({
                    ...u,
                    id: String(u.id || u.vehicle_id || u.intern || Math.random()),
                    intern: String(u.intern || u.id || u.vehicle_id || 'Unidad'),
                    linea: u.linea || u.route_short_name || 'SUBE',
                    route_short_name: u.route_short_name || u.linea || '',
                    route_id: u.route_id || '',
                    trip_headsign: u.trip_headsign || '',
                    agency_name: u.agency_name || '',
                    lat: u.latitude || u.lat || -34.0970,
                    lng: u.longitude || u.lng || -59.0300,
                    bearing: u.bearing || u.heading || 0,
                    speed: u.speed || 0,
                    direction: u.direction,
                    delayMinutes: 0,
                    status: 'running',
                    timestamp: u.timestamp || Date.now()
                  }));

                  setTelemetryVehicles(mappedUnits);

                  // Acumular el camino recorrido por calles (OSRM) por cada unidad activa
                  for (const u of mappedUnits) {
                    if (typeof u.lat !== 'number' || typeof u.lng !== 'number' || isNaN(u.lat) || isNaN(u.lng)) continue;
                    const key = String(u.intern || u.id || u.vehicle_id);

                    setGpsTraces(prev => {
                      const cur = prev[key] || { points: [], streetPath: [] };
                      const currentPts = cur.points || [];
                      const lastPt = currentPts.length > 0 ? currentPts[currentPts.length - 1] : null;

                      let shouldAdd = true;
                      if (lastPt) {
                        const distMeters = calculateDistanceKm(lastPt.lat, lastPt.lng, u.lat, u.lng) * 1000;
                        if (distMeters < 5) {
                          shouldAdd = false;
                        }
                      }

                      if (!shouldAdd) return prev;

                      const newPt = {
                        lat: u.lat,
                        lng: u.lng,
                        speed: u.speed || 0,
                        bearing: u.bearing || 0,
                        timestamp: u.timestamp || Date.now(),
                        intern: u.intern,
                        linea: u.linea || u.route_short_name,
                        route_short_name: u.route_short_name || u.linea
                      };

                      const newPoints = [...currentPts.slice(-100), newPt];

                      // Disparar ruteo OSRM para seguir las calles entre el punto anterior y el nuevo
                      if (lastPt) {
                        fetchOsrmFullRoute([[lastPt.lat, lastPt.lng], [newPt.lat, newPt.lng]])
                          .then(osrmRes => {
                            if (osrmRes && osrmRes.points && osrmRes.points.length > 0) {
                              setGpsTraces(innerPrev => {
                                const innerCur = innerPrev[key];
                                if (!innerCur) return innerPrev;
                                const prevPath = innerCur.streetPath || [];
                                const combined = prevPath.length > 0 ? [...prevPath, ...osrmRes.points.slice(1)] : osrmRes.points;
                                return {
                                  ...innerPrev,
                                  [key]: {
                                    ...innerCur,
                                    streetPath: combined.slice(-500)
                                  }
                                };
                              });
                            }
                          })
                          .catch(() => {});
                      }

                      return {
                        ...prev,
                        [key]: {
                          points: newPoints,
                          streetPath: cur.streetPath && cur.streetPath.length > 0 ? [...cur.streetPath, [newPt.lat, newPt.lng]] : [[newPt.lat, newPt.lng]]
                        }
                      };
                    });
                  }
                }}
                currentDirection={direction}
                mapBounds={mapBounds}
              />
            </div>
          ) : (
            <>
              {/* Nested Combos: Línea y Ramal */}
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {/* Combo 1: Línea */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    LÍNEA / EMPRESA
                  </label>
                  <select
                    value={selectedLineFilterId}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedLineFilterId(val);
                      if (val !== 'all') {
                        const firstBranch = branchesList.find(b => b.line_id === val);
                        if (firstBranch) setSelectedBranchId(firstBranch.id);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      backgroundColor: '#1f2937',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="all">Todas las Líneas ({linesList.length})</option>
                    {linesList.map(line => (
                      <option key={line.id} value={line.id}>
                        Línea {line.code} - {line.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Combo 2: Ramal (Anidado) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    RAMAL
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={e => setSelectedBranchId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      backgroundColor: '#1f2937',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Seleccionar Ramal...</option>
                    {nestedBranchesForCombo.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.code ? `${b.code} - ${b.name}` : b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tree Accordion / List Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(groupedBranches).map(([groupKey, groupItems]) => {
                  const isExpanded = expandedCompanies[groupKey] !== false;
                  return (
                    <div key={groupKey} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <button
                        onClick={() => setExpandedCompanies(prev => ({ ...prev, [groupKey]: !isExpanded }))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.4rem 0.75rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#9ca3af',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}
                      >
                        <span>🏢 {groupKey} ({groupItems.length})</span>
                        <span>{isExpanded ? '▾' : '▸'}</span>
                      </button>

                      {isExpanded && groupItems.map((b, bIdx) => {
                        const isSelected = b.id === selectedBranchId;
                        const branchColor = getBranchColor(b.code || b.name, bIdx);
                        return (
                          <div
                            key={b.id}
                            onClick={() => setSelectedBranchId(prev => prev === b.id ? '' : b.id)}
                            style={{
                              padding: '0.65rem 0.75rem',
                              borderRadius: '10px',
                              backgroundColor: isSelected ? `${branchColor}12` : '#1e293b',
                              border: isSelected ? `1px solid ${branchColor}88` : '1px solid rgba(255, 255, 255, 0.08)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.45rem',
                              boxShadow: isSelected ? `0 2px 12px ${branchColor}22` : 'none'
                            }}
                          >
                            {/* Línea 1: Badge Código, Nombre de Ramal a la izquierda y Checkbox a la derecha */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.55rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                                {b.code && (
                                  <span
                                    style={{
                                      minWidth: '44px',
                                      height: '24px',
                                      padding: '0 6px',
                                      borderRadius: '6px',
                                      backgroundColor: `${branchColor}22`,
                                      color: branchColor,
                                      fontSize: '0.74rem',
                                      fontWeight: 800,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {b.code}
                                  </span>
                                )}
                                <span style={{
                                  fontWeight: 600,
                                  fontSize: '0.84rem',
                                  color: isSelected ? '#ffffff' : '#f8fafc',
                                  lineHeight: '1.25',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {b.name}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBranchId(prev => prev === b.id ? '' : b.id);
                                }}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '4px',
                                  border: `2px solid ${branchColor}`,
                                  background: isSelected ? `${branchColor}35` : 'transparent',
                                  flexShrink: 0,
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s'
                                }}
                              >
                                {isSelected && <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: branchColor }} />}
                              </button>
                            </div>

                            {/* Línea 2: Indicador de Publicación y Mirita */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              {(() => {
                                const statusId = b.branch_publication_statuses_id;
                                const isDraft = statusId === 'bpub_draft';
                                const isUnpublished = statusId === 'bpub_unpublished';
                                const label = isDraft ? 'BORRADOR' : (isUnpublished ? 'NO PUBLICADO' : 'PUBLICADO');
                                const bg = isDraft ? 'rgba(245, 158, 11, 0.15)' : (isUnpublished ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.12)');
                                const color = isDraft ? '#f59e0b' : (isUnpublished ? '#fca5a5' : '#10b981');
                                return (
                                  <span style={{
                                    fontSize: '0.65rem',
                                    backgroundColor: bg,
                                    color: color,
                                    padding: '0.12rem 0.45rem',
                                    borderRadius: '4px',
                                    fontWeight: 700
                                  }}>
                                    {label}
                                  </span>
                                );
                              })()}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedBranchId !== b.id) {
                                    setSelectedBranchId(b.id);
                                  }
                                  handleFocusCurrentRoute();
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  padding: '3px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '4px',
                                  transition: 'color 0.15s, background 0.15s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.color = '#38bdf8'; e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
                                title="Enfocar recorrido (Mira)"
                              >
                                <LocateFixed size={15} />
                              </button>
                            </div>

                            {/* Línea 3: Botones de Sentido cuando está seleccionado */}
                            {isSelected && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.15rem' }}>
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); setDirection('ida'); }}
                                  style={{
                                    padding: '0.4rem 0.5rem',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                    backgroundColor: direction === 'ida' ? '#0284c7' : 'rgba(56, 189, 248, 0.1)',
                                    color: direction === 'ida' ? '#ffffff' : '#38bdf8',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  ➔ {b.direction_ida_label || 'Ida'}
                                </button>
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); setDirection('vuelta'); }}
                                  style={{
                                    padding: '0.4rem 0.5rem',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(168, 85, 247, 0.3)',
                                    backgroundColor: direction === 'vuelta' ? '#9333ea' : 'rgba(168, 85, 247, 0.1)',
                                    color: direction === 'vuelta' ? '#ffffff' : '#c084fc',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  ➔ {b.direction_vuelta_label || 'Vuelta'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : (
          /* Tab de Paradas en el Sidebar */
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ padding: '0.2rem 0.4rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8' }}>
                Paradas de {selectedBranchObj?.name || 'Ramal activo'}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600 }}>
                {stops.length} en {direction.toUpperCase()}
              </span>
            </div>
            {stops.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.78rem' }}>
                No hay paradas cargadas para este ramal en sentido {direction.toUpperCase()}.
              </div>
            ) : (
              stops.map((stop, idx) => (
                <div
                  key={stop.id || `sidebar_stop_${idx}`}
                  onClick={() => {
                    setFocusCoords([stop.lat, stop.lng]);
                    setSelectedStopId(stop.id);
                    setShowRightDock(true);
                  }}
                  style={{
                    padding: '0.5rem 0.65rem',
                    borderRadius: '8px',
                    backgroundColor: selectedStopId === stop.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: selectedStopId === stop.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: '#38bdf8',
                    minWidth: '22px'
                  }}>
                    {idx + 1}.
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#f1f5f9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {stop.name || 'Parada sin nombre'}
                  </span>
                  <MapPin size={13} color="#94a3b8" />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 2. LEAFLET MAP CANVAS & TOOLBAR */}
      <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>
        
        {/* Map Top Action Toolbar */}
        <div style={{
          backgroundColor: '#111827',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          {/* Active Branch Info & Routing Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
              {selectedSource === 'redsube'
                ? (selectedVehicle 
                    ? `Línea ${selectedVehicle.linea || selectedVehicle.route_short_name} #${selectedVehicle.intern || selectedVehicle.id} • ${selectedVehicle.trip_headsign || 'En Circulación'}`
                    : (selectedBranchObj ? (selectedBranchObj.code ? `${selectedBranchObj.code} - ${selectedBranchObj.name}` : selectedBranchObj.name) : 'Monitoreo de Flota RedSUBE'))
                : (selectedBranchObj ? (selectedBranchObj.code ? `${selectedBranchObj.code} - ${selectedBranchObj.name}` : selectedBranchObj.name) : 'Selecciona un Ramal')}
            </span>
            {selectedSource !== 'redsube' && (
              <span style={{
                backgroundColor: direction === 'ida' ? 'rgba(2, 132, 199, 0.2)' : 'rgba(225, 29, 72, 0.2)',
                color: direction === 'ida' ? '#38bdf8' : '#fb7185',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                {(() => {
                  const customLabel = direction === 'ida' ? selectedBranchObj?.direction_ida_label : selectedBranchObj?.direction_vuelta_label;
                  if (customLabel && customLabel.toLowerCase().trim() !== direction && customLabel.toLowerCase().trim() !== (direction === 'ida' ? 'ida' : 'vuelta') && customLabel.trim() !== '') {
                    return `${direction.toUpperCase()} (${customLabel.trim()})`;
                  }
                  return direction.toUpperCase();
                })()}
              </span>
            )}

            {isRouting && (
              <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                🛣️ Ruteando por calles...
              </span>
            )}
          </div>

          {/* Map Editing Tools & Assistants */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Botón Deshacer en Cabecera (a la izquierda de Ruteo Calles) */}
            <button
              onClick={() => executeIfEditing(handleUndoWaypoint)}
              disabled={!isEditingEnabled || undoStack.length === 0}
              title={!isEditingEnabled ? 'Debes habilitar la edición primero' : undoStack.length === 0 ? 'No hay modificaciones anteriores para deshacer' : 'Deshacer última modificación (Ctrl+Z)'}
              className="btn-animated btn-animated-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: (isEditingEnabled && undoStack.length > 0) ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: (isEditingEnabled && undoStack.length > 0) ? 'rgba(56, 189, 248, 0.15)' : '#1f2937',
                color: (isEditingEnabled && undoStack.length > 0) ? '#38bdf8' : '#64748b',
                fontSize: '0.8rem',
                fontWeight: 600,
                opacity: (isEditingEnabled && undoStack.length > 0) ? 1 : 0.4,
                cursor: (isEditingEnabled && undoStack.length > 0) ? 'pointer' : 'not-allowed'
              }}
            >
              <Undo size={14} />
              <span>Deshacer</span>
            </button>

            {/* Street Routing OSRM Toggle */}
            <button
              onClick={() => setUseStreetRouting(!useStreetRouting)}
              title="Alternar entre Ruteo por calles (OSRM) o Línea recta directa"
              className="btn-animated btn-animated-success"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: useStreetRouting ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: useStreetRouting ? 'rgba(16, 185, 129, 0.15)' : '#1f2937',
                color: useStreetRouting ? '#10b981' : '#9ca3af',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Navigation size={14} />
              <span>{useStreetRouting ? '🛣️ Ruteo Calles: SÍ' : '📏 Ruteo Recto: SÍ'}</span>
            </button>

            {/* Toggle Stop Icon Display Mode: Bus Icon vs Sequential Numbers */}
            <button
              onClick={() => setStopIconMode(prev => prev === 'icon' ? 'number' : 'icon')}
              title={stopIconMode === 'number' ? 'Cambiar íconos de paradas a símbolo de colectivo' : 'Cambiar íconos de paradas a números secuenciales (1..N)'}
              className="btn-animated btn-animated-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: stopIconMode === 'number' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: stopIconMode === 'number' ? 'rgba(56, 189, 248, 0.15)' : '#1f2937',
                color: stopIconMode === 'number' ? '#38bdf8' : '#9ca3af',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Hash size={14} />
              <span>{stopIconMode === 'number' ? '🔢 Números: SÍ' : '🚌 Íconos: SÍ'}</span>
            </button>

            {/* Toggle Seguimiento de Camino Recorrido por Unidades (GPS Traces) */}
            <button
              onClick={() => setShowGpsTraces(!showGpsTraces)}
              title="Mostrar u ocultar el trazado continuo del camino que van haciendo las unidades en vivo"
              className="btn-animated"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: showGpsTraces ? '1px solid #00e676' : '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: showGpsTraces ? 'rgba(0, 230, 118, 0.15)' : '#1f2937',
                color: showGpsTraces ? '#00e676' : '#9ca3af',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Footprints size={14} />
              <span>{showGpsTraces ? '🛤️ Camino GPS: SÍ' : '🛤️ Camino GPS: NO'}</span>
            </button>

            {/* Botón para Limpiar Trazas GPS si hay puntos acumulados */}
            {Object.keys(gpsTraces).length > 0 && (
              <button
                onClick={handleClearGpsTraces}
                title="Limpiar caminos y puntos GPS históricos registrados de las unidades"
                className="btn-animated"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: '#f87171',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={13} />
                <span>Limpiar</span>
              </button>
            )}

            <button
              onClick={() => setShowRightDock(!showRightDock)}
              title="Alternar dock flotante"
              className="btn-animated btn-animated-primary"
              style={{
                padding: '0.45rem 0.65rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: showRightDock ? 'rgba(56, 189, 248, 0.15)' : '#1f2937',
                color: showRightDock ? '#38bdf8' : '#9ca3af',
                cursor: 'pointer'
              }}
            >
              <Layers size={14} />
            </button>
          </div>
        </div>

        {/* Leaflet Map Canvas */}
        <div style={{ flex: 1, borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)', position: 'relative' }}>
          <MapContainer
            center={displayPolylinePath.length > 0 ? displayPolylinePath[0] : ZARATE_CENTER}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />

            <MapInstanceCapture onMapReady={setMapInstance} />
            <MapBoundsListener onBoundsChange={setMapBounds} />

            <LeafletStreetSearch onSelectLocation={handleSelectSearchedStreet} />

            {searchedLocation && (
              <Marker
                position={searchedLocation.coords}
                icon={createSearchedPinIcon()}
                zIndexOffset={3500}
              >
                <Popup>
                  <div style={{ color: '#111827', fontSize: '0.8rem', fontWeight: 600 }}>
                    📍 {searchedLocation.name}
                  </div>
                </Popup>
              </Marker>
            )}

            <MapFocusController focusCoords={focusCoords} bounds={routeBounds} />
            <MapZoomListener onZoomChange={setCurrentZoom} />
            <MapClickHandler
              isEditingEnabled={isEditingEnabled}
              activeTool={activeTool}
              rightDockTab={rightDockTab}
              isPolylineClickRef={isPolylineClickRef}
              onAddWaypoint={handleAddWaypoint}
              onAddStop={handleAddStop}
            />

            {/* Traza de Fondo NO Activa (Ida o Vuelta simultánea - Solo en modo Core/Edición) */}
            {selectedSource !== 'redsube' && direction === 'vuelta' && idaPolylinePath.length > 1 && (
              <>
                <Polyline
                  positions={idaPolylinePath}
                  pathOptions={{
                    color: '#000000',
                    weight: 6.0,
                    opacity: 0.85,
                    lineJoin: 'round',
                    lineCap: 'round'
                  }}
                  interactive={false}
                />
                <Polyline
                  positions={idaPolylinePath}
                  pathOptions={{
                    color: '#0284c7',
                    weight: 4.5,
                    opacity: 0.8,
                    lineJoin: 'round',
                    lineCap: 'round'
                  }}
                  interactive={false}
                />
                <RouteDirectionArrows
                  coordinates={idaPolylinePath}
                  color="#0284c7"
                  direction="ida"
                />
              </>
            )}

            {selectedSource !== 'redsube' && direction === 'ida' && vueltaPolylinePath.length > 1 && (
              <>
                <Polyline
                  positions={vueltaPolylinePath}
                  pathOptions={{
                    color: '#e11d48',
                    weight: 4.5,
                    opacity: 0.75,
                    dashArray: '8, 6',
                    lineJoin: 'round',
                    lineCap: 'round'
                  }}
                  interactive={false}
                />
                <RouteDirectionArrows
                  coordinates={vueltaPolylinePath}
                  color="#e11d48"
                  direction="vuelta"
                />
              </>
            )}

            {/* Interactive Polyline: Continuous OSRM street route shape (Dirección Activa - Solo en modo Core/Edición) */}
            {selectedSource !== 'redsube' && displayPolylinePath.length > 1 && (
              <>
                {direction === 'ida' && (
                  <Polyline
                    positions={displayPolylinePath}
                    pathOptions={{
                      color: '#000000',
                      weight: 7.0,
                      opacity: 1.0,
                      lineJoin: 'round',
                      lineCap: 'round'
                    }}
                    interactive={false}
                  />
                )}
                <Polyline
                  positions={displayPolylinePath}
                  eventHandlers={{
                    click(e) {
                      if (!isEditingEnabled) return;
                      if (e.originalEvent) {
                        L.DomEvent.stopPropagation(e.originalEvent);
                      }
                      isPolylineClickRef.current = true;
                      handleInsertPolylineWaypoint([e.latlng.lat, e.latlng.lng]);
                      setTimeout(() => {
                        isPolylineClickRef.current = false;
                      }, 200);
                    }
                  }}
                  pathOptions={{
                    color: direction === 'ida' ? '#0284c7' : '#e11d48',
                    weight: 5.0,
                    opacity: 0.95,
                    dashArray: activeTool === 'draw_route' ? '6, 8' : (direction === 'vuelta' ? '8, 6' : undefined),
                    lineJoin: 'round',
                    lineCap: 'round'
                  }}
                />
                <RouteDirectionArrows
                  coordinates={displayPolylinePath}
                  color={direction === 'ida' ? '#0284c7' : '#e11d48'}
                  direction={direction}
                />
              </>
            )}

            {/* Control Waypoint Markers: Renderizar solo en modo Core/Edición */}
            {selectedSource !== 'redsube' && waypoints.filter(pt => Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number' && !isNaN(pt[0]) && !isNaN(pt[1])).map((pt, idx) => {
              const isStart = idx === 0;
              const isEnd = idx === waypoints.length - 1 && waypoints.length > 1;
              const isSelected = selectedWaypointIdx === idx;
              const showNumbers = rightDockTab === 'recorrido' || stopIconMode === 'number';

              return (
                <Marker
                  key={`wpt_control_marker_${idx}_${pt[0]}_${pt[1]}`}
                  position={pt}
                  draggable={isEditingEnabled}
                  zIndexOffset={rightDockTab === 'recorrido' ? 3000 + (isSelected ? 500 : 0) : 1000}
                  icon={createWaypointIcon(idx + 1, isStart, isEnd, isSelected, showNumbers)}
                  eventHandlers={{
                    click() {
                      setSelectedWaypointIdx(idx);
                    },
                    dragend(e: any) {
                      if (!isEditingEnabled) return;
                      const newLat = e.target.getLatLng().lat;
                      const newLng = e.target.getLatLng().lng;
                      handleWaypointDragEnd(idx, [newLat, newLng]);
                    }
                  }}
                >
                  <Popup>
                    <div style={{ color: '#111827', fontSize: '0.8rem', fontWeight: 600 }}>
                      {isStart ? '🚩 Inicio (Cabecera A)' : isEnd ? '🏁 Fin (Cabecera B)' : `Punto ${idx + 1}`}
                      <br />
                      <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Arrastra para re-rutar las calles</span>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Render Paradas del Editor solo en modo Core/Edición */}
            {selectedSource !== 'redsube' && allBranchStops.filter(st => typeof st.lat === 'number' && typeof st.lng === 'number' && !isNaN(st.lat) && !isNaN(st.lng)).map((st, idx) => {
              const isActiveDir = st.direction === direction;
              const isIda = st.direction === 'ida';
              const displayNum = (st.stop_order ?? (idx + 1));
              const isSelectedStop = selectedStopId === st.id;
              const stopColor = isSelectedStop ? '#ec4899' : (isIda ? '#0284c7' : '#9333ea');

              return (
                <Marker
                  key={`stop_marker_${st.id}`}
                  position={[st.lat, st.lng]}
                  draggable={isEditingEnabled && isActiveDir}
                  opacity={rightDockTab === 'recorrido' ? 0.35 : (isActiveDir ? 1 : 0.75)}
                  zIndexOffset={rightDockTab === 'paradas' ? (isSelectedStop ? 3500 : (isActiveDir ? 2000 : 1200)) : 500}
                  icon={
                    stopIconMode === 'number'
                      ? createStopIconWithNumber(displayNum, stopColor, isIda, stopIconSize)
                      : createStopIcon(stopColor, isIda, stopIconSize)
                  }
                  eventHandlers={{
                    click() {
                      if (st.direction !== direction) {
                        setDirection(st.direction);
                      }
                      setSelectedStopId(st.id);
                      setSelectedWaypointIdx(null);
                    },
                    dragend(e: any) {
                      if (!isEditingEnabled || !isActiveDir) return;
                      const newLat = e.target.getLatLng().lat;
                      const newLng = e.target.getLatLng().lng;
                      handleStopDragEnd(st.id, [newLat, newLng]);
                    }
                  }}
                >
                  <Popup>
                    <div style={{ color: '#111827', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        padding: '2px 5px', 
                        borderRadius: '4px', 
                        backgroundColor: st.direction === 'ida' ? '#0284c7' : '#ea580c', 
                        color: '#fff',
                        marginRight: '6px'
                      }}>
                        {st.direction.toUpperCase()}
                      </span>
                      {displayNum}. {(st.name || '').replace(/^\d+[\.\s\-]+\s*/, '')}
                      {isActiveDir && (
                        <>
                          <br />
                          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Arrastra para re-posicionar parada</span>
                        </>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* 1. Único Recorrido por Calles en Tiempo Real (OSRM) para la Unidad Seleccionada */}
            {showGpsTraces && selectedVehicle && (() => {
              const vKey = String(selectedVehicle.intern || selectedVehicle.id);
              const trace = gpsTraces[vKey];
              if (!trace) return null;
              const pts = trace.points || [];
              const streetPath = trace.streetPath || [];
              if (pts.length < 2 && streetPath.length < 2) return null;

              const coords: [number, number][] = streetPath.length > 0 ? streetPath : pts.map(p => [p.lat, p.lng]);

              return (
                <React.Fragment key={`gps-trace-${vKey}`}>
                  {/* Borde exterior oscuro de contraste */}
                  <Polyline
                    positions={coords}
                    smoothFactor={1.0}
                    pathOptions={{
                      color: '#000000',
                      weight: 8,
                      opacity: 0.9,
                      lineJoin: 'round',
                      lineCap: 'round'
                    }}
                    interactive={false}
                  />
                  {/* Línea Neón Principal por las Calles */}
                  <Polyline
                    positions={coords}
                    smoothFactor={1.0}
                    pathOptions={{
                      color: '#f59e0b',
                      weight: 5,
                      opacity: 1.0,
                      lineJoin: 'round',
                      lineCap: 'round'
                    }}
                  >
                    <Tooltip sticky interactive={false}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                        Recorrido Línea {pts[0]?.linea || selectedVehicle.linea || ''} #{pts[0]?.intern || vKey} ({pts.length} reportes por calles)
                      </div>
                    </Tooltip>
                  </Polyline>
                </React.Fragment>
              );
            })()}

            {/* 2. Puntos GPS Históricos Individuales (Solo de la Unidad Seleccionada) */}
            {selectedVehicle && (() => {
              const vKey = String(selectedVehicle.intern || selectedVehicle.id);
              const trace = gpsTraces[vKey];
              if (!trace) return null;
              const pts = trace.points || [];
              if (pts.length === 0) return null;

              return (
                <React.Fragment key={`gps-raw-pts-${vKey}`}>
                  {pts.map((pt, idx) => {
                    const isLast = idx === pts.length - 1;
                    if (isLast && !showRawGpsPoints) return null;

                    return (
                      <CircleMarker
                        key={`gps-raw-pt-${vKey}-${idx}`}
                        center={[pt.lat, pt.lng]}
                        radius={4}
                        pathOptions={{
                          color: '#000000',
                          fillColor: '#f59e0b',
                          fillOpacity: 0.9,
                          weight: 1.2
                        }}
                      >
                        <Tooltip sticky interactive={false}>
                          <div style={{ fontSize: '0.74rem', lineHeight: '1.45', padding: '2px 4px', color: '#0f172a' }}>
                            <div style={{ fontWeight: 800, color: '#d97706', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '2px', marginBottom: '2px' }}>
                              Reporte #{idx + 1} • #{pt.intern || vKey} (Línea {pt.linea || ''})
                            </div>
                            <div>Velocidad: <strong style={{ color: '#059669' }}>{Math.round(pt.speed || 0)} km/h</strong> {pt.bearing ? `(${Math.round(pt.bearing)}°)` : ''}</div>
                            {pt.timestamp && (
                              <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: '2px' }}>
                                Hora: {new Date(typeof pt.timestamp === 'number' && pt.timestamp < 2000000000 ? pt.timestamp * 1000 : pt.timestamp).toLocaleTimeString()}
                              </div>
                            )}
                          </div>
                        </Tooltip>
                      </CircleMarker>
                    );
                  })}
                </React.Fragment>
              );
            })()}

            {/* Marcadores de Colectivos en Tiempo Real (RedSUBE / Telemetría GTFS V3) */}
            {telemetryVehicles.filter(veh => veh && typeof veh.lat === 'number' && typeof veh.lng === 'number' && !isNaN(veh.lat) && !isNaN(veh.lng)).map((veh, idx) => {
              const isSelected = selectedVehicle && (String(selectedVehicle.intern) === String(veh.intern) || String(selectedVehicle.id) === String(veh.id));
              const vehBearing = typeof veh.bearing === 'number' && !isNaN(veh.bearing) ? veh.bearing : (parseFloat(veh.bearing) || 0);
              const dirLabel = veh.direction === 0 ? 'Ida (Hacia Destino)' : veh.direction === 1 ? 'Vuelta (Hacia Cabecera)' : (direction === 'ida' ? 'Ida' : 'Vuelta');
              const formattedTime = veh.timestamp ? (typeof veh.timestamp === 'number' && veh.timestamp < 2000000000 ? new Date(veh.timestamp * 1000).toLocaleTimeString() : new Date(veh.timestamp).toLocaleTimeString()) : 'En vivo';

              return (
                <Marker
                  key={`telemetry_veh_${veh.id || idx}`}
                  position={[veh.lat, veh.lng]}
                  zIndexOffset={isSelected ? 9000 : 7000}
                  icon={createBusVehicleIcon(veh.linea || veh.route_short_name, vehBearing, isSelected)}
                  eventHandlers={{
                    click(e) {
                      if (e.originalEvent) {
                        L.DomEvent.stopPropagation(e.originalEvent);
                      }
                      setSelectedVehicle(veh);
                    }
                  }}
                >
                  <Popup>
                    <div style={{
                      color: '#0f172a',
                      fontSize: '0.8rem',
                      minWidth: '220px',
                      maxWidth: '280px',
                      padding: '2px'
                    }}>
                      {/* Cabecera Colectivo */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '2px solid #0284c7',
                        paddingBottom: '6px',
                        marginBottom: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '18px' }}>🚍</span>
                          <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0284c7', lineHeight: 1.1 }}>
                              Línea {veh.linea || veh.route_short_name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                              GTFS Route: {veh.route_id || 'N/A'}
                            </div>
                          </div>
                        </div>
                        <span style={{
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          boxShadow: '0 2px 4px rgba(2, 132, 199, 0.3)'
                        }}>
                          #{veh.intern}
                        </span>
                      </div>

                      {/* Empresa / Concesionaria */}
                      {veh.agency_name && (
                        <div style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: '#334155',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <span>🏢</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {veh.agency_name}
                          </span>
                        </div>
                      )}

                      {/* Destino / Headsign GTFS */}
                      {veh.trip_headsign && (
                        <div style={{
                          marginBottom: '6px',
                          fontSize: '0.75rem',
                          color: '#1e293b'
                        }}>
                          <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Destino (Headsign):</span>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            🏁 {veh.trip_headsign}
                          </div>
                        </div>
                      )}

                      {/* Grid de Telemetría */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '6px',
                        backgroundColor: '#f1f5f9',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        marginBottom: '6px'
                      }}>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.65rem' }}>VELOCIDAD</span>
                          <strong style={{ color: '#16a34a', fontSize: '0.85rem' }}>{Math.round(veh.speed)} km/h</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.65rem' }}>SENTIDO</span>
                          <strong style={{ color: '#0284c7' }}>{dirLabel}</strong>
                        </div>
                        {veh.bearing !== undefined && veh.bearing !== null && (
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.65rem' }}>RUMBO</span>
                            <strong>{Math.round(veh.bearing)}°</strong>
                          </div>
                        )}
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.65rem' }}>ÚLTIMO GPS</span>
                          <strong>{formattedTime}</strong>
                        </div>
                      </div>

                      {/* Coordenadas GPS */}
                      <div style={{
                        fontSize: '0.65rem',
                        color: '#94a3b8',
                        textAlign: 'right',
                        fontFamily: 'monospace'
                      }}>
                        GPS: {veh.lat.toFixed(5)}, {veh.lng.toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Terminales de Inicio y Fin (Cabeceras) */}
            {terminalStart && (
              <Marker
                key={`terminal_start_${direction}_${terminalStart.pos[0]}_${terminalStart.pos[1]}`}
                position={terminalStart.pos}
                zIndexOffset={3800}
                icon={createTerminalIcon(terminalStart.name, true, '#f59e0b')}
                interactive={false}
              />
            )}

            {terminalEnd && (
              <Marker
                key={`terminal_end_${direction}_${terminalEnd.pos[0]}_${terminalEnd.pos[1]}`}
                position={terminalEnd.pos}
                zIndexOffset={3800}
                icon={createTerminalIcon(terminalEnd.name, false, '#f59e0b')}
                interactive={false}
              />
            )}
          </MapContainer>

          {/* Ventana Flotante de Detalle de Unidad GTFS */}
          {selectedVehicle && (
            <div style={{
              position: 'absolute',
              bottom: '24px',
              left: '24px',
              zIndex: 1100,
              width: '350px',
              backgroundColor: 'rgba(15, 23, 42, 0.97)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '16px',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.75), 0 0 24px rgba(2, 132, 199, 0.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Header */}
              <div style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(2, 132, 199, 0.18)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🚍</span>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8', lineHeight: 1.1 }}>
                      Línea {selectedVehicle.linea || selectedVehicle.route_short_name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                      GTFS Route ID: {selectedVehicle.route_id || 'N/A'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.4)'
                  }}>
                    #{selectedVehicle.intern}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedVehicle(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Tabs Switcher: Detalle vs JSON */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: 'rgba(0, 0, 0, 0.25)'
              }}>
                <button
                  type="button"
                  onClick={() => setVehicleModalTab('info')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    border: 'none',
                    borderBottom: vehicleModalTab === 'info' ? '2px solid #38bdf8' : '2px solid transparent',
                    backgroundColor: vehicleModalTab === 'info' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    color: vehicleModalTab === 'info' ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>📊 Telemetría</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVehicleModalTab('json')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    border: 'none',
                    borderBottom: vehicleModalTab === 'json' ? '2px solid #38bdf8' : '2px solid transparent',
                    backgroundColor: vehicleModalTab === 'json' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    color: vehicleModalTab === 'json' ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <FileCode size={13} />
                  <span>JSON Completo</span>
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {vehicleModalTab === 'info' ? (
                  <>
                    {/* Empresa */}
                    {selectedVehicle.agency_name && (
                      <div style={{
                        backgroundColor: 'rgba(30, 41, 59, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        fontSize: '0.78rem',
                        color: '#cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ fontSize: '14px' }}>🏢</span>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {selectedVehicle.agency_name}
                        </div>
                      </div>
                    )}

                    {/* Headsign / Destino GTFS */}
                    <div style={{
                      backgroundColor: 'rgba(30, 41, 59, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '8px 10px'
                    }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', display: 'block', marginBottom: '2px' }}>
                        Destino Oficial (Headsign)
                      </span>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🏁</span>
                        <span>{selectedVehicle.trip_headsign || 'Sin especificar'}</span>
                      </div>
                    </div>

                    {/* Grid de Métricas */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px'
                    }}>
                      <div style={{
                        backgroundColor: 'rgba(30, 41, 59, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '8px 10px'
                      }}>
                        <span style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                          Velocidad en Vivo
                        </span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4ade80' }}>
                          {Math.round(selectedVehicle.speed || 0)} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>km/h</span>
                        </div>
                      </div>

                      <div style={{
                        backgroundColor: 'rgba(30, 41, 59, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '8px 10px'
                      }}>
                        <span style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                          Sentido GTFS
                        </span>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: selectedVehicle.direction === 0 ? '#38bdf8' : '#fb7185' }}>
                          {selectedVehicle.direction === 0 ? 'Ida (0)' : selectedVehicle.direction === 1 ? 'Vuelta (1)' : 'Ida'}
                        </div>
                      </div>

                      <div style={{
                        backgroundColor: 'rgba(30, 41, 59, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '8px 10px'
                      }}>
                        <span style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                          Rumbo
                        </span>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
                          🧭 {Math.round(selectedVehicle.bearing || 0)}°
                        </div>
                      </div>

                      <div style={{
                        backgroundColor: 'rgba(30, 41, 59, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '8px 10px'
                      }}>
                        <span style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                          Última Señal GPS
                        </span>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                          🕒 {selectedVehicle.timestamp ? (typeof selectedVehicle.timestamp === 'number' && selectedVehicle.timestamp < 2000000000 ? new Date(selectedVehicle.timestamp * 1000).toLocaleTimeString() : new Date(selectedVehicle.timestamp).toLocaleTimeString()) : 'En vivo'}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Pestaña JSON Raw Completo */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                        Datos completos de la unidad
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(selectedVehicle, null, 2));
                          setVehicleJsonCopied(true);
                          setTimeout(() => setVehicleJsonCopied(false), 2000);
                        }}
                        style={{
                          backgroundColor: vehicleJsonCopied ? '#16a34a' : 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          color: vehicleJsonCopied ? '#ffffff' : '#38bdf8',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          padding: '3px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {vehicleJsonCopied ? <Check size={12} /> : <Copy size={12} />}
                        <span>{vehicleJsonCopied ? '¡Copiado!' : 'Copiar JSON'}</span>
                      </button>
                    </div>
                    <pre style={{
                      backgroundColor: '#090d16',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '10px',
                      fontSize: '0.71rem',
                      color: '#38bdf8',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      margin: 0,
                      boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.5)'
                    }}>
                      {JSON.stringify(selectedVehicle, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Coordenadas GPS, Información del Camino y Botón Centrar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '6px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  fontSize: '0.7rem',
                  color: '#64748b',
                  fontFamily: 'monospace'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>Lat: {selectedVehicle.lat?.toFixed(5)}, Lng: {selectedVehicle.lng?.toFixed(5)}</span>
                    <span style={{ color: '#00e676', fontWeight: 600 }}>
                      🛤️ Camino: {(gpsTraces[String(selectedVehicle.intern || selectedVehicle.id)]?.points || []).length} reportes por calles
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {((gpsTraces[String(selectedVehicle.intern || selectedVehicle.id)]?.streetPath || []).length >= 2 || (gpsTraces[String(selectedVehicle.intern || selectedVehicle.id)]?.points || []).length >= 2) && (
                      <button
                        type="button"
                        onClick={() => {
                          const trace = gpsTraces[String(selectedVehicle.intern || selectedVehicle.id)];
                          const coords = (trace?.streetPath && trace.streetPath.length >= 2) 
                            ? trace.streetPath 
                            : (trace?.points || []).map(p => [p.lat, p.lng] as [number, number]);
                          if (mapInstance && coords.length >= 2) {
                            mapInstance.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 16 });
                          }
                        }}
                        style={{
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(0, 230, 118, 0.4)',
                          color: '#00e676',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Footprints size={12} /> Ver Camino
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (mapInstance && typeof selectedVehicle.lat === 'number') {
                          mapInstance.setView([selectedVehicle.lat, selectedVehicle.lng], 16, { animate: true });
                        }
                      }}
                      style={{
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#38bdf8',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <LocateFixed size={13} /> Enfocar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botón flotante Mirita para centrar/enfocar el recorrido */}
          <button
            type="button"
            onClick={handleFocusCurrentRoute}
            style={{
              position: 'absolute',
              bottom: '24px',
              right: showRightDock ? '360px' : '24px',
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
              zIndex: 999,
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#0284c7'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#1e293b'; e.currentTarget.style.color = '#38bdf8'; e.currentTarget.style.transform = 'scale(1)'; }}
            title="Mirita: Enfocar recorrido del ramal en el mapa"
          >
            <LocateFixed size={20} />
          </button>

          {/* 3. RIGHT FLOATING WIDGET DOCK (CONMUTADOR DE PESTAÑAS: PARADAS vs RECORRIDO) */}
          {showRightDock && (
            <div style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              bottom: '16px',
              width: '340px',
              backgroundColor: '#0c1527',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
              zIndex: 1000
            }}>
              {/* TOP BAR */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#070d19',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <button
                  onClick={() => {
                    if (rightDockTab === 'paradas') handleClearAllStops();
                    else handleClearWaypoints();
                  }}
                  title={rightDockTab === 'paradas' ? 'Eliminar todas las paradas' : 'Limpiar todo el trazado'}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Trash2 size={16} />
                </button>

                {/* Top Action Switchers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    onClick={() => {
                      setRightDockTab('paradas');
                      setActiveTool('add_stop');
                    }}
                    title="Editar Paradas"
                    className="btn-animated btn-animated-dark"
                    style={{
                      backgroundColor: rightDockTab === 'paradas' ? '#1e293b' : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.35rem 0.5rem',
                      color: rightDockTab === 'paradas' ? '#38bdf8' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <MapPin size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setRightDockTab('recorrido');
                      setActiveTool('none');
                    }}
                    title="Editar Recorrido / Trazado"
                    className="btn-animated btn-animated-dark"
                    style={{
                      backgroundColor: rightDockTab === 'recorrido' ? '#1e293b' : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.35rem 0.5rem',
                      color: rightDockTab === 'recorrido' ? '#38bdf8' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <RouteIcon size={15} />
                  </button>
                  <span style={{ color: '#334155', fontSize: '0.8rem' }}>|</span>
                  <button
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      padding: '0.35rem',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Settings size={15} />
                  </button>
                  <span style={{ color: '#334155', fontSize: '0.8rem' }}>|</span>
                  <button
                    onClick={() => setShowRightDock(false)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      padding: '0.35rem',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Maximize2 size={15} />
                  </button>
                </div>
              </div>

              {/* TITLE & COUNTER BAR */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                backgroundColor: '#0c1527',
                borderBottom: rightDockTab === 'recorrido' ? 'none' : '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '0.5rem' }}>
                  {rightDockTab === 'paradas' ? 'Paradas' : 'Recorrido'}: {selectedBranchObj ? (selectedBranchObj.name || selectedBranchObj.code) : 'Ramal'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', backgroundColor: '#0284c7', color: '#ffffff', padding: '0.15rem 0.55rem', borderRadius: '6px', fontWeight: 800 }}>
                    {rightDockTab === 'paradas' ? stops.length : waypoints.length}
                  </span>
                </div>
              </div>

              {/* DISTANCE BADGE UNDER HEADER */}
              {rightDockTab === 'recorrido' && (
                <div style={{
                  padding: '0.2rem 1rem 0.6rem',
                  backgroundColor: '#0c1527',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Distancia total:</span>
                  <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 800, backgroundColor: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                    📏 {totalDistanceKm} km
                  </span>
                </div>
              )}

              {/* DIRECTION TABS BAR (IDA / VUELTA) */}
              <div style={{ display: 'flex', backgroundColor: '#070d19', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <button
                  onClick={() => setDirection('ida')}
                  className="btn-animated btn-animated-primary"
                  style={{
                    flex: 1,
                    padding: '0.65rem',
                    border: 'none',
                    backgroundColor: direction === 'ida' ? '#131e32' : 'transparent',
                    color: direction === 'ida' ? '#38bdf8' : '#64748b',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    borderBottom: direction === 'ida' ? '2px solid #0284c7' : 'none'
                  }}
                >
                  IDA ({rightDockTab === 'paradas' ? idaStopsCount : (direction === 'ida' ? waypoints.length : idaWaypointsCount)})
                </button>
                <button
                  onClick={() => setDirection('vuelta')}
                  className="btn-animated btn-animated-primary"
                  style={{
                    flex: 1,
                    padding: '0.65rem',
                    border: 'none',
                    backgroundColor: direction === 'vuelta' ? '#131e32' : 'transparent',
                    color: direction === 'vuelta' ? '#38bdf8' : '#64748b',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    borderBottom: direction === 'vuelta' ? '2px solid #0284c7' : 'none'
                  }}
                >
                  VUELTA ({rightDockTab === 'paradas' ? vueltaStopsCount : (direction === 'vuelta' ? waypoints.length : vueltaWaypointsCount)})
                </button>
              </div>

              {/* TAB CONTENT: PARADAS LIST vs RECORRIDO CONTROL WAYPOINTS LIST */}
              {rightDockTab === 'paradas' ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {stops.length === 0 ? (
                    <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                      <MapPin size={28} style={{ color: '#475569' }} />
                      <div>
                        No hay paradas en {direction.toUpperCase()}.<br />
                        Toca cualquier punto del mapa o importa desde KML.
                      </div>
                      <button
                        onClick={() => executeIfEditing(() => kmlInputRef.current?.click())}
                        disabled={!isEditingEnabled}
                        className="btn-animated btn-animated-success"
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: isEditingEnabled ? '#10b981' : '#334155',
                          color: 'white',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: isEditingEnabled ? 'pointer' : 'not-allowed',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          marginTop: '0.3rem'
                        }}
                      >
                        <FileCode size={16} />
                        Importar paradas desde KML
                      </button>
                    </div>
                  ) : (
                    stops.map((st, idx) => {
                      const isSelectedStop = selectedStopId === st.id;
                      return (
                        <div
                          key={st.id}
                          onClick={() => {
                            setSelectedStopId(st.id);
                            setSelectedWaypointIdx(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.55rem 0.75rem',
                            borderRadius: '8px',
                            backgroundColor: isSelectedStop ? '#1e293b' : '#131b2e',
                            border: isSelectedStop ? '1px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.04)',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
                            <div style={{ color: '#475569', fontSize: '0.75rem', cursor: 'grab', userSelect: 'none' }}>::</div>

                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isSelectedStop ? '#ec4899' : '#38bdf8', minWidth: '22px' }}>
                              {idx + 1}.
                            </span>

                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStopId(st.id);
                                setFocusCoords([st.lat, st.lng]);
                              }}
                              title="Centrar parada en el mapa"
                              style={{ fontSize: '0.8rem', color: isSelectedStop ? '#f472b6' : '#f1f5f9', fontWeight: 600, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                            >
                              {st.name}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStopId(st.id);
                                setFocusCoords([st.lat, st.lng]);
                              }}
                              title="Centrar en mapa"
                              style={{ backgroundColor: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '2px' }}
                            >
                              <Search size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteStop(st.id);
                              }}
                              title="Eliminar parada"
                              style={{ backgroundColor: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {waypoints.length === 0 ? (
                    <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                      <Compass size={28} style={{ margin: '0 auto 0.5rem', color: '#475569' }} />
                      No hay trazado dibujado para {direction.toUpperCase()}.<br />
                      Haz clic sobre el mapa para trazar el recorrido por las calles.
                    </div>
                  ) : (
                    waypoints.map((pt, idx) => {
                      const isStart = idx === 0;
                      const isEnd = idx === waypoints.length - 1 && waypoints.length > 1;
                      const isSelected = selectedWaypointIdx === idx;
                      return (
                        <div
                          key={`wpt_${idx}_${pt[0]}_${pt[1]}`}
                          onClick={() => {
                            setFocusCoords(pt);
                            setSelectedWaypointIdx(idx);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.55rem 0.75rem',
                            borderRadius: '8px',
                            backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.22)' : '#131b2e',
                            border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.04)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isStart ? '#10b981' : isEnd ? '#ef4444' : '#38bdf8', minWidth: '22px' }}>
                              {idx + 1}.
                            </span>
                            <span style={{ fontSize: '0.78rem', color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isStart ? '🚩 Inicio (Cabecera A)' : isEnd ? '🏁 Fin (Cabecera B)' : `Punto ${idx + 1}`} ({pt[0].toFixed(4)}, {pt[1].toFixed(4)})
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFocusCoords(pt);
                                setSelectedWaypointIdx(idx);
                              }}
                              title="Centrar punto en mapa"
                              style={{ backgroundColor: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '2px' }}
                            >
                              <Search size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                executeIfEditing(() => handleDeleteWaypointIndex(idx));
                              }}
                              disabled={!isEditingEnabled}
                              title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Eliminar punto del recorrido'}
                              style={{ backgroundColor: 'transparent', border: 'none', color: isEditingEnabled ? '#ef4444' : '#64748b', cursor: isEditingEnabled ? 'pointer' : 'not-allowed', padding: '2px' }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* BOTTOM TOOLBAR GRID (7 BOTONES ÚNICOS Y PROTEGIDOS) */}
              {rightDockTab === 'paradas' ? (
                <div style={{
                  padding: '0.6rem 0.75rem',
                  backgroundColor: '#070d19',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '0.35rem'
                }}>
                  <button
                    onClick={() => executeIfEditing(() => kmlInputRef.current?.click())}
                    disabled={!isEditingEnabled}
                    title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Importar paradas desde archivo KML / Google Earth'}
                    className="btn-animated btn-animated-primary"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: isEditingEnabled ? '#0284c7' : '#1e293b', color: isEditingEnabled ? 'white' : '#64748b', opacity: isEditingEnabled ? 1 : 0.4, cursor: isEditingEnabled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <FileCode size={14} />
                  </button>
                  <button
                    onClick={() => executeIfEditing(() => setShowProjectStopsModal(true))}
                    disabled={!isEditingEnabled}
                    title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Posicionar y proyectar paradas a la derecha del trazado'}
                    className="btn-animated btn-animated-success"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: isEditingEnabled ? '#10b981' : '#1e293b', color: isEditingEnabled ? 'white' : '#64748b', opacity: isEditingEnabled ? 1 : 0.4, cursor: isEditingEnabled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <MapPin size={14} />
                  </button>
                  <button
                    onClick={() => executeIfEditing(() => setShowReverseStopsModal(true))}
                    disabled={!isEditingEnabled}
                    title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Invertir secuencia de paradas (1->N a N->1)'}
                    className="btn-animated btn-animated-primary"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: isEditingEnabled ? '#0284c7' : '#1e293b', color: isEditingEnabled ? 'white' : '#64748b', opacity: isEditingEnabled ? 1 : 0.4, cursor: isEditingEnabled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ArrowUpDown size={14} />
                  </button>
                  <button
                    onClick={() => executeIfEditing(() => setShowSortStopsModal(true))}
                    disabled={!isEditingEnabled}
                    title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Reordenar paradas de inicio a fin según el recorrido'}
                    className="btn-animated btn-animated-primary"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: isEditingEnabled ? '#d97706' : '#1e293b', color: isEditingEnabled ? 'white' : '#64748b', opacity: isEditingEnabled ? 1 : 0.4, cursor: isEditingEnabled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Compass size={14} />
                  </button>
                  <button
                    onClick={() => executeIfEditing(() => setShowReplicateModal(true))}
                    disabled={!isEditingEnabled}
                    title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Replicar paradas a otro ramal'}
                    className="btn-animated btn-animated-primary"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: isEditingEnabled ? '#0284c7' : '#1e293b', color: isEditingEnabled ? 'white' : '#64748b', opacity: isEditingEnabled ? 1 : 0.4, cursor: isEditingEnabled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => executeIfEditing(() => setShowAutoStopsModal(true))}
                    disabled={!isEditingEnabled}
                    title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Autogenerar paradas por distancia cada X metros'}
                    className="btn-animated btn-animated-purple"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: isEditingEnabled ? '#8b5cf6' : '#1e293b', color: isEditingEnabled ? 'white' : '#64748b', opacity: isEditingEnabled ? 1 : 0.4, cursor: isEditingEnabled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Wand2 size={14} />
                  </button>
                  <button
                    onClick={() => executeIfEditing(() => setShowClearStopsModal(true))}
                    disabled={!isEditingEnabled}
                    title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Eliminar todas las paradas de esta solapa'}
                    className="btn-animated btn-animated-danger"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: isEditingEnabled ? '#ef4444' : '#1e293b', color: isEditingEnabled ? 'white' : '#64748b', opacity: isEditingEnabled ? 1 : 0.4, cursor: isEditingEnabled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <div style={{
                  padding: '0.6rem 0.75rem',
                  backgroundColor: '#070d19',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.35rem'
                }}>
                  <button
                    onClick={() => executeIfEditing(handleOpenSmoothModal)}
                    disabled={!isEditingEnabled || waypoints.length < 2}
                    title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Suavizar tramo del recorrido vialmente'}
                    className="btn-animated btn-animated-primary"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: (isEditingEnabled && waypoints.length >= 2) ? '#0284c7' : '#1e293b', color: (isEditingEnabled && waypoints.length >= 2) ? 'white' : '#64748b', opacity: (isEditingEnabled && waypoints.length >= 2) ? 1 : 0.4, cursor: (isEditingEnabled && waypoints.length >= 2) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Wand2 size={14} />
                  </button>
                  <button
                    onClick={() => executeIfEditing(() => setShowClearRouteModal(true))}
                    disabled={!isEditingEnabled || waypoints.length === 0}
                    title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Limpiar todo el trazado'}
                    className="btn-animated btn-animated-danger"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: (isEditingEnabled && waypoints.length > 0) ? '#dc2626' : '#1e293b', color: (isEditingEnabled && waypoints.length > 0) ? 'white' : '#64748b', opacity: (isEditingEnabled && waypoints.length > 0) ? 1 : 0.4, cursor: (isEditingEnabled && waypoints.length > 0) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => executeIfEditing(() => setShowReverseRouteModal(true))}
                    disabled={!isEditingEnabled}
                    title={!isEditingEnabled ? 'Debes habilitar la edición primero' : 'Invertir sentido del trazado'}
                    className="btn-animated btn-animated-purple"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: isEditingEnabled ? '#8b5cf6' : '#1e293b', color: isEditingEnabled ? 'white' : '#64748b', opacity: isEditingEnabled ? 1 : 0.4, cursor: isEditingEnabled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <GitCompare size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: REPLICAR PARADAS HACIA OTRO RAMAL */}
      {showReplicateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '420px',
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Copy size={16} /> Replicar Paradas hacia otro Ramal
              </h3>
              <button onClick={() => setShowReplicateModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af', lineHeight: '1.4' }}>
              Se copiarán las <strong>{stops.length} paradas</strong> del ramal actual hacia el ramal y sentido destino seleccionados.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700 }}>RAMAL DESTINO:</label>
                <select
                  value={replicateTargetBranchId}
                  onChange={e => setReplicateTargetBranchId(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#1f2937', color: '#ffffff', fontSize: '0.8rem' }}
                >
                  <option value="">Seleccionar ramal destino...</option>
                  {branchesList.map(b => (
                    <option key={`rep_${b.id}`} value={b.id}>
                      {b.code ? `${b.code} - ${b.name}` : b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700 }}>SENTIDO DESTINO:</label>
                <select
                  value={replicateTargetDirection}
                  onChange={e => setReplicateTargetDirection(e.target.value as any)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#1f2937', color: '#ffffff', fontSize: '0.8rem' }}
                >
                  <option value="ida">IDA</option>
                  <option value="vuelta">VUELTA</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowReplicateModal(false)}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: '#cbd5e1', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteReplicateStops}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Replicar Paradas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: AUTOGENERADOR MASIVO DE PARADAS CADA X METROS */}
      {showAutoStopsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '420px',
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#a78bfa', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wand2 size={16} /> Autogenerar Paradas por Distancia
              </h3>
              <button onClick={() => setShowAutoStopsModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af', lineHeight: '1.4' }}>
              Calcula y posiciona automáticamente paradas a lo largo de la traza vectorial dibujada cada <strong>{autoStopsIntervalMeters} metros</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700 }}>DISTANCIA ENTRE PARADAS (METROS):</label>
              <input
                type="number"
                value={autoStopsIntervalMeters}
                onChange={e => setAutoStopsIntervalMeters(Math.max(50, parseInt(e.target.value, 10) || 100))}
                step={50}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#1f2937', color: '#ffffff', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowAutoStopsModal(false)}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: '#cbd5e1', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteAutoStopsGenerator}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none', backgroundColor: '#8b5cf6', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Generar Paradas
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 3: INVERTIR SECUENCIA DE PARADAS CONFIRMACION */}
      {showReverseStopsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '420px',
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowUpDown size={16} /> Invertir Secuencia de Paradas
              </h3>
              <button onClick={() => setShowReverseStopsModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              ¿Estás seguro de que deseas invertir el orden de la secuencia de las <strong>{stops.length} paradas</strong> en el sentido <strong>{direction.toUpperCase()}</strong>?
              <br />
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem', display: 'block' }}>
                La primera parada se convertirá en la última y toda la secuencia se reordenará inversamente.
              </span>
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowReverseStopsModal(false)}
                className="btn-animated btn-animated-dark"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: '#1f2937', color: '#f1f5f9', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleReverseStops();
                  setShowReverseStopsModal(false);
                }}
                className="btn-animated btn-animated-primary"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Sí, Invertir Secuencia
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 4: POSICIONAR Y PROYECTAR PARADAS CONFIRMACION */}
      {showProjectStopsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '420px',
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#10b981', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={16} /> Posicionar Paradas en Acera Derecha
              </h3>
              <button onClick={() => setShowProjectStopsModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              ¿Deseas proyectar las <strong>{stops.length} paradas</strong> en el sentido <strong>{direction.toUpperCase()}</strong> sobre el trazado?
              <br />
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem', display: 'block' }}>
                Se encajarán automáticamente sobre la calle desplazadas 6m a la derecha según el avance del colectivo.
              </span>
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowProjectStopsModal(false)}
                className="btn-animated btn-animated-dark"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: '#1f2937', color: '#f1f5f9', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleProjectStopsOnRoute();
                  setShowProjectStopsModal(false);
                }}
                className="btn-animated btn-animated-success"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Sí, Posicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: REORDENAR PARADAS POR DISTANCIA CONFIRMACION */}
      {showSortStopsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '420px',
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#f59e0b', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Compass size={16} /> Reordenar por Avance del Recorrido
              </h3>
              <button onClick={() => setShowSortStopsModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              ¿Deseas reordenar secuencialmente (1..N) las <strong>{stops.length} paradas</strong> en el sentido <strong>{direction.toUpperCase()}</strong> según su posición a lo largo de las calles de inicio a fin?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowSortStopsModal(false)}
                className="btn-animated btn-animated-dark"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: '#1f2937', color: '#f1f5f9', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleSortStopsByPathDistance();
                  setShowSortStopsModal(false);
                }}
                className="btn-animated btn-animated-primary"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', backgroundColor: '#d97706', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Sí, Reordenar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: ELIMINAR PARADAS CONFIRMACION */}
      {showClearStopsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '420px',
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#ef4444', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={16} /> Eliminar Todas las Paradas
              </h3>
              <button onClick={() => setShowClearStopsModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              ¿Estás seguro de que deseas eliminar todas las <strong>{stops.length} paradas</strong> del sentido <strong>{direction.toUpperCase()}</strong>?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowClearStopsModal(false)}
                className="btn-animated btn-animated-dark"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: '#1f2937', color: '#f1f5f9', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleClearAllStops();
                  setShowClearStopsModal(false);
                }}
                className="btn-animated btn-animated-danger"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Sí, Eliminar Paradas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: LIMPIAR TRAZADO CONFIRMACION */}
      {showClearRouteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '420px',
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#ef4444', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={16} /> Limpiar Trazado del Recorrido
              </h3>
              <button onClick={() => setShowClearRouteModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              ¿Estás seguro de que deseas borrar todo el trazado y los puntos de control del sentido <strong>{direction.toUpperCase()}</strong>?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowClearRouteModal(false)}
                className="btn-animated btn-animated-dark"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: '#1f2937', color: '#f1f5f9', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleClearWaypoints();
                  setShowClearRouteModal(false);
                }}
                className="btn-animated btn-animated-danger"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Sí, Limpiar Trazado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: INVERTIR TRAZADO CONFIRMACION */}
      {showReverseRouteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '420px',
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#a78bfa', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GitCompare size={16} /> Invertir Sentido del Trazado
              </h3>
              <button onClick={() => setShowReverseRouteModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              ¿Estás seguro de que deseas invertir el sentido del trazado en <strong>{direction.toUpperCase()}</strong>?
              <br />
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem', display: 'block' }}>
                Esta acción invierte los puntos de inicio a fin (ideal para crear el sentido de Vuelta).
              </span>
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowReverseRouteModal(false)}
                className="btn-animated btn-animated-dark"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: '#1f2937', color: '#f1f5f9', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleReverseRouteShape();
                  setShowReverseRouteModal(false);
                }}
                className="btn-animated btn-animated-purple"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', backgroundColor: '#8b5cf6', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Sí, Invertir Trazado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: SUAVIZAR RECORRIDO */}
      {showSmoothRouteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '440px',
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            color: '#f8fafc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wand2 size={18} /> Suavizar Recorrido Vialmente
              </h3>
              <button onClick={() => setShowSmoothRouteModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              Selecciona un tramo de puntos para corregirlos automáticamente y alinearlos al trazado de las calles mediante el seguimiento de Leaflet (OSRM).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Punto Inicial:</label>
                <select
                  value={smoothStartIdx}
                  onChange={(e) => setSmoothStartIdx(Number(e.target.value))}
                  style={{ backgroundColor: '#1f2937', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '0.5rem', fontSize: '0.82rem', outline: 'none' }}
                >
                  {waypoints.map((pt, idx) => (
                    <option key={`smooth-start-${idx}`} value={idx}>
                      {idx + 1}. Punto {idx + 1} ({pt[0].toFixed(4)}, {pt[1].toFixed(4)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Punto Final:</label>
                <select
                  value={smoothEndIdx}
                  onChange={(e) => setSmoothEndIdx(Number(e.target.value))}
                  style={{ backgroundColor: '#1f2937', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '0.5rem', fontSize: '0.82rem', outline: 'none' }}
                >
                  {waypoints.map((pt, idx) => (
                    <option key={`smooth-end-${idx}`} value={idx}>
                      {idx + 1}. Punto {idx + 1} ({pt[0].toFixed(4)}, {pt[1].toFixed(4)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Simplificación de Puntos:</label>
                <select
                  value={smoothSimplification}
                  onChange={(e) => setSmoothSimplification(e.target.value as any)}
                  style={{ backgroundColor: '#1f2937', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '0.5rem', fontSize: '0.82rem', outline: 'none' }}
                >
                  <option value="auto">Automático (Recomendado - reduce exceso de puntos)</option>
                  <option value="min">Simplificación Máxima (Sólo esquinas y giros principales)</option>
                  <option value="all">Sin Simplificar (Conserva todos los nodos de calle OSRM)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowSmoothRouteModal(false)}
                className="btn-animated btn-animated-dark"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: '#1f2937', color: '#f1f5f9', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                disabled={isSmoothing}
                onClick={handleApplySmoothRoute}
                className="btn-animated btn-animated-primary"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: isSmoothing ? 'not-allowed' : 'pointer', opacity: isSmoothing ? 0.7 : 1 }}
              >
                {isSmoothing ? 'Procesando...' : 'Suavizar Recorrido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INGESTADOR DE RECORRIDOS GOOGLE MY MAPS MODAL OVERLAY */}
      {showMyMapsIngestorModal && (
        <KmlMyMapsIngestor
          onClose={() => setShowMyMapsIngestorModal(false)}
          linesList={linesList || []}
          branchesList={branchesList || []}
          showNotification={showNotification}
          onIntegrateRoute={() => {
            loadBranchData();
          }}
        />
      )}

      {/* HIDDEN FILE INPUT FOR KML IMPORT */}
      <input
        type="file"
        ref={kmlInputRef}
        accept=".kml,.xml"
        onChange={handleKmlFileUpload}
        style={{ display: 'none' }}
      />
    </div>
  );
}
