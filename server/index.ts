import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  FLEET_KV: KVNamespace;
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
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

// Helper para obtener la versión actual de la caché (invalida instantáneamente todo al cambiar de versión)
async function getCacheVersion(kv: any): Promise<string> {
  if (!kv) return 'v1';
  try {
    const v = await kv.get('cache:global:version');
    return v || 'v1';
  } catch (_) {
    return 'v1';
  }
}

// Endpoint de Purga / Invalidation de Caché del Servidor
const handleCachePurge = async (c: any) => {
  try {
    if (!c.env.FLEET_KV) {
      return c.json({ success: false, error: 'KV Namespace not configured' }, 500);
    }
    const currentV = await getCacheVersion(c.env.FLEET_KV);
    const versionNum = parseInt(currentV.replace('v', ''), 10) || 1;
    const newVersion = `v${versionNum + 1}`;

    await c.env.FLEET_KV.put('cache:global:version', newVersion);

    return c.json({
      success: true,
      message: 'Todas las cachés del servidor fueron invalidadas exitosamente',
      previous_version: currentV,
      new_version: newVersion,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
};

app.post('/v1/admin/cache/purge', handleCachePurge);
app.get('/v1/admin/cache/purge', handleCachePurge);

// 1. Líneas / Empresas públicas (Retorna las empresas reales disponibles en D1) + Caché KV (15 min)
app.get('/v1/catalog/public/lines', async (c) => {
  try {
    const v = await getCacheVersion(c.env.FLEET_KV);
    const cacheKey = `cache:${v}:lines`;

    if (c.env.FLEET_KV) {
      try {
        const cachedStr = await c.env.FLEET_KV.get(cacheKey);
        if (cachedStr) {
          c.header('Cache-Control', 'public, max-age=900, s-maxage=900, stale-while-revalidate=120');
          c.header('X-Cache-Status', 'HIT-KV');
          return c.json(JSON.parse(cachedStr));
        }
      } catch (_) {}
    }

    const companiesRes = await c.env.DB.prepare("SELECT DISTINCT company FROM branches WHERE company IS NOT NULL AND company != '' ORDER BY company ASC").all();
    const companies = companiesRes.results.map((r: any) => r.company);
    const payload = { success: true, lines: companies.length > 0 ? companies : ['SIT'] };

    if (c.env.FLEET_KV) {
      try {
        await c.env.FLEET_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 900 });
      } catch (_) {}
    }

    c.header('Cache-Control', 'public, max-age=900, s-maxage=900, stale-while-revalidate=120');
    c.header('X-Cache-Status', 'MISS-D1');
    return c.json(payload);
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to fetch lines', details: err.message }, 500);
  }
});

// 2. Data completa del catálogo (Routes, Shapes, Stops) + Caché KV (15 min)
app.get('/v1/catalog/public/data', async (c) => {
  try {
    const idsParam = c.req.query('ids') || '';
    const companyParam = c.req.query('company') || '';

    const v = await getCacheVersion(c.env.FLEET_KV);
    const cacheKey = `cache:${v}:data:${idsParam.trim()}:${companyParam.trim()}`;

    if (c.env.FLEET_KV) {
      try {
        const cachedStr = await c.env.FLEET_KV.get(cacheKey);
        if (cachedStr) {
          c.header('Cache-Control', 'public, max-age=900, s-maxage=900, stale-while-revalidate=120');
          c.header('X-Cache-Status', 'HIT-KV');
          return c.json(JSON.parse(cachedStr));
        }
      } catch (_) {}
    }

    let branchesQuery = `
      SELECT b.id as branch_id, b.code as branch_code, b.name as branch_name, b.company as branch_company, b.description,
             l.id as line_id, l.code as line_code, l.name as line_name, l.color as line_color, l.jurisdiction,
             bs.code as status_code, bs.name as status_name, bs.color as status_color
      FROM branches b
      JOIN lines l ON b.line_id = l.id
      LEFT JOIN branch_statuses bs ON b.branch_statuses_id = bs.id
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
      // Shapes / Trazados
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
        code: b.branch_code,
        stop_group_id: st.stop_group_id || null
      }));

      return {
        id: b.branch_id,
        code: b.branch_code,
        name: b.branch_name,
        color: b.line_color,
        company: b.branch_company || 'SIT',
        jurisdiction: b.jurisdiction,
        status_code: b.status_code || 'active',
        status_name: b.status_name || 'Activo / Normal',
        status_color: b.status_color || '#10B981',
        directions,
        stops
      };
    }));

    const payload = { success: true, routes };

    if (c.env.FLEET_KV) {
      try {
        await c.env.FLEET_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 900 });
      } catch (_) {}
    }

    c.header('Cache-Control', 'public, max-age=900, s-maxage=900, stale-while-revalidate=120');
    c.header('X-Cache-Status', 'MISS-D1');
    return c.json(payload);
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to fetch catalog data', details: err.message }, 500);
  }
});

// 2b. Grupos de Paradas Unificadas / Estaciones (Stop Groups) + Caché KV (15 min)
app.get('/v1/catalog/public/stop_groups', async (c) => {
  try {
    const includeDisabled = c.req.query('include_disabled') === 'true';

    const v = await getCacheVersion(c.env.FLEET_KV);
    const cacheKey = `cache:${v}:stop_groups:${includeDisabled}`;

    if (c.env.FLEET_KV) {
      try {
        const cachedStr = await c.env.FLEET_KV.get(cacheKey);
        if (cachedStr) {
          c.header('Cache-Control', 'public, max-age=900, s-maxage=900, stale-while-revalidate=120');
          c.header('X-Cache-Status', 'HIT-KV');
          return c.json(JSON.parse(cachedStr));
        }
      } catch (_) {}
    }

    let query = 'SELECT * FROM stop_groups';
    if (!includeDisabled) {
      query += ' WHERE is_enabled = 1';
    }
    query += ' ORDER BY name ASC';

    const stopGroupsRes = await c.env.DB.prepare(query).all();
    const stop_groups = stopGroupsRes.results;

    const enrichedStopGroups = await Promise.all(stop_groups.map(async (sg: any) => {
      const detailsRes = await c.env.DB.prepare('SELECT * FROM stop_group_details WHERE stop_group_id = ? ORDER BY display_order ASC').bind(sg.id).all();

      const stopsRes = await c.env.DB.prepare(`
        SELECT s.id as stop_id, s.name as stop_name, s.lat, s.lng, s.direction, s.stop_order,
               b.id as branch_id, b.code as branch_code, b.name as branch_name,
               l.id as line_id, l.code as line_code, l.name as line_name, l.color as line_color
        FROM stops s
        JOIN branches b ON s.branch_id = b.id
        JOIN lines l ON b.line_id = l.id
        WHERE s.stop_group_id = ?
        ORDER BY l.code ASC, b.code ASC
      `).bind(sg.id).all();

      return {
        ...sg,
        details: detailsRes.results,
        stops: stopsRes.results
      };
    }));

    const payload = { success: true, stop_groups: enrichedStopGroups };

    if (c.env.FLEET_KV) {
      try {
        await c.env.FLEET_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 900 });
      } catch (_) {}
    }

    c.header('Cache-Control', 'public, max-age=900, s-maxage=900, stale-while-revalidate=120');
    c.header('X-Cache-Status', 'MISS-D1');
    return c.json(payload);
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to fetch stop groups', details: err.message }, 500);
  }
});

// Helper function to resolve the current active day type in Argentina Time (UTC-3)
function resolveCurrentDayType(nowDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short'
  });
  const weekdayStr = formatter.format(nowDate).toLowerCase();

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

// 3. Horarios (Schedules & Schedule Items) Multicolumna con Puntos Intermedios + Caché KV (15 min)
app.get('/v1/catalog/public/timetables', async (c) => {
  try {
    const routeId = c.req.query('route_id');
    if (!routeId) {
      return c.json({ success: false, error: 'route_id query parameter is required' }, 400);
    }

    const v = await getCacheVersion(c.env.FLEET_KV);
    const cacheKey = `cache:${v}:timetable:${routeId.trim().toLowerCase()}`;

    // 1. Intentar responder desde Cloudflare KV (Caché servidor global 15 min)
    if (c.env.FLEET_KV) {
      try {
        const cachedStr = await c.env.FLEET_KV.get(cacheKey);
        if (cachedStr) {
          c.header('Cache-Control', 'public, max-age=900, s-maxage=900, stale-while-revalidate=120');
          c.header('X-Cache-Status', 'HIT-KV');
          return c.json(JSON.parse(cachedStr));
        }
      } catch (_) {}
    }

    const upperRouteId = routeId.trim().toUpperCase();
    const schRes = await c.env.DB.prepare(
      'SELECT s.*, b.code as branch_code, dt.code as day_type_code, dt.name as day_type_name FROM schedules s JOIN branches b ON s.branch_id = b.id JOIN day_types dt ON s.day_types_id = dt.id WHERE b.id = ? OR b.line_id = ? OR b.code = ? OR b.code = ?'
    ).bind(routeId, routeId, routeId, upperRouteId).all();

    const schedulesList = schRes.results || [];
    const schedulesDict: Record<string, any> = {};

    if (schedulesList.length > 0) {
      // Obtener los ítems de horarios (schedule_items) para todas las grillas de este ramal
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

    const payload = {
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
    };

    // Guardar en Cloudflare KV con TTL de 15 minutos (900 s) para servir a otros usuarios de forma global
    if (c.env.FLEET_KV) {
      try {
        await c.env.FLEET_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 900 });
      } catch (_) {}
    }

    c.header('Cache-Control', 'public, max-age=900, s-maxage=900, stale-while-revalidate=120');
    c.header('X-Cache-Status', 'MISS-D1');
    return c.json(payload);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 3.b Tipos de Día (Day Types) para Selección de Horarios + Caché KV (15 min)
app.get('/v1/catalog/public/day_types', async (c) => {
  try {
    const includeDisabled = c.req.query('include_disabled') === 'true';

    const v = await getCacheVersion(c.env.FLEET_KV);
    const cacheKey = `cache:${v}:day_types:${includeDisabled}`;

    if (c.env.FLEET_KV) {
      try {
        const cachedStr = await c.env.FLEET_KV.get(cacheKey);
        if (cachedStr) {
          c.header('Cache-Control', 'public, max-age=900, s-maxage=900, stale-while-revalidate=120');
          c.header('X-Cache-Status', 'HIT-KV');
          return c.json(JSON.parse(cachedStr));
        }
      } catch (_) {}
    }

    const sql = includeDisabled 
      ? 'SELECT id, code, name, description, display_order, aws_schedule_type_prefix, is_enabled FROM day_types ORDER BY display_order ASC'
      : 'SELECT id, code, name, description, display_order, aws_schedule_type_prefix, is_enabled FROM day_types WHERE is_enabled = 1 ORDER BY display_order ASC';

    const currentDayTypeInfo = resolveCurrentDayType();
    const res = await c.env.DB.prepare(sql).all();
    const results = res.results || [];

    const payload = {
      success: true,
      currentDayType: currentDayTypeInfo.code,
      currentDayTypeName: currentDayTypeInfo.name,
      currentDayTypeId: currentDayTypeInfo.id,
      day_types: results,
      combos: results
    };

    if (c.env.FLEET_KV) {
      try {
        await c.env.FLEET_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 900 });
      } catch (_) {}
    }

    c.header('Cache-Control', 'public, max-age=900, s-maxage=900, stale-while-revalidate=120');
    c.header('X-Cache-Status', 'MISS-D1');
    return c.json(payload);
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

// 7. Endpoint de Administración: Actualizar Estado Operativo de Ramales desde Consola / Transit Core
const handleBranchStatusUpdate = async (c: any) => {
  try {
    const authHeader = c.req.header('Authorization') || c.req.header('authorization');
    if (!authHeader) {
      return c.json({ success: false, error: 'Authorization header is required (Bearer token)' }, 401);
    }

    let body: any = {};
    if (c.req.method === 'POST' || c.req.method === 'PUT') {
      try { body = await c.req.json(); } catch (_) {}
    }

    const branchIdentifier = body.branch_id || body.branch_code || body.code || c.req.query('branch_code') || c.req.query('branch_id');
    const statusCode = body.status_code || body.status || c.req.query('status_code') || c.req.query('status');

    if (!branchIdentifier) {
      return c.json({ success: false, error: 'branch_code or branch_id parameter is required' }, 400);
    }
    if (!statusCode) {
      return c.json({ success: false, error: 'status_code parameter is required (e.g. active, interrupted, reduced, suspended)' }, 400);
    }

    // 1. Validar que el estado solicitado exista en branch_statuses
    const cleanStatusCode = statusCode.trim().toLowerCase();
    const statusRes = await c.env.DB.prepare(
      'SELECT id, code, name, color FROM branch_statuses WHERE LOWER(code) = ? OR LOWER(name) = ? OR id = ?'
    ).bind(cleanStatusCode, cleanStatusCode, statusCode).all();

    const statusObj = statusRes.results?.[0];
    if (!statusObj) {
      return c.json({
        success: false,
        error: `Invalid status_code: '${statusCode}'. Valid codes: active, interrupted, reduced, suspended`
      }, 400);
    }

    // 2. Actualizar el ramal en la tabla branches
    const updateRes = await c.env.DB.prepare(
      'UPDATE branches SET branch_statuses_id = ? WHERE id = ? OR LOWER(code) = ?'
    ).bind(statusObj.id, branchIdentifier, branchIdentifier.trim().toLowerCase()).run();

    if (updateRes.meta.changes === 0) {
      return c.json({ success: false, error: `Branch not found with code or id: '${branchIdentifier}'` }, 444);
    }

    // 3. Invalidador automático de caché global en KV (Auto-Purge)
    let cachePurged = false;
    if (c.env.FLEET_KV) {
      try {
        const currentV = await getCacheVersion(c.env.FLEET_KV);
        const versionNum = parseInt(currentV.replace('v', ''), 10) || 1;
        const newVersion = `v${versionNum + 1}`;
        await c.env.FLEET_KV.put('cache:global:version', newVersion);
        cachePurged = true;
      } catch (_) {}
    }

    return c.json({
      success: true,
      message: `Estado del ramal '${branchIdentifier}' actualizado a '${statusObj.name}'`,
      branch_identifier: branchIdentifier,
      status_code: statusObj.code,
      status_name: statusObj.name,
      status_color: statusObj.color,
      cache_purged: cachePurged,
      updated_at: new Date().toISOString()
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
};

app.post('/v1/admin/branches/status', handleBranchStatusUpdate);
app.put('/v1/admin/branches/status', handleBranchStatusUpdate);
app.get('/v1/admin/branches/status', handleBranchStatusUpdate);

// SPA Fallback Route: Para cualquier ruta de cliente navegada directamente (ej: /login), servir index.html
app.notFound(async (c) => {
  if (c.req.path.startsWith('/v1/') || c.req.path.startsWith('/health')) {
    return c.json({ error: 'API Endpoint Not Found' }, 404);
  }

  if (c.env.ASSETS) {
    try {
      const rootUrl = new URL(c.req.url);
      rootUrl.pathname = '/';
      const rootRes = await c.env.ASSETS.fetch(new Request(rootUrl.toString(), c.req.raw));
      return new Response(rootRes.body, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=0, must-revalidate'
        }
      });
    } catch (_) {}
  }

  return c.text('Not Found', 404);
});

export default app;
