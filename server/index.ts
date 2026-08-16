import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  FLEET_KV: KVNamespace;
  AI?: any;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
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

// Helper para verificar si la petición proviene de un Admin logueado
function isUserAdminRequest(c: any): boolean {
  const authHeader = c.req.header('authorization') || c.req.header('Authorization') || '';
  const adminHeader = c.req.header('x-admin-token') || c.req.header('x-admin-session') || '';
  const adminQuery = c.req.query('admin');
  
  if (adminQuery === 'true' || adminQuery === '1') return true;
  if (adminHeader && adminHeader.trim().length > 0) return true;
  if (authHeader.startsWith('Bearer ') && authHeader.length > 15) return true;
  
  return false;
}

// Helper para asegurar la existencia de los 3 estados de publicación (Publicado, Borrador, No Publicado) en D1
async function ensurePublicationStatuses(db: any) {
  if (!db) return;
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO line_publication_statuses (id, code, name, description, color, display_order)
      VALUES 
        ('lpub_published', 'published', 'Publicado', 'Línea visible públicamente', '#10B981', 1),
        ('lpub_draft', 'draft', 'Borrador', 'Línea visible únicamente para Admin logueado', '#F59E0B', 2),
        ('lpub_unpublished', 'unpublished', 'No Publicado', 'Línea oculta para todos', '#EF4444', 3)
    `).run();

    await db.prepare(`
      INSERT OR IGNORE INTO branch_publication_statuses (id, code, name, description, color, display_order)
      VALUES 
        ('bpub_published', 'published', 'Publicado', 'Ramal visible públicamente', '#10B981', 1),
        ('bpub_draft', 'draft', 'Borrador', 'Ramal visible únicamente para Admin logueado', '#F59E0B', 2),
        ('bpub_unpublished', 'unpublished', 'No Publicado', 'Ramal oculto para todos', '#EF4444', 3)
    `).run();
  } catch (_) {}
}

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

async function purgeKvCache(kv: any) {
  if (!kv) return;
  try {
    const currentV = await getCacheVersion(kv);
    const versionNum = parseInt(currentV.replace('v', ''), 10) || 1;
    const newVersion = `v${versionNum + 1}`;
    await kv.put('cache:global:version', newVersion);
  } catch (_) {}
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
    await ensurePublicationStatuses(c.env.DB);
    const isAdmin = isUserAdminRequest(c);
    const v = await getCacheVersion(c.env.FLEET_KV);
    const cacheKey = `cache:${v}:lines:admin_${isAdmin}`;

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

    const lineFilter = isAdmin
      ? "(l.line_publication_statuses_id IS NULL OR l.line_publication_statuses_id != 'lpub_unpublished')"
      : "(l.line_publication_statuses_id IS NULL OR (l.line_publication_statuses_id != 'lpub_unpublished' AND l.line_publication_statuses_id != 'lpub_draft'))";

    const branchFilter = isAdmin
      ? "(b.id IS NULL OR b.branch_publication_statuses_id IS NULL OR b.branch_publication_statuses_id != 'bpub_unpublished')"
      : "(b.id IS NULL OR b.branch_publication_statuses_id IS NULL OR (b.branch_publication_statuses_id != 'bpub_unpublished' AND b.branch_publication_statuses_id != 'bpub_draft'))";

    const companiesRes = await c.env.DB.prepare(`
      SELECT DISTINCT COALESCE(NULLIF(l.code, ''), b.company) as line_code
      FROM lines l
      LEFT JOIN branches b ON b.line_id = l.id
      WHERE ${lineFilter}
        AND ${branchFilter}
      ORDER BY line_code ASC
    `).all();
    const companies = companiesRes.results.map((r: any) => r.line_code).filter(Boolean);
    const payload = { success: true, lines: companies };

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
    await ensurePublicationStatuses(c.env.DB);
    const isAdmin = isUserAdminRequest(c);
    const idsParam = c.req.query('ids') || '';
    const companyParam = c.req.query('company') || '';

    const v = await getCacheVersion(c.env.FLEET_KV);
    const cacheKey = `cache:${v}:data_v3:admin_${isAdmin}:${idsParam.trim()}:${companyParam.trim()}`;

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

    const branchFilter = isAdmin
      ? "(b.branch_publication_statuses_id IS NULL OR b.branch_publication_statuses_id != 'bpub_unpublished')"
      : "(b.branch_publication_statuses_id IS NULL OR (b.branch_publication_statuses_id != 'bpub_unpublished' AND b.branch_publication_statuses_id != 'bpub_draft'))";

    const lineFilter = isAdmin
      ? "(l.line_publication_statuses_id IS NULL OR l.line_publication_statuses_id != 'lpub_unpublished')"
      : "(l.line_publication_statuses_id IS NULL OR (l.line_publication_statuses_id != 'lpub_unpublished' AND l.line_publication_statuses_id != 'lpub_draft'))";

    let branchesQuery = `
      SELECT b.id as branch_id, b.code as branch_code, b.name as branch_name, b.company as branch_company, b.description,
             b.display_order as branch_display_order, b.branch_colors_id, b.branch_publication_statuses_id,
             l.id as line_id, l.code as line_code, l.name as line_name, l.color as line_color, l.jurisdiction, l.line_publication_statuses_id,
             bs.code as status_code, bs.name as status_name, bs.color as status_color,
             bc.code_hexa as explicit_branch_color,
             bc_by_order.code_hexa as order_branch_color
      FROM branches b
      JOIN lines l ON b.line_id = l.id
      LEFT JOIN branch_statuses bs ON b.branch_statuses_id = bs.id
      LEFT JOIN branch_colors bc ON b.branch_colors_id = bc.id
      LEFT JOIN branch_colors bc_by_order ON b.display_order = bc_by_order.display_order
      WHERE ${branchFilter}
        AND ${lineFilter}
    `;
    let params: any[] = [];

    if (idsParam) {
      const idsList = idsParam.split(',').map(s => s.trim()).filter(Boolean);
      branchesQuery += ` AND (b.id IN (${idsList.map(() => '?').join(',')}) OR b.code IN (${idsList.map(() => '?').join(',')}) OR l.id IN (${idsList.map(() => '?').join(',')}))`;
      params = [...idsList, ...idsList, ...idsList];
    } else if (companyParam && companyParam.toUpperCase() !== 'ALL') {
      const filter = `%${companyParam.trim()}%`;
      branchesQuery += ` AND (b.company LIKE ? OR l.company LIKE ?)`;
      params = [filter, filter];
    }

    branchesQuery += ' ORDER BY l.code ASC, b.display_order ASC, b.code ASC';

    const branchesRes = await c.env.DB.prepare(branchesQuery).bind(...params).all();
    const branches = branchesRes.results;

    const activeUnitsSummary = await getOrComputeActiveUnitsSummary(c.env).catch(() => null);

    // Cargar horarios (schedules & schedule_items) para todos los ramales del catálogo
    const branchIds = branches.map((b: any) => b.branch_id);
    const branchSchedulesMap: Record<string, Record<string, any>> = {};
    const branchSchedulesListMap: Record<string, any[]> = {};

    if (branchIds.length > 0) {
      const placeholders = branchIds.map(() => '?').join(',');
      const schRes = await c.env.DB.prepare(
        `SELECT s.*, b.id as branch_id, dt.code as day_type_code, dt.name as day_type_name
         FROM schedules s
         JOIN branches b ON s.branch_id = b.id
         JOIN day_types dt ON (s.day_types_id = dt.id OR s.day_types_id = dt.code)
         WHERE s.branch_id IN (${placeholders})`
      ).bind(...branchIds).all();

      const schedulesList = schRes.results || [];

      if (schedulesList.length > 0) {
        const scheduleIds = schedulesList.map((s: any) => s.id);
        const schPlaceholders = scheduleIds.map(() => '?').join(',');

        const itemsRes = await c.env.DB.prepare(
          `SELECT si.* FROM schedule_items si WHERE si.schedule_id IN (${schPlaceholders}) ORDER BY si.dispatch_order ASC`
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
          const branchId = row.branch_id;
          if (!branchSchedulesMap[branchId]) {
            branchSchedulesMap[branchId] = {};
            branchSchedulesListMap[branchId] = [];
          }

          const dayTypeCode = row.day_type_code || row.day_types_id;
          const dirType = row.direction || 'ida';
          const key = `${dayTypeCode}_${dirType}`;

          let defaultHeaders: string[] = ['Salida'];
          if (row.headers_json) {
            try { defaultHeaders = JSON.parse(row.headers_json); } catch (_) {}
          }

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

          const schObj = {
            id: row.id,
            dayType: dayTypeCode,
            dayTypesId: row.day_types_id,
            dayTypeName: row.day_type_name,
            direction: dirType,
            headers: defaultHeaders,
            matrix: matrix,
            rows: matrix
          };

          branchSchedulesMap[branchId][key] = schObj;
          branchSchedulesListMap[branchId].push({
            id: row.id,
            direction: dirType,
            direction_id: dirType === 'ida' ? '0' : '1',
            service_type: dayTypeCode,
            dayType: dayTypeCode,
            trips: matrix.map(rowTimes => ({ times: rowTimes }))
          });
        });
      }
    }

    const routes = await Promise.all(branches.map(async (b: any) => {
      const branchColor = b.explicit_branch_color || b.order_branch_color || b.line_color || '#10B981';

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
        color: branchColor,
        code: b.branch_code,
        stop_group_id: st.stop_group_id || null
      }));

      const routeActiveInfo = activeUnitsSummary?.by_route?.[b.branch_id] || activeUnitsSummary?.by_route?.[b.branch_code] || { active_units: 0, ida: 0, vuelta: 0 };
      const isPublished = (b.branch_publication_statuses_id === 'bpub_published' || !b.branch_publication_statuses_id) && 
                          (b.line_publication_statuses_id === 'lpub_published' || !b.line_publication_statuses_id);

      return {
        id: b.branch_id,
        code: b.branch_code,
        name: b.branch_name,
        color: branchColor,
        company: b.branch_company || 'SIT',
        jurisdiction: b.jurisdiction,
        status_code: b.status_code || 'active',
        status_name: b.status_name || 'Activo / Normal',
        status_color: b.status_color || '#10B981',
        branch_publication_statuses_id: b.branch_publication_statuses_id || 'bpub_published',
        line_publication_statuses_id: b.line_publication_statuses_id || 'lpub_published',
        is_published: isPublished,
        active_units_count: routeActiveInfo.active_units,
        active_units_ida: routeActiveInfo.ida,
        active_units_vuelta: routeActiveInfo.vuelta,
        directions,
        stops,
        schedules: branchSchedulesMap[b.branch_id] || {},
        schedulesList: branchSchedulesListMap[b.branch_id] || []
      };
    }));

    const payload = { 
      success: true, 
      routes,
      active_units_summary: activeUnitsSummary
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
    return c.json({ success: false, error: 'Failed to fetch catalog data', details: err.message }, 500);
  }
});

// 2b. Grupos de Paradas Unificadas / Estaciones (Stop Groups) + Caché KV (15 min)
app.get('/v1/catalog/public/stop_groups', async (c) => {
  try {
    await ensurePublicationStatuses(c.env.DB);
    const isAdmin = isUserAdminRequest(c);
    const includeDisabled = c.req.query('include_disabled') === 'true';

    const v = await getCacheVersion(c.env.FLEET_KV);
    const cacheKey = `cache:${v}:stop_groups:admin_${isAdmin}:${includeDisabled}`;

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

    const branchFilter = isAdmin
      ? "(b.branch_publication_statuses_id IS NULL OR b.branch_publication_statuses_id != 'bpub_unpublished')"
      : "(b.branch_publication_statuses_id IS NULL OR (b.branch_publication_statuses_id != 'bpub_unpublished' AND b.branch_publication_statuses_id != 'bpub_draft'))";

    const lineFilter = isAdmin
      ? "(l.line_publication_statuses_id IS NULL OR l.line_publication_statuses_id != 'lpub_unpublished')"
      : "(l.line_publication_statuses_id IS NULL OR (l.line_publication_statuses_id != 'lpub_unpublished' AND l.line_publication_statuses_id != 'lpub_draft'))";

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
          AND ${branchFilter}
          AND ${lineFilter}
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

async function resolveCurrentDayTypeAsync(db?: any, company = 'SIT', routeId?: string, nowDate = new Date()) {
  const dateStr = nowDate.toISOString().split('T')[0];

  if (db) {
    try {
      if (routeId) {
        const branchExc = await db.prepare(`
          SELECT override_day_type, description FROM calendar_exceptions
          WHERE date = ? AND (branch_id = ? OR LOWER(branch_id) = LOWER(?))
          LIMIT 1
        `).bind(dateStr, routeId, routeId).first();

        if (branchExc && branchExc.override_day_type) {
          const override = branchExc.override_day_type;
          if (override === 'saturday' || override === 'sabados') {
            return { code: 'sabados', name: 'Sábado (Excepción)', id: '26453d08-1d87-57ea-910e-1e14de95a162' };
          } else if (override === 'sunday' || override === 'domingos_feriados') {
            return { code: 'domingos_feriados', name: 'Domingos y Feriados (Excepción)', id: 'ce073f89-6031-5bb6-8d6a-fc16e1b3ca1e' };
          } else if (override === 'weekday' || override === 'lunes_a_viernes') {
            return { code: 'lunes_a_viernes', name: 'Lunes a Viernes (Excepción)', id: '88f18fc3-ba8e-521a-a093-07db0825cf3a' };
          } else {
            return { code: override, name: `Excepción (${override})`, id: override };
          }
        }
      }

      const lineExc = await db.prepare(`
        SELECT override_day_type, description FROM calendar_exceptions
        WHERE date = ? AND (company = ? OR company = 'all') AND (branch_id IS NULL OR branch_id = '')
        ORDER BY CASE WHEN company = ? THEN 1 ELSE 2 END
        LIMIT 1
      `).bind(dateStr, company, company).first();

      if (lineExc && lineExc.override_day_type) {
        const override = lineExc.override_day_type;
        if (override === 'saturday' || override === 'sabados') {
          return { code: 'sabados', name: 'Sábado (Excepción Línea)', id: '26453d08-1d87-57ea-910e-1e14de95a162' };
        } else if (override === 'sunday' || override === 'domingos_feriados') {
          return { code: 'domingos_feriados', name: 'Domingos y Feriados (Excepción Línea)', id: 'ce073f89-6031-5bb6-8d6a-fc16e1b3ca1e' };
        } else if (override === 'weekday' || override === 'lunes_a_viernes') {
          return { code: 'lunes_a_viernes', name: 'Lunes a Viernes (Excepción Línea)', id: '88f18fc3-ba8e-521a-a093-07db0825cf3a' };
        } else {
          return { code: override, name: `Excepción Línea (${override})`, id: override };
        }
      }

      const holRes = await db.prepare('SELECT name, type FROM holidays WHERE date = ?').bind(dateStr).first();
      if (holRes) {
        return {
          code: 'domingos_feriados',
          name: `Feriado (${holRes.name})`,
          id: 'ce073f89-6031-5bb6-8d6a-fc16e1b3ca1e'
        };
      }
    } catch (_) {}
  }

  return resolveCurrentDayType(nowDate);
}

// 3. Horarios (Schedules & Schedule Items) Multicolumna con Puntos Intermedios + Caché KV (15 min)
app.get('/v1/catalog/public/timetables', async (c) => {
  try {
    await ensurePublicationStatuses(c.env.DB);
    const isAdmin = isUserAdminRequest(c);
    const routeId = c.req.query('route_id');
    if (!routeId) {
      return c.json({ success: false, error: 'route_id query parameter is required' }, 400);
    }

    const v = await getCacheVersion(c.env.FLEET_KV);
    const cacheKey = `cache:${v}:timetable:admin_${isAdmin}:${routeId.trim().toLowerCase()}`;

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

    const branchFilter = isAdmin
      ? "(b.branch_publication_statuses_id IS NULL OR b.branch_publication_statuses_id != 'bpub_unpublished')"
      : "(b.branch_publication_statuses_id IS NULL OR (b.branch_publication_statuses_id != 'bpub_unpublished' AND b.branch_publication_statuses_id != 'bpub_draft'))";

    const lineFilter = isAdmin
      ? "(l.line_publication_statuses_id IS NULL OR l.line_publication_statuses_id != 'lpub_unpublished')"
      : "(l.line_publication_statuses_id IS NULL OR (l.line_publication_statuses_id != 'lpub_unpublished' AND l.line_publication_statuses_id != 'lpub_draft'))";

    const upperRouteId = routeId.trim().toUpperCase();
    const schRes = await c.env.DB.prepare(
      `SELECT s.*, b.code as branch_code, dt.code as day_type_code, dt.name as day_type_name 
       FROM schedules s 
       JOIN branches b ON s.branch_id = b.id 
       JOIN lines l ON b.line_id = l.id 
       JOIN day_types dt ON (s.day_types_id = dt.id OR s.day_types_id = dt.code) 
       WHERE (b.id = ? OR b.line_id = ? OR b.code = ? OR b.code = ?)
         AND ${branchFilter}
         AND ${lineFilter}`
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

    const currentDayTypeInfo = await resolveCurrentDayTypeAsync(c.env.DB, 'SIT', routeId);
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

    const currentDayTypeInfo = await resolveCurrentDayTypeAsync(c.env.DB);
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

// AWS SigV4 Signer & Textract Helpers for Cloudflare Workers (Native Web Crypto)
async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const keyBuffer = (key instanceof Uint8Array ? key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) : key) as ArrayBuffer;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function sha256Hex(message: string | Uint8Array): Promise<string> {
  const data = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const dataBuffer = (data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data) as ArrayBuffer;
  const hash = await crypto.subtle.digest('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256(kDate, regionName);
  const kService = await hmacSha256(kRegion, serviceName);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  return kSigning;
}

async function callAwsTextractAnalyzeDocument(
  base64Image: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string = 'us-east-1'
): Promise<any> {
  let rawBase64 = base64Image;
  if (rawBase64.includes('base64,')) {
    rawBase64 = rawBase64.split('base64,')[1];
  }

  const endpoint = `https://textract.${region}.amazonaws.com/`;
  const host = `textract.${region}.amazonaws.com`;
  const service = 'textract';

  const bodyObj = {
    Document: {
      Bytes: rawBase64
    },
    FeatureTypes: ['TABLES']
  };
  const payload = JSON.stringify(bodyObj);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.substring(0, 8);

  const contentType = 'application/x-amz-json-1.1';
  const target = 'Textract.AnalyzeDocument';

  const payloadHash = await sha256Hex(payload);
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${target}\n`;
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';

  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'Host': host,
      'X-Amz-Date': amzDate,
      'X-Amz-Target': target,
      'Authorization': authorizationHeader
    },
    body: payload
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AWS Textract API error (${res.status}): ${errText}`);
  }

  return await res.json();
}

