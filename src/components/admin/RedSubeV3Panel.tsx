import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bus, Search, CheckSquare, Square, Clock, Sparkles, LocateFixed } from 'lucide-react';

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

export function getBranchColor(codeOrName: string, index: number = 0): string {
  if (!codeOrName) return ROUTE_COLORS_PALETTE[index % ROUTE_COLORS_PALETTE.length];
  
  const match = codeOrName.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (num <= 20) {
      return ROUTE_COLORS_PALETTE[(num - 1) % ROUTE_COLORS_PALETTE.length];
    }
  }
  
  let hash = 0;
  for (let i = 0; i < codeOrName.length; i++) {
    hash = codeOrName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hashIdx = (Math.abs(hash) + index) % ROUTE_COLORS_PALETTE.length;
  return ROUTE_COLORS_PALETTE[hashIdx];
}

export interface V3Route {
  ramal: string;
  name: string;
  headsignIda?: string;
  headsignVuelta?: string;
  color?: string;
  unitsCount?: number;
}

interface RedSubeV3PanelProps {
  onRouteToggle?: (ramal: string, isChecked: boolean, routeData: V3Route) => void;
  onSelectDirection?: (ramal: string, direction: 'ida' | 'vuelta') => void;
  onFocusRoute?: (ramal: string, routeData: V3Route) => void;
  onUnitsUpdate?: (vehicles: any[]) => void;
  showNotification?: (type: 'success' | 'error', msg: string) => void;
  currentDirection?: 'ida' | 'vuelta';
  activeRamal?: string;
  mapBounds?: any;
}

