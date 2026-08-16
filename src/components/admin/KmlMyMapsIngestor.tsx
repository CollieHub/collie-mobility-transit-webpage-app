import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  Route,
  Check,
  Loader2,
  AlertCircle,
  X
} from 'lucide-react';

interface ParsedLine {
  id: string;
  name: string;
  coordinates: [number, number][];
  color?: string;
  directionSuggestion?: 'ida' | 'vuelta';
  folderName?: string;
}

interface ParsedStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  folderName?: string;
}

interface RecentUrl {
  url: string;
  title: string;
  timestamp: number;
}

interface KmlMyMapsIngestorProps {
  onClose: () => void;
  linesList: any[];
  branchesList: any[];
  showNotification?: (type: 'success' | 'error' | 'info', msg: string) => void;
  onIntegrateRoute?: (branchId: string, direction: 'ida' | 'vuelta', waypoints: [number, number][], stops?: any[]) => void;
}

const kmlColorToHex = (kmlColor: string): string => {
  let clean = kmlColor.replace('#', '').trim();
  if (clean.length === 8) {
    const b = clean.substring(2, 4);
    const g = clean.substring(4, 6);
    const r = clean.substring(6, 8);
    return `#${r}${g}${b}`;
  }
  if (clean.length === 6) {
    const b = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const r = clean.substring(4, 6);
    return `#${r}${g}${b}`;
  }
  return '#38bdf8';
};

const suggestDirection = (name: string, folderName?: string): 'ida' | 'vuelta' => {
  const text = `${name} ${folderName || ''}`.toLowerCase();
  if (text.includes('vuelta') || text.includes('regreso') || text.includes('retorno') || text.includes('sentido 2')) {
    return 'vuelta';
  }
  return 'ida';
};