function parseTextractBlocksToTable(blocks: any[]): { headers: string[]; matrix: string[][] } {
  const wordMap: Record<string, string> = {};
  const cellMap: Record<string, any> = {};
  const tableBlocks: any[] = [];

  for (const block of blocks) {
    if (block.BlockType === 'WORD' && block.Id && block.Text) {
      wordMap[block.Id] = block.Text;
    } else if (block.BlockType === 'CELL' && block.Id) {
      cellMap[block.Id] = block;
    } else if (block.BlockType === 'TABLE') {
      tableBlocks.push(block);
    }
  }

  if (tableBlocks.length === 0) {
    throw new Error('No se detectaron tablas en la imagen');
  }

  const table = tableBlocks[0];
  let cellIds: string[] = [];
  if (Array.isArray(table.Relationships)) {
    for (const rel of table.Relationships) {
      if (rel.Type === 'CHILD') {
        cellIds = rel.Ids || [];
        break;
      }
    }
  }

  const tempMatrix: Record<number, Record<number, string>> = {};
  let maxRow = 0;
  let maxCol = 0;

  for (const id of cellIds) {
    const cell = cellMap[id];
    if (!cell) continue;

    const rIdx = (cell.RowIndex || 1) - 1;
    const cIdx = (cell.ColumnIndex || 1) - 1;

    if (rIdx > maxRow) maxRow = rIdx;
    if (cIdx > maxCol) maxCol = cIdx;

    const cellTextParts: string[] = [];
    if (Array.isArray(cell.Relationships)) {
      for (const rel of cell.Relationships) {
        if (rel.Type === 'CHILD') {
          for (const childId of (rel.Ids || [])) {
            if (wordMap[childId]) {
              cellTextParts.push(wordMap[childId]);
            }
          }
        }
      }
    }

    if (!tempMatrix[rIdx]) tempMatrix[rIdx] = {};
    tempMatrix[rIdx][cIdx] = cellTextParts.join(' ').trim();
  }

  const rawMatrix: string[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = [];
    let hasContent = false;
    for (let c = 0; c <= maxCol; c++) {
      const val = (tempMatrix[r]?.[c]) || '';
      row.push(val);
      if (val !== '') hasContent = true;
    }
    if (hasContent) {
      rawMatrix.push(row);
    }
  }

  if (rawMatrix.length === 0) {
    throw new Error('La tabla detectada está vacía');
  }

  const headers = rawMatrix[0];
  const matrix = rawMatrix.length > 1 ? rawMatrix.slice(1) : [];

  return { headers, matrix };
}

