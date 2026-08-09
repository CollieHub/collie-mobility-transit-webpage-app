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

// 1. Endpoint Catálogo Público
app.get('/v1/catalog/public', async (c) => {
  try {
    const linesRes = await c.env.DB.prepare('SELECT * FROM lines ORDER BY code ASC').all();
    const branchesRes = await c.env.DB.prepare('SELECT * FROM branches').all();
    
    const lines = linesRes.results.map((l: any) => ({
      ...l,
      branches: branchesRes.results.filter((b: any) => b.line_id === l.id)
    }));

    return c.json({ lines });
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch catalog', details: err.message }, 500);
  }
});

// 2. Endpoint Fleet State (Telemetría con Bounding Box)
app.get('/v1/fleet/state', async (c) => {
  try {
    const bbox = c.req.query('bbox');
    const cachedState = await c.env.FLEET_KV.get('fleet_live_snapshot', 'json');
    const buses = (cachedState as any[]) || [];

    if (!bbox) {
      return c.json(buses);
    }

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
    return c.json({ error: 'Failed to fetch fleet state', details: err.message }, 500);
  }
});

// 3. Webhook de Sincronización Push desde AWS Backoffice
app.post('/v1/internal/sync-catalog', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.includes('Bearer secret-sync-key')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await c.req.json();
  // Batch insert into D1
  return c.json({ status: 'synced', received_lines: payload.lines?.length || 0 });
});

export default app;
