import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  FLEET_KV: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// Health Check
app.get('/health', (c) => c.json({ status: 'ok', service: 'collie-mobility-transit-webpage-app' }));

// Handshake Endpoint
app.post('/v1/handshake', (c) => c.json({ status: 'ok', token: 'public_token', expires_in: 86400 }));

// Configuration Endpoint
app.get('/v1/transit/config', (c) => c.json({ status: 'ok', features: { live_tracking: true, incidents: true }, min_app_version: '1.0.0' }));

// Incidents Endpoint
app.get('/v1/transit/incidents', (c) => c.json({ incidents: [] }));

// Ads Endpoint
app.get('/v1/transit/ads', (c) => c.json({ ads: [] }));

// 1. Líneas / Empresas públicas (Retorna las empresas reales disponibles en D1)
app.get('/v1/catalog/public/lines', async (c) => {
  try {
    const companiesRes = await c.env.DB.prepare("SELECT DISTINCT company FROM branches WHERE company IS NOT NULL AND company != '' ORDER BY company ASC").all();
    const companies = companiesRes.results.map((r: any) => r.company);
    return c.json({ success: true, lines: companies.length > 0 ? companies : ['SIT'] });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to fetch lines', details: err.message }, 500);
  }
});

// 2. Data completa del catálogo (Routes, Shapes, Stops)
app.get('/v1/catalog/public/data', async (c) => {
  try {
    const idsParam = c.req.query('ids');
    const companyParam = c.req.query('company');

    let branchesQuery = `
      SELECT b.id as branch_id, b.code as branch_code, b.name as branch_name, b.company as branch_company, b.description,
             l.id as line_id, l.code as line_code, l.name as line_name, l.color as line_color, l.jurisdiction
      FROM branches b
      JOIN lines l ON b.line_id = l.id
    `;
    let params: any[] = [];

    if (idsParam) {
      const idsList = idsParam.split(',').map(s => s.trim()).filter(Boolean);
      branchesQuery += ` WHERE b.id IN (${idsList.map(() => '?').join(',')}) OR b.code IN (${idsList.map(() => '?').join(',')}) OR l.id IN (${idsList.map(() => '?').join(',')})`;
      params = [...idsList, ...idsList, ...idsList];
    } else if (companyParam && companyParam.toUpperCase() !== 'ALL') {
      const filter = `%${companyParam.trim()}%`;
      branchesQuery += ` WHERE b.company LIKE ? OR l.company LIKE ?`;
      params = [filter, filter];
    }

    branchesQuery += ' ORDER BY l.code ASC, b.code ASC';

    const branchesRes = await c.env.DB.prepare(branchesQuery).bind(...params).all();
    const branches = branchesRes.results;

    const routes = await Promise.all(branches.map(async (b: any) => {
      // Shapes / Trazados (se incluyen ambos campos 'type' y 'direction' para compatibilidad total con el mapa React-Leaflet)
      const shapesRes = await c.env.DB.prepare('SELECT * FROM route_shapes WHERE branch_id = ?').bind(b.branch_id).all();
      const directions = shapesRes.results.map((s: any) => ({
        type: s.direction,
        direction: s.direction,
        coordinates: JSON.parse(s.coordinates_json || '[]'),
        distance: s.total_distance_km
      }));

      // Stops / Paradas
      const stopsRes = await c.env.DB.prepare('SELECT * FROM stops WHERE branch_id = ? ORDER BY stop_order ASC').bind(b.branch_id).all();
      const stops = stopsRes.results.map((st: any) => ({
        id: st.id,
        name: st.name,
        lat: st.lat,
        lng: st.lng,
        proj_lat: st.proj_lat,
        proj_lng: st.proj_lng,
        direction: st.direction,
        order: st.stop_order,
        color: b.line_color,
        code: b.branch_code
      }));

      return {
        id: b.branch_id,
        code: b.branch_code,
        name: b.branch_name,
        color: b.line_color,
        company: b.branch_company || 'SIT',
        jurisdiction: b.jurisdiction,
        directions,
        stops
      };
    }));

    return c.json({ success: true, routes });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to fetch catalog data', details: err.message }, 500);
  }
});