// 3.4.1 Proxy KML para Ingestador de Recorridos desde Google My Maps
app.get('/v1/admin/kml-proxy', async (c) => {
  const mid = c.req.query('mid');
  if (!mid) {
    return c.json({ success: false, error: 'Se requiere el parámetro mid' }, 400);
  }

  try {
    const googleUrl = `https://www.google.com/maps/d/kml?mid=${encodeURIComponent(mid)}&forcekml=1`;
    const res = await fetch(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      return c.json({ success: false, error: `Error de Google My Maps (${res.status})` }, 400);
    }

    const kmlText = await res.text();
    c.header('Content-Type', 'application/xml; charset=utf-8');
    return c.text(kmlText);
  } catch (err: any) {
    return c.json({ success: false, error: `Error al obtener KML de Google: ${err.message}` }, 500);
  }
});

// 3.4.2 Integración Atómica de KML (Recorrido Polilínea y/o Paradas)
app.post('/v1/admin/kml/integrate', async (c) => {
  try {
    const { branch_id, direction, waypoints, stops, import_polyline, import_stops } = await c.req.json();
    if (!branch_id || !direction) {
      return c.json({ success: false, error: 'Ramal y sentido son requeridos' }, 400);
    }

    const statements: any[] = [];

    // 1. Guardar Recorrido (Polilínea / Route Shape) si import_polyline es verdadero
    if (import_polyline && Array.isArray(waypoints) && waypoints.length > 0) {
      const existingShape = await c.env.DB.prepare(
        'SELECT id FROM route_shapes WHERE branch_id = ? AND direction = ?'
      ).bind(branch_id, direction).first();

      const shapeJson = JSON.stringify(waypoints);

      if (existingShape && (existingShape as any).id) {
        statements.push(
          c.env.DB.prepare('UPDATE route_shapes SET coordinates_json = ? WHERE id = ?').bind(shapeJson, (existingShape as any).id)
        );
      } else {
        const newShapeId = `shape-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        statements.push(
          c.env.DB.prepare('INSERT INTO route_shapes (id, branch_id, direction, coordinates_json) VALUES (?, ?, ?, ?)').bind(newShapeId, branch_id, direction, shapeJson)
        );
      }
    }

    // 2. Guardar Paradas si import_stops es verdadero
    if (import_stops && Array.isArray(stops) && stops.length > 0) {
      statements.push(
        c.env.DB.prepare('DELETE FROM stops WHERE branch_id = ? AND direction = ?').bind(branch_id, direction)
      );

      stops.forEach((st: any, idx: number) => {
        const stopId = `stop-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
        const isControl = (idx === 0 || idx === stops.length - 1) ? 1 : 0;
        statements.push(
          c.env.DB.prepare(
            'INSERT INTO stops (id, branch_id, direction, stop_order, name, lat, lng, is_control_point) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(stopId, branch_id, direction, idx + 1, st.name || `Parada ${idx + 1}`, st.lat, st.lng, isControl)
        );
      });
    }

    if (statements.length > 0) {
      await c.env.DB.batch(statements);
      await triggerKVAutoPurge(c.env);
    }

    return c.json({
      success: true,
      integrated_polyline: !!(import_polyline && Array.isArray(waypoints) && waypoints.length > 0),
      integrated_stops_count: (import_stops && Array.isArray(stops)) ? stops.length : 0
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 3.5 OCR Processing con AWS Textract (con fallback a Cloudflare Workers AI Vision)
app.post('/v1/admin/ocr', async (c) => {
  try {
    const body = await c.req.json();
    const fileData = body.file || body.image;

    if (!fileData) {
      return c.json({ success: false, error: 'No se envió ninguna imagen' }, 400);
    }

    let headers: string[] = [];
    let matrix: string[][] = [];
    let engine = 'unknown';

    // 1. Intentar primero con AWS Textract (si están configurados los secretos)
    const accessKeyId = c.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = c.env.AWS_SECRET_ACCESS_KEY;
    const region = c.env.AWS_REGION || 'us-east-1';

    if (accessKeyId && secretAccessKey) {
      try {
        const textractOutput = await callAwsTextractAnalyzeDocument(fileData, accessKeyId, secretAccessKey, region);
        const parsed = parseTextractBlocksToTable(textractOutput.Blocks || []);
        headers = parsed.headers;
        matrix = parsed.matrix;
        engine = 'aws-textract';
      } catch (awsErr: any) {
        console.warn('AWS Textract OCR attempt failed, falling back to Workers AI:', awsErr.message);
      }
    }

    // 2. Fallback a Cloudflare Workers AI si AWS Textract no devolvió resultados
    if (matrix.length === 0 && c.env.AI) {
      try {
        let base64String = fileData;
        if (base64String.includes('base64,')) {
          base64String = base64String.split('base64,')[1];
        }

        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const prompt = `Analiza esta imagen de una tabla/grilla de horarios de colectivos/autobuses.
Extrae todas las cabeceras/nombres de paradas y la matriz de horarios en formato JSON estricto con la siguiente estructura exacta:
{
  "headers": ["NOMBRE_PARADA_1", "NOMBRE_PARADA_2"],
  "matrix": [
    ["HH:MM", "HH:MM"],
    ["HH:MM", ""]
  ]
}
REGLAS IMPORTANTES:
1. Extrae absolutamente TODAS las filas y celdas visibles en la imagen de arriba a abajo.
2. Si alguna hora o valor en una celda es ilegible, borroso o indeterminado, pon "" (cadena vacía) en esa posición exacta para que la fila no se pierda.
3. Responde UNICAMENTE con el objeto JSON estricto sin texto adicional.`;

        const response: any = await c.env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
          prompt: prompt,
          image: [...bytes]
        });

        const rawText = typeof response === 'string' ? response : (response.response || JSON.stringify(response));

        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed.headers)) headers = parsed.headers.map((h: any) => String(h).trim());
            if (Array.isArray(parsed.matrix)) {
              matrix = parsed.matrix.map((row: any) => {
                if (!Array.isArray(row)) return [''];
                return row.map((cell: any) => {
                  const s = String(cell || '').trim();
                  if (s === '' || /^\d{1,2}:\d{2}$/.test(s)) return s;
                  // Reparación rápida de formatos como 0700 -> 07:00 o 7.45 -> 07:45
                  const digits = s.replace(/\D/g, '');
                  if (digits.length === 4) return `${digits.substring(0, 2)}:${digits.substring(2, 4)}`;
                  if (digits.length === 3) return `0${digits.substring(0, 1)}:${digits.substring(1, 3)}`;
                  return '';
                });
              });
            }
          } catch (_) {}
        }

        if (headers.length === 0 && matrix.length === 0) {
          const lines = rawText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
          for (const line of lines) {
            const timeMatches = line.match(/\b\d{1,2}:\d{2}\b/g);
            if (timeMatches && timeMatches.length >= 1) {
              matrix.push(timeMatches);
            } else if (!line.includes(':') && line.includes(';')) {
              headers = line.split(';').map((s: string) => s.trim());
            } else {
              // Si la línea contiene algún caracter pero no se pudo leer el horario exacto, agregar ítem en blanco ""
              const cleanChars = line.replace(/[^a-zA-Z0-9]/g, '');
              if (cleanChars.length >= 2) {
                matrix.push(['']);
              }
            }
          }
        }

        if (matrix.length > 0) {
          engine = 'cloudflare-workers-ai';
        }
      } catch (aiErr: any) {
        console.warn('Cloudflare Workers AI OCR error:', aiErr);
      }
    }

    if (matrix.length > 0 && headers.length === 0) {
      headers = matrix[0].map((_, idx) => `Parada ${idx + 1}`);
    }

    // Si aún no se detectó matriz pero hay texto reconocido, generar filas en blanco por cada línea detectada
    if (matrix.length === 0) {
      return c.json({
        success: false,
        error: 'No se pudieron reconocer patrones de horarios (HH:MM) en la imagen proporcionada. Intenta con una imagen más clara o recortada.'
      }, 422);
    }

    return c.json({
      success: true,
      headers: headers,
      matrix: matrix,
      engine: engine
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'Error al procesar la imagen', details: err.message }, 500);
  }
});

