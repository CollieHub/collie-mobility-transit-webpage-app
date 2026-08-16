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
              style={{ position: 'relative', flexShrink: 0, width: '100%', height: '100%', background: banner.color || '#FFE600', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '16px', boxSizing: 'border-box' }}
            >
              {banner.imageUrl ? (
                <div style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden', border: `2px solid ${banner.border || '#ccc'}` }}>
                  <img src={banner.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Ad" draggable={false} />
                </div>
              ) : (
                <div style={{ padding: '24px', border: `2px solid ${banner.border || '#E6CF00'}`, borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '90%', height: '90%', background: 'rgba(255,255,255,0.2)' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 900, color: banner.text || '#2D3277', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', userSelect: 'none', marginBottom: '8px' }}>{banner.title}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: banner.text || '#2D3277', opacity: 0.9, textAlign: 'center', userSelect: 'none' }}>{banner.subtitle}</span>
                </div>
              )}
              {banner.redirectUrl && (
                <div 
                  style={{
                    position: 'absolute', top: '10px', right: '12px',
                    background: 'rgba(0,0,0,0.1)', borderRadius: '12px', padding: '4px 8px',
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem',
                    fontWeight: 700, color: banner.text || '#2D3277'
                  }}
                >
                  <ExternalLink size={12} />
                  <span>Ver oferta</span>
                </div>
              )}
              <button 
                onClick={(e) => { e.stopPropagation(); onBannerDoubleClick(actualBannerIdx); }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{ position: 'absolute', bottom: '12px', right: '12px', background: banner.text || '#2D3277', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.85, transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                onMouseOut={(e) => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1)'; }}
                title="Ampliar anuncio"
              >
                <Maximize2 size={14} strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
