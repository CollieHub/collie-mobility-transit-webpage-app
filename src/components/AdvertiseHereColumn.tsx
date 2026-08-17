import React, { useState } from 'react';
import { Megaphone, ChevronRight, ChevronLeft, Sparkles, TrendingUp, Users, MapPin, Mail, CheckCircle2 } from 'lucide-react';

interface AdvertiseHereColumnProps {
  className?: string;
  style?: React.CSSProperties;
}

const WhatsAppOfficialIcon = ({ size = 18, color = '#ffffff' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.707 1.458h.005c6.56 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function AdvertiseHereColumn({
  className = '',
  style = {}
}: AdvertiseHereColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div
      className={`advertise-right-column ${className}`}
      style={{
        position: 'absolute',
        top: '56px',
        right: '16px',
        bottom: '100px',
        width: isCollapsed ? '48px' : '320px',
        zIndex: 900,
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: '24px',
        border: '3px solid #38bdf8',
        boxShadow: '0 12px 40px rgba(14, 165, 233, 0.18)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        pointerEvents: 'auto',
        userSelect: 'none',
        ...style
      }}
    >
      {/* Collapse / Expand Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          position: 'absolute',
          top: '14px',
          left: isCollapsed ? '10px' : '12px',
          zIndex: 10,
          background: '#0f172a',
          color: '#38bdf8',
          border: 'none',
          borderRadius: '50%',
          width: '28px',
          height: '28px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          transition: 'all 0.2s'
        }}
        title={isCollapsed ? 'Expandir panel de publicidad' : 'Ocultar panel'}
      >
        {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Marca de Agua Diagonal "PRÓXIMAMENTE" */}
      {!isCollapsed && (
        <div
          style={{
            position: 'absolute',
            top: '48%',
            left: '-30%',
            right: '-30%',
            transform: 'translateY(-50%) rotate(-24deg)',
            background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.88) 0%, rgba(190, 18, 60, 0.94) 100%)',
            color: '#ffffff',
            textAlign: 'center',
            fontWeight: 900,
            fontSize: '1.25rem',
            letterSpacing: '5px',
            padding: '10px 0',
            textTransform: 'uppercase',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
            borderTop: '2px solid rgba(255, 255, 255, 0.6)',
            borderBottom: '2px solid rgba(255, 255, 255, 0.6)',
            zIndex: 60,
            pointerEvents: 'none',
            userSelect: 'none',
            backdropFilter: 'blur(3px)',
            textShadow: '0 2px 6px rgba(0,0,0,0.5)'
          }}
        >
          PRÓXIMAMENTE
        </div>
      )}

      {/* Collapsed State: Vertical Strip */}
      {isCollapsed ? (
        <div
          onClick={() => setIsCollapsed(false)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            cursor: 'pointer',
            paddingTop: '36px',
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)'
          }}
        >
          <div style={{ transform: 'rotate(90deg)', whiteSpace: 'nowrap', fontWeight: 900, fontSize: '0.85rem', color: '#38bdf8', letterSpacing: '2px' }}>
            ANUNCIE AQUÍ
          </div>
          <Megaphone size={20} color="#38bdf8" />
        </div>
      ) : (
        <>
          {/* Header */}
          <div
            style={{
              padding: '16px 16px 14px 48px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              borderBottom: '2px solid rgba(56, 189, 248, 0.2)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Sparkles size={11} /> Espacio Disponible
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Megaphone size={18} color="#38bdf8" /> Anuncie Aquí
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.2 }}>
              Destacá tu marca ante miles de pasajeros todos los días
            </p>
          </div>

          {/* Scrollable Content Body */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {/* Highlight Hero Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(56, 189, 248, 0.04) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '16px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: '#0284c7',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <TrendingUp size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                    Máxima Visibilidad Local
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Audiencia activa mientras viaja
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0284c7', fontSize: '0.7rem', fontWeight: 700 }}>
                    <Users size={12} /> +50.000
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Visitas mensuales</div>
                </div>
                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontSize: '0.7rem', fontWeight: 700 }}>
                    <MapPin size={12} /> 100% Local
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Zárate y alrededores</div>
                </div>
              </div>
            </div>

            {/* Benefits List */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ¿Por qué promocionar aquí?
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem', color: '#475569' }}>
                <CheckCircle2 size={15} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Posicionamiento Premium:</strong> Tu negocio visible al lado del mapa de recorridos.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem', color: '#475569' }}>
                <CheckCircle2 size={15} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Enlace directo a WhatsApp:</strong> Tráfico directo a tu catálogo o local.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem', color: '#475569' }}>
                <CheckCircle2 size={15} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Planes flexibles:</strong> Banners semanales, mensuales o exclusivos.</span>
              </div>
            </div>
          </div>

          {/* Footer Buttons (Inactivos/Deshabilitados para Próximamente) */}
          <div
            style={{
              padding: '12px 14px',
              background: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            {/* Botón WhatsApp con icono oficial y sin acción */}
            <div
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#25D366',
                color: '#ffffff',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
                cursor: 'default',
                opacity: 0.95
              }}
            >
              <WhatsAppOfficialIcon size={18} color="#ffffff" />
              <span>Consultar por WhatsApp</span>
            </div>

            {/* Botón Email sin acción */}
            <div
              style={{
                width: '100%',
                padding: '8px 14px',
                background: '#0f172a',
                color: '#ffffff',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'default',
                opacity: 0.95
              }}
            >
              <Mail size={14} color="#38bdf8" />
              <span>Contactar por Email</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
