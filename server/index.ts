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

// 1. Lineas publicas
app.get('/v1/catalog/public/lines', async (c) => {
  try {
    const linesRes = await c.env.DB.prepare('SELECT * FROM lines ORDER BY code ASC').all();
    const branchesRes = await c.env.DB.prepare('SELECT * FROM branches').all();
    
    const lines = linesRes.results.map((l: any) => ({
      ...l,
      branches: branchesRes.results.filter((b: any) => b.line_id === l.id)
    }));

    return c.json(lines);
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch lines', details: err.message }, 500);
  }
});

// 2. Data completa del catalogo (Routes, Shapes, Stops)
app.get('/v1/catalog/public/data', async (c) => {
  try {
    const idsParam = c.req.query('ids');
    const companyParam = c.req.query('company');

    let linesQuery = 'SELECT * FROM lines';
    let params: any[] = [];

    if (idsParam) {
      const idsList = idsParam.split(',').filter(Boolean);
      linesQuery += ` WHERE id IN (${idsList.map(() => '?').join(',')})`;
      params = idsList;
    } else if (companyParam) {
      linesQuery += ' WHERE name LIKE ? OR code LIKE ?';
      params = [`%${companyParam}%`, `%${companyParam}%`];
    }

    const linesRes = await c.env.DB.prepare(linesQuery).bind(...params).all();
    const lines = linesRes.results;

    const routes = await Promise.all(lines.map(async (line: any) => {
      const branchesRes = await c.env.DB.prepare('SELECT * FROM branches WHERE line_id = ?').bind(line.id).all();
      const branches = branchesRes.results;

      const directions = await Promise.all(branches.map(async (branch: any) => {
        const shapesRes = await c.env.DB.prepare('SELECT * FROM route_shapes WHERE branch_id = ?').bind(branch.id).all();
        return shapesRes.results.map((s: any) => ({
          type: s.direction,
          coordinates: JSON.parse(s.coordinates_json || '[]'),
          distance: s.total_distance_km
        }));
      }));

      const stopsRes = await c.env.DB.prepare('SELECT s.* FROM stops s JOIN branches b ON s.branch_id = b.id WHERE b.line_id = ?').bind(line.id).all();

      return {
        id: line.id,
        code: line.code,
        name: line.name,
        color: line.color,
        jurisdiction: line.jurisdiction,
        directions: directions.flat(),
        stops: stopsRes.results.map((st: any) => ({
          id: st.id,
          name: st.name,
          lat: st.lat,
          lng: st.lng,
          proj_lat: st.proj_lat,
          proj_lng: st.proj_lng,
          direction: st.direction,
          order: st.stop_order
        }))
      };
    }));

    return c.json({ routes });
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch catalog data', details: err.message }, 500);
  }
});

// 3. Horarios (Timetables)
app.get('/v1/catalog/public/timetables', async (c) => {
  try {
    const routeId = c.req.query('route_id');
    if (!routeId) {
      return c.json({ error: 'route_id query parameter is required' }, 400);
    }

    const ttRes = await c.env.DB.prepare('SELECT t.* FROM timetables t JOIN branches b ON t.branch_id = b.id WHERE b.line_id = ? OR b.id = ? ORDER BY t.dispatch_order ASC').bind(routeId, routeId).all();

    return c.json({ route_id: routeId, timetables: ttRes.results });
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch timetables', details: err.message }, 500);
  }
});

// 4. Excepciones de Calendario
app.get('/v1/calendar_exceptions', (c) => c.json([]));

// 5. Colectivos en Vivo (Fleet State & Telemetria)
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

// 6. Webhook de Sincronizacion Push desde AWS Backoffice
app.post('/v1/internal/sync-catalog', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.includes('Bearer secret-sync-key')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await c.req.json();
  return c.json({ status: 'synced', received_lines: payload.lines?.length || 0 });
});

export default app;
