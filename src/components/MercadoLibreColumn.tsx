import React, { useState } from 'react';
import { ExternalLink, Zap, ShieldCheck, ChevronRight, ChevronLeft, ShoppingBag } from 'lucide-react';
import { type MeliProduct, useMeliProducts } from '../hooks/useMeliProducts';

interface MercadoLibreColumnProps {
  affiliateUrl?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function MercadoLibreColumn({
  affiliateUrl = 'https://meli.la/1fwfx2Y',
  className = '',
  style = {}
}: MercadoLibreColumnProps) {
  const { products, isLoading } = useMeliProducts();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleOpenMeli = (url?: string) => {
    window.open(url || affiliateUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={`meli-right-column ${className}`}
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        bottom: '48px',
        width: isCollapsed ? '48px' : '320px',
        zIndex: 1000,
        background: '#ffffff',
        borderRadius: '24px',
        border: '3px solid #FFE600',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.22)',
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
          background: '#2D3277',
          color: '#FFE600',
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
        title={isCollapsed ? 'Expandir ofertas de Mercado Libre' : 'Ocultar columna'}
      >
        {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Collapsed State: Vertical Strip with Icon */}
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
            background: 'linear-gradient(180deg, #FFE600 0%, #FFF059 100%)'
          }}
        >
          <div style={{ transform: 'rotate(90deg)', whiteSpace: 'nowrap', fontWeight: 900, fontSize: '0.85rem', color: '#2D3277', letterSpacing: '1px' }}>
            MERCADO LIBRE
          </div>
          <ShoppingBag size={20} color="#2D3277" />
        </div>
      ) : (
        <>
          {/* Header */}
          <div
            onClick={() => handleOpenMeli(affiliateUrl)}
            style={{
              padding: '16px 16px 14px 48px',
              background: 'linear-gradient(135deg, #FFE600 0%, #FFF059 100%)',
              borderBottom: '2px solid #E6CF00',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Logo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="24" height="18" viewBox="0 0 46 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12.5 13.5C11.1 12.1 8.9 12.1 7.5 13.5L2.2 18.8C0.8 20.2 0.8 22.4 2.2 23.8L6.4 28C7.8 29.4 10 29.4 11.4 28L21.3 18.1C21.7 17.7 22.2 17.5 22.8 17.5C23.4 17.5 23.9 17.7 24.3 18.1L34.2 28C35.6 29.4 37.8 29.4 39.2 28L43.4 23.8C44.8 22.4 44.8 20.2 43.4 18.8L38.1 13.5C36.7 12.1 34.5 12.1 33.1 13.5L26.5 20.1C25.1 21.5 22.9 21.5 21.5 20.1L12.5 13.5Z" fill="#2D3277"/>
                  <path d="M22.8 7.5C19.5 7.5 16.8 10.2 16.8 13.5C16.8 16.8 19.5 19.5 22.8 19.5C26.1 19.5 28.8 16.8 28.8 13.5C28.8 10.2 26.1 7.5 22.8 7.5Z" fill="#2D3277"/>
                </svg>
                <span style={{ fontSize: '1.02rem', fontWeight: 900, color: '#2D3277', letterSpacing: '-0.02em' }}>
                  mercado libre
                </span>
              </div>

              <span style={{
                background: '#2D3277',
                color: '#FFE600',
                fontSize: '0.6rem',
                fontWeight: 900,
                padding: '2px 6px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px'
              }}>
                <Zap size={9} fill="#FFE600" />
                OFICIAL
              </span>
            </div>

            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>
              ⚡ Ofertas del Día con Envíos Rápidos
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <ShieldCheck size={11} color="#15803d" />
                Compra Protegida
              </span>
              <span>•</span>
              <span>Hasta 40% OFF</span>
            </div>
          </div>

          {/* Product List Vertical Scroll */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: '#f8fafc'
            }}
          >
            {isLoading && products.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                Cargando ofertas...
              </div>
            ) : (
              products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleOpenMeli(product.redirectUrl)}
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = '#FFE600';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)';
                  }}
                >
                  {/* Badge */}
                  {product.badge && (
                    <span style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      background: '#ff7733',
                      color: '#ffffff',
                      fontSize: '0.58rem',
                      fontWeight: 900,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      zIndex: 2
                    }}>
                      {product.badge}
                    </span>
                  )}

                  {/* Image Frame */}
                  <div style={{
                    width: '100%',
                    height: '110px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#ffffff',
                    borderRadius: '10px',
                    overflow: 'hidden'
                  }}>
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                      draggable={false}
                    />
                  </div>

                  {/* Price and Discount */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                      {product.price}
                    </span>
                    {product.discount && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#00a650' }}>
                        {product.discount}
                      </span>
                    )}
                  </div>

                  {/* Installments / Shipping */}
                  {product.installments && (
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#00a650' }}>
                      {product.installments}
                    </div>
                  )}

                  {/* Title */}
                  <div style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#334155',
                    lineHeight: 1.25,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {product.title}
                  </div>

                  {/* Buy Button */}
                  <button
                    style={{
                      width: '100%',
                      background: '#2D3277',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 6px rgba(45,50,119,0.2)',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#1e2358'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#2D3277'}
                  >
                    <span>Comprar en MeLi</span>
                    <ExternalLink size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            onClick={() => handleOpenMeli(affiliateUrl)}
            style={{
              padding: '10px 14px',
              borderTop: '1px solid #e2e8f0',
              background: '#ffffff',
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.76rem',
              fontWeight: 800,
              color: '#2D3277'
            }}
          >
            <span>Ver más ofertas en Mercado Libre</span>
            <ExternalLink size={13} />
          </div>
        </>
      )}
    </div>
  );
}