export default function RedSubeV3Panel({
  onRouteToggle,
  onSelectDirection,
  onFocusRoute,
  onUnitsUpdate,
  showNotification,
  currentDirection,
  activeRamal,
  mapBounds
}: RedSubeV3PanelProps) {
  const [unitsLimit, setUnitsLimit] = useState<number>(100);
  const [unitsMode, setUnitsMode] = useState<'ramal' | 'free'>('free');
  const [selectedCompany, setSelectedCompany] = useState<string>('TODAS');
  const [companies, setCompanies] = useState<any[]>([
    { id: 'TODAS', name: '— Todas las Líneas Activas —' },
    { id: '228', name: 'Línea 228 (LA NUEVA METROPOL S.A. (Línea 194))' },
    { id: '194', name: 'Línea 194 (LA NUEVA METROPOL S.A. (Línea 194))' },
    { id: '204', name: 'Línea 204 (LINEA 204 S.A.)' },
    { id: 'SIT', name: 'SIT (Servicio Integral Zárate)' },
    { id: '314', name: 'Línea 314 (La Primera de Martínez S.A.)' }
  ]);
  const [routes, setRoutes] = useState<V3Route[]>([]);
  const [activeUnitsCount, setActiveUnitsCount] = useState<number>(0);
  const [selectedRamales, setSelectedRamales] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const [correctedVersions, setCorrectedVersions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const allVehiclesCacheRef = useRef<any[]>([]);

  const onRouteToggleRef = useRef(onRouteToggle);
  onRouteToggleRef.current = onRouteToggle;

  const onUnitsUpdateRef = useRef(onUnitsUpdate);
  onUnitsUpdateRef.current = onUnitsUpdate;

  // Fetch Companies
  useEffect(() => {
    fetch('/v1/redsube/lines')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.companies)) {
          // Asegurar que TODAS esté siempre al inicio
          const hasTodas = data.companies.some((c: any) => c.id === 'TODAS');
          const finalComps = hasTodas 
            ? data.companies 
            : [{ id: 'TODAS', name: '— Todas las Líneas Activas —' }, ...data.companies];
          setCompanies(finalComps);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Routes for selected company
  const loadRoutes = useCallback(async (comp: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/v1/redsube/line-routes?company=${encodeURIComponent(comp)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.routes)) {
        setRoutes(data.routes);
        // Default select first route if none selected
        if (data.routes.length > 0) {
          const firstRamal = data.routes[0].ramal;
          setSelectedRamales(new Set([firstRamal]));
          setExpandedDetails(new Set([firstRamal]));
          onRouteToggleRef.current?.(firstRamal, true, data.routes[0]);
        } else {
          setSelectedRamales(new Set());
          setExpandedDetails(new Set());
        }
      }
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filterAndEmitVehicles = useCallback((rawVehicles: any[], mode: 'ramal' | 'free', limit: number) => {
    let result = Array.isArray(rawVehicles) ? rawVehicles : [];

    if (mode === 'ramal' && selectedCompany !== 'TODAS') {
      // Filtrar por sub-ramales seleccionados de la empresa actual
      if (selectedRamales.size > 0) {
        result = result.filter((v: any) => {
          const shortName = String(v.route_short_name || v.linea || '').toUpperCase().trim();
          return Array.from(selectedRamales).some(ramal => shortName.includes(ramal.toUpperCase()));
        });
      }
    }

    setActiveUnitsCount(result.length);
    onUnitsUpdateRef.current?.(result.slice(0, limit));
  }, [selectedCompany, selectedRamales]);

  // Fetch live telemetry vehicles
  const loadVehicles = useCallback(async (comp: string, limit: number, mode: 'ramal' | 'free') => {
    if (limit === 0) {
      setActiveUnitsCount(0);
      onUnitsUpdateRef.current?.([]);
      return;
    }
    try {
      const targetComp = mode === 'free' ? 'TODAS' : comp;
      let boundsParams = '';
      if (mode === 'free') {
        if (mapBounds && typeof mapBounds.getSouth === 'function') {
          boundsParams = `&sw_lat=${mapBounds.getSouth()}&sw_lng=${mapBounds.getWest()}&ne_lat=${mapBounds.getNorth()}&ne_lng=${mapBounds.getEast()}`;
        } else {
          boundsParams = `&sw_lat=-34.25&sw_lng=-59.20&ne_lat=-33.95&ne_lng=-58.85`;
        }
      }
      const fetchLimit = mode === 'free' ? 2500 : 500;
      const res = await fetch(`/v1/redsube/vehicles?company=${encodeURIComponent(targetComp)}&limit=${fetchLimit}${boundsParams}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.vehicles)) {
        allVehiclesCacheRef.current = data.vehicles;
        filterAndEmitVehicles(data.vehicles, mode, limit);
      }
    } catch (_) {}
  }, [filterAndEmitVehicles, mapBounds]);

  // Re-filtrar cuando cambia mapBounds, selectedRamales o unitsMode
  useEffect(() => {
    if (allVehiclesCacheRef.current.length > 0) {
      filterAndEmitVehicles(allVehiclesCacheRef.current, unitsMode, unitsLimit);
    }
  }, [mapBounds, selectedRamales, unitsMode, unitsLimit, filterAndEmitVehicles]);

  useEffect(() => {
    loadRoutes(selectedCompany);
  }, [selectedCompany, loadRoutes]);

  useEffect(() => {
    loadVehicles(selectedCompany, unitsLimit, unitsMode);
    const interval = setInterval(() => {
      loadVehicles(selectedCompany, unitsLimit, unitsMode);
    }, 12000);
    return () => clearInterval(interval);
  }, [selectedCompany, unitsLimit, unitsMode, loadVehicles]);

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      const allRam = new Set(routes.map(r => r.ramal));
      setSelectedRamales(allRam);
      routes.forEach(r => onRouteToggle?.(r.ramal, true, r));
    } else {
      setSelectedRamales(new Set());
      routes.forEach(r => onRouteToggle?.(r.ramal, false, r));
    }
  };

  const handleToggleRoute = (r: V3Route) => {
    const isChecked = selectedRamales.has(r.ramal);
    const nextSet = new Set(selectedRamales);
    const nextDetails = new Set(expandedDetails);

    if (isChecked) {
      nextSet.delete(r.ramal);
      nextDetails.delete(r.ramal);
      onRouteToggle?.(r.ramal, false, r);
    } else {
      nextSet.add(r.ramal);
      nextDetails.add(r.ramal);
      onRouteToggle?.(r.ramal, true, r);
    }

    setSelectedRamales(nextSet);
    setExpandedDetails(nextDetails);
  };

  const handleToggleCorrected = (ramal: string, isChecked: boolean) => {
    const next = new Set(correctedVersions);
    if (isChecked) {
      next.add(ramal);
      showNotification?.('success', `Trazado vial corregido activado para ${ramal}`);
    } else {
      next.delete(ramal);
      showNotification?.('success', `Trazado estándar activado para ${ramal}`);
    }
    setCorrectedVersions(next);
  };

  const isAllSelected = routes.length > 0 && routes.every(r => selectedRamales.has(r.ramal));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '0.75rem',
        color: '#f8fafc',
        height: '100%',
        overflowY: 'auto'
      }}
    >
      {/* 1. Control de Unidades en Mapa */}
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '0.65rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#ff9800', marginBottom: '0.4rem' }}>
          <Bus size={14} />
          <span>Unidades en mapa</span>
        </div>

        <select
          value={unitsLimit}
          onChange={e => setUnitsLimit(parseInt(e.target.value, 10))}
          style={{
            width: '100%',
            backgroundColor: '#1f2937',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '6px',
            color: '#f8fafc',
            padding: '0.4rem 0.5rem',
            fontSize: '0.75rem',
            marginBottom: '0.4rem',
            cursor: 'pointer'
          }}
        >
          <option value={0}>No mostrar unidades</option>
          <option value={50}>Hasta 50 unidades</option>
          <option value={100}>Hasta 100 unidades</option>
          <option value={200}>Hasta 200 unidades</option>
          <option value={500}>Hasta 500 unidades</option>
          <option value={2000}>Todas las unidades visibles (Sin límite)</option>
        </select>

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            padding: '0.35rem 0.5rem',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: '#cbd5e1', cursor: 'pointer' }}>
            <input
              type="radio"
              name="v3_units_mode"
              value="ramal"
              checked={unitsMode === 'ramal'}
              onChange={() => setUnitsMode('ramal')}
              style={{ accentColor: '#e65100', cursor: 'pointer' }}
            />
            Línea seleccionada
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: '#cbd5e1', cursor: 'pointer' }}>
            <input
              type="radio"
              name="v3_units_mode"
              value="free"
              checked={unitsMode === 'free'}
              onChange={() => setUnitsMode('free')}
              style={{ accentColor: '#e65100', cursor: 'pointer' }}
            />
            Todas dentro del zoom
          </label>
        </div>
      </div>

      {/* 2. Selector de Empresa / Servicio */}
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '0.65rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#ff9800', marginBottom: '0.4rem' }}>
          <Search size={14} />
          <span>Empresa / Servicio</span>
        </div>

        <select
          value={selectedCompany}
          onChange={e => setSelectedCompany(e.target.value)}
          style={{
            width: '100%',
            backgroundColor: '#1f2937',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '6px',
            color: '#f8fafc',
            padding: '0.45rem 0.5rem',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Checkbox seleccionar / desmarcar todos */}
        <div
          onClick={() => handleToggleAll(!isAllSelected)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '0.5rem',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            padding: '0.45rem 0.65rem',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          {isAllSelected ? (
            <CheckSquare size={15} color="#e65100" />
          ) : (
            <Square size={15} color="#94a3b8" />
          )}
          <span style={{ fontSize: '0.74rem', color: '#e2e8f0', fontWeight: 600 }}>
            Seleccionar / Desmarcar todos los sub-ramales
          </span>
        </div>
      </div>

      {/* 3. Header de Conteo de Unidades */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.2rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>
          {selectedCompany === 'TODAS' ? 'Todas las Líneas Activas' : `Línea ${selectedCompany}`}
        </span>
        <span
          style={{
            fontSize: '0.7rem',
            backgroundColor: 'rgba(230, 81, 0, 0.18)',
            border: '1px solid rgba(230, 81, 0, 0.4)',
            color: '#ffcc80',
            padding: '0.2rem 0.55rem',
            borderRadius: '6px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#e65100' }} />
          {activeUnitsCount} {activeUnitsCount === 1 ? 'unidad activa' : 'unidades activas'}
        </span>
      </div>

      {/* 4. Lista de Tarjetas de Ramales V3 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {isLoading ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
            Cargando recorridos de RedSUBE...
          </div>
        ) : routes.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
            No se encontraron ramales para esta empresa.
          </div>
        ) : (
          routes.map((r, idx) => {
            const isChecked = selectedRamales.has(r.ramal);
            const isExpanded = expandedDetails.has(r.ramal);
            const isCorrected = correctedVersions.has(r.ramal);
            const ramalColor = (r.color && r.color !== '#e65100') ? r.color : getBranchColor(r.ramal, idx);

            return (
              <div
                key={r.ramal}
                style={{
                  backgroundColor: isChecked ? `${ramalColor}12` : '#1e293b',
                  border: isChecked ? `1px solid ${ramalColor}88` : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  transition: 'all 0.15s ease',
                  boxShadow: isChecked ? `0 2px 12px ${ramalColor}22` : 'none'
                }}
              >
                {/* Card Header */}
                <div
                  onClick={() => handleToggleRoute(r)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.75rem',
                    cursor: 'pointer',
                    backgroundColor: isChecked ? `${ramalColor}10` : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        minWidth: '44px',
                        height: '24px',
                        padding: '0 6px',
                        borderRadius: '6px',
                        backgroundColor: `${ramalColor}22`,
                        color: ramalColor,
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {r.ramal}
                    </span>
                    <span
                      title={r.name}
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        color: isChecked ? '#ffffff' : '#f8fafc',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {r.name}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleRoute(r);
                    }}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      border: `2px solid ${ramalColor}`,
                      background: isChecked ? `${ramalColor}35` : 'transparent',
                      flexShrink: 0,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s'
                    }}
                  >
                    {isChecked && <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: ramalColor }} />}
                  </button>
                </div>

                {/* Card Expandable Details */}
                {isExpanded && (
                  <div
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderTop: `1px solid ${ramalColor}20`,
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    {/* Status badge & Mirita Focus Button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px'
                          }}
                        >
                          NORMAL
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                          {r.unitsCount ? `${r.unitsCount} unidades activas` : 'Conectado a RedSUBE'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusRoute?.(r.ramal, r);
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

                    {/* Direction Buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      {r.headsignIda && (
                        <button
                          type="button"
                          onClick={() => onSelectDirection?.(r.ramal, 'ida')}
                          style={{
                            padding: '0.4rem 0.5rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            backgroundColor: (currentDirection === 'ida' && isChecked) ? '#0284c7' : 'rgba(56, 189, 248, 0.1)',
                            color: (currentDirection === 'ida' && isChecked) ? '#ffffff' : '#38bdf8',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          ➔ {r.headsignIda}
                        </button>
                      )}
                      {r.headsignVuelta && (
                        <button
                          type="button"
                          onClick={() => onSelectDirection?.(r.ramal, 'vuelta')}
                          style={{
                            padding: '0.4rem 0.5rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(168, 85, 247, 0.3)',
                            backgroundColor: (currentDirection === 'vuelta' && isChecked) ? '#9333ea' : 'rgba(168, 85, 247, 0.1)',
                            color: (currentDirection === 'vuelta' && isChecked) ? '#ffffff' : '#c084fc',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          ➔ {r.headsignVuelta}
                        </button>
                      )}
                    </div>

                    {/* Corrected version switch */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '6px',
                        padding: '0.35rem 0.6rem'
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Sparkles size={12} /> Ver versión corregida
                      </span>
                      <input
                        type="checkbox"
                        checked={isCorrected}
                        onChange={e => handleToggleCorrected(r.ramal, e.target.checked)}
                        style={{ accentColor: '#10b981', cursor: 'pointer' }}
                      />
                    </div>

                    {/* Horarios button */}
                    <button
                      type="button"
                      onClick={() => showNotification?.('success', `Horarios para ${r.ramal}: Servicios regulares cada 15-20 min`)}
                      style={{
                        padding: '0.4rem',
                        backgroundColor: '#1f2937',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: '#f1f5f9',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Clock size={13} />
                      <span>Horarios</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
