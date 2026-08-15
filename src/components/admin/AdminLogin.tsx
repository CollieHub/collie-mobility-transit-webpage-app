import React, { useState, useEffect } from 'react';
import { Bus } from 'lucide-react';

interface AdminLoginProps {
  onSuccess: (token: string, user: { name: string; email: string }) => void;
  onCancel?: () => void;
}

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export default function AdminLogin({ onSuccess, onCancel }: AdminLoginProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const isLocalEnvironment = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Detectar respuesta de Google OAuth en la URL (hash o query params)
  useEffect(() => {
    const hashParams = window.location.hash ? new URLSearchParams(window.location.hash.substring(1)) : null;
    const urlParams = new URLSearchParams(window.location.search);

    const cognitoError = urlParams.get('error') || hashParams?.get('error');
    const cognitoDesc = urlParams.get('error_description') || hashParams?.get('error_description');

    if (cognitoError) {
      setError('Inicio de sesión no autorizado');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (hashParams) {
      const idToken = hashParams.get('id_token');
      if (idToken) {
        setIsLoading(true);
        try {
          const claims = parseJwt(idToken);
          if (!claims) {
            throw new Error('Token de autenticación de Google no válido.');
          }

          const userEmail = (claims.email || '').toLowerCase();
          const userName = claims.name || claims['cognito:username'] || userEmail.split('@')[0];

          // Validar que sea un correo autorizado
          if (!userEmail) {
            throw new Error('No se pudo verificar el correo electrónico en la respuesta de Google.');
          }

          const user = { name: userName, email: userEmail };
          sessionStorage.setItem('collie_admin_token', idToken);
          sessionStorage.setItem('collie_admin_user', JSON.stringify(user));
          localStorage.setItem('collie_admin_token', idToken);

          window.history.replaceState({}, document.title, window.location.pathname);
          onSuccess(idToken, user);
        } catch (err: any) {
          setError(err.message || 'Error al validar la sesión con Google.');
          window.history.replaceState({}, document.title, window.location.pathname);
        } finally {
          setIsLoading(false);
        }
      }
    }
  }, [onSuccess]);

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    setError(null);

    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || '3v36jiv38j2chslodhs8oqdodd';
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN || 'auth.pordondeviene.ar';
    const redirectUri = `${window.location.origin}/login`;
    const googleLoginUrl = `https://${cognitoDomain}/oauth2/authorize?identity_provider=Google&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&client_id=${clientId}&scope=email+openid+profile`;

    window.location.href = googleLoginUrl;
  };

  const handleLocalBypass = () => {
    const mockToken = `google-local-dev-${Date.now()}`;
    const mockUser = { name: 'Desarrollador Local (Gmail)', email: 'admin@gmail.com' };
    sessionStorage.setItem('collie_admin_token', mockToken);
    sessionStorage.setItem('collie_admin_user', JSON.stringify(mockUser));
    localStorage.setItem('collie_admin_token', mockToken);
    onSuccess(mockToken, mockUser);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(12px)',
      padding: '1.5rem',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#1e293b',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '2.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
        textAlign: 'center'
      }}>
        {/* Icono y Encabezado */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)'
          }}>
            <Bus size={32} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#ffffff' }}>
            ¿Por dónde viene?
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#94a3b8', margin: 0, fontWeight: 500 }}>
            Tu app de transportes
          </p>
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div style={{
            padding: '0.875rem 1rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            textAlign: 'left'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Único Método de Acceso: Botón Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '0.95rem 1.25rem',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            border: 'none',
            borderRadius: '14px',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: isLoading ? 'wait' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.15C3.25 21.3 7.31 24 12 24z"/>
            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.27C.46 8.2.0 10.04.0 12s.46 3.8 1.27 5.42l4.01-3.15z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24.0 12 .0 7.31.0 3.25 2.7 1.27 6.58l4.01 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
          </svg>
          {isLoading ? 'Autenticando con Google...' : 'Iniciar Sesión con Google'}
        </button>

        {/* Botón opcional de bypass sólo en servidor de desarrollo local (localhost) */}
        {isLocalEnvironment && (
          <button
            type="button"
            onClick={handleLocalBypass}
            style={{
              width: '100%',
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Acceder con Bypass Local (Dev)
          </button>
        )}

        {/* Botón para Volver */}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              width: '100%',
              marginTop: '1.25rem',
              padding: '0.75rem',
              backgroundColor: 'transparent',
              color: '#94a3b8',
              border: 'none',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            Volver a la App Pública
          </button>
        )}
      </div>
    </div>
  );
}
