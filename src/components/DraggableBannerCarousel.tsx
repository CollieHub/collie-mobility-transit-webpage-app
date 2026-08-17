import React, { useState, useEffect, useRef } from 'react';
import { Maximize2, ExternalLink } from 'lucide-react';

interface Banner {
  title: string;
  subtitle: string;
  color?: string;
  text?: string;
  border?: string;
  imageUrl?: string;
  redirectUrl?: string;
}

interface DraggableBannerCarouselProps {
  slotIndex: number;
  activeBanner: number;
  banners: Banner[];
  onBannerChange: (idx: number) => void;
  onBannerDoubleClick: (bannerIdx: number) => void;
}

export default function DraggableBannerCarousel({
  activeBanner,
  banners,
  onBannerChange,
  onBannerDoubleClick
}: DraggableBannerCarouselProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const wheelCooldownRef = useRef(false);
  
  const [localIndex, setLocalIndex] = useState(activeBanner + 1);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const prevActiveBannerRef = useRef(activeBanner);

  const n = banners.length;

  useEffect(() => {
    const prev = prevActiveBannerRef.current;
    if (prev === activeBanner) return;

    setTransitionEnabled(true);

    if (prev === n - 1 && activeBanner === 0) {
      setLocalIndex(n + 1); // animate to clone 0
      const timer = setTimeout(() => {
        setTransitionEnabled(false);
        setLocalIndex(1); // instantly move to actual 0
      }, 550);
      prevActiveBannerRef.current = activeBanner;
      return () => clearTimeout(timer);
    } else if (prev === 0 && activeBanner === n - 1) {
      setLocalIndex(0); // animate to clone n-1
      const timer = setTimeout(() => {
        setTransitionEnabled(false);
        setLocalIndex(n); // instantly move to actual n-1
      }, 550);
      prevActiveBannerRef.current = activeBanner;
      return () => clearTimeout(timer);
    } else {
      setLocalIndex(activeBanner + 1);
      prevActiveBannerRef.current = activeBanner;
    }
  }, [activeBanner, n]);

  useEffect(() => {
    if (!isHovered) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onBannerChange((activeBanner - 1 + n) % n);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onBannerChange((activeBanner + 1) % n);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHovered, activeBanner, onBannerChange, n]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setDragOffset(e.clientY - startY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    // Umbral para cambiar de diapositiva (50px)
    if (dragOffset < -50) {
      onBannerChange((activeBanner + 1) % n);
    } else if (dragOffset > 50) {
      onBannerChange((activeBanner - 1 + n) % n);
    }
    setDragOffset(0);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (wheelCooldownRef.current) return;
    
    if (e.deltaY > 20) {
      wheelCooldownRef.current = true;
      onBannerChange((activeBanner + 1) % n);
      setTimeout(() => { wheelCooldownRef.current = false; }, 800);
    } else if (e.deltaY < -20) {
      wheelCooldownRef.current = true;
      onBannerChange((activeBanner - 1 + n) % n);
      setTimeout(() => { wheelCooldownRef.current = false; }, 800);
    }
  };

  const currentTranslate = -(localIndex * 100);
  const transitionStyle = isDragging || !transitionEnabled ? 'none' : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';

  if (n === 0) return null;

  return (
    <div 
      style={{ 
        flex: 1, width: '100%', minHeight: '120px', overflow: 'hidden', borderRadius: '12px', 
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', pointerEvents: 'auto', position: 'relative', 
        cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' 
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onWheel={handleWheel}
    >
      <div style={{ display: 'flex', flexDirection: 'column', transition: transitionStyle, transform: `translateY(calc(${currentTranslate}% + ${dragOffset}px))`, height: '100%' }}>
        {[banners[n - 1], ...banners, banners[0]].map((banner, arrIdx) => {
          const actualBannerIdx = arrIdx === 0 ? n - 1 : arrIdx === n + 1 ? 0 : arrIdx - 1;
          return (
            <div 
              key={arrIdx} 
              onClick={() => {
                if (banner.redirectUrl) {
                  window.open(banner.redirectUrl, '_blank', 'noopener,noreferrer');
                } else {
                  onBannerDoubleClick(actualBannerIdx);
                }
              }}
              onDoubleClick={() => onBannerDoubleClick(actualBannerIdx)} 
              style={{ 
                position: 'relative', 
                flexShrink: 0, 
                width: '100%', 
                height: '100%', 
                background: banner.color || '#FFE600', 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer', 
                padding: '12px 14px', 
                boxSizing: 'border-box',
                borderRadius: '16px'
              }}
            >
              {banner.imageUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', height: '100%' }}>
                  <div style={{ 
                    width: '92px', 
                    height: '92px', 
                    minWidth: '92px', 
                    background: '#ffffff', 
                    borderRadius: '12px', 
                    overflow: 'hidden', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    padding: '4px',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.1)',
                    border: '1px solid rgba(0,0,0,0.06)'
                  }}>
                    <img src={banner.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Ad" draggable={false} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ background: '#2D3277', color: '#FFE600', fontSize: '0.62rem', fontWeight: 900, padding: '2px 5px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Meli
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2D3277', opacity: 0.9 }}>
                        ⚡ OFERTA
                      </span>
                    </div>
                    <span style={{ fontSize: '0.96rem', fontWeight: 900, color: banner.text || '#2D3277', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '3px' }}>
                      {banner.title}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', opacity: 0.9, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {banner.subtitle}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '16px', border: `2px solid ${banner.border || '#E6CF00'}`, borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'rgba(255,255,255,0.2)' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900, color: banner.text || '#2D3277', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', userSelect: 'none', marginBottom: '6px' }}>{banner.title}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: banner.text || '#2D3277', opacity: 0.9, textAlign: 'center', userSelect: 'none' }}>{banner.subtitle}</span>
                </div>
              )}
              {banner.redirectUrl && (
                <div 
                  style={{
                    position: 'absolute', top: '8px', right: '10px',
                    background: 'rgba(0,0,0,0.08)', borderRadius: '10px', padding: '3px 6px',
                    display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem',
                    fontWeight: 800, color: banner.text || '#2D3277'
                  }}
                >
                  <ExternalLink size={11} />
                  <span>Ver oferta</span>
                </div>
              )}
              <button 
                onClick={(e) => { e.stopPropagation(); onBannerDoubleClick(actualBannerIdx); }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{ position: 'absolute', bottom: '8px', right: '8px', background: banner.text || '#2D3277', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.85, transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                onMouseOut={(e) => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1)'; }}
                title="Ampliar anuncio"
              >
                <Maximize2 size={12} strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