// 4. Feriados Nacionales y Excepciones de Calendario
app.get('/v1/holidays', async (c) => {
  try {
    const res = await c.env.DB.prepare('SELECT id, date, name, type, created_at FROM holidays ORDER BY date ASC').all();
    return c.json(res.results || []);
  } catch (err: any) {
    return c.json([]);
  }
});

app.post('/v1/holidays', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.date || !body.name) {
      return c.json({ success: false, error: 'Fecha y nombre son requeridos' }, 400);
    }
    const id = body.id || `hol_${Date.now()}`;
    const type = body.type || 'inamovible';
    await c.env.DB.prepare(`
      INSERT INTO holidays (id, date, name, type)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET name = excluded.name, type = excluded.type
    `).bind(id, body.date, body.name, type).run();

    await purgeKvCache(c.env.FLEET_KV);

    return c.json({ success: true, id, date: body.date, name: body.name, type });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/v1/holidays/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM holidays WHERE id = ? OR date = ?').bind(id, id).run();
    
    await purgeKvCache(c.env.FLEET_KV);

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/v1/calendar_exceptions', async (c) => {
  try {
    const res = await c.env.DB.prepare('SELECT id, date, company, branch_id as branchId, branch_id, override_day_type as overrideDayType, description, created_at FROM calendar_exceptions ORDER BY date ASC').all();
    return c.json(res.results || []);
  } catch (err: any) {
    return c.json([]);
  }
});

