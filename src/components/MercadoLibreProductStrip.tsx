import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Zap, ShieldCheck } from 'lucide-react';
import { type MeliProduct, useMeliProducts } from '../hooks/useMeliProducts';

interface MercadoLibreProductStripProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function MercadoLibreProductStrip({
  className = '',
  style = {}
}: MercadoLibreProductStripProps) {
  const { products, isLoading } = useMeliProducts();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (isLoading || products.length === 0) {
    return null;
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleProductClick = (product: MeliProduct) => {
    window.open(product.redirectUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={`meli-product-strip ${className}`}
      style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '2px solid #FFE600',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.16)',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        userSelect: 'none',
        ...style
      }}
    >
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Logo Mercado Libre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="24" height="18" viewBox="0 0 46 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 13.5C11.1 12.1 8.9 12.1 7.5 13.5L2.2 18.8C0.8 20.2 0.8 22.4 2.2 23.8L6.4 28C7.8 29.4 10 29.4 11.4 28L21.3 18.1C21.7 17.7 22.2 17.5 22.8 17.5C23.4 17.5 23.9 17.7 24.3 18.1L34.2 28C35.6 29.4 37.8 29.4 39.2 28L43.4 23.8C44.8 22.4 44.8 20.2 43.4 18.8L38.1 13.5C36.7 12.1 34.5 12.1 33.1 13.5L26.5 20.1C25.1 21.5 22.9 21.5 21.5 20.1L12.5 13.5Z" fill="#2D3277"/>
              <path d="M22.8 7.5C19.5 7.5 16.8 10.2 16.8 13.5C16.8 16.8 19.5 19.5 22.8 19.5C26.1 19.5 28.8 16.8 28.8 13.5C28.8 10.2 26.1 7.5 22.8 7.5Z" fill="#2D3277"/>
            </svg>
            <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#2D3277', letterSpacing: '-0.02em' }}>
              mercado libre
            </span>
          </div>

          <span style={{
            background: '#FFE600',
            color: '#2D3277',
            fontSize: '0.68rem',
            fontWeight: 900,
            padding: '3px 8px',
            borderRadius: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Zap size={10} fill="#2D3277" />
            OFERTAS RECOMENDADAS
          </span>
        </div>

        {/* Navigation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => scroll('left')}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#334155',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
            onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
            title="Anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scroll('right')}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#334155',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
            onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
            title="Siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Products Horizontal Carousel */}
      <div
        ref={scrollContainerRef}
        style={{
          display: 'flex',
          gap: '14px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: '4px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => handleProductClick(product)}
            style={{
              flex: '0 0 220px',
              scrollSnapAlign: 'start',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '12px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              cursor: 'pointer',
              position: 'relative',
              transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.borderColor = '#FFE600';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.borderColor = '#e2e8f0';
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
                fontSize: '0.62rem',
                fontWeight: 900,
                padding: '2px 6px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                zIndex: 2
              }}>
                {product.badge}
              </span>
            )}

            {/* Product Image */}
            <div style={{
              width: '100%',
              height: '110px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
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

            {/* Price & Discount */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                {product.price}
              </span>
              {product.discount && (
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#00a650' }}>
                  {product.discount}
                </span>
              )}
            </div>

            {/* Installments */}
            {product.installments && (
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#00a650', marginBottom: '6px' }}>
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
              overflow: 'hidden',
              flex: 1,
              marginBottom: '10px'
            }}>
              {product.title}
            </div>

            {/* CTA Button */}
            <button
              style={{
                width: '100%',
                background: '#2D3277',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '0.74rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#1e2358'}
              onMouseOut={(e) => e.currentTarget.style.background = '#2D3277'}
            >
              <span>Ver en MeLi</span>
              <ExternalLink size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
