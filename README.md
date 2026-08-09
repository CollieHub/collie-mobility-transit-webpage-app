# 🚀 Collie Mobility Transit Webpage App (Full-Stack React + Hono + Cloudflare D1)

Aplicación pública unificada Full-Stack que brinda servicios a **Webpage App, Android, iOS y Radar** aislada 100% de la infraestructura interna de AWS a costo $0.00 USD.

---

## 📌 Arquitectura del Repositorio

- **`src/`**: Aplicación Frontend React 19 + TypeScript + Leaflet Maps.
- **`server/`**: Servidor API REST Backend Hono.js en TypeScript sobre Cloudflare Workers.
- **`schema.sql`**: Esquema DDL de Base de Datos relacional pública Cloudflare D1 (SQLite).
- **`wrangler.jsonc`**: Configuración de Cloudflare Workers, bindings a D1 (`collie-transit-db`) y KV (`FLEET_KV`).

---

## 🚀 Comandos Rápidos

```bash
# Entorno de Desarrollo Local
npm run dev

# Compilar para Producción
npm run build

# Desplegar a Cloudflare (Pages / Workers)
npm run deploy

# Migrar Esquema D1
npm run db:migrate
```
