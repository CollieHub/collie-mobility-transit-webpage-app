import React, { useState } from 'react';
import { Megaphone, ChevronRight, ChevronLeft, Sparkles, TrendingUp, Users, MapPin, MessageCircle, Mail, CheckCircle2 } from 'lucide-react';

interface AdvertiseHereColumnProps {
  className?: string;
  style?: React.CSSProperties;
  contactEmail?: string;
  whatsappNumber?: string;
}

export default function AdvertiseHereColumn({
  className = '',
  style = {},
  contactEmail = 'contacto@pordondeviene.ar',
  whatsappNumber = '5493487000000'
}: AdvertiseHereColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactCompany, setContactCompany] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isSent, setIsSent] = useState(false);

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent('¡Hola! Me gustaría consultar por espacios publicitarios en Por Dónde Viene.');
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleOpenEmail = () => {
    const subject = encodeURIComponent('Consulta de Publicidad en Por Dónde Viene');
    const body = encodeURIComponent('Hola equipo de Por Dónde Viene,\n\nMe gustaría recibir información y tarifas sobre los espacios publicitarios disponibles en la plataforma.\n\nNombre / Empresa:\nTeléfono de contacto:\n\nMuchas gracias.');
    window.open(`mailto:${contactEmail}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleSendForm = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSent(true);
    setTimeout(() => {
      setIsSent(false);
      setShowContactModal(false);
      setContactName('');
      setContactCompany('');
      setContactMessage('');
    }, 2500);
  };

  return (
    <>
      <div
        className={`advertise-right-column ${className}`}
        style={{
          position: 'absolute',
          top: '56px',
          right: '16px',
          bottom: '100px',
          width: isCollapsed ? '48px' : '320px',
          zIndex: 900,
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: '24px',
          border: '3px solid #38bdf8',
          boxShadow: '0 12px 40px rgba(14, 165, 233, 0.18)',
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
            background: '#0f172a',
            color: '#38bdf8',
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
          title={isCollapsed ? 'Expandir panel de publicidad' : 'Ocultar panel'}
        >
          {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* Collapsed State: Vertical Strip */}
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
              background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)'
            }}
          >
            <div style={{ transform: 'rotate(90deg)', whiteSpace: 'nowrap', fontWeight: 900, fontSize: '0.85rem', color: '#38bdf8', letterSpacing: '2px' }}>
              ANUNCIE AQUÍ
            </div>
            <Megaphone size={20} color="#38bdf8" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div
              style={{
                padding: '16px 16px 14px 48px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                borderBottom: '2px solid rgba(56, 189, 248, 0.2)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span
                  style={{
                    background: 'rgba(56, 189, 248, 0.2)',
                    color: '#38bdf8',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Sparkles size={11} /> Espacio Disponible
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Megaphone size={18} color="#38bdf8" /> Anuncie Aquí
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.2 }}>
                Destacá tu marca ante miles de pasajeros todos los días
              </p>
            </div>

            {/* Scrollable Content Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {/* Highlight Hero Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(56, 189, 248, 0.04) 100%)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '16px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: '#0284c7',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                      Máxima Visibilidad Local
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Audiencia activa mientras viaja
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0284c7', fontSize: '0.7rem', fontWeight: 700 }}>
                      <Users size={12} /> +50.000
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Visitas mensuales</div>
                  </div>
                  <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontSize: '0.7rem', fontWeight: 700 }}>
                      <MapPin size={12} /> 100% Local
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Zárate y alrededores</div>
                  </div>
                </div>
              </div>

              {/* Benefits List */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ¿Por qué promocionar aquí?
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem', color: '#475569' }}>
                  <CheckCircle2 size={15} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>Posicionamiento Premium:</strong> Tu negocio visible al lado del mapa de recorridos.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem', color: '#475569' }}>
                  <CheckCircle2 size={15} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>Enlace directo a WhatsApp:</strong> Tráfico directo a tu catálogo o local.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem', color: '#475569' }}>
                  <CheckCircle2 size={15} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>Planes flexibles:</strong> Banners semanales, mensuales o exclusivos.</span>
                </div>
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div
              style={{
                padding: '12px 14px',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <button
                onClick={handleOpenWhatsApp}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: '#25D366',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.05)'}
                onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
              >
                <MessageCircle size={17} /> Consultar por WhatsApp
              </button>

              <button
                onClick={handleOpenEmail}
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = '#1e293b'}
                onMouseOut={e => e.currentTarget.style.background = '#0f172a'}
              >
                <Mail size={14} color="#38bdf8" /> Contactar por Email
              </button>
            </div>
          </>
        )}
      </div>

      {/* Contact Modal */}
      {showContactModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowContactModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            {isSent ? (
              <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                <CheckCircle2 size={48} color="#059669" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ margin: '0 0 6px', fontSize: '1.2rem', color: '#0f172a' }}>¡Mensaje Enviado!</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  Nos pondremos en contacto con vos a la brevedad.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendForm} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Solicitar Espacio Publicitario
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
                  >
                    ✕
                  </button>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Nombre / Contacto</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    placeholder="Tu nombre completo"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Comercio / Empresa</label>
                  <input
                    type="text"
                    required
                    value={contactCompany}
                    onChange={e => setContactCompany(e.target.value)}
                    placeholder="Nombre del local o negocio"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Mensaje o Consulta</label>
                  <textarea
                    rows={3}
                    value={contactMessage}
                    onChange={e => setContactMessage(e.target.value)}
                    placeholder="Contanos sobre tu negocio o qué tipo de anuncio te interesa..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', resize: 'none' }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '10px',
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Enviar Consulta
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
