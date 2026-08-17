import React, { useState } from 'react';
import { X, Info } from 'lucide-react';

interface MapLegendPanelProps {
  sidebarOpen?: boolean;
  isTablet?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function MapLegendPanel({
  sidebarOpen = true,
  isTablet = false,
  className = '',
  style = {}
}: MapLegendPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`map-legend-pill ${className}`}
        style={{
          position: 'absolute',
          bottom: '26px',
          left: sidebarOpen ? (isTablet ? '336px' : '406px') : '16px',
          zIndex: 1100,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          borderRadius: '999px',
          padding: '7px 14px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.8rem',
          fontWeight: 700,
          color: '#334155',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'auto',
          ...style
        }}
        title="Mostrar referencias del mapa"
      >
        <Info size={15} color="#0284c7" />
        <span>Referencias</span>
      </button>
    );
  }

  return (
    <div
      className={`map-legend-panel ${className}`}
      style={{
        position: 'absolute',
        bottom: '26px',
        left: sidebarOpen ? (isTablet ? '336px' : '406px') : '16px',
        zIndex: 1100,
        width: '320px',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
        border: '1px solid #e2e8f0',
        padding: '16px',
        fontFamily: 'Inter, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s',
        pointerEvents: 'auto',
        userSelect: 'none',
        ...style
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
            Referencias del Mapa
          </h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.3 }}>
            El color del círculo alrededor de cada colectivo indica su tipo de seguimiento:
          </p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s'
          }}
          title="Cerrar referencias"
          onMouseOver={e => e.currentTarget.style.color = '#0f172a'}
          onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}
        >
          <X size={18} />
        </button>
      </div>

      {/* Legend Items Card */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {/* Item 1: Círculo Verde */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: '2.5px solid #059669',
              background: 'rgba(5, 150, 105, 0.15)',
              marginTop: '2px',
              flexShrink: 0
            }}
          />
          <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.35 }}>
            <strong style={{ color: '#059669' }}>Círculo Verde:</strong> Ubicación en tiempo real (máxima precisión disponible).
          </div>
        </div>

        {/* Item 2: Círculo Rojo */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: '2.5px solid #dc2626',
              background: 'rgba(220, 38, 38, 0.15)',
              marginTop: '2px',
              flexShrink: 0
            }}
          />
          <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.35 }}>
            <strong style={{ color: '#dc2626' }}>Círculo Rojo:</strong> Posición estimada según horarios.
          </div>
        </div>

        {/* Item 3: Círculo Amarillo */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: '2.5px solid #d97706',
              background: 'rgba(217, 119, 6, 0.15)',
              marginTop: '2px',
              flexShrink: 0
            }}
          />
          <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.35 }}>
            <strong style={{ color: '#d97706' }}>Círculo Amarillo:</strong> Posición estimada por horario más GPS colaborativo.
          </div>
        </div>
      </div>

      {/* Note Box */}
      <div
        style={{
          background: '#f8fafc',
          borderLeft: '3px solid #64748b',
          borderRadius: '4px 8px 8px 4px',
          padding: '8px 10px',
          fontSize: '0.73rem',
          fontStyle: 'italic',
          color: '#64748b',
          lineHeight: 1.35
        }}
      >
        <strong style={{ fontStyle: 'normal', color: '#475569' }}>NOTA:</strong> Las posiciones de los colectivos son aproximadas y pueden no ser exactas en cualquiera de los casos.
      </div>
    </div>
  );
}
