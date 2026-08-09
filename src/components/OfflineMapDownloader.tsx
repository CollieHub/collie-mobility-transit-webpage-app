import React, { useState, useEffect, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import { CloudDownload, X, CheckCircle2, AlertCircle, Download, Trash2 } from 'lucide-react';

// === Lógica del Calculador de Tiles Offline ===
function lon2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat: number, zoom: number): number {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
    Math.pow(2, zoom)
  );
}

interface OfflineMapDownloaderProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
  hideButton?: boolean;
}

export default function OfflineMapDownloader({ externalOpen, onExternalClose, hideButton = false }: OfflineMapDownloaderProps) {
  const map = useMap();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  
  const setIsOpen = (open: boolean) => {
    if (externalOpen !== undefined) {
      if (!open && onExternalClose) onExternalClose();
    } else {
      setInternalOpen(open);
    }
  };
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [downloadCurrent, setDownloadCurrent] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info' | null>(null);
  
  // Calcular cantidad de tiles estimadas para la vista actual
  const [tileCountEstimate, setTileCountEstimate] = useState(0);
  const [currentZoom, setCurrentZoom] = useState(13);

  const calculateTilesForCurrentBounds = useCallback(() => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    setCurrentZoom(zoom);

    const south = bounds.getSouth();
    const west = bounds.getWest();
    const north = bounds.getNorth();
    const east = bounds.getEast();

    let totalTiles = 0;
    // Descargamos el zoom actual y hasta 2 niveles más detallados (máximo zoom 16 para evitar sobrecarga)
    const maxZoomToDownload = Math.min(zoom + 2, 16);
    
    for (let z = zoom; z <= maxZoomToDownload; z++) {
      const xMin = lon2tile(west, z);
      const xMax = lon2tile(east, z);
      const yMin = lat2tile(north, z);
      const yMax = lat2tile(south, z);

      const xCount = Math.abs(xMax - xMin) + 1;
      const yCount = Math.abs(yMax - yMin) + 1;
      totalTiles += xCount * yCount;
    }

    setTileCountEstimate(totalTiles);
  }, [map]);

  // Recalcular cuando el mapa se mueve o hace zoom
  useEffect(() => {
    calculateTilesForCurrentBounds();
    
    const handleMoveEnd = () => {
      calculateTilesForCurrentBounds();
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
    };
  }, [map, calculateTilesForCurrentBounds]);

  const handleDownload = async () => {
    if (tileCountEstimate > 500) {
      setStatusMessage('El área seleccionada es demasiado grande. Por favor, acercá más el mapa.');
      setStatusType('error');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadCurrent(0);
    setStatusMessage('Iniciando descarga de mosaicos...');
    setStatusType('info');

    const bounds = map.getBounds();
    const zoom = map.getZoom();
    const south = bounds.getSouth();
    const west = bounds.getWest();
    const north = bounds.getNorth();
    const east = bounds.getEast();

    const maxZoomToDownload = Math.min(zoom + 2, 16);
    const tileUrls: string[] = [];

    // Generar todas las urls de tiles
    for (let z = zoom; z <= maxZoomToDownload; z++) {
      const xMin = lon2tile(west, z);
      const xMax = lon2tile(east, z);
      const yMin = lat2tile(north, z);
      const yMax = lat2tile(south, z);

      for (let x = Math.min(xMin, xMax); x <= Math.max(xMin, xMax); x++) {
        for (let y = Math.min(yMin, yMax); y <= Math.max(yMin, yMax); y++) {
          // Reemplazar {s} por subdominios de CartoDB (a, b, c, d)
          const subdomains = ['a', 'b', 'c', 'd'];
          const s = subdomains[Math.abs(x + y) % subdomains.length];
          const url = `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
          tileUrls.push(url);
        }
      }
    }

    const total = tileUrls.length;
    setDownloadTotal(total);

    try {
      const cache = await caches.open('map-tiles-cache');
      let downloaded = 0;

      // Descargar en lotes de a 5 peticiones simultáneas
      const batchSize = 5;
      for (let i = 0; i < total; i += batchSize) {
        const batch = tileUrls.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (url) => {
            try {
              const response = await fetch(url, { mode: 'cors' });
              if (response.ok) {
                await cache.put(url, response);
              }
            } catch (err) {
              console.warn('Fallo al descargar tile offline:', url, err);
            } finally {
              downloaded++;
              setDownloadCurrent(downloaded);
              setDownloadProgress(Math.round((downloaded / total) * 100));
            }
          })
        );
      }

      setStatusMessage(`¡Éxito! Se descargaron ${downloaded} mosaicos correctamente.`);
      setStatusType('success');
    } catch (err) {
      console.error('Error durante la descarga offline:', err);
      setStatusMessage('Hubo un error al guardar los mosaicos locales.');
      setStatusType('error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClearCache = async () => {
    if (window.confirm('¿Estás seguro de que querés borrar el mapa offline descargado?')) {
      try {
        const deleted = await caches.delete('map-tiles-cache');
        if (deleted) {
          setStatusMessage('Caché del mapa eliminada con éxito.');
          setStatusType('success');
        } else {
          setStatusMessage('No se encontraron mapas offline guardados.');
          setStatusType('info');
        }
      } catch (err) {
        setStatusMessage('Error al borrar la caché.');
        setStatusType('error');
      }
    }
  };

  return (
    <>
      {/* Botón flotante del mapa en la esquina inferior izquierda (arriba del logo de Leaflet) */}
      {!hideButton && (
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '16px',
            zIndex: 1000,
            fontFamily: "'Inter', sans-serif"
          }}
        >
          <button
            onClick={() => setIsOpen(!isOpen)}
            style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              color: '#1e293b',
              borderRadius: '50%',
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.background = '#ffffff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)';
            }}
            title="Descargar mapa offline"
          >
            <CloudDownload size={20} />
          </button>
        </div>
      )}

      {/* Panel flotante de control de mapa offline */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '76px',
            left: '16px',
            width: '280px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            fontFamily: "'Inter', -apple-system, sans-serif",
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CloudDownload size={16} /> Mapa Offline
            </h4>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              <X size={16} />
            </button>
          </div>

          <p style={{ margin: '0 0 10px 0', fontSize: '0.78rem', color: '#475569', lineHeight: '1.4' }}>
            Guardá el recuadro actual de la pantalla para usar la aplicación sin conexión.
          </p>

          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
              <span>Zoom actual:</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{currentZoom}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
              <span>Imágenes estimadas:</span>
              <span style={{ fontWeight: 600, color: tileCountEstimate > 500 ? '#ef4444' : '#0f172a' }}>
                {tileCountEstimate}
              </span>
            </div>
          </div>

          {statusMessage && (
            <div
              style={{
                fontSize: '0.75rem',
                padding: '8px 10px',
                borderRadius: '8px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                background: statusType === 'success' ? '#dcfce7' : statusType === 'error' ? '#fee2e2' : '#f0f9ff',
                color: statusType === 'success' ? '#15803d' : statusType === 'error' ? '#b91c1c' : '#0369a1',
                border: `1px solid ${statusType === 'success' ? '#bbf7d0' : statusType === 'error' ? '#fecaca' : '#bae6fd'}`
              }}
            >
              {statusType === 'success' && <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: '2px' }} />}
              {statusType === 'error' && <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />}
              <span style={{ lineHeight: '1.3' }}>{statusMessage}</span>
            </div>
          )}

          {isDownloading ? (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569', marginBottom: '4px' }}>
                <span>Descargando...</span>
                <span>{downloadCurrent} / {downloadTotal}</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${downloadProgress}%`,
                    height: '100%',
                    background: '#3b82f6',
                    borderRadius: '3px',
                    transition: 'width 0.2s ease-out'
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handleDownload}
                disabled={tileCountEstimate > 500}
                style={{
                  width: '100%',
                  padding: '9px',
                  background: tileCountEstimate > 500 ? '#e2e8f0' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: tileCountEstimate > 500 ? '#94a3b8' : '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: tileCountEstimate > 500 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: tileCountEstimate > 500 ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.2)',
                  transition: 'all 0.2s'
                }}
              >
                <Download size={14} /> Guardar Zona
              </button>
              
              <button
                onClick={handleClearCache}
                style={{
                  width: '100%',
                  padding: '7px',
                  background: 'transparent',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = '#fca5a5';
                  e.currentTarget.style.background = '#fef2f2';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Trash2 size={12} /> Borrar Guardados
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