export const KmlMyMapsIngestor: React.FC<KmlMyMapsIngestorProps> = ({
  onClose,
  branchesList,
  showNotification,
  onIntegrateRoute
}) => {
  const [mapUrl, setMapUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [mapTitle, setMapTitle] = useState<string | null>(null);
  const [detectedLines, setDetectedLines] = useState<ParsedLine[]>([]);
  const [detectedStops, setDetectedStops] = useState<ParsedStop[]>([]);

  const [selectedLineIds, setSelectedLineIds] = useState<Record<string, boolean>>({});
  const [integratedLineIds, setIntegratedLineIds] = useState<Record<string, boolean>>({});
  const [lineAssignments, setLineAssignments] = useState<Record<string, { branchId: string; direction: 'ida' | 'vuelta' }>>({});

  const [integrationFilter, setIntegrationFilter] = useState<'all' | 'integrated' | 'not_integrated'>('all');
  const [recentUrls, setRecentUrls] = useState<RecentUrl[]>([]);

  // Load recent URLs on mount
  useEffect(() => {
    const stored = localStorage.getItem('collie_kml_recent_urls');
    if (stored) {
      try {
        setRecentUrls(JSON.parse(stored));
      } catch (_) {}
    }
  }, []);

  const extractMid = (url: string): string | null => {
    try {
      const match = url.match(/[?&]mid=([^&]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]);
      const embedMatch = url.match(/\/d\/(?:viewer|embed\?mid=)([^\/\?]+)/);
      if (embedMatch && embedMatch[1]) return decodeURIComponent(embedMatch[1]);
      return null;
    } catch {
      return null;
    }
  };

  const handleFetchKml = async (targetUrl?: string) => {
    const urlToUse = targetUrl || mapUrl;
    if (!urlToUse.trim()) {
      setErrorMsg('Por favor, ingresa una URL válida de Google My Maps.');
      return;
    }

    const mid = extractMid(urlToUse);
    if (!mid) {
      setErrorMsg('No se pudo identificar el ID del mapa (mid) en la URL ingresada. Asegúrate de copiar el enlace de visualización de Google My Maps.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setDetectedLines([]);
    setDetectedStops([]);
    setMapTitle(null);

    try {
      const res = await fetch(`/v1/admin/kml-proxy?mid=${encodeURIComponent(mid)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Error al obtener KML (${res.status})`);
      }

      const xmlText = await res.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      if (xmlDoc.querySelector('parsererror')) {
        throw new Error('El KML devuelto por Google contiene errores de sintaxis XML.');
      }

      const docName = xmlDoc.querySelector('Document > name')?.textContent?.trim() || 'Mapa de Google My Maps';
      setMapTitle(docName);

      // Save to recent URLs
      const updatedRecents = [
        { url: urlToUse, title: docName, timestamp: Date.now() },
        ...recentUrls.filter(r => extractMid(r.url) !== mid)
      ].slice(0, 10);
      setRecentUrls(updatedRecents);
      localStorage.setItem('collie_kml_recent_urls', JSON.stringify(updatedRecents));

      // Parse styles
      const stylesMap: Record<string, string> = {};
      xmlDoc.querySelectorAll('Style').forEach(style => {
        const id = style.getAttribute('id');
        if (!id) return;
        const colorText = style.querySelector('LineStyle > color')?.textContent?.trim();
        if (colorText) stylesMap[id] = kmlColorToHex(colorText);
      });

      xmlDoc.querySelectorAll('StyleMap').forEach(sm => {
        const id = sm.getAttribute('id');
        if (!id) return;
        let normalStyleUrl = '';
        sm.querySelectorAll('Pair').forEach(pair => {
          if (pair.querySelector('key')?.textContent?.trim() === 'normal') {
            normalStyleUrl = pair.querySelector('styleUrl')?.textContent?.trim() || '';
          }
        });
        if (normalStyleUrl) {
          const cleanUrl = normalStyleUrl.replace('#', '');
          if (stylesMap[cleanUrl]) stylesMap[id] = stylesMap[cleanUrl];
        }
      });

      const parsedLines: ParsedLine[] = [];
      const parsedStops: ParsedStop[] = [];

      const processFolderOrDoc = (element: Element, folderName?: string) => {
        const currentFolderName = element.querySelector('name')?.textContent?.trim() || folderName;
        
        element.querySelectorAll('Placemark').forEach((pm, idx) => {
          const pmName = pm.querySelector('name')?.textContent?.trim() || `Trazado ${idx + 1}`;
          
          let styleUrl = pm.querySelector('styleUrl')?.textContent?.trim() || '';
          styleUrl = styleUrl.replace('#', '');
          const strokeColor = stylesMap[styleUrl] || '#38bdf8';

          // Extract LineString
          const lineString = pm.querySelector('LineString');
          if (lineString) {
            const coordText = lineString.querySelector('coordinates')?.textContent?.trim() || '';
            const rawTokens = coordText.split(/\s+/);
            const coords: [number, number][] = [];

            rawTokens.forEach(tok => {
              const parts = tok.split(',');
              if (parts.length >= 2) {
                const lng = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                  coords.push([lat, lng]);
                }
              }
            });

            if (coords.length > 1) {
              const lineId = `kml-line-${Date.now()}-${parsedLines.length}-${Math.random().toString(36).substr(2, 4)}`;
              const dirSugg = suggestDirection(pmName, currentFolderName);

              // Match branch automatically by code or name
              let matchedBranchId = '';
              const cleanPm = pmName.toLowerCase().replace(/[^a-z0-9]/g, '');
              const matchedBranch = branchesList.find(b => {
                const cleanCode = (b.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return cleanCode && (cleanPm.includes(cleanCode) || cleanCode.includes(cleanPm));
              });
              if (matchedBranch) matchedBranchId = matchedBranch.id;

              parsedLines.push({
                id: lineId,
                name: pmName,
                coordinates: coords,
                color: strokeColor,
                directionSuggestion: dirSugg,
                folderName: currentFolderName
              });

              setLineAssignments(prev => ({
                ...prev,
                [lineId]: { branchId: matchedBranchId, direction: dirSugg }
              }));
            }
          }

          // Extract Point Stop
          const pointNode = pm.querySelector('Point');
          if (pointNode) {
            const coordText = pointNode.querySelector('coordinates')?.textContent?.trim() || '';
            const parts = coordText.split(',');
            if (parts.length >= 2) {
              const lng = parseFloat(parts[0]);
              const lat = parseFloat(parts[1]);
              if (!isNaN(lat) && !isNaN(lng)) {
                parsedStops.push({
                  id: `kml-stop-${Date.now()}-${parsedStops.length}`,
                  name: pmName,
                  lat,
                  lng,
                  folderName: currentFolderName
                });
              }
            }
          }
        });
      };

      xmlDoc.querySelectorAll('Folder').forEach(folder => processFolderOrDoc(folder));

      if (parsedLines.length === 0) {
        processFolderOrDoc(xmlDoc.documentElement);
      }

      setDetectedLines(parsedLines);
      setDetectedStops(parsedStops);

      if (parsedLines.length === 0 && parsedStops.length === 0) {
        showNotification?.('info', 'No se encontraron trazados ni paradas válidas en el enlace KML.');
      } else {
        showNotification?.('success', `¡Mapa cargado! Se detectaron ${parsedLines.length} trazados y ${parsedStops.length} puntos de paradas.`);
      }

    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener la información geográfica del mapa.');
      showNotification?.('error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIntegrateSingle = async (line: ParsedLine) => {
    const assign = lineAssignments[line.id];
    if (!assign || !assign.branchId) {
      showNotification?.('error', 'Por favor selecciona un Ramal para integrar este trazado.');
      return;
    }

    try {
      const res = await fetch('/v1/admin/table/shapes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: assign.branchId,
          direction: assign.direction,
          waypoints_json: JSON.stringify(line.coordinates),
          polyline_json: JSON.stringify(line.coordinates)
        })
      });

      const data = await res.json();
      if (data.success) {
        setIntegratedLineIds(prev => ({ ...prev, [line.id]: true }));
        onIntegrateRoute?.(assign.branchId, assign.direction, line.coordinates);
        showNotification?.('success', `¡Trazado "${line.name}" integrado exitosamente!`);
      } else {
        throw new Error(data.error || 'Error al guardar el trazado');
      }
    } catch (err: any) {
      showNotification?.('error', `Error al integrar trazado: ${err.message}`);
    }
  };

  const handleIntegrateSelected = async () => {
    const selectedIds = Object.keys(selectedLineIds).filter(id => selectedLineIds[id]);
    if (selectedIds.length === 0) {
      showNotification?.('error', 'Selecciona al menos un trazado para integrar.');
      return;
    }

    let successCount = 0;
    for (const id of selectedIds) {
      const line = detectedLines.find(l => l.id === id);
      if (line) {
        const assign = lineAssignments[line.id];
        if (assign && assign.branchId) {
          await handleIntegrateSingle(line);
          successCount++;
        }
      }
    }

    if (successCount > 0) {
      showNotification?.('success', `Se integraron ${successCount} trazados seleccionados correctamente.`);
    }
  };

  const filteredLines = useMemo(() => {
    return detectedLines.filter(line => {
      const isIntegrated = !!integratedLineIds[line.id];
      if (integrationFilter === 'integrated') return isIntegrated;
      if (integrationFilter === 'not_integrated') return !isIntegrated;
      return true;
    });
  }, [detectedLines, integratedLineIds, integrationFilter]);

  const mapBounds = useMemo(() => {
    const allCoords: [number, number][] = [];
    detectedLines.forEach(l => l.coordinates.forEach(c => allCoords.push(c)));
    detectedStops.forEach(s => allCoords.push([s.lat, s.lng]));
    if (allCoords.length === 0) return null;
    const lats = allCoords.map(c => c[0]);
    const lngs = allCoords.map(c => c[1]);
    return L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    );
  }, [detectedLines, detectedStops]);

  const selectedCount = Object.values(selectedLineIds).filter(Boolean).length;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      backgroundColor: '#090d16',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* HEADER BAR */}
      <div style={{
        padding: '0.85rem 1.25rem',
        backgroundColor: '#0f172a',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <button
            onClick={onClose}
            className="btn-animated btn-animated-dark"
            style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', backgroundColor: '#1e293b', color: '#f8fafc', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <ArrowLeft size={16} /> Volver al Editor
          </button>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ec4899', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Route size={18} /> Ingestador de Recorridos (Google My Maps)
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Importa trazados geográficos y paradas directamente desde cualquier mapa público de Google My Maps
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.3rem' }}
        >
          <X size={22} />
        </button>
      </div>

      {/* MAIN CONTAINER */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT CONTROL SIDEBAR */}
        <div style={{
          width: '450px',
          backgroundColor: '#0f172a',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: '1rem',
          gap: '1rem',
          flexShrink: 0
        }}>
          {/* INPUT FORM */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Enlace de Google My Maps
            </label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type="text"
                value={mapUrl}
                onChange={e => setMapUrl(e.target.value)}
                placeholder="Pegar enlace de visualización o embed (ej: https://www.google.com/maps/d/u/0/viewer?mid=...)"
                style={{ flex: 1, padding: '0.65rem 0.75rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', color: '#ffffff', fontSize: '0.8rem', outline: 'none' }}
              />
              <button
                onClick={() => handleFetchKml()}
                disabled={isLoading}
                style={{ padding: '0.65rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: '#ec4899', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {isLoading ? <Loader2 size={15} className="animate-spin" /> : 'Cargar'}
              </button>
            </div>

            {errorMsg && (
              <div style={{ padding: '0.65rem', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#fca5a5', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* RECENT URLS */}
          {recentUrls.length > 0 && !detectedLines.length && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Mapas Recientes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {recentUrls.map((r, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setMapUrl(r.url);
                      handleFetchKml(r.url);
                    }}
                    style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.06)', color: '#38bdf8', fontSize: '0.78rem', fontWeight: 600, textAlign: 'left', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    🗺️ {r.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MAP IDENTIFIED HEADER */}
          {mapTitle && (
            <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid rgba(56, 189, 248, 0.25)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Mapa Identificado</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#38bdf8' }}>{mapTitle}</span>
            </div>
          )}

          {/* DETECTED ROUTES HEADER & BATCH ACTION */}
          {detectedLines.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
                  TRAZADOS DETECTADOS ({filteredLines.length})
                </span>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <button
                    onClick={() => setIntegrationFilter('all')}
                    style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: 'none', backgroundColor: integrationFilter === 'all' ? '#0284c7' : '#1e293b', color: '#ffffff', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Todos ({detectedLines.length})
                  </button>
                  <button
                    onClick={() => setIntegrationFilter('not_integrated')}
                    style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: 'none', backgroundColor: integrationFilter === 'not_integrated' ? '#0284c7' : '#1e293b', color: '#ffffff', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    No integrados
                  </button>
                </div>
              </div>

              {selectedCount > 0 && (
                <button
                  onClick={handleIntegrateSelected}
                  className="btn-animated btn-animated-success"
                  style={{ padding: '0.65rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <Check size={16} /> Confirmar e Integrar Seleccionados ({selectedCount})
                </button>
              )}

              {/* DETECTED LINES LIST */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {filteredLines.map(line => {
                  const isSelected = !!selectedLineIds[line.id];
                  const isIntegrated = !!integratedLineIds[line.id];
                  const assign = lineAssignments[line.id] || { branchId: '', direction: line.directionSuggestion || 'ida' };

                  return (
                    <div
                      key={line.id}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '10px',
                        backgroundColor: '#131e32',
                        border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => setSelectedLineIds(prev => ({ ...prev, [line.id]: e.target.checked }))}
                            style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                          />
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: line.color || '#38bdf8', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {line.name}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.65rem', backgroundColor: assign.direction === 'ida' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)', color: assign.direction === 'ida' ? '#38bdf8' : '#c084fc', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 800 }}>
                          {assign.direction.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        Capa: {line.folderName || 'General'} | {line.coordinates.length} puntos de geoposicionamiento
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.2rem' }}>
                        <select
                          value={assign.branchId}
                          onChange={e => setLineAssignments(prev => ({
                            ...prev,
                            [line.id]: { ...assign, branchId: e.target.value }
                          }))}
                          style={{ width: '100%', backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '0.45rem 0.6rem', fontSize: '0.78rem', outline: 'none' }}
                        >
                          <option value="">Seleccionar Ramal...</option>
                          {branchesList.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.code ? `${b.code} - ${b.name}` : b.name}
                            </option>
                          ))}
                        </select>

                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'space-between' }}>
                          <button
                            onClick={() => setLineAssignments(prev => ({
                              ...prev,
                              [line.id]: { ...assign, direction: assign.direction === 'ida' ? 'vuelta' : 'ida' }
                            }))}
                            style={{
                              flex: 1,
                              padding: '0.4rem 0.6rem',
                              borderRadius: '6px',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              backgroundColor: assign.direction === 'ida' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(192, 132, 252, 0.12)',
                              color: assign.direction === 'ida' ? '#38bdf8' : '#c084fc',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            {assign.direction === 'ida' ? 'SENTIDO: IDA ➔' : 'SENTIDO: ↩ VUELTA'}
                          </button>

                          <button
                            onClick={() => handleIntegrateSingle(line)}
                            disabled={isIntegrated || !assign.branchId}
                            className="btn-animated btn-animated-success"
                            style={{
                              flex: 1,
                              padding: '0.4rem 0.6rem',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: isIntegrated ? '#334155' : (assign.branchId ? '#10b981' : '#1e293b'),
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: isIntegrated || !assign.branchId ? 'not-allowed' : 'pointer',
                              opacity: isIntegrated ? 0.6 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            {isIntegrated ? '✓ Integrado' : 'Integrar Trazado'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* RIGHT MAP DISPLAY */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer
            center={[-34.0970, -59.0300]}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            bounds={mapBounds || undefined}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />

            {detectedLines.map(line => (
              <Polyline
                key={line.id}
                positions={line.coordinates}
                pathOptions={{
                  color: line.color || '#38bdf8',
                  weight: 5,
                  opacity: 0.85
                }}
              >
                <Popup>
                  <div style={{ padding: '0.2rem' }}>
                    <strong style={{ color: '#0284c7' }}>{line.name}</strong><br />
                    <span style={{ fontSize: '0.75rem', color: '#475569' }}>Capa: {line.folderName || 'General'}</span><br />
                    <span style={{ fontSize: '0.75rem', color: '#475569' }}>Puntos: {line.coordinates.length}</span>
                  </div>
                </Popup>
              </Polyline>
            ))}

            {detectedStops.map((st, idx) => (
              <Marker
                key={st.id || idx}
                position={[st.lat, st.lng]}
                icon={L.divIcon({
                  className: 'custom-kml-stop-marker',
                  html: `<div style="background-color:#ec4899;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4);"></div>`,
                  iconSize: [12, 12],
                  iconAnchor: [6, 6]
                })}
              >
                <Popup>
                  <strong>{st.name}</strong>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};
