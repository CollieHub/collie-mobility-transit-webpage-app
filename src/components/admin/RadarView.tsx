import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Polygon, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
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
  LocateFixed
} from 'lucide-react';
import { KmlMyMapsIngestor } from './KmlMyMapsIngestor';
import RedSubeV3Panel, { getBranchColor } from './RedSubeV3Panel';
import type { V3Route } from './RedSubeV3Panel';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ZARATE_CENTER: [number, number] = [-34.0970, -59.0300];

function createBusVehicleIcon(label: string, linea: string) {
  return L.divIcon({
    className: 'custom-vehicle-icon',
    html: `<div style="
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #0284c7;
      color: #ffffff;
      padding: 2px 7px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 800;
      border: 2px solid #ffffff;
      box-shadow: 0 3px 8px rgba(0,0,0,0.5);
      white-space: nowrap;
      cursor: pointer;
    ">
      <span>🚍</span>
      <span>${linea || label || 'SUBE'}</span>
    </div>`,
    iconSize: [60, 24],
    iconAnchor: [30, 12]
  });
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

function createStopIcon(color: string = '#ea580c') {
  const size = 24;
  const svgCode = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" style="cursor: grab; filter: drop-shadow(0px 2px 5px rgba(0,0,0,0.5));">
      <!-- Fondo del Icono Naranja / Color del Ramal -->
      <rect width="32" height="32" rx="7" fill="${color}"/>
      <!-- Borde interior blanco continuo -->
      <rect x="1.5" y="1.5" width="29" height="29" rx="5.5" fill="none" stroke="#ffffff" stroke-width="1.8" />
      <!-- Icono de Colectivo Blanco -->
      <g transform="translate(4,4)">
          <path fill="#FFFFFF" d="M4,16c0,0.88 0.39,1.67 1,2.22l0,1.78c0,0.55 0.45,1 1,1l1,0c0.55,0 1,-0.45 1,-1l0,-1l8,0l0,1c0,0.55 0.45,1 1,1l1,0c0.55,0 1,-0.45 1,-1l0,-1.78c0.61,-0.55 1,-1.34 1,-2.22L20,6c0,-3.5 -3.58,-4 -8,-4s-8,0.5 -8,4l0,10zM7.5,17c-0.83,0 -1.5,-0.67 -1.5,-1.5S6.67,14 7.5,14s1.5,0.67 1.5,1.5S8.33,17 7.5,17zM16.5,17c-0.83,0 -1.5,-0.67 -1.5,-1.5s0.67,-1.5 1.5,-1.5s1.5,0.67 1.5,1.5S17.33,17 16.5,17zM18,11L6,11L6,6l12,0L18,11z"/>
      </g>
    </svg>`;
  return L.divIcon({
    className: 'custom-stop-icon',
    html: svgCode,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function createStopIconWithNumber(orderNum: number, color: string = '#ea580c') {
  const size = 26;
  const svgCode = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" style="cursor: grab; filter: drop-shadow(0px 2px 5px rgba(0,0,0,0.5));">
      <rect width="32" height="32" rx="8" fill="${color}"/>
      <rect x="1.5" y="1.5" width="29" height="29" rx="6.5" fill="none" stroke="#ffffff" stroke-width="2" />
      <text x="16" y="21" font-size="14" font-weight="900" font-family="system-ui, -apple-system, sans-serif" fill="#ffffff" text-anchor="middle">${orderNum}</text>
    </svg>`;
  return L.divIcon({
    className: 'custom-stop-number-icon',
    html: svgCode,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
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
function simplifyPolylineRdp(points: [number, number][], epsilonKm: number = 0.2): [number, number][] {
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
    if (focusCoords) {
      map.flyTo(focusCoords, 16, { duration: 1 });
    }
  }, [focusCoords, map]);

  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      try {
        const lBounds = L.latLngBounds(bounds.map(p => L.latLng(p[0], p[1])));
        if (lBounds.isValid()) {
          map.fitBounds(lBounds, { padding: [60, 60], maxZoom: 15, duration: 1 });
        }
      } catch (_) {}
    }
  }, [bounds, map]);

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
    if (!coordinates || coordinates.length < 2 || zoom < 13) return [];

    const cumulativeDistances: number[] = [0];
    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];
      const dist = calculateDistanceKm(prev[0], prev[1], curr[0], curr[1]) * 1000;
      cumulativeDistances.push(cumulativeDistances[i - 1] + dist);
    }
    const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
    if (totalDistance <= 0) return [];

    const pathData = { coordinates, cumulativeDistances, totalDistance };

    let spacing = 350; // metros entre flechas para zoom >= 16
    if (zoom === 15) spacing = 600;
    else if (zoom === 14) spacing = 1200;
    else if (zoom === 13) spacing = 2000;

    const scaleFactor = Math.pow(2, 16 - Math.min(18, Math.max(10, zoom)));
    const L = 0.00016 * scaleFactor;
    const W = 0.00007 * scaleFactor;

    const polygons: any[] = [];
    for (let d = 40; d < totalDistance - 30; d += spacing) {
      const p = getPositionAtDistance(pathData, d);
      const nextP = getPositionAtDistance(pathData, Math.min(d + 4, totalDistance));

      const dLat = nextP.lat - p.lat;
      const dLng = nextP.lng - p.lng;
      const length = Math.sqrt(dLat * dLat + dLng * dLng);
      if (length > 0) {
        const dirVec = { lat: dLat / length, lng: dLng / length };
        const norm = { lat: -dirVec.lng, lng: dirVec.lat };

        const pTip: [number, number] = [p.lat + dirVec.lat * L, p.lng + dirVec.lng * L];
        const pLeft: [number, number] = [p.lat - dirVec.lat * L * 0.35 + norm.lat * W, p.lng - dirVec.lng * L * 0.35 + norm.lng * W];
        const pRight: [number, number] = [p.lat - dirVec.lat * L * 0.35 - norm.lat * W, p.lng - dirVec.lng * L * 0.35 - norm.lng * W];

        polygons.push(
          <Polygon
            key={`route_arrow_${direction}_${d}`}
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
  showNotification?: (type: 'success' | 'error', message: string) => void;
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
  }, [linesList, branchesList, selectedLineFilterId]);

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
            parsedIdaCoords = parsed.map((pt: any) => {
              if (Array.isArray(pt)) return [pt[0], pt[1]];
              if (typeof pt === 'object' && pt.lat && pt.lng) return [pt.lat, pt.lng];
              return pt;
            });
            setIdaPolylinePath(parsedIdaCoords);
            setIdaWaypointsCount(simplifyPolylineRdp(parsedIdaCoords, 0.2).length);
          } catch (_) { setIdaPolylinePath([]); setIdaWaypointsCount(0); }
        } else { setIdaPolylinePath([]); setIdaWaypointsCount(0); }

        if (vueltaMatch && vueltaMatch.coordinates_json) {
          try {
            const parsed = JSON.parse(vueltaMatch.coordinates_json);
            parsedVueltaCoords = parsed.map((pt: any) => {
              if (Array.isArray(pt)) return [pt[0], pt[1]];
              if (typeof pt === 'object' && pt.lat && pt.lng) return [pt.lat, pt.lng];
              return pt;
            });
            setVueltaPolylinePath(parsedVueltaCoords);
            setVueltaWaypointsCount(simplifyPolylineRdp(parsedVueltaCoords, 0.2).length);
          } catch (_) { setVueltaPolylinePath([]); setVueltaWaypointsCount(0); }
        } else { setVueltaPolylinePath([]); setVueltaWaypointsCount(0); }

        const allCoords = [...parsedIdaCoords, ...parsedVueltaCoords];
        if (allCoords.length >= 2) {
          setRouteBounds(allCoords);
        }

        const match = rows.find((r: any) => r.branch_id === selectedBranchId && r.direction === direction);
        if (match && match.coordinates_json) {
          try {
            const formatted = direction === 'ida' ? parsedIdaCoords : parsedVueltaCoords;
            setFullPolylinePath(formatted);
            const simplifiedControls = simplifyPolylineRdp(formatted, 0.2);
            setWaypoints(simplifiedControls);
            setUndoStack([]);
            setExistingShapeId(match.id);

            // Re-calculate clean distance directly from OSRM or simplified control waypoints
            if (simplifiedControls.length >= 2) {
              const osrmRes = await fetchOsrmFullRoute(simplifiedControls);
              setRouteDistanceKm(osrmRes.distanceKm);
            } else if (match.total_distance_km && match.total_distance_km > 0) {
              setRouteDistanceKm(match.total_distance_km);
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
                  setTelemetryVehicles(units.map((u: any) => ({
                    id: u.id || u.vehicle_id || Math.random().toString(),
                    lat: u.latitude || u.lat || -34.0970,
                    lng: u.longitude || u.lng || -59.0300,
                    bearing: u.bearing || u.heading || 0,
                    speed: u.speed || 0,
                    intern: u.label || u.agency_name || 'RedSUBE',
                    linea: u.route_short_name || u.linea || '228',
                    delayMinutes: 0,
                    status: 'running',
                    timestamp: u.timestamp || Date.now()
                  })));
                }}
                currentDirection={direction}
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
              {selectedBranchObj ? (selectedBranchObj.code ? `${selectedBranchObj.code} - ${selectedBranchObj.name}` : selectedBranchObj.name) : 'Selecciona un Ramal'}
            </span>
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
            <MapClickHandler
              isEditingEnabled={isEditingEnabled}
              activeTool={activeTool}
              rightDockTab={rightDockTab}
              isPolylineClickRef={isPolylineClickRef}
              onAddWaypoint={handleAddWaypoint}
              onAddStop={handleAddStop}
            />

            {/* Traza de Fondo NO Activa (Ida o Vuelta simultánea) */}
            {direction === 'vuelta' && idaPolylinePath.length > 1 && (
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
              </>
            )}

            {direction === 'ida' && vueltaPolylinePath.length > 1 && (
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
            )}

            {/* Interactive Polyline: Continuous OSRM street route shape (Dirección Activa) */}
            {displayPolylinePath.length > 1 && (
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

            {/* Control Waypoint Markers: Render key control handles with numbers matching the Recorrido list */}
            {waypoints.map((pt, idx) => {
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

            {/* Stop Draggable Markers: Render active and other direction stops */}
            {allBranchStops.map((st, idx) => {
              const isActiveDir = st.direction === direction;
              const displayNum = (st.stop_order ?? (idx + 1));
              const isSelectedStop = selectedStopId === st.id;

              return (
                <Marker
                  key={`stop_marker_${st.id}`}
                  position={[st.lat, st.lng]}
                  draggable={isEditingEnabled && isActiveDir}
                  opacity={rightDockTab === 'recorrido' ? 0.35 : (isActiveDir ? 1 : 0.65)}
                  zIndexOffset={rightDockTab === 'paradas' ? (isSelectedStop ? 3500 : (isActiveDir ? 2000 : 1200)) : 500}
                  icon={
                    stopIconMode === 'number'
                      ? createStopIconWithNumber(displayNum, isSelectedStop ? '#ec4899' : (st.direction === 'ida' ? '#0284c7' : '#ea580c'))
                      : createStopIcon(isSelectedStop ? '#ec4899' : (st.direction === 'ida' ? '#ea580c' : '#d97706'))
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

            {/* Marcadores de Colectivos en Tiempo Real (RedSUBE / Telemetría V3) */}
            {telemetryVehicles.map((veh, idx) => (
              <Marker
                key={`telemetry_veh_${veh.id || idx}`}
                position={[veh.lat, veh.lng]}
                zIndexOffset={4000}
                icon={createBusVehicleIcon(veh.intern, veh.linea)}
              >
                <Popup>
                  <div style={{ color: '#111827', fontSize: '0.8rem', fontWeight: 600 }}>
                    🚍 <strong>Línea {veh.linea}</strong> — Interno: {veh.intern}
                    <br />
                    <span style={{ fontSize: '0.72rem', color: '#4b5563' }}>
                      Velocidad: {Math.round(veh.speed)} km/h
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

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
