import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
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
  Navigation
} from 'lucide-react';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ZARATE_CENTER: [number, number] = [-34.0970, -59.0300];

function createWaypointIcon(isStart: boolean, isEnd: boolean) {
  const bgColor = isStart ? '#10b981' : isEnd ? '#ef4444' : '#0284c7';
  return L.divIcon({
    className: 'custom-waypoint-icon',
    html: `<div style="
      width: 14px;
      height: 14px;
      background-color: ${bgColor};
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.6);
      cursor: grab;
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}

function createStopIcon() {
  return L.divIcon({
    className: 'custom-stop-icon',
    html: `<div style="
      width: 14px;
      height: 14px;
      background-color: #3b82f6;
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
      cursor: grab;
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
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
  activeTool,
  onAddWaypoint,
  onAddStop
}: {
  activeTool: 'none' | 'draw_route' | 'add_stop';
  onAddWaypoint: (point: [number, number]) => void;
  onAddStop: (point: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      if (activeTool === 'add_stop') {
        onAddStop([e.latlng.lat, e.latlng.lng]);
      } else {
        onAddWaypoint([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

function MapFocusController({ focusCoords }: { focusCoords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (focusCoords) {
      map.flyTo(focusCoords, 16, { duration: 1 });
    }
  }, [focusCoords, map]);
  return null;
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
  showNotification?: (type: 'success' | 'error', message: string) => void;
}

export default function RadarView({ linesList = [], branchesList = [], showNotification }: RadarViewProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [direction, setDirection] = useState<'ida' | 'vuelta'>('ida');

  const [, setActiveSidebarTab] = useState<'lineas' | 'paradas'>('lineas');
  const [selectedLineFilterId, setSelectedLineFilterId] = useState<string>('all');
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({ SIT: true, all: true });

  const [activeTool, setActiveTool] = useState<'none' | 'draw_route' | 'add_stop'>('none');
  const [useStreetRouting, setUseStreetRouting] = useState<boolean>(true);
  const [isRouting, setIsRouting] = useState<boolean>(false);

  // Control waypoints: High-level control handles (5-15 points max)
  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  // Full polyline path: Detailed OSRM curve geometry coordinates for clean street polyline rendering
  const [fullPolylinePath, setFullPolylinePath] = useState<[number, number][]>([]);
  // Exact road distance calculated by OSRM or Haversine
  const [routeDistanceKm, setRouteDistanceKm] = useState<number>(0);

  const [existingShapeId, setExistingShapeId] = useState<string | null>(null);

  const [stops, setStops] = useState<StopItem[]>([]);
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [editingStopName, setEditingStopName] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [focusCoords, setFocusCoords] = useState<[number, number] | null>(null);
  const [showRightDock, setShowRightDock] = useState<boolean>(true);
  const [rightDockTab, setRightDockTab] = useState<'paradas' | 'recorrido'>('paradas');

  // Assistant Modals State
  const [showReplicateModal, setShowReplicateModal] = useState<boolean>(false);
  const [replicateTargetBranchId, setReplicateTargetBranchId] = useState<string>('');
  const [replicateTargetDirection, setReplicateTargetDirection] = useState<'ida' | 'vuelta'>('ida');

  const [showAutoStopsModal, setShowAutoStopsModal] = useState<boolean>(false);
  const [autoStopsIntervalMeters, setAutoStopsIntervalMeters] = useState<number>(250);

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

  useEffect(() => {
    if (branchesList.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branchesList[0].id);
    }
  }, [branchesList, selectedBranchId]);

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
    if (!selectedBranchId) return;

    try {
      const res = await fetch('/v1/admin/table/route_shapes?limit=500');
      if (res.ok) {
        const data = await res.json();
        const rows = data.rows || [];
        const match = rows.find((r: any) => r.branch_id === selectedBranchId && r.direction === direction);
        if (match && match.coordinates_json) {
          try {
            const parsed = JSON.parse(match.coordinates_json);
            const formatted: [number, number][] = parsed.map((pt: any) => {
              if (Array.isArray(pt)) return [pt[0], pt[1]];
              if (typeof pt === 'object' && pt.lat && pt.lng) return [pt.lat, pt.lng];
              return pt;
            });

            setFullPolylinePath(formatted);
            const simplifiedControls = simplifyPolylineRdp(formatted, 0.2);
            setWaypoints(simplifiedControls);
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
      setRouteDistanceKm(0);
      setExistingShapeId(null);
    }

    try {
      const res = await fetch('/v1/admin/table/stops?limit=500');
      if (res.ok) {
        const data = await res.json();
        const rows = data.rows || [];
        const filtered = rows
          .filter((s: any) => s.branch_id === selectedBranchId && s.direction === direction)
          .sort((a: any, b: any) => (a.stop_order ?? 0) - (b.stop_order ?? 0));
        setStops(filtered);
      }
    } catch (_) {
      setStops([]);
    }
  }, [selectedBranchId, direction]);

  useEffect(() => {
    loadBranchData();
  }, [loadBranchData]);

  const displayPolylinePath = useMemo(() => {
    return fullPolylinePath.length > 0 ? fullPolylinePath : waypoints;
  }, [fullPolylinePath, waypoints]);

  const totalDistanceKm = useMemo(() => {
    return routeDistanceKm;
  }, [routeDistanceKm]);

  // 1. Clic en el mapa: Suma un punto de control al recorrido
  const handleAddWaypoint = async (pt: [number, number]) => {
    const updatedControls = [...waypoints, pt];
    setWaypoints(updatedControls);
    await updateFullPolylinePathFromControls(updatedControls);
  };

  // 2. Clic directo sobre la línea del recorrido: Inserta un punto de control intermedio
  const handleInsertPolylineWaypoint = async (clickPt: [number, number]) => {
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

    const updatedControls = [...waypoints];
    updatedControls.splice(insertIdx, 0, clickPt);
    setWaypoints(updatedControls);
    await updateFullPolylinePathFromControls(updatedControls);
    showNotification?.('success', `Punto intermedio insertado`);
  };

  // 3. Clic y mantener presionado (Drag & Drop) de un Waypoint de control
  const handleWaypointDragEnd = async (idx: number, newPt: [number, number]) => {
    const updatedControls = [...waypoints];
    updatedControls[idx] = newPt;
    setWaypoints(updatedControls);
    await updateFullPolylinePathFromControls(updatedControls);
    showNotification?.('success', `Punto #${idx + 1} movido`);
  };

  // 4. Clic y mantener presionado (Drag & Drop) de una Parada
  const handleStopDragEnd = (stopId: string, newPt: [number, number]) => {
    let projLat = newPt[0];
    let projLng = newPt[1];
    if (displayPolylinePath.length >= 2) {
      const proj = projectPointOnPolyline(newPt, displayPolylinePath);
      projLat = proj[0];
      projLng = proj[1];
    }
    setStops(prev => prev.map(st => st.id === stopId ? { ...st, lat: newPt[0], lng: newPt[1], proj_lat: projLat, proj_lng: projLng } : st));
    showNotification?.('success', 'Parada re-posicionada');
  };

  const handleUndoWaypoint = async () => {
    const updatedControls = waypoints.slice(0, -1);
    setWaypoints(updatedControls);
    await updateFullPolylinePathFromControls(updatedControls);
  };

  const handleClearWaypoints = () => {
    setWaypoints([]);
    setFullPolylinePath([]);
    setRouteDistanceKm(0);
  };

  const handleDeleteWaypointIndex = async (idx: number) => {
    const updatedControls = waypoints.filter((_, i) => i !== idx);
    setWaypoints(updatedControls);
    await updateFullPolylinePathFromControls(updatedControls);
  };

  const handleReverseRouteShape = async () => {
    if (waypoints.length < 2) {
      showNotification?.('error', 'Se requieren al menos 2 puntos para invertir el trazado');
      return;
    }
    const reversedControls = [...waypoints].reverse();
    setWaypoints(reversedControls);
    await updateFullPolylinePathFromControls(reversedControls);
    showNotification?.('success', 'Trazado invertido (ideal para configurar Vuelta)');
  };

  const handleAddStop = (pt: [number, number]) => {
    if (!selectedBranchId) return;

    let projLat = pt[0];
    let projLng = pt[1];
    if (displayPolylinePath.length >= 2) {
      const proj = projectPointOnPolyline(pt, displayPolylinePath);
      projLat = proj[0];
      projLng = proj[1];
    }

    const newOrder = stops.length + 1;
    const newStop: StopItem = {
      id: `stp_${selectedBranchId}_${direction}_${Date.now()}`,
      branch_id: selectedBranchId,
      direction: direction,
      stop_order: newOrder,
      name: `Parada ${newOrder}`,
      lat: pt[0],
      lng: pt[1],
      proj_lat: projLat,
      proj_lng: projLng
    };

    setStops(prev => [...prev, newStop]);
    showNotification?.('success', `Parada #${newOrder} añadida al mapa`);
  };

  const handleDeleteStop = (stopId: string) => {
    setStops(prev => {
      const remaining = prev.filter(s => s.id !== stopId);
      return remaining.map((s, idx) => ({ ...s, stop_order: idx + 1 }));
    });
    showNotification?.('success', 'Parada eliminada');
  };

  const handleReverseStops = () => {
    setStops(prev => {
      const reversed = [...prev].reverse();
      return reversed.map((s, idx) => ({ ...s, stop_order: idx + 1 }));
    });
    showNotification?.('success', 'Orden de paradas invertido');
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

  // 1. Tool Assistant: Replicar Paradas hacia otro Ramal
  const handleExecuteReplicateStops = async () => {
    if (!replicateTargetBranchId) {
      showNotification?.('error', 'Selecciona el ramal destino');
      return;
    }
    if (stops.length === 0) {
      showNotification?.('error', 'No hay paradas en el ramal origen para replicar');
      return;
    }

    try {
      for (const st of stops) {
        const payload = {
          id: `stp_${replicateTargetBranchId}_${replicateTargetDirection}_${Date.now()}_${st.stop_order}`,
          branch_id: replicateTargetBranchId,
          direction: replicateTargetDirection,
          stop_order: st.stop_order,
          name: st.name,
          lat: st.lat,
          lng: st.lng,
          proj_lat: st.proj_lat || st.lat,
          proj_lng: st.proj_lng || st.lng
        };

        await fetch('/v1/admin/table/stops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      await fetch('/v1/admin/cache/purge');
      showNotification?.('success', `¡${stops.length} paradas replicadas exitosamente!`);
      setShowReplicateModal(false);
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

    setStops(newStopsList);
    showNotification?.('success', `¡Se autogeneraron ${newStopsList.length} paradas a lo largo del trazado!`);
    setShowAutoStopsModal(false);
  };

  const handleSaveAll = async () => {
    if (!selectedBranchId) {
      showNotification?.('error', 'Selecciona un ramal');
      return;
    }

    setIsSaving(true);
    try {
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
          ? `/v1/admin/table/route_shapes/${encodeURIComponent(existingShapeId)}`
          : `/v1/admin/table/route_shapes`;
        const shapeMethod = existingShapeId ? 'PUT' : 'POST';

        await fetch(shapeUrl, {
          method: shapeMethod,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shapePayload)
        });
        setExistingShapeId(shapeId);
      }

      for (const stop of stops) {
        const stopPayload = {
          id: stop.id,
          branch_id: stop.branch_id,
          direction: stop.direction,
          stop_order: stop.stop_order,
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng,
          proj_lat: stop.proj_lat || stop.lat,
          proj_lng: stop.proj_lng || stop.lng
        };

        await fetch('/v1/admin/table/stops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stopPayload)
        });
      }

      await fetch('/v1/admin/cache/purge');
      showNotification?.('success', `¡Recorrido y ${stops.length} paradas guardados correctamente en D1!`);
    } catch (err: any) {
      showNotification?.('error', `Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBranchObj = useMemo(() => {
    return branchesList.find(b => b.id === selectedBranchId);
  }, [branchesList, selectedBranchId]);

  return (
    <div style={{ display: 'flex', gap: '1rem', height: 'calc(100vh - 120px)', width: '100%', position: 'relative' }}>
      
      {/* 1. LEFT SIDEBAR PANEL: Tree Explorer */}
      <div style={{
        width: '320px',
        backgroundColor: '#111827',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', backgroundColor: '#161e2e' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RouteIcon size={18} style={{ color: '#38bdf8' }} /> Editor de Recorridos
            </h2>
            <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>
              EDICIÓN ACTIVA
            </span>
          </div>

          {/* Quick Actions Bar */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              style={{
                flex: 1,
                padding: '0.5rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <Save size={14} /> Guardar
            </button>
            <button
              onClick={loadBranchData}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Descartar
            </button>
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
              color: '#38bdf8',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              borderBottom: '2px solid #38bdf8'
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
              color: '#9ca3af',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            🚏 Paradas ({stops.length})
          </button>
        </div>

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
                {/* Group Title */}
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

                {/* Branch Cards */}
                {isExpanded && groupItems.map(b => {
                  const isSelected = b.id === selectedBranchId;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBranchId(b.id)}
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: '10px',
                        backgroundColor: isSelected ? '#1e293b' : 'transparent',
                        border: isSelected ? '1px solid #0284c7' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isSelected ? '#38bdf8' : '#6b7280' }} />
                          <span style={{ fontWeight: 600, fontSize: '0.82rem', color: isSelected ? '#ffffff' : '#e5e7eb' }}>
                            {b.code ? `${b.code} - ${b.name}` : b.name}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '0.65rem',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: 600
                        }}>
                          PUBLICADO
                        </span>
                      </div>

                      {isSelected && (
                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                          <button
                            onClick={e => { e.stopPropagation(); setDirection('ida'); }}
                            style={{
                              flex: 1,
                              padding: '0.25rem 0.4rem',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: direction === 'ida' ? '#0284c7' : '#334155',
                              color: '#ffffff',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            + {b.direction_ida_label || 'Ida'}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDirection('vuelta'); }}
                            style={{
                              flex: 1,
                              padding: '0.25rem 0.4rem',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: direction === 'vuelta' ? '#0284c7' : '#334155',
                              color: '#ffffff',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            + {b.direction_vuelta_label || 'Vuelta'}
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
              {direction.toUpperCase()} ({direction === 'ida' ? (selectedBranchObj?.direction_ida_label || 'Ida') : (selectedBranchObj?.direction_vuelta_label || 'Vuelta')})
            </span>

            {isRouting && (
              <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                🛣️ Ruteando por calles...
              </span>
            )}
          </div>

          {/* Map Editing Tools & Assistants */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Street Routing OSRM Toggle */}
            <button
              onClick={() => setUseStreetRouting(!useStreetRouting)}
              title="Alternar entre Ruteo por calles (OSRM) o Línea recta directa"
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

            <button
              onClick={() => setActiveTool(activeTool === 'add_stop' ? 'none' : 'add_stop')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: activeTool === 'add_stop' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: activeTool === 'add_stop' ? 'rgba(56, 189, 248, 0.15)' : '#1f2937',
                color: activeTool === 'add_stop' ? '#38bdf8' : '#9ca3af',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <MapPin size={14} />
              <span>{activeTool === 'add_stop' ? '🚏 Agregar Paradas ACTIVO' : '🚏 Agregar Parada'}</span>
            </button>

            {/* Assistant 1: Auto-generate Stops Wizard */}
            <button
              onClick={() => setShowAutoStopsModal(true)}
              title="Autogenerar paradas cada X metros"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: '#a78bfa',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Wand2 size={14} />
              <span>Auto-Paradas</span>
            </button>

            {/* Assistant 2: Replicate Stops to another Branch */}
            <button
              onClick={() => setShowReplicateModal(true)}
              title="Replicar paradas a otro ramal"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                backgroundColor: 'rgba(14, 165, 233, 0.15)',
                color: '#38bdf8',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Copy size={14} />
              <span>Replicar</span>
            </button>

            {/* Assistant 3: Invert & Create Vuelta Shape */}
            <button
              onClick={handleReverseRouteShape}
              title="Invertir trazado para crear la Vuelta"
              style={{
                padding: '0.45rem 0.65rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: '#1f2937',
                color: '#f3f4f6',
                cursor: 'pointer'
              }}
            >
              <GitCompare size={14} />
            </button>

            <button
              onClick={handleUndoWaypoint}
              disabled={waypoints.length === 0}
              title="Deshacer último punto del trazado"
              style={{
                padding: '0.45rem 0.65rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: '#1f2937',
                color: waypoints.length === 0 ? '#4b5563' : '#f3f4f6',
                cursor: waypoints.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <Undo size={14} />
            </button>

            <button
              onClick={handleClearWaypoints}
              disabled={waypoints.length === 0}
              title="Limpiar trazado"
              style={{
                padding: '0.45rem 0.65rem',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: waypoints.length === 0 ? '#4b5563' : '#ef4444',
                cursor: waypoints.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <Trash2 size={14} />
            </button>

            <button
              onClick={() => setShowRightDock(!showRightDock)}
              title="Alternar dock flotante"
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

            <MapFocusController focusCoords={focusCoords} />
            <MapClickHandler activeTool={activeTool} onAddWaypoint={handleAddWaypoint} onAddStop={handleAddStop} />

            {/* Interactive Polyline: Continuous OSRM street route shape */}
            {displayPolylinePath.length > 1 && (
              <Polyline
                positions={displayPolylinePath}
                eventHandlers={{
                  click(e) {
                    L.DomEvent.stopPropagation(e.originalEvent);
                    handleInsertPolylineWaypoint([e.latlng.lat, e.latlng.lng]);
                  }
                }}
                pathOptions={{
                  color: direction === 'ida' ? '#0284c7' : '#e11d48',
                  weight: 7,
                  opacity: 0.85,
                  dashArray: activeTool === 'draw_route' ? '6, 8' : undefined
                }}
              />
            )}

            {/* Control Waypoint Markers: ONLY render the key control handles (5-15 max, zero clutter!) */}
            {waypoints.map((pt, idx) => {
              const isStart = idx === 0;
              const isEnd = idx === waypoints.length - 1 && waypoints.length > 1;

              return (
                <Marker
                  key={`wpt_control_marker_${idx}`}
                  position={pt}
                  draggable={true}
                  icon={createWaypointIcon(isStart, isEnd)}
                  eventHandlers={{
                    dragend(e: any) {
                      const newLat = e.target.getLatLng().lat;
                      const newLng = e.target.getLatLng().lng;
                      handleWaypointDragEnd(idx, [newLat, newLng]);
                    }
                  }}
                >
                  <Popup>
                    <div style={{ color: '#111827', fontSize: '0.8rem', fontWeight: 600 }}>
                      {isStart ? '🚩 Inicio (Cabecera A)' : isEnd ? '🏁 Fin (Cabecera B)' : `Punto de Control ${idx + 1}`}
                      <br />
                      <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Arrastra para re-rutar las calles</span>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Stop Draggable Markers: Paradas en mapa */}
            {stops.map(st => (
              <Marker
                key={`stop_marker_${st.id}`}
                position={[st.lat, st.lng]}
                draggable={true}
                icon={createStopIcon()}
                eventHandlers={{
                  dragend(e: any) {
                    const newLat = e.target.getLatLng().lat;
                    const newLng = e.target.getLatLng().lng;
                    handleStopDragEnd(st.id, [newLat, newLng]);
                  }
                }}
              >
                <Popup>
                  <div style={{ color: '#111827', fontSize: '0.8rem', fontWeight: 600 }}>
                    {st.stop_order}. {st.name}
                    <br />
                    <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Arrastra para re-posicionar parada</span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

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

                {/* Top Bar Switcher: Paradas (MapPin) | Recorrido (RouteIcon) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#0f172a', padding: '0.2rem 0.5rem', borderRadius: '8px' }}>
                  <button
                    onClick={() => setRightDockTab('paradas')}
                    title="Editar Paradas"
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
                    onClick={() => setRightDockTab('recorrido')}
                    title="Editar Recorrido / Trazado"
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
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rightDockTab === 'paradas' ? 'Paradas' : 'Recorrido'}: {selectedBranchObj ? (selectedBranchObj.name || selectedBranchObj.code) : 'Ramal'}
                </span>
                <span style={{ fontSize: '0.75rem', backgroundColor: '#0284c7', color: '#ffffff', padding: '0.15rem 0.55rem', borderRadius: '6px', fontWeight: 800 }}>
                  {rightDockTab === 'paradas' ? stops.length : waypoints.length}
                </span>
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
                  IDA ({direction === 'ida' ? (rightDockTab === 'paradas' ? stops.length : waypoints.length) : 0})
                </button>
                <button
                  onClick={() => setDirection('vuelta')}
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
                  VUELTA ({direction === 'vuelta' ? (rightDockTab === 'paradas' ? stops.length : waypoints.length) : 0})
                </button>
              </div>

              {/* TAB CONTENT: PARADAS LIST vs RECORRIDO CONTROL WAYPOINTS LIST */}
              {rightDockTab === 'paradas' ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {stops.length === 0 ? (
                    <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                      <MapPin size={28} style={{ margin: '0 auto 0.5rem', color: '#475569' }} />
                      No hay paradas en {direction.toUpperCase()}.<br />
                      Activa <strong>🚏 Agregar Parada</strong> e ir tocando el mapa.
                    </div>
                  ) : (
                    stops.map((st) => (
                      <div
                        key={st.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '8px',
                          backgroundColor: '#131b2e',
                          border: '1px solid rgba(255, 255, 255, 0.04)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
                          <div style={{ color: '#475569', fontSize: '0.75rem', cursor: 'grab', userSelect: 'none' }}>::</div>

                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', minWidth: '22px' }}>
                            {st.stop_order}.
                          </span>

                          {editingStopId === st.id ? (
                            <input
                              type="text"
                              value={editingStopName}
                              onChange={e => setEditingStopName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  setStops(prev => prev.map(s => s.id === st.id ? { ...s, name: editingStopName } : s));
                                  setEditingStopId(null);
                                }
                              }}
                              style={{
                                backgroundColor: '#070d19',
                                color: '#ffffff',
                                border: '1px solid #38bdf8',
                                borderRadius: '4px',
                                padding: '0.2rem 0.4rem',
                                fontSize: '0.78rem',
                                flex: 1
                              }}
                            />
                          ) : (
                            <span
                              onClick={() => { setEditingStopId(st.id); setEditingStopName(st.name); }}
                              style={{ fontSize: '0.8rem', color: '#f1f5f9', fontWeight: 500, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {st.name}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            onClick={() => setFocusCoords([st.lat, st.lng])}
                            title="Centrar en mapa"
                            style={{ backgroundColor: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '2px' }}
                          >
                            <Search size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteStop(st.id)}
                            title="Eliminar parada"
                            style={{ backgroundColor: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))
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
                      return (
                        <div
                          key={`wpt_${idx}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.55rem 0.75rem',
                            borderRadius: '8px',
                            backgroundColor: '#131b2e',
                            border: '1px solid rgba(255, 255, 255, 0.04)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isStart ? '#10b981' : isEnd ? '#ef4444' : '#38bdf8', minWidth: '22px' }}>
                              {idx + 1}.
                            </span>
                            <span style={{ fontSize: '0.78rem', color: '#f1f5f9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isStart ? '🚩 Inicio (Cabecera A)' : isEnd ? '🏁 Fin (Cabecera B)' : `Punto ${idx + 1}`} ({pt[0].toFixed(4)}, {pt[1].toFixed(4)})
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              onClick={() => setFocusCoords(pt)}
                              title="Centrar punto en mapa"
                              style={{ backgroundColor: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '2px' }}
                            >
                              <Search size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteWaypointIndex(idx)}
                              title="Eliminar punto"
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
              )}

              {/* BOTTOM TOOLBAR GRID */}
              {rightDockTab === 'paradas' ? (
                <div style={{
                  padding: '0.6rem 0.75rem',
                  backgroundColor: '#070d19',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: '0.35rem'
                }}>
                  <button
                    onClick={() => setActiveTool('add_stop')}
                    title="Agregar Parada"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => showNotification?.('success', 'Modo posicionamiento de paradas activado')}
                    title="Posicionar Paradas"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <MapPin size={14} />
                  </button>
                  <button
                    onClick={handleReverseStops}
                    title="Invertir secuencia de paradas"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ArrowUpDown size={14} />
                  </button>
                  <button
                    onClick={handleProjectStopsOnRoute}
                    title="Ordenar por distancia"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: '#b45309', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Compass size={14} />
                  </button>
                  <button
                    onClick={handleProjectStopsOnRoute}
                    title="Auto-proyectar paradas sobre el trazado"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: '#0d9488', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Search size={14} />
                  </button>
                  <button
                    onClick={() => setShowReplicateModal(true)}
                    title="Replicar paradas a otro ramal"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => setShowAutoStopsModal(true)}
                    title="Autogenerar paradas por distancia"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: '#8b5cf6', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Wand2 size={14} />
                  </button>
                  <button
                    onClick={handleClearAllStops}
                    title="Eliminar todas las paradas"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '0.35rem'
                }}>
                  <button
                    onClick={() => setUseStreetRouting(!useStreetRouting)}
                    title={useStreetRouting ? 'Desactivar ruteo OSRM por calles' : 'Activar ruteo OSRM por calles'}
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: useStreetRouting ? '#10b981' : '#0284c7', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Navigation size={14} />
                  </button>
                  <button
                    onClick={handleUndoWaypoint}
                    disabled={waypoints.length === 0}
                    title="Deshacer último punto"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: waypoints.length === 0 ? '#334155' : '#0284c7', color: 'white', cursor: waypoints.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Undo size={14} />
                  </button>
                  <button
                    onClick={handleClearWaypoints}
                    disabled={waypoints.length === 0}
                    title="Limpiar todo el trazado"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: waypoints.length === 0 ? '#334155' : '#dc2626', color: 'white', cursor: waypoints.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={handleSaveAll}
                    disabled={isSaving}
                    title="Guardar trazado a D1"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Save size={14} />
                  </button>
                  <button
                    onClick={handleReverseRouteShape}
                    title="Invertir sentido del trazado"
                    style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: '#8b5cf6', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
    </div>
  );
}
