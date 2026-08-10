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

// Helper function to resolve the current active day type in Argentina Time (UTC-3)
function resolveCurrentDayType(nowDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short'
  });
  const weekdayStr = formatter.format(nowDate).toLowerCase(); // 'lun.', 'mar.', 'mié.', 'jue.', 'vie.', 'sáb.', 'dóm.'

  if (weekdayStr.startsWith('sáb') || weekdayStr.startsWith('sab')) {
    return {
      code: 'sabados',
      name: 'Sábado',
      id: '26453d08-1d87-57ea-910e-1e14de95a162'
    };
  } else if (weekdayStr.startsWith('dom') || weekdayStr.startsWith('dóm')) {
    return {
      code: 'domingos_feriados',
      name: 'Domingos y Feriados',
      id: 'ce073f89-6031-5bb6-8d6a-fc16e1b3ca1e'
    };
  }
  return {
    code: 'lunes_a_viernes',
    name: 'Lunes a Viernes',
    id: '88f18fc3-ba8e-521a-a093-07db0825cf3a'
  };
}

// 3. Horarios (Schedules & Schedule Items) Multicolumna con Puntos Intermedios
app.get('/v1/catalog/public/timetables', async (c) => {
  try {
    const routeId = c.req.query('route_id');
    if (!routeId) {
      return c.json({ success: false, error: 'route_id query parameter is required' }, 400);
    }

    // 1. Consultar grillas maestras (schedules)
    const schRes = await c.env.DB.prepare(
      'SELECT s.*, b.code as branch_code, dt.code as day_type_code, dt.name as day_type_name FROM schedules s JOIN branches b ON s.branch_id = b.id JOIN day_types dt ON s.day_types_id = dt.id WHERE b.id = ? OR b.line_id = ? OR b.code = ?'
    ).bind(routeId, routeId, routeId).all();

    const schedulesList = schRes.results || [];
    const schedulesDict: Record<string, any> = {};

    if (schedulesList.length > 0) {
      // 2. Obtener los ítems de horarios (schedule_items) para todas las grillas de este ramal
      const scheduleIds = schedulesList.map((s: any) => s.id);
      const placeholders = scheduleIds.map(() => '?').join(',');
      
      const itemsRes = await c.env.DB.prepare(
        `SELECT si.* FROM schedule_items si WHERE si.schedule_id IN (${placeholders}) ORDER BY si.dispatch_order ASC`
      ).bind(...scheduleIds).all();

      const itemsList = itemsRes.results || [];
      const itemsByScheduleId: Record<string, any[]> = {};
      itemsList.forEach((item: any) => {
        if (!itemsByScheduleId[item.schedule_id]) {
          itemsByScheduleId[item.schedule_id] = [];
        }
        itemsByScheduleId[item.schedule_id].push(item);
      });

      schedulesList.forEach((row: any) => {
        const dayTypeCode = row.day_type_code || row.day_types_id;
        const dirType = row.direction; // 'ida' or 'vuelta'
        const key = `${dayTypeCode}_${dirType}`;

        let defaultHeaders: string[] = ['Salida'];
        if (row.headers_json) {
          try { defaultHeaders = JSON.parse(row.headers_json); } catch (_) {}
        }

        let headerAliases: string[] = [];
        if (row.header_aliases_json) {
          try { headerAliases = JSON.parse(row.header_aliases_json); } catch (_) {}
        }

        let stopAddresses: string[] = [];
        if (row.stop_addresses_json) {
          try { stopAddresses = JSON.parse(row.stop_addresses_json); } catch (_) {}
        }

        const resolvedHeaders = defaultHeaders.map((h, i) => {
          const alias = headerAliases[i];
          if (alias && alias.trim() !== '') return alias.trim();
          const addr = stopAddresses[i];
          if (addr && addr.trim() !== '') return addr.trim();
          return h;
        });

        const items = itemsByScheduleId[row.id] || [];
        const matrix: string[][] = [];

        items.forEach((item: any) => {
          let tripTimes: string[] = [];
          if (item.trip_times_json) {
            try { tripTimes = JSON.parse(item.trip_times_json); } catch (_) {}
          }
          if (!tripTimes || tripTimes.length === 0) {
            if (item.departure_time) tripTimes = [item.departure_time];
          }
          if (tripTimes.length > 0) {
            matrix.push(tripTimes);
          }
        });

        schedulesDict[key] = {
          id: row.id,
          dayType: dayTypeCode,
          dayTypesId: row.day_types_id,
          dayTypeName: row.day_type_name,
          headers: resolvedHeaders,
          aliases: headerAliases,
          addresses: stopAddresses,
          matrix: matrix,
          rows: matrix
        };
      });
    }

    const currentDayTypeInfo = resolveCurrentDayType();
    let dayTypesList: any[] = [];
    try {
      const dtRes = await c.env.DB.prepare('SELECT id, code, name, description, display_order, is_enabled FROM day_types WHERE is_enabled = 1 ORDER BY display_order ASC').all();
      dayTypesList = dtRes.results || [];
    } catch (_) {}

    return c.json({
      success: true,
      data: [
        {
          id: routeId,
          currentDayType: currentDayTypeInfo.code,
          currentDayTypeName: currentDayTypeInfo.name,
          currentDayTypeId: currentDayTypeInfo.id,
          dayTypes: dayTypesList,
          timetables: schedulesList,
          schedules: schedulesDict
        }
      ]
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 3.b Tipos de Día (Day Types) para Selección de Horarios
app.get('/v1/catalog/public/day_types', async (c) => {
  try {
    const includeDisabled = c.req.query('include_disabled') === 'true';
    const sql = includeDisabled 
      ? 'SELECT id, code, name, description, display_order, aws_schedule_type_prefix, is_enabled FROM day_types ORDER BY display_order ASC'
      : 'SELECT id, code, name, description, display_order, aws_schedule_type_prefix, is_enabled FROM day_types WHERE is_enabled = 1 ORDER BY display_order ASC';
      
    const currentDayTypeInfo = resolveCurrentDayType();
    const { results } = await c.env.DB.prepare(sql).all();
    return c.json({
      success: true,
      currentDayType: currentDayTypeInfo.code,
      currentDayTypeName: currentDayTypeInfo.name,
      currentDayTypeId: currentDayTypeInfo.id,
      day_types: results,
      combos: results
    });
  } catch (err: any) {
    const currentDayTypeInfo = resolveCurrentDayType();
    const fallbackTypes = [
      { id: '88f18fc3-ba8e-521a-a093-07db0825cf3a', code: 'lunes_a_viernes', name: 'Lunes a Viernes', display_order: 1, is_enabled: 1 },
      { id: '26453d08-1d87-57ea-910e-1e14de95a162', code: 'sabados', name: 'Sábados', display_order: 2, is_enabled: 1 },
      { id: 'ce073f89-6031-5bb6-8d6a-fc16e1b3ca1e', code: 'domingos_feriados', name: 'Domingos y Feriados', display_order: 3, is_enabled: 1 }
    ];
    return c.json({
      success: true,
      currentDayType: currentDayTypeInfo.code,
      currentDayTypeName: currentDayTypeInfo.name,
      currentDayTypeId: currentDayTypeInfo.id,
      day_types: fallbackTypes,
      combos: fallbackTypes
    });
  }
});
app.get('/v1/catalog/public/day_combos', async (c) => {
  try {
    const includeDisabled = c.req.query('include_disabled') === 'true';
    const sql = includeDisabled 
      ? 'SELECT id, code, name, description, display_order, aws_schedule_type_prefix, is_enabled FROM day_types ORDER BY display_order ASC'
      : 'SELECT id, code, name, description, display_order, aws_schedule_type_prefix, is_enabled FROM day_types WHERE is_enabled = 1 ORDER BY display_order ASC';
    const { results } = await c.env.DB.prepare(sql).all();
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