app.post('/v1/calendar_exceptions', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.date) {
      return c.json({ success: false, error: 'La fecha es requerida' }, 400);
    }
    const id = body.id || `cexc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const company = body.company || 'SIT';
    const branchId = body.branchId || body.branch_id || null;
    const overrideDayType = body.overrideDayType || body.override_day_type || 'saturday';
    const description = body.description || '';

    await c.env.DB.prepare(`
      INSERT INTO calendar_exceptions (id, date, company, branch_id, override_day_type, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, body.date, company, branchId, overrideDayType, description).run();

    await purgeKvCache(c.env.FLEET_KV);

    return c.json({ success: true, id, date: body.date, company, branchId, branch_id: branchId, overrideDayType, description });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/v1/calendar_exceptions/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM calendar_exceptions WHERE id = ?').bind(id).run();

    await purgeKvCache(c.env.FLEET_KV);

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});


// Helper: Evalúa si una fila de horario está activa en la hora actual de Argentina (UTC-3)
const isRowActiveAtServerTime = (row: string[], currentMinutes: number) => {
  if (!Array.isArray(row)) return false;
  const validTimes = row.filter((t: any) => typeof t === 'string' && t.trim() !== '' && t.includes(':'));
  if (validTimes.length < 2) return false;
  
  const parseToMinutes = (timeStr: string) => {
    const parts = timeStr.trim().split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };
  
  const startMinutes = parseToMinutes(validTimes[0]);
  const endMinutes = parseToMinutes(validTimes[validTimes.length - 1]);
  
  if (endMinutes < startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

const getServerDayTypeCode = () => {
  const now = new Date();
  const argTimeStr = now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' });
  const argDate = new Date(argTimeStr);
  const day = argDate.getDay();
  if (day === 0) return 'domingos_feriados';
  if (day === 6) return 'sabados';
  return 'lunes_a_viernes';
};

const getServerCurrentMinutes = () => {
  const now = new Date();
  const argTimeStr = now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' });
  const argDate = new Date(argTimeStr);
  return argDate.getHours() * 60 + argDate.getMinutes();
};

async function getOrComputeActiveUnitsSummary(env: any) {
  const cacheKey = 'cache:active_units_summary_v1';
  
  if (env.FLEET_KV) {
    try {
      const cached = await env.FLEET_KV.get(cacheKey, 'json');
      if (cached) return cached;
    } catch (_) {}
  }

  const dayTypeCode = getServerDayTypeCode();
  const currentMinutes = getServerCurrentMinutes();

  let liveBuses: any[] = [];
  if (env.FLEET_KV) {
    try {
      const snap = await env.FLEET_KV.get('fleet_live_snapshot', 'json');
      if (Array.isArray(snap)) liveBuses = snap;
    } catch (_) {}
  }

  const schRes = await env.DB.prepare(`
    SELECT s.id, s.branch_id, s.direction, dt.code as day_type_code
    FROM schedules s
    JOIN day_types dt ON (s.day_types_id = dt.id OR s.day_types_id = dt.code)
    WHERE dt.code = ? OR dt.code LIKE ? OR s.day_types_id = ?
  `).bind(dayTypeCode, `%${dayTypeCode}%`, dayTypeCode).all();

  const schedules = schRes.results || [];
  const activeTripsCountByBranchDir: Record<string, number> = {};

  if (schedules.length > 0) {
    const scheduleIds = schedules.map((s: any) => s.id);
    const placeholders = scheduleIds.map(() => '?').join(',');
    const itemsRes = await env.DB.prepare(`
      SELECT schedule_id, trip_times_json, departure_time FROM schedule_items WHERE schedule_id IN (${placeholders})
    `).bind(...scheduleIds).all();

    const itemsByScheduleId: Record<string, any[]> = {};
    (itemsRes.results || []).forEach((item: any) => {
      if (!itemsByScheduleId[item.schedule_id]) itemsByScheduleId[item.schedule_id] = [];
      itemsByScheduleId[item.schedule_id].push(item);
    });

    schedules.forEach((sch: any) => {
      const items = itemsByScheduleId[sch.id] || [];
      const dirKey = sch.direction || 'ida';
      const mapKey = `${sch.branch_id}_${dirKey}`;
      let count = 0;

      items.forEach((item: any) => {
        let times: string[] = [];
        if (item.trip_times_json) {
          try { times = JSON.parse(item.trip_times_json); } catch (_) {}
        }
        if (times.length > 0 && isRowActiveAtServerTime(times, currentMinutes)) {
          count++;
        }
      });

      activeTripsCountByBranchDir[mapKey] = (activeTripsCountByBranchDir[mapKey] || 0) + count;
    });
  }

  const branchesRes = await env.DB.prepare(`
    SELECT b.id as branch_id, b.code as branch_code, l.code as line_code
    FROM branches b
    JOIN lines l ON b.line_id = l.id
  `).all();

  const byRoute: Record<string, { active_units: number; ida: number; vuelta: number }> = {};
  const byLine: Record<string, { active_units: number }> = {};
  let totalActiveUnits = 0;

  (branchesRes.results || []).forEach((b: any) => {
    const branchId = b.branch_id;
    const branchCode = b.branch_code;
    const lineCode = b.line_code || 'SIT';

    const gpsIda = liveBuses.filter((bus: any) => (bus.routeId === branchId || bus.code === branchCode) && (bus.dir === 'ida' || bus.direction === 'ida')).length;
    const gpsVuelta = liveBuses.filter((bus: any) => (bus.routeId === branchId || bus.code === branchCode) && (bus.dir === 'vuelta' || bus.direction === 'vuelta')).length;

    const schIda = activeTripsCountByBranchDir[`${branchId}_ida`] || 0;
    const schVuelta = activeTripsCountByBranchDir[`${branchId}_vuelta`] || 0;

    const idaActive = Math.max(gpsIda, schIda);
    const vueltaActive = Math.max(gpsVuelta, schVuelta);
    const routeTotal = idaActive + vueltaActive;

    const routeEntry = { active_units: routeTotal, ida: idaActive, vuelta: vueltaActive };
    byRoute[branchId] = routeEntry;
    if (branchCode) {
      byRoute[branchCode] = routeEntry;
    }

    if (!byLine[lineCode]) {
      byLine[lineCode] = { active_units: 0 };
    }
    byLine[lineCode].active_units += routeTotal;
    totalActiveUnits += routeTotal;
  });

  const activeLinesCount = Object.values(byLine).filter(l => l.active_units > 0).length;

  const payload = {
    success: true,
    timestamp: new Date().toISOString(),
    day_type_code: dayTypeCode,
    server_minutes: currentMinutes,
    total_active_lines: activeLinesCount,
    total_active_units: totalActiveUnits,
    by_line: byLine,
    by_route: byRoute
  };

  if (env.FLEET_KV) {
    try {
      await env.FLEET_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 60 });
    } catch (_) {}
  }

  return payload;
}

