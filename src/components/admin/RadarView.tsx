import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Tooltip, useMapEvents, useMap } from 'react-leaflet';
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
  Layers
} from 'lucide-react';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ZARATE_CENTER: [number, number] = [-34.0970, -59.0300];

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
      if (activeTool === 'draw_route') {
        onAddWaypoint([e.latlng.lat, e.latlng.lng]);
      } else if (activeTool === 'add_stop') {
        onAddStop([e.latlng.lat, e.latlng.lng]);
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
  const [sidebarSearch, setSidebarSearch] = useState<string>('');
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({ SIT: true, all: true });

  const [activeTool, setActiveTool] = useState<'none' | 'draw_route' | 'add_stop'>('none');

  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  const [existingShapeId, setExistingShapeId] = useState<string | null>(null);

  const [stops, setStops] = useState<StopItem[]>([]);
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [editingStopName, setEditingStopName] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [focusCoords, setFocusCoords] = useState<[number, number] | null>(null);
  const [showRightDock, setShowRightDock] = useState<boolean>(true);

  const groupedBranches = useMemo(() => {
    const groups: Record<string, any[]> = {};
    branchesList.forEach(b => {
      let key = 'SIT';
      if (b.line_id && b.line_id.includes('campana')) key = 'Campana';
      else if (b.line_id && b.line_id.includes('san_nicolas')) key = 'San Nicolás';
      else if (b.code && b.code.startsWith('228')) key = 'Metropolitana';
      else if (b.company_id) key = b.company_id;

      if (sidebarSearch) {
        const q = sidebarSearch.toLowerCase();
        if (!(b.code || '').toLowerCase().includes(q) && !(b.name || '').toLowerCase().includes(q)) {
          return;
        }
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    });
    return groups;
  }, [branchesList, sidebarSearch]);

  useEffect(() => {
    if (branchesList.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branchesList[0].id);
    }
  }, [branchesList, selectedBranchId]);

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
            setWaypoints(formatted);
            setExistingShapeId(match.id);
          } catch (_) {
            setWaypoints([]);
            setExistingShapeId(null);
          }
        } else {
          setWaypoints([]);
          setExistingShapeId(null);
        }
      }
    } catch (_) {
      setWaypoints([]);
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

  const totalDistanceKm = useMemo(() => {
    if (waypoints.length < 2) return 0;
    let sum = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      sum += calculateDistanceKm(waypoints[i][0], waypoints[i][1], waypoints[i + 1][0], waypoints[i + 1][1]);
    }
    return Math.round(sum * 100) / 100;
  }, [waypoints]);

  const handleAddWaypoint = (pt: [number, number]) => {
    setWaypoints(prev => [...prev, pt]);
  };

  const handleUndoWaypoint = () => {
    setWaypoints(prev => prev.slice(0, -1));
  };

  const handleClearWaypoints = () => {
    setWaypoints([]);
  };

  const handleAddStop = (pt: [number, number]) => {
    if (!selectedBranchId) return;

    let projLat = pt[0];
    let projLng = pt[1];
    if (waypoints.length >= 2) {
      const proj = projectPointOnPolyline(pt, waypoints);
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
    if (waypoints.length < 2) {
      showNotification?.('error', 'Crea o carga un trazado primero para proyectar las paradas');
      return;
    }
    setStops(prev => {
      return prev.map(s => {
        const proj = projectPointOnPolyline([s.lat, s.lng], waypoints);
        return { ...s, proj_lat: proj[0], proj_lng: proj[1] };
      });
    });
    showNotification?.('success', `${stops.length} paradas proyectadas sobre el trazado`);
  };

  const handleClearAllStops = () => {
    setStops([]);
    showNotification?.('success', 'Todas las paradas eliminadas');
  };

  const handleSaveAll = async () => {
    if (!selectedBranchId) {
      showNotification?.('error', 'Selecciona un ramal');
      return;
    }

    setIsSaving(true);
    try {
      if (waypoints.length >= 2) {
        const shapeId = existingShapeId || `shp_${selectedBranchId}_${direction}_${Date.now()}`;
        const shapePayload = {
          id: shapeId,
          branch_id: selectedBranchId,
          direction: direction,
          coordinates_json: JSON.stringify(waypoints),
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

        {/* Filter Input */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input
              type="text"
              placeholder="Filtrar líneas y ramales..."
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.5rem 0.45rem 2rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: '#1f2937',
                color: '#ffffff',
                fontSize: '0.8rem'
              }}
            />
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
          {/* Active Branch Info */}
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
          </div>

          {/* Map Editing Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTool(activeTool === 'draw_route' ? 'none' : 'draw_route')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: activeTool === 'draw_route' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: activeTool === 'draw_route' ? 'rgba(56, 189, 248, 0.15)' : '#1f2937',
                color: activeTool === 'draw_route' ? '#38bdf8' : '#9ca3af',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Compass size={14} />
              <span>{activeTool === 'draw_route' ? '✏️ Modo Dibujar Recorrido ACTIVO' : '✏️ Dibujar Recorrido'}</span>
            </button>

            <button
              onClick={() => setActiveTool(activeTool === 'add_stop' ? 'none' : 'add_stop')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: activeTool === 'add_stop' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: activeTool === 'add_stop' ? 'rgba(16, 185, 129, 0.15)' : '#1f2937',
                color: activeTool === 'add_stop' ? '#10b981' : '#9ca3af',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <MapPin size={14} />
              <span>{activeTool === 'add_stop' ? '🚏 Modo Agregar Parada ACTIVO' : '🚏 Agregar Parada'}</span>
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
              title="Alternar dock flotante de paradas"
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
            center={waypoints.length > 0 ? waypoints[0] : ZARATE_CENTER}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              maxZoom={19}
            />

            <MapFocusController focusCoords={focusCoords} />
            <MapClickHandler activeTool={activeTool} onAddWaypoint={handleAddWaypoint} onAddStop={handleAddStop} />

            {/* Polyline path for Route Shape */}
            {waypoints.length > 1 && (
              <Polyline
                positions={waypoints}
                pathOptions={{
                  color: direction === 'ida' ? '#0284c7' : '#e11d48',
                  weight: 5,
                  opacity: 0.85,
                  dashArray: activeTool === 'draw_route' ? '6, 8' : undefined
                }}
              />
            )}

            {/* Start (A) & End (B) Route Markers */}
            {waypoints.map((pt, idx) => {
              const isStart = idx === 0;
              const isEnd = idx === waypoints.length - 1 && waypoints.length > 1;

              // Ocultar totalmente los puntos intermedios
              if (!isStart && !isEnd) return null;

              return (
                <CircleMarker
                  key={`pt_${idx}`}
                  center={pt}
                  radius={6}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: isStart ? '#10b981' : '#ef4444',
                    fillOpacity: 1
                  }}
                >
                  <Popup>
                    <div style={{ color: '#111827', fontSize: '0.8rem', fontWeight: 600 }}>
                      {isStart ? '🚩 Inicio de Recorrido (Punto 1)' : '🏁 Fin de Recorrido'}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Stop Markers on Map */}
            {stops.map(st => (
              <CircleMarker
                key={st.id}
                center={[st.lat, st.lng]}
                radius={7}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: '#3b82f6',
                  fillOpacity: 1
                }}
              >
                <Tooltip permanent direction="top" offset={[0, -8]} opacity={0.9}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a' }}>
                    {st.stop_order}. {st.name}
                  </span>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>

          {/* 3. RIGHT FLOATING WIDGET DOCK (EXACT REPLICA FROM SCREENSHOT) */}
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
                  onClick={handleClearAllStops}
                  title="Eliminar todas las paradas"
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#0f172a', padding: '0.2rem 0.5rem', borderRadius: '8px' }}>
                  <button
                    style={{
                      backgroundColor: '#1e293b',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.35rem 0.5rem',
                      color: '#38bdf8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <MapPin size={15} />
                  </button>
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
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Paradas: {selectedBranchObj ? (selectedBranchObj.name || selectedBranchObj.code) : 'Ramal'}
                </span>
                <span style={{ fontSize: '0.75rem', backgroundColor: '#0284c7', color: '#ffffff', padding: '0.15rem 0.55rem', borderRadius: '6px', fontWeight: 800 }}>
                  {stops.length}
                </span>
              </div>

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
                  IDA ({stops.filter(s => s.direction === 'ida').length})
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
                  VUELTA ({stops.filter(s => s.direction === 'vuelta').length})
                </button>
              </div>

              {/* STOPS LIST */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {stops.length === 0 ? (
                  <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                    <MapPin size={28} style={{ margin: '0 auto 0.5rem', color: '#475569' }} />
                    No hay paradas en {direction.toUpperCase()}.<br />
                    Usa el botón <strong>+</strong> inferior para sumar paradas sobre el mapa.
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
                        {/* Drag Handle Icon */}
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

              {/* BOTTOM TOOLBAR GRID (8 exact icons from screenshot) */}
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
                  onClick={() => showNotification?.('success', 'Paradas duplicadas')}
                  title="Duplicar paradas"
                  style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Layers size={14} />
                </button>
                <button
                  onClick={() => showNotification?.('success', 'Modo edición masiva')}
                  title="Edición masiva de paradas"
                  style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={handleClearAllStops}
                  title="Eliminar todas las paradas"
                  style={{ padding: '0.45rem', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
