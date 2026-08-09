import React, { useState } from 'react';
import { Shield, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

interface AdminLoginViewProps {
  onLoginSuccess: (token: string) => void;
  onCancel: () => void;
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

export default function AdminLoginView({ onLoginSuccess, onCancel }: AdminLoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLocalEnvironment = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Procesar redirección con hash de Cognito (Google login)
  React.useEffect(() => {
    console.log('[Cognito Auth] URL actual:', window.location.href);
    console.log('[Cognito Auth] Hash:', window.location.hash);
    console.log('[Cognito Auth] Query String:', window.location.search);

    // 1. Chequear errores de Cognito en la URL (query string o hash)
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = window.location.hash ? new URLSearchParams(window.location.hash.substring(1)) : null;

    const cognitoError = urlParams.get('error') || hashParams?.get('error');
    const cognitoDesc = urlParams.get('error_description') || hashParams?.get('error_description');

    if (cognitoError) {
      console.error('[Cognito Auth] Error en redirección:', cognitoError, cognitoDesc);
      setError(`Error de autenticación de Cognito: ${cognitoError} ${cognitoDesc ? `(${cognitoDesc})` : ''}`);
      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // 2. Procesar el Token si existe en el hash
    if (hashParams) {
      const idToken = hashParams.get('id_token');
      if (idToken) {
        setIsLoading(true);
        console.log('[Cognito Auth] Detectado id_token, procesando claims...');
        try {
          const claims = parseJwt(idToken);
          console.log('[Cognito Auth] Claims decodificados:', claims);
          
          if (!claims) {
            throw new Error('Token JWT inválido o malformado');
          }

          const userEmail = claims.email || '';
          console.log('[Cognito Auth] Correo del token:', userEmail);

          if (userEmail.toLowerCase() === 'moreirajonatan1983@gmail.com') {
            window.history.replaceState({}, document.title, window.location.pathname);
            console.log('[Cognito Auth] Acceso concedido, redirigiendo a la app...');
            onLoginSuccess(idToken);
          } else {
            setError(`Acceso denegado: el correo ${userEmail} no está autorizado.`);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (e: any) {
          console.error('[Cognito Auth] Error al decodificar token JWT:', e);
          setError(`Error al procesar el token de Google: ${e.message || e}`);
          window.history.replaceState({}, document.title, window.location.pathname);
        } finally {
          setIsLoading(false);
        }
      }
    }
  }, [onLoginSuccess]);

  const handleGoogleLogin = () => {
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || '3v36jiv38j2chslodhs8oqdodd';
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN || 'auth.pordondeviene.ar';
    const redirectUri = `${window.location.origin}/login`;
    const googleLoginUrl = `https://${cognitoDomain}/oauth2/authorize?identity_provider=Google&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&client_id=${clientId}&scope=email+openid+profile`;
    window.location.href = googleLoginUrl;
  };

  const handleLocalBypass = () => {
    localStorage.setItem('developer_bypass', 'true');
    onLoginSuccess('mock-admin-token');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Por favor, ingresa tu correo y contraseña.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_d8CouTqrR';
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || '3v36jiv38j2chslodhs8oqdodd';
    const region = userPoolId ? userPoolId.split('_')[0] : 'us-east-1';

    try {
      const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
        },
        body: JSON.stringify({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: clientId,
          AuthParameters: {
            USERNAME: email.trim(),
            PASSWORD: password
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Manejar errores típicos de Cognito de forma amigable
        const errorType = data.__type || '';
        let friendlyMessage = 'Error al iniciar sesión. Verifica tus credenciales.';
        
        if (errorType.includes('NotAuthorizedException')) {
          friendlyMessage = 'Usuario o contraseña incorrectos.';
        } else if (errorType.includes('UserNotConfirmedException')) {
          friendlyMessage = 'Tu cuenta aún no ha sido confirmada.';
        } else if (errorType.includes('UserNotFoundException')) {
          friendlyMessage = 'El usuario ingresado no existe.';
        } else if (errorType.includes('PasswordResetRequiredException')) {
          friendlyMessage = 'Debes restablecer tu contraseña para ingresar.';
        } else if (data.message) {
          friendlyMessage = data.message;
        }
        
        throw new Error(friendlyMessage);
      }

      if (data.AuthenticationResult && data.AuthenticationResult.IdToken) {
        const token = data.AuthenticationResult.IdToken;
        const claims = parseJwt(token);
        const userEmail = claims?.email || '';
        if (userEmail.toLowerCase() !== 'moreirajonatan1983@gmail.com') {
          throw new Error('Acceso denegado: este correo no está autorizado.');
        }
        onLoginSuccess(token);
      } else {
        throw new Error('No se recibió el token de sesión de AWS.');
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado al conectar con el servicio.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at 10% 20%, rgba(30, 41, 59, 1) 0%, rgba(15, 23, 42, 1) 90%)',
      fontFamily: "'Inter', -apple-system, sans-serif",
      boxSizing: 'border-box',
      padding: '20px',
      color: '#f8fafc'
    }}>
      {/* Estilos locales para animaciones y foco */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .login-card {
          animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          background: rgba(30, 41, 59, 0.45);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          border-radius: 24px;
          padding: 40px;
          width: 100%;
          max-width: 420px;
          box-sizing: border-box;
          text-align: center;
        }
        .input-group {
          position: relative;
          width: 100%;
          margin-bottom: 20px;
        }
        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
          transition: color 0.2s;
        }
        .login-input {
          width: 100%;
          padding: 14px 14px 14px 44px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f8fafc;
          font-size: 0.95rem;
          font-family: inherit;
          outline: none;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        .login-input:focus {
          border-color: #3b82f6;
          background: rgba(15, 23, 42, 0.8);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }
        .login-input:focus + .input-icon {
          color: #3b82f6;
        }
        .password-toggle-btn {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .submit-btn {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          background: #3b82f6;
          color: white;
          border: none;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
        }
        .submit-btn:hover:not(:disabled) {
          background: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.35);
        }
        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .cancel-link {
          display: inline-block;
          margin-top: 20px;
          font-size: 0.85rem;
          color: #94a3b8;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.2s;
        }
        .cancel-link:hover {
          color: #3b82f6;
          text-decoration: underline;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>

      <div className="login-card">
        {/* Cabecera del login */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1.5px solid rgba(59, 130, 246, 0.3)',
            padding: '12px',
            borderRadius: '16px',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Shield size={28} />
          </div>
        </div>
        
        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
          Control de Acceso
        </h2>
        <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: '0 0 32px 0', lineHeight: 1.4 }}>
          Inicia sesión para ingresar con tu cuenta de administrador
        </p>

        {/* Mensaje de Error */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '0.85rem',
            color: '#ef4444',
            textAlign: 'left',
            marginBottom: '24px',
            lineHeight: 1.45
          }}>
            {error}
          </div>
        )}



        {/* Botón de Google */}
        <button 
          onClick={handleGoogleLogin} 
          onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
          onMouseOut={e => e.currentTarget.style.background = 'white'}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            background: 'white',
            color: '#1e293b',
            border: 'none',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            marginBottom: '16px'
          }}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 8 12.5a5.99 5.99 0 0 1 5.99-6.01c2.443 0 4.5 1.096 5.86 2.865l3.29-3.29C20.67 3.73 17.562 2 13.99 2C8.472 2 4 6.472 4 12s4.472 10 9.99 10c5.398 0 9.87-3.87 9.87-9.87c0-.629-.057-1.258-.17-1.845H12.24Z" />
          </svg>
          <span>Ingresar con Google</span>
        </button>

        {/* Botón de Bypass Local si aplica */}
        {isLocalEnvironment && (
          <button 
            onClick={handleLocalBypass} 
            onMouseOver={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}
            type="button"
          >
            <span>Acceder con Bypass (Local)</span>
          </button>
        )}

        {/* Cancelar / Volver al mapa */}
        <span onClick={onCancel} className="cancel-link">
          Volver al mapa público
        </span>
      </div>
    </div>
  );
}