// 4b. Estado Servidor de Unidades Activas Cacheado (Server Pre-calculated Active Units)
app.get('/v1/transit/active_units', async (c) => {
  try {
    const summary = await getOrComputeActiveUnitsSummary(c.env);
    c.header('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=30');
    return c.json(summary);
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to compute active units summary', details: err.message }, 500);
  }
});

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

// Registros de Esquemas de Tablas para la Consola Admin
const ALLOWED_ADMIN_TABLES: Record<string, { label: string; primaryKey: string; orderBy?: string; fields: string[] }> = {
  companies: {
    label: 'Empresas de Transporte (Companies)',
    primaryKey: 'id',
    orderBy: 'code ASC',
    fields: ['id', 'code', 'name', 'description']
  },
  line_publication_statuses: {
    label: 'Publicación de Líneas (Line Publication Statuses)',
    primaryKey: 'id',
    orderBy: 'display_order ASC',
    fields: ['id', 'code', 'name', 'description', 'color', 'display_order']
  },
  lines: {
    label: 'Líneas (Lines)',
    primaryKey: 'id',
    orderBy: 'code ASC',
    fields: ['id', 'company_id', 'code', 'name', 'color', 'line_publication_statuses_id']
  },
  branches: {
    label: 'Ramales (Branches)',
    primaryKey: 'id',
    orderBy: 'line_id ASC, display_order ASC, code ASC',
    fields: ['id', 'line_id', 'code', 'name', 'direction_ida_label', 'direction_vuelta_label', 'display_order', 'branch_statuses_id', 'branch_colors_id', 'branch_publication_statuses_id']
  },
  branch_publication_statuses: {
    label: 'Publicación de Ramales (Branch Publication Statuses)',
    primaryKey: 'id',
    orderBy: 'display_order ASC',
    fields: ['id', 'code', 'name', 'description', 'color', 'display_order']
  },
  branch_colors: {
    label: 'Colores de Ramales',
    primaryKey: 'id',
    orderBy: 'display_order ASC',
    fields: ['id', 'code_hexa', 'description', 'display_order']
  },
  branch_companies: {
    label: 'Relación Ramales - Empresas (Branch Companies)',
    primaryKey: 'id',
    orderBy: 'branch_id ASC, company_id ASC',
    fields: ['id', 'branch_id', 'company_id']
  },
  schedules: {
    label: 'Horarios',
    primaryKey: 'id',
    orderBy: 'name ASC',
    fields: ['id', 'branch_id', 'direction', 'day_types_id', 'name', 'headers_json', 'header_aliases_json', 'stop_addresses_json']
  },
  schedule_items: {
    label: 'Despachos / Salidas (Schedule Items)',
    primaryKey: 'id',
    orderBy: 'dispatch_order ASC, departure_time ASC',
    fields: ['id', 'schedule_id', 'departure_time', 'dispatch_order', 'trip_times_json']
  },
  day_types: {
    label: 'Tipos de Día (Day Types)',
    primaryKey: 'id',
    orderBy: 'display_order ASC',
    fields: ['id', 'code', 'name', 'display_order']
  },
  calendar_exceptions: {
    label: 'Excepciones de Calendario (Calendar Exceptions)',
    primaryKey: 'id',
    orderBy: 'date DESC',
    fields: ['id', 'date', 'company', 'branch_id', 'override_day_type', 'description']
  },
  branch_statuses: {
    label: 'Estados Operativos (Branch Statuses)',
    primaryKey: 'id',
    orderBy: 'code ASC',
    fields: ['id', 'code', 'name', 'color']
  },
  stops: {
    label: 'Paradas (Stops)',
    primaryKey: 'id',
    orderBy: 'branch_id ASC, direction ASC, stop_order ASC',
    fields: ['id', 'branch_id', 'direction', 'stop_order', 'name', 'lat', 'lng', 'is_control_point']
  },
  route_shapes: {
    label: 'Trazados / Shapes (Route Shapes)',
    primaryKey: 'id',
    orderBy: 'branch_id ASC, direction ASC',
    fields: ['id', 'branch_id', 'direction', 'coordinates_json']
  },
  ads: {
    label: 'Anuncios y Alertas (Ads)',
    primaryKey: 'id',
    orderBy: 'created_at DESC',
    fields: ['id', 'title', 'content', 'badge', 'type', 'is_active', 'created_at']
  }
};