// 3. Horarios (Schedules) Multicolumna con Puntos Intermedios
app.get('/v1/catalog/public/timetables', async (c) => {
  try {
    const routeId = c.req.query('route_id');
    if (!routeId) {
      return c.json({ success: false, error: 'route_id query parameter is required' }, 400);
    }

    const ttRes = await c.env.DB.prepare(
      'SELECT s.*, b.code as branch_code FROM schedules s JOIN branches b ON s.branch_id = b.id WHERE b.id = ? OR b.line_id = ? OR b.code = ? ORDER BY s.dispatch_order ASC'
    ).bind(routeId, routeId, routeId).all();

    const rows = ttRes.results || [];
    const schedulesDict: Record<string, any> = {};

    rows.forEach((row: any) => {
      const dayTypesId = row.day_types_id === 'habil' ? 'weekday' : (row.day_types_id || row.day_type);
      const dirType = row.direction; // 'ida' or 'vuelta'
      const key = `${dayTypesId}_${dirType}`;

      if (!schedulesDict[key]) {
        let defaultHeaders: string[] = ['Salida'];
        if (row.headers_json) {
          try {
            defaultHeaders = JSON.parse(row.headers_json);
          } catch (_) {}
        }

        let headerAliases: string[] = [];
        if (row.header_aliases_json) {
          try {
            headerAliases = JSON.parse(row.header_aliases_json);
          } catch (_) {}
        }

        let stopAddresses: string[] = [];
        if (row.stop_addresses_json) {
          try {
            stopAddresses = JSON.parse(row.stop_addresses_json);
          } catch (_) {}
        }

        // Lógica de resolución: por defecto se muestra el alias cargado; si no tiene valor, se muestra la dirección de la parada
        const resolvedHeaders = defaultHeaders.map((h, i) => {
          const alias = headerAliases[i];
          if (alias && alias.trim() !== '') {
            return alias.trim();
          }
          const addr = stopAddresses[i];
          if (addr && addr.trim() !== '') {
            return addr.trim();
          }
          return h;
        });

        schedulesDict[key] = {
          dayType: dayTypesId,
          dayTypesId: dayTypesId,
          headers: resolvedHeaders,
          aliases: headerAliases,
          addresses: stopAddresses,
          matrix: [],
          rows: []
        };
      }

      let tripTimes: string[] = [];
      if (row.trip_times_json) {
        try {
          tripTimes = JSON.parse(row.trip_times_json);
        } catch (_) {}
      }
      if (!tripTimes || tripTimes.length === 0) {
        if (row.departure_time) {
          tripTimes = [row.departure_time];
        }
      }

      if (tripTimes.length > 0) {
        schedulesDict[key].matrix.push(tripTimes);
        schedulesDict[key].rows.push(tripTimes);
      }
    });

    return c.json({
      success: true,
      data: [
        {
          id: routeId,
          timetables: rows,
          schedules: schedulesDict
        }
      ]
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to fetch timetables', details: err.message }, 500);
  }
});

// 3.b Tipos de Día (Day Types) para Selección de Horarios
app.get('/v1/catalog/public/day_types', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT id, code, name, description, display_order, aws_schedule_type_prefix FROM day_types ORDER BY display_order ASC').all();
    return c.json({ success: true, day_types: results, combos: results });
  } catch (err: any) {
    return c.json({
      success: true,
      day_types: [
        { id: 'lunes_a_viernes', code: 'lunes_a_viernes', name: 'Lunes a Viernes', display_order: 1 },
        { id: 'sabados', code: 'sabados', name: 'Sábados', display_order: 2 },
        { id: 'domingos_feriados', code: 'domingos_feriados', name: 'Domingos y Feriados', display_order: 3 },
        { id: 'especial', code: 'especial', name: 'Especial (Horario Extraordinario / Invierno)', display_order: 4 }
      ]
    });
  }
});
app.get('/v1/catalog/public/day_combos', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT id, code, name, description, display_order, aws_schedule_type_prefix FROM day_types ORDER BY display_order ASC').all();
    return c.json({ success: true, combos: results, day_types: results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 3.c Estados de Ramal (Branch Statuses)
app.get('/v1/catalog/public/branch_statuses', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT id, code, name, description, color FROM branch_statuses ORDER BY id ASC').all();
    return c.json({ success: true, branch_statuses: results });
  } catch (err: any) {
    return c.json({
      success: true,
      branch_statuses: [
        { id: 'status-active', code: 'active', name: 'Activo / Normal', color: '#10B981' },
        { id: 'status-interrupted', code: 'interrupted', name: 'Interrumpido', color: '#EF4444' },
        { id: 'status-reduced', code: 'reduced', name: 'Servicio Reducido', color: '#F59E0B' },
        { id: 'status-suspended', code: 'suspended', name: 'Suspendido', color: '#6B7280' }
      ]
    });
  }
});

// 4. Excepciones de Calendario
app.get('/v1/calendar_exceptions', (c) => c.json([]));

// 5. Colectivos en Vivo (Fleet State & Telemetría)
app.get('/v1/transit/buses/live', async (c) => {
  try {
    const bbox = c.req.query('bbox');
    const cachedState = await c.env.FLEET_KV.get('fleet_live_snapshot', 'json');
    const buses = (cachedState as any[]) || [];

    if (!bbox) return c.json(buses);

    const parts = bbox.split(',').map(Number);
    if (parts.length === 4 && !parts.some(isNaN)) {
      const [minLng, minLat, maxLng, maxLat] = parts;
      const filtered = buses.filter((b: any) => {
        const lat = b.lat || (b.pos ? b.pos[0] : 0);
        const lng = b.lng || (b.pos ? b.pos[1] : 0);
        return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
      });
      return c.json(filtered);
    }

    return c.json(buses);
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch live buses', details: err.message }, 500);
  }
});

// 6. Webhook de Sincronización Push desde AWS Backoffice
app.post('/v1/internal/sync-catalog', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.includes('Bearer secret-sync-key')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await c.req.json();
  return c.json({ status: 'synced', received_lines: payload.lines?.length || 0 });
});

export default app;
