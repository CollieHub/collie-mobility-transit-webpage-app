import { useState, useEffect } from 'react';

export function useIsPWA() {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const checkPWA = () => {
      // 1. Detectar display-mode standalone (estándar para PWA instalada)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

      // 2. Detectar standalone en iOS (Safari PWA)
      const isIOSStandalone = (window.navigator as any).standalone === true;

      // 3. Detectar si viene referido por app externa/TWA o contiene parámetro PWA
      const isUrlPWA = window.location.search.includes('utm_source=pwa') || 
                        document.referrer.includes('android-app://');

      setIsPWA(isStandalone || isIOSStandalone || isUrlPWA);
    };

    checkPWA();

    // Listener opcional por si el modo cambia dinámicamente
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handler = (e: MediaQueryListEvent) => {
      setIsPWA(e.matches || (window.navigator as any).standalone === true);
    };

    mediaQuery.addEventListener('change', handler);
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  return isPWA;
}
