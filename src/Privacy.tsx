import React from 'react';
import './index.css';
import { useAppConfig, DEFAULT_PRIVACY_CONTENT } from './hooks/useAppConfig';

export default function Privacy() {
    const { config } = useAppConfig();

    return (
        <div style={{
            fontFamily: "'Inter', sans-serif",
            background: "#ffffff",
            color: "#0f172a",
            lineHeight: 1.7,
            padding: "2rem",
            maxWidth: "900px",
            margin: "0 auto",
            minHeight: "100vh"
        }}>
            <div style={{
                textAlign: "center",
                marginBottom: "3rem",
                paddingBottom: "2rem",
                borderBottom: "1px solid #e2e8f0"
            }}>
                <h1 style={{
                    fontSize: "2.5rem",
                    fontWeight: 800,
                    marginBottom: "0.5rem",
                    color: "#0f172a"
                }}>Políticas de Privacidad</h1>
                <p style={{ color: "#475569", fontSize: "0.9rem" }}>
                    ¿Por dónde viene? Tu app de transportes | CollieTech
                </p>
            </div>

            <div style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "2rem",
                marginBottom: "2rem",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
            }}>
                <div className="legal-content-container" dangerouslySetInnerHTML={{ __html: config?.privacy_content || DEFAULT_PRIVACY_CONTENT }} />
            </div>

            <div style={{
                textAlign: "center",
                color: "#64748b",
                fontSize: "0.85rem",
                marginTop: "3rem",
                paddingTop: "2rem",
                borderTop: "1px solid #e2e8f0"
            }}>
                <p>Al utilizar la aplicación "¿Por dónde viene?", usted declara conocer y aceptar de conformidad los términos descritos en la presente Política de Privacidad.</p>
                <p style={{ marginTop: "1rem" }}>© 2026 ¿Por dónde viene?. Todos los derechos reservados por CollieTech.</p>
            </div>
        </div>
    );
}