// GET /v1/admin/tables -> Lista de esquemas de tablas editables
app.get('/v1/admin/tables', (c) => {
  return c.json({ success: true, tables: ALLOWED_ADMIN_TABLES });
});

// Helper de Autopurga de Caché KV
const triggerKVAutoPurge = async (env: any): Promise<boolean> => {
  if (!env.FLEET_KV) return false;
  try {
    const currentV = await getCacheVersion(env.FLEET_KV);
    const versionNum = parseInt(currentV.replace('v', ''), 10) || 1;
    const newVersion = `v${versionNum + 1}`;
    await env.FLEET_KV.put('cache:global:version', newVersion);
    return true;
  } catch (_) {
    return false;
  }
};

// GET /v1/admin/table/:tableName -> Leer registros paginados
app.get('/v1/admin/table/:tableName', async (c) => {
  const tableName = c.req.param('tableName');
  const tableConfig = ALLOWED_ADMIN_TABLES[tableName];
  if (!tableConfig) {
    return c.json({ success: false, error: `Tabla no autorizada o inexistente: '${tableName}'` }, 400);
  }

  const requestedLimit = parseInt(c.req.query('limit') || '100', 10);
  const hasSpecificFilter = !!(c.req.query('schedule_id') || c.req.query('branch_id') || c.req.query('line_id'));
  const maxLimit = (hasSpecificFilter || tableName === 'schedule_items') ? 5000 : 500;
  const limit = Math.min(requestedLimit, maxLimit);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const search = (c.req.query('q') || '').trim().toLowerCase();

  try {
    let countSql = `SELECT COUNT(*) as total FROM ${tableName}`;
    let dataSql = `SELECT * FROM ${tableName}`;
    const params: any[] = [];
    const whereConditions: string[] = [];

    for (const field of tableConfig.fields) {
      const fieldVal = c.req.query(field);
      if (fieldVal !== undefined && fieldVal !== '') {
        whereConditions.push(`${field} = ?`);
        params.push(fieldVal);
      }
    }

    if (search) {
      const searchCols = tableConfig.fields.filter(f => f !== 'id' && !f.endsWith('_json'));
      if (searchCols.length > 0) {
        const searchClause = '(' + searchCols.map(col => `LOWER(CAST(${col} AS TEXT)) LIKE ?`).join(' OR ') + ')';
        whereConditions.push(searchClause);
        searchCols.forEach(() => params.push(`%${search}%`));
      }
    }

    if (whereConditions.length > 0) {
      const whereStr = ` WHERE ` + whereConditions.join(' AND ');
      countSql += whereStr;
      dataSql += whereStr;
    }

    const orderClause = tableConfig.orderBy || `${tableConfig.primaryKey} DESC`;
    dataSql += ` ORDER BY ${orderClause} LIMIT ? OFFSET ?`;

    const countRes = await c.env.DB.prepare(countSql).bind(...params).all();
    const total = (countRes.results?.[0] as any)?.total || 0;

    const dataRes = await c.env.DB.prepare(dataSql).bind(...params, limit, offset).all();

    return c.json({
      success: true,
      table: tableName,
      primaryKey: tableConfig.primaryKey,
      fields: tableConfig.fields,
      total,
      limit,
      offset,
      rows: dataRes.results || []
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /v1/admin/schedules/batch -> Guardado atómico ultrarrápido de grilla de horarios e ítems
app.post('/v1/admin/schedules/batch', async (c) => {
  try {
    const { schedule, items } = await c.req.json();
    if (!schedule || !schedule.branch_id) {
      return c.json({ success: false, error: 'Metadatos de horario inválidos' }, 400);
    }

    let scheduleId = schedule.id;
    const activeDayTypeId = schedule.day_types_id || '88f18fc3-ba8e-521a-a093-07db0825cf3a';

    if (!scheduleId && schedule.branch_id) {
      const existing = await c.env.DB.prepare(
        `SELECT id FROM schedules WHERE branch_id = ? AND direction = ? AND (day_types_id = ? OR day_types_id = ?)`
      ).bind(schedule.branch_id, schedule.direction || 'ida', activeDayTypeId, schedule.day_types_id).all();
      if (existing.results && existing.results.length > 0) {
        scheduleId = (existing.results[0] as any).id;
      }
    }

    const statements: any[] = [];

    // 1. Guardar o actualizar schedule maestro
    if (scheduleId) {
      statements.push(
        c.env.DB.prepare(`
          UPDATE schedules 
          SET branch_id = ?, direction = ?, day_types_id = ?, name = ?, headers_json = ?, header_aliases_json = ?, stop_addresses_json = ? 
          WHERE id = ?
        `).bind(
          schedule.branch_id,
          schedule.direction || 'ida',
          activeDayTypeId,
          schedule.name || 'Grilla',
          schedule.headers_json || '[]',
          schedule.header_aliases_json || '[]',
          schedule.stop_addresses_json || '[]',
          scheduleId
        )
      );
    } else {
      scheduleId = `sched-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      statements.push(
        c.env.DB.prepare(`
          INSERT INTO schedules (id, branch_id, direction, day_types_id, name, headers_json, header_aliases_json, stop_addresses_json) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          scheduleId,
          schedule.branch_id,
          schedule.direction || 'ida',
          schedule.day_types_id || '88f18fc3-ba8e-521a-a093-07db0825cf3a',
          schedule.name || 'Grilla',
          schedule.headers_json || '[]',
          schedule.header_aliases_json || '[]',
          schedule.stop_addresses_json || '[]'
        )
      );
    }

    // 2. Limpiar e insertar ítems solo si 'items' fue enviado explícitamente en el cuerpo del request
    if (Array.isArray(items)) {
      statements.push(
        c.env.DB.prepare('DELETE FROM schedule_items WHERE schedule_id = ?').bind(scheduleId)
      );

      if (items.length > 0) {
        items.forEach((item: any, idx: number) => {
          const itemId = `sitem-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`;
          statements.push(
            c.env.DB.prepare(`
              INSERT INTO schedule_items (id, schedule_id, departure_time, dispatch_order, trip_times_json)
              VALUES (?, ?, ?, ?, ?)
            `).bind(
              itemId,
              scheduleId,
              item.departure_time || '00:00',
              item.dispatch_order || (idx + 1),
              typeof item.trip_times_json === 'string' ? item.trip_times_json : JSON.stringify(item.trip_times_json || [])
            )
          );
        });
      }
    }

    // Ejecución masiva atómica en D1 (1 solo viaje de red)
    await c.env.DB.batch(statements);

    // Purgar caché KV una única vez al finalizar
    await triggerKVAutoPurge(c.env);

    return c.json({
      success: true,
      scheduleId,
      itemsCount: items ? items.length : 0,
      message: 'Grilla de horarios guardada exitosamente en una sola operación atómica'
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /v1/admin/table/:tableName -> Insertar registro
app.post('/v1/admin/table/:tableName', async (c) => {
  const tableName = c.req.param('tableName');
  const tableConfig = ALLOWED_ADMIN_TABLES[tableName];
  if (!tableConfig) {
    return c.json({ success: false, error: `Tabla no autorizada: '${tableName}'` }, 400);
  }

  try {
    const body = await c.req.json();
    const colsToInsert: string[] = [];
    const valPlaceholders: string[] = [];
    const values: any[] = [];

    // Asignar ID si no viene provisto
    if (!body[tableConfig.primaryKey]) {
      body[tableConfig.primaryKey] = `${tableName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    tableConfig.fields.forEach(field => {
      if (body[field] !== undefined) {
        colsToInsert.push(field);
        valPlaceholders.push('?');
        let val = body[field];
        if (typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        }
        values.push(val);
      }
    });

    if (colsToInsert.length === 0) {
      return c.json({ success: false, error: 'No se enviaron datos para insertar' }, 400);
    }

    const insertSql = `INSERT INTO ${tableName} (${colsToInsert.join(', ')}) VALUES (${valPlaceholders.join(', ')})`;
    await c.env.DB.prepare(insertSql).bind(...values).run();

    const cachePurged = await triggerKVAutoPurge(c.env);

    return c.json({
      success: true,
      message: `Registro creado exitosamente en '${tableName}'`,
      id: body[tableConfig.primaryKey],
      cache_purged: cachePurged
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PUT /v1/admin/table/:tableName/:id -> Actualizar registro
app.put('/v1/admin/table/:tableName/:id', async (c) => {
  const tableName = c.req.param('tableName');
  const recordId = c.req.param('id');
  const tableConfig = ALLOWED_ADMIN_TABLES[tableName];
  if (!tableConfig) {
    return c.json({ success: false, error: `Tabla no autorizada: '${tableName}'` }, 400);
  }

  try {
    const body = await c.req.json();
    const setClauses: string[] = [];
    const values: any[] = [];

    tableConfig.fields.forEach(field => {
      if (field !== tableConfig.primaryKey && body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        let val = body[field];
        if (typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        }
        values.push(val);
      }
    });

    if (setClauses.length === 0) {
      return c.json({ success: false, error: 'No hay campos válidos para actualizar' }, 400);
    }

    values.push(recordId);
    const updateSql = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE ${tableConfig.primaryKey} = ?`;
    const res = await c.env.DB.prepare(updateSql).bind(...values).run();

    if (res.meta.changes === 0) {
      return c.json({ success: false, error: `No se encontró registro con ID '${recordId}' en '${tableName}'` }, 404);
    }

    const cachePurged = await triggerKVAutoPurge(c.env);

    return c.json({
      success: true,
      message: `Registro '${recordId}' actualizado en '${tableName}'`,
      cache_purged: cachePurged
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /v1/admin/table/:tableName/:id -> Eliminar registro
app.delete('/v1/admin/table/:tableName/:id', async (c) => {
  const tableName = c.req.param('tableName');
  const recordId = c.req.param('id');
  const tableConfig = ALLOWED_ADMIN_TABLES[tableName];
  if (!tableConfig) {
    return c.json({ success: false, error: `Tabla no autorizada: '${tableName}'` }, 400);
  }

  try {
    const deleteSql = `DELETE FROM ${tableName} WHERE ${tableConfig.primaryKey} = ?`;
    const res = await c.env.DB.prepare(deleteSql).bind(recordId).run();

    if (res.meta.changes === 0) {
      return c.json({ success: false, error: `No se encontró el registro '${recordId}' en '${tableName}'` }, 404);
    }

    const cachePurged = await triggerKVAutoPurge(c.env);

    return c.json({
      success: true,
      message: `Registro '${recordId}' eliminado de '${tableName}'`,
      cache_purged: cachePurged
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

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
