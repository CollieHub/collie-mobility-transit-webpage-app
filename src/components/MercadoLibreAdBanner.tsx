import React from 'react';
import { ExternalLink, Zap, ShieldCheck, ShoppingBag } from 'lucide-react';

interface MercadoLibreAdBannerProps {
  affiliateUrl?: string;
  onOpenStrip?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function MercadoLibreAdBanner({
  affiliateUrl = 'https://meli.la/1fwfx2Y',
  onOpenStrip,
  className = '',
  style = {}
}: MercadoLibreAdBannerProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (onOpenStrip) {
      onOpenStrip();
    } else {
      window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCtaClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleClick}
      className={`meli-ad-banner ${className}`}
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #FFE600 0%, #FFF059 100%)',
        borderRadius: '16px',
        border: '2px solid #E6CF00',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        boxSizing: 'border-box',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        ...style
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
        e.currentTarget.style.boxShadow = '0 14px 35px rgba(0, 0, 0, 0.24)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)';
        e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.18)';
      }}
      title="Hacé clic para ver el catálogo de ofertas recomendadas"
    >
      {/* Background Decorative Pattern */}
      <div style={{
        position: 'absolute',
        top: '-20px',
        right: '-20px',
        width: '120px',
        height: '120px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)',
        pointerEvents: 'none'
      }} />

      {/* Left Section: Logo and Slogans */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 1, flex: 1, minWidth: 0, paddingRight: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          {/* Official Vector Handshake Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="28" height="20" viewBox="0 0 46 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 13.5C11.1 12.1 8.9 12.1 7.5 13.5L2.2 18.8C0.8 20.2 0.8 22.4 2.2 23.8L6.4 28C7.8 29.4 10 29.4 11.4 28L21.3 18.1C21.7 17.7 22.2 17.5 22.8 17.5C23.4 17.5 23.9 17.7 24.3 18.1L34.2 28C35.6 29.4 37.8 29.4 39.2 28L43.4 23.8C44.8 22.4 44.8 20.2 43.4 18.8L38.1 13.5C36.7 12.1 34.5 12.1 33.1 13.5L26.5 20.1C25.1 21.5 22.9 21.5 21.5 20.1L12.5 13.5Z" fill="#2D3277"/>
              <path d="M22.8 7.5C19.5 7.5 16.8 10.2 16.8 13.5C16.8 16.8 19.5 19.5 22.8 19.5C26.1 19.5 28.8 16.8 28.8 13.5C28.8 10.2 26.1 7.5 22.8 7.5Z" fill="#2D3277"/>
            </svg>
            <span style={{
              fontSize: '1.05rem',
              fontWeight: 900,
              color: '#2D3277',
              letterSpacing: '-0.02em',
              fontFamily: 'Inter, sans-serif'
            }}>
              mercado libre
            </span>
          </div>

          <span style={{
            background: '#2D3277',
            color: '#FFE600',
            fontSize: '0.62rem',
            fontWeight: 900,
            padding: '2px 6px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px'
          }}>
            <Zap size={10} fill="#FFE600" />
            OFICIAL
          </span>
        </div>

        <div style={{
          fontSize: '0.92rem',
          fontWeight: 800,
          color: '#1e293b',
          lineHeight: 1.25,
          marginBottom: '4px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          ⚡ Ofertas del Día y Envíos Rápidos
        </div>

        <div style={{
          fontSize: '0.76rem',
          fontWeight: 600,
          color: '#475569',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <ShieldCheck size={13} color="#15803d" />
            Compra Protegida
          </span>
          <span>•</span>
          <span>Hasta 40% OFF</span>
        </div>
      </div>

      {/* Right Section: Call To Action Buttons */}
      <div style={{ zIndex: 1, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        {onOpenStrip && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenStrip();
            }}
            style={{
              background: '#ffffff',
              color: '#2D3277',
              border: '1.5px solid #2D3277',
              borderRadius: '12px',
              padding: '9px 12px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
            onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
            title="Ver catálogo de productos"
          >
            <ShoppingBag size={14} />
            <span>Productos</span>
          </button>
        )}

        <button
          onClick={handleCtaClick}
          style={{
            background: '#2D3277',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 14px rgba(45, 50, 119, 0.3)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#1e2358';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#2D3277';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span>Ver ofertas</span>
          <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
}
