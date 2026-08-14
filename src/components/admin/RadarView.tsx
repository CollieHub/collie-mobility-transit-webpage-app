import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Route as RouteIcon,
  Trash2,
  Undo,
  Save,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const startIcon = L.divIcon({
  className: 'custom-start-marker',
  html: `<div style="background-color: #10b981; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">A</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const endIcon = L.divIcon({
  className: 'custom-end-marker',
  html: `<div style="background-color: #ef4444; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">B</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const waypointIcon = L.divIcon({
  className: 'custom-waypoint-marker',
  html: `<div style="background-color: #38bdf8; color: #111827; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">•</div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
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

function MapClickHandler({ isDrawing, onMapClick }: { isDrawing: boolean; onMapClick: (latlng: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      if (isDrawing) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

interface RadarViewProps {
  linesList?: any[];
  branchesList?: any[];
  showNotification?: (type: 'success' | 'error', message: string) => void;
}

export default function RadarView({ linesList = [], branchesList = [], showNotification }: RadarViewProps) {
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [direction, setDirection] = useState<'ida' | 'vuelta'>('ida');
  
  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [existingShapeId, setExistingShapeId] = useState<string | null>(null);

  useEffect(() => {
    if (linesList.length > 0 && !selectedLineId) {
      setSelectedLineId(linesList[0].id);
    }
  }, [linesList, selectedLineId]);

  const filteredBranches = useMemo(() => {
    if (!selectedLineId) return branchesList;
    return branchesList.filter(b => b.line_id === selectedLineId || b.company_id === selectedLineId);
  }, [branchesList, selectedLineId]);

  useEffect(() => {
    if (filteredBranches.length > 0) {
      if (!filteredBranches.some(b => b.id === selectedBranchId)) {
        setSelectedBranchId(filteredBranches[0].id);
      }
    } else {
      setSelectedBranchId('');
    }
  }, [filteredBranches, selectedBranchId]);

  const fetchExistingShape = useCallback(async () => {
    if (!selectedBranchId) {
      setWaypoints([]);
      setExistingShapeId(null);
      return;
    }
    try {
      const res = await fetch(`/v1/admin/table/route_shapes?limit=500`);
      if (res.ok) {
        const data = await res.json();
        const rows = data.rows || [];
        const match = rows.find((r: any) => r.branch_id === selectedBranchId && r.direction === direction);
        if (match && match.coordinates_json) {
          try {
            const parsed = JSON.parse(match.coordinates_json);
            if (Array.isArray(parsed)) {
              const formatted: [number, number][] = parsed.map((pt: any) => {
                if (Array.isArray(pt)) return [pt[0], pt[1]];
                if (typeof pt === 'object' && pt.lat && pt.lng) return [pt.lat, pt.lng];
                return pt;
              });
              setWaypoints(formatted);
              setExistingShapeId(match.id);
              return;
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
    setWaypoints([]);
    setExistingShapeId(null);
  }, [selectedBranchId, direction]);

  useEffect(() => {
    fetchExistingShape();
  }, [fetchExistingShape]);

  const totalDistanceKm = useMemo(() => {
    if (waypoints.length < 2) return 0;
    let sum = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      sum += calculateDistanceKm(waypoints[i][0], waypoints[i][1], waypoints[i + 1][0], waypoints[i + 1][1]);
    }
    return Math.round(sum * 100) / 100;
  }, [waypoints]);

  const handleMapClick = (point: [number, number]) => {
    setWaypoints(prev => [...prev, point]);
  };

  const handleUndo = () => {
    setWaypoints(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setWaypoints([]);
  };

  const handleSaveShape = async () => {
    if (!selectedBranchId) {
      showNotification?.('error', 'Selecciona un ramal para guardar el trazado');
      return;
    }
    if (waypoints.length < 2) {
      showNotification?.('error', 'Marca al menos 2 puntos en el mapa para crear el recorrido');
      return;
    }

    setIsSaving(true);
    const shapeId = existingShapeId || `shp_${selectedBranchId}_${direction}_${Date.now()}`;
    const payload = {
      id: shapeId,
      branch_id: selectedBranchId,
      direction: direction,
      coordinates_json: JSON.stringify(waypoints),
      total_distance_km: totalDistanceKm
    };

    try {
      const url = existingShapeId 
        ? `/v1/admin/table/route_shapes/${encodeURIComponent(existingShapeId)}`
        : `/v1/admin/table/route_shapes`;
      const method = existingShapeId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success || res.ok) {
        showNotification?.('success', `Trazado de recorrido (${direction.toUpperCase()}) guardado en D1 con éxito! (${waypoints.length} puntos, ${totalDistanceKm} km)`);
        setExistingShapeId(shapeId);
        fetch('/v1/admin/cache/purge').catch(() => {});
      } else {
        showNotification?.('error', data.error || 'Error al guardar el trazado');
      }
    } catch (err: any) {
      showNotification?.('error', `Error de conexión: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBranchObj = useMemo(() => {
    return branchesList.find(b => b.id === selectedBranchId);
  }, [branchesList, selectedBranchId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'calc(100vh - 120px)' }}>
      {/* Controls Bar */}
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Line & Branch Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', flex: '1 1 500px' }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 600 }}>Línea</label>
            <select
              value={selectedLineId}
              onChange={e => setSelectedLineId(e.target.value)}
              style={{
                backgroundColor: '#1f2937',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
            >
              {linesList.map(l => (
                <option key={l.id} value={l.id}>
                  Línea {l.code} - {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 600 }}>Ramal</label>
            <select
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
              style={{
                backgroundColor: '#1f2937',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
            >
              {filteredBranches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.code ? `${b.code} - ${b.name}` : b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 600 }}>Sentido</label>
            <div style={{ display: 'flex', backgroundColor: '#1f2937', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                type="button"
                onClick={() => setDirection('ida')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: direction === 'ida' ? '#0284c7' : 'transparent',
                  color: direction === 'ida' ? '#ffffff' : '#9ca3af',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Ida ({selectedBranchObj?.direction_ida_label || 'Ida'})
              </button>
              <button
                type="button"
                onClick={() => setDirection('vuelta')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: direction === 'vuelta' ? '#0284c7' : 'transparent',
                  color: direction === 'vuelta' ? '#ffffff' : '#9ca3af',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Vuelta ({selectedBranchObj?.direction_vuelta_label || 'Vuelta'})
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={() => setIsDrawing(!isDrawing)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 0.9rem',
              borderRadius: '8px',
              border: isDrawing ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: isDrawing ? 'rgba(56, 189, 248, 0.15)' : '#1f2937',
              color: isDrawing ? '#38bdf8' : '#9ca3af',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Compass size={15} />
            <span>{isDrawing ? 'Modo Dibujar ACTIVO' : 'Modo Dibujar Inactivo'}</span>
          </button>

          <button
            type="button"
            onClick={handleUndo}
            disabled={waypoints.length === 0}
            title="Deshacer último punto"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.55rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: '#1f2937',
              color: waypoints.length === 0 ? '#4b5563' : '#f3f4f6',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: waypoints.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Undo size={14} />
            <span>Deshacer</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={waypoints.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.55rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: waypoints.length === 0 ? '#4b5563' : '#ef4444',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: waypoints.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Trash2 size={14} />
            <span>Limpiar</span>
          </button>

          <button
            type="button"
            onClick={handleSaveShape}
            disabled={isSaving || waypoints.length < 2}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: waypoints.length >= 2 ? '#10b981' : '#374151',
              color: waypoints.length >= 2 ? '#ffffff' : '#9ca3af',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: (isSaving || waypoints.length < 2) ? 'not-allowed' : 'pointer',
              boxShadow: waypoints.length >= 2 ? '0 4px 12px rgba(16, 185, 129, 0.25)' : 'none'
            }}
          >
            <Save size={15} />
            <span>{isSaving ? 'Guardando...' : 'Guardar Recorrido'}</span>
          </button>
        </div>
      </div>

      {/* Main Map & Side Details */}
      <div style={{ flex: 1, display: 'flex', gap: '1rem', position: 'relative', overflow: 'hidden', borderRadius: '16px' }}>
        {/* Leaflet Map Canvas */}
        <div style={{ flex: 1, height: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <MapContainer
            center={waypoints.length > 0 ? waypoints[0] : ZARATE_CENTER}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              maxZoom={19}
            />

            <MapClickHandler isDrawing={isDrawing} onMapClick={handleMapClick} />

            {waypoints.length > 1 && (
              <Polyline
                positions={waypoints}
                pathOptions={{
                  color: direction === 'ida' ? '#0284c7' : '#e11d48',
                  weight: 5,
                  opacity: 0.85,
                  dashArray: isDrawing ? '6, 8' : undefined
                }}
              />
            )}

            {waypoints.map((pt, idx) => {
              const isStart = idx === 0;
              const isEnd = idx === waypoints.length - 1 && waypoints.length > 1;
              const radius = isStart || isEnd ? 6 : 3.5;
              const fillColor = isStart ? '#10b981' : isEnd ? '#ef4444' : '#38bdf8';

              return (
                <CircleMarker
                  key={idx}
                  center={pt}
                  radius={radius}
                  pathOptions={{
                    color: '#ffffff',
                    weight: isStart || isEnd ? 2 : 1,
                    fillColor: fillColor,
                    fillOpacity: 1
                  }}
                >
                  <Popup>
                    <div style={{ color: '#111827', fontSize: '0.8rem', fontWeight: 600 }}>
                      {isStart ? '🚩 Inicio de Recorrido (Punto 1)' : isEnd ? '🏁 Fin de Recorrido' : `Punto ${idx + 1}`}
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '4px' }}>
                        Lat: {pt[0].toFixed(5)}, Lng: {pt[1].toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        {/* Floating Side Details Panel */}
        <div style={{
          width: '280px',
          backgroundColor: '#111827',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ffffff', fontWeight: 700, fontSize: '0.95rem' }}>
            <RouteIcon size={18} style={{ color: '#38bdf8' }} />
            <span>Resumen del Recorrido</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ backgroundColor: '#1f2937', padding: '0.85rem', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Distancia Total Aprox.</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>
                {totalDistanceKm} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>km</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#1f2937', padding: '0.85rem', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Puntos Clickeados</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
                {waypoints.length} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>puntos</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#1f2937', padding: '0.85rem', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Estado de Guardado</span>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: existingShapeId ? '#38bdf8' : '#f59e0b', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {existingShapeId ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <span>{existingShapeId ? 'Trazado Existente en D1' : 'Trazado Nuevo sin Guardar'}</span>
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '10px',
            padding: '0.85rem',
            fontSize: '0.75rem',
            color: '#93c5fd',
            lineHeight: '1.4'
          }}>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8' }}>
              <Info size={14} /> Instrucciones de Uso:
            </div>
            1. Asegúrate de tener el <strong>Modo Dibujar ACTIVO</strong>.<br />
            2. Haz clic sobre el mapa para ir trazando el camino del ramal.<br />
            3. Usa <strong>Deshacer</strong> si te equivocas de punto.<br />
            4. Presiona <strong>Guardar Recorrido</strong> para persisitir el trazado en Cloudflare D1.
          </div>
        </div>
      </div>
    </div>
  );
}
