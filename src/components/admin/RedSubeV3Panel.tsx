import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bus, Search, CheckSquare, Square, Clock, Sparkles } from 'lucide-react';

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
  onUnitsUpdate?: (vehicles: any[]) => void;
  showNotification?: (type: 'success' | 'error', msg: string) => void;
}

export default function RedSubeV3Panel({
  onRouteToggle,
  onSelectDirection,
  onUnitsUpdate,
  showNotification
}: RedSubeV3PanelProps) {
  const [unitsLimit, setUnitsLimit] = useState<number>(50);
  const [unitsMode, setUnitsMode] = useState<'ramal' | 'free'>('ramal');
  const [selectedCompany, setSelectedCompany] = useState<string>('228');
  const [companies, setCompanies] = useState<any[]>([
    { id: '228', name: 'Línea 228 (LA NUEVA METROPOL S.A. (Línea 194))' },
    { id: '194', name: 'Línea 194 (Metropol Zárate ⇄ Once)' },
    { id: '204', name: 'Línea 204 (Zárate ⇄ Campana)' },
    { id: 'SIT', name: 'SIT (Servicio Integral Zárate)' },
    { id: '314', name: 'Línea 314 (La Primera de Martínez S.A.)' },
    { id: 'TODAS', name: '— Todas las Líneas Activas —' }
  ]);
  const [routes, setRoutes] = useState<V3Route[]>([]);
  const [activeUnitsCount, setActiveUnitsCount] = useState<number>(0);
  const [selectedRamales, setSelectedRamales] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const [correctedVersions, setCorrectedVersions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
          setCompanies(data.companies);
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

  // Fetch live telemetry vehicles
  const loadVehicles = useCallback(async (comp: string, limit: number) => {
    if (limit === 0) {
      setActiveUnitsCount(0);
      onUnitsUpdateRef.current?.([]);
      return;
    }
    try {
      const res = await fetch(`/v1/redsube/vehicles?company=${encodeURIComponent(comp)}&limit=${limit}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.vehicles)) {
        setActiveUnitsCount(data.total || data.vehicles.length);
        onUnitsUpdateRef.current?.(data.vehicles);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadRoutes(selectedCompany);
  }, [selectedCompany, loadRoutes]);

  useEffect(() => {
    loadVehicles(selectedCompany, unitsLimit);
    const interval = setInterval(() => {
      loadVehicles(selectedCompany, unitsLimit);
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedCompany, unitsLimit, loadVehicles]);

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
          <option value={10}>Hasta 10 unidades</option>
          <option value={25}>Hasta 25 unidades</option>
          <option value={50}>Hasta 50 unidades</option>
          <option value={100}>Hasta 100 unidades</option>
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
            Sub-ramales seleccionados
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
            Todas en el mapa
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
          routes.map(r => {
            const isChecked = selectedRamales.has(r.ramal);
            const isExpanded = expandedDetails.has(r.ramal);
            const isCorrected = correctedVersions.has(r.ramal);
            const ramalColor = r.color || '#e65100';

            return (
              <div
                key={r.ramal}
                style={{
                  backgroundColor: '#1e293b',
                  border: isChecked ? `1px solid ${ramalColor}88` : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  transition: 'all 0.15s ease',
                  boxShadow: isChecked ? `0 2px 10px ${ramalColor}22` : 'none'
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
                    backgroundColor: isChecked ? `${ramalColor}12` : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        border: `1.5px solid ${ramalColor}`,
                        color: ramalColor,
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        backgroundColor: `${ramalColor}15`,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {r.ramal}
                    </span>
                    <span
                      title={r.name}
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#f8fafc',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {r.name}
                    </span>
                  </div>

                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    onClick={e => e.stopPropagation()}
                    style={{ accentColor: '#e65100', cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </div>

                {/* Card Expandable Details */}
                {isExpanded && (
                  <div
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    {/* Status badge */}
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
                            backgroundColor: 'rgba(56, 189, 248, 0.1)',
                            color: '#38bdf8',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
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
                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                            color: '#c084fc',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
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
