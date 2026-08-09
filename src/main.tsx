import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

if (typeof window !== 'undefined') {
  const showMaintenancePage = () => {
    // Si ya existe una pantalla de mantenimiento, no duplicarla
    if (document.getElementById('maintenance-screen')) return;

    const container = document.createElement('div');
    container.id = 'maintenance-screen';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.background = '#0f172a';
    container.style.color = '#ffffff';
    container.style.zIndex = '999999';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.fontFamily = "'Inter', -apple-system, sans-serif";

    container.innerHTML = `
      <style>
        @keyframes pulse-maint {
          0% { transform: scale(0.96); opacity: 0.85; }
          50% { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(0.96); opacity: 0.85; }
        }
      </style>
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 32px;
        box-sizing: border-box;
      ">
        <div style="
          width: 80px;
          height: 80px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          animation: pulse-maint 3s infinite ease-in-out;
        ">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
        </div>
        
        <h1 style="
          font-size: 1.8rem;
          font-weight: 800;
          margin: 0 0 12px 0;
          color: #ffffff;
          letter-spacing: -0.025em;
        ">Aplicación en Mantenimiento</h1>
        
        <p style="
          font-size: 1.05rem;
          color: #94a3b8;
          margin: 0 0 28px 0;
          max-width: 440px;
          line-height: 1.6;
        ">
          Estamos realizando mejoras de rendimiento y actualizaciones del sistema en este momento. Por favor, intentá nuevamente en unos minutos.
        </p>
        
        <button onclick="window.location.reload()" style="
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 12px 24px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
          transition: transform 0.2s ease;
          outline: none;
        ">
          Reintentar cargar
        </button>
      </div>
    `;
    
    // Adjuntar al documento
    if (document.body) {
      document.body.appendChild(container);
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(container);
      });
    }
  };

  window.addEventListener('error', (event) => {
    console.error('🟢 [Runtime Error Capturado]:', event.error || event.message);
    showMaintenancePage();
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('🟢 [Unhandled Rejection Capturado]:', event.reason);
    showMaintenancePage();
  });
}

import App from './App.tsx'
import Privacy from './Privacy.tsx'

const isPrivacyRoute = window.location.pathname === '/privacy' || window.location.pathname === '/privacy/';

// Registrar Service Worker para soporte offline (solo en producción, bypass en localhost)
if ('serviceWorker' in navigator) {
  if (window.location.hostname === 'localhost') {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) console.log('🗑️ [SW] Service Worker desregistrado con éxito en localhost');
        });
      }
    });
  } else {
    // Forzar reload automático cuando el nuevo Service Worker toma el control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('🔄 [SW] Nueva versión activa. Recargando la aplicación...');
        window.location.reload();
      }
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js?v=1.0.178')
        .then((registration) => {
          console.log('🟢 [SW] Service Worker registrado con éxito en scope:', registration.scope);
        })
        .catch((error) => {
          console.error('🔴 [SW] Error al registrar el Service Worker:', error);
        });
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPrivacyRoute ? <Privacy /> : <App />}
  </StrictMode>,
)
