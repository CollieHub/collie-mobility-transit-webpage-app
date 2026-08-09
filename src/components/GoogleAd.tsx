import React, { useEffect, useState, useRef } from 'react';

interface GoogleAdProps {
  adSlot: string;
  adFormat?: string;
  style?: React.CSSProperties;
  className?: string;
  onAdStateChange?: (state: 'filled' | 'unfilled' | 'blocked' | 'loading') => void;
}

// Interruptor maestro global: deshabilitado por completo (código preservado para habilitar a futuro)
const GOOGLE_ADS_GLOBAL_ENABLED = false;

export const GoogleAd: React.FC<GoogleAdProps> = ({
  adSlot,
  adFormat = 'auto',
  style,
  className = '',
  onAdStateChange
}) => {
  if (!GOOGLE_ADS_GLOBAL_ENABLED) {
    return null;
  }
  const [adStatus, setAdStatus] = useState<'loading' | 'filled' | 'unfilled' | 'blocked'>('loading');
  const insRef = useRef<HTMLModElement>(null);
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const adClientId = import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT_ID || 'ca-pub-2657816467577244';

  useEffect(() => {
    if (isDev) {
      setAdStatus('filled');
      onAdStateChange?.('filled');
      return;
    }

    let isMounted = true;

    try {
      const scriptId = 'google-adsense-sdk';
      let script = document.getElementById(scriptId) as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClientId}`;
        script.crossOrigin = 'anonymous';
        script.onerror = () => {
          if (isMounted) {
            setAdStatus('blocked');
            onAdStateChange?.('blocked');
          }
        };
        document.head.appendChild(script);
      }

      // Safe push to adsbygoogle array after ins element is rendered in DOM
      const pushTimer = setTimeout(() => {
        if (isMounted) {
          try {
            // @ts-ignore
            (window.adsbygoogle = window.adsbygoogle || []).push({});
          } catch (e) {
            console.warn("adsbygoogle push error:", e);
          }
        }
      }, 100);

      const observer = new MutationObserver(() => {
        if (!insRef.current) return;
        const statusAttr = insRef.current.getAttribute('data-ad-status');
        const hasIframe = insRef.current.querySelector('iframe');
        if (statusAttr === 'unfilled') {
          if (isMounted) {
            setAdStatus('unfilled');
            onAdStateChange?.('unfilled');
          }
        } else if (statusAttr === 'filled' || hasIframe) {
          if (isMounted) {
            setAdStatus('filled');
            onAdStateChange?.('filled');
          }
        }
      });

      if (insRef.current) {
        observer.observe(insRef.current, { attributes: true, childList: true, subtree: true });
      }

      const timeoutTimer = setTimeout(() => {
        if (isMounted && insRef.current) {
          const hasIframe = insRef.current.querySelector('iframe');
          const statusAttr = insRef.current.getAttribute('data-ad-status');
          if (!hasIframe && statusAttr !== 'filled') {
            setAdStatus('unfilled');
            onAdStateChange?.('unfilled');
          }
        }
      }, 10000);

      return () => {
        isMounted = false;
        clearTimeout(pushTimer);
        clearTimeout(timeoutTimer);
        observer.disconnect();
      };
    } catch (err) {
      console.warn("Google Adsense no se pudo cargar:", err);
      if (isMounted) {
        setAdStatus('blocked');
        onAdStateChange?.('blocked');
      }
    }
  }, [isDev, adClientId, onAdStateChange]);

  if (adStatus === 'blocked') {
    return null;
  }

  if (isDev) {
    return (
      <div 
        className={`google-ad-mockup ${className}`} 
        style={{
          background: '#f1f5f9',
          border: '2px dashed #0284c7',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0f172a',
          fontSize: '0.85rem',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 700,
          padding: '8px 12px',
          boxSizing: 'border-box',
          width: '100%',
          height: '100%',
          maxHeight: '100%',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
          ...style
        }}
      >
        <span style={{ color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.75rem', fontWeight: 800, marginBottom: '4px' }}>Anuncio Google AdSense</span>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Slot ID: {adSlot}</span>
      </div>
    );
  }

  return (
    <div className={`google-ad-container ${className}`} style={{ overflow: 'hidden', width: '100%', height: '100%', ...style }}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '100%', ...style }}
        data-ad-client={adClientId}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default GoogleAd;
