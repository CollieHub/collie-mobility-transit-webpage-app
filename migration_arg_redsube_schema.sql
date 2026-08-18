-- ==============================================================================
-- Migración D1: Esquema 'arg.redsube.' para Collie Transit (GTFS y Operativa)
-- ==============================================================================

-- 1. Empresas / Agencias RedSUBE
CREATE TABLE IF NOT EXISTS "arg.redsube.agencies" (
  agency_id TEXT PRIMARY KEY,
  agency_name TEXT NOT NULL,
  agency_url TEXT,
  agency_timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires',
  agency_lang TEXT DEFAULT 'es'
);

-- 2. Rutas / Líneas RedSUBE
CREATE TABLE IF NOT EXISTS "arg.redsube.lines" (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT,
  jurisdiction TEXT DEFAULT 'Nacional / Provincial',
  agency_id TEXT,
  last_updated INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES "arg.redsube.agencies"(agency_id)
);

CREATE TABLE IF NOT EXISTS "arg.redsube.routes" (
  route_id TEXT PRIMARY KEY,
  agency_id TEXT,
  route_short_name TEXT NOT NULL,
  route_long_name TEXT,
  route_desc TEXT,
  route_type INTEGER DEFAULT 3,
  route_color TEXT,
  route_text_color TEXT,
  FOREIGN KEY (agency_id) REFERENCES "arg.redsube.agencies"(agency_id)
);

-- 3. Ramales RedSUBE
CREATE TABLE IF NOT EXISTS "arg.redsube.branches" (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  agency_id TEXT,
  route_id TEXT,
  headsign_ida TEXT,
  headsign_vuelta TEXT,
  color TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (line_id) REFERENCES "arg.redsube.lines"(id) ON DELETE CASCADE
);

-- 4. Trazados Polilíneas de Ramales RedSUBE
CREATE TABLE IF NOT EXISTS "arg.redsube.route_shapes" (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  coordinates_json TEXT NOT NULL,
  total_distance_km REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES "arg.redsube.branches"(id) ON DELETE CASCADE
);

-- 5. Paradas RedSUBE
CREATE TABLE IF NOT EXISTS "arg.redsube.stops" (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  stop_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  proj_lat REAL,
  proj_lng REAL,
  stop_desc TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES "arg.redsube.branches"(id) ON DELETE CASCADE
);

-- 6. GTFS Trips, Stop Times y Shapes individuales
CREATE TABLE IF NOT EXISTS "arg.redsube.trips" (
  trip_id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  service_id TEXT,
  trip_headsign TEXT,
  direction_id INTEGER,
  shape_id TEXT,
  FOREIGN KEY (route_id) REFERENCES "arg.redsube.routes"(route_id)
);

CREATE TABLE IF NOT EXISTS "arg.redsube.stop_times" (
  trip_id TEXT NOT NULL,
  arrival_time TEXT,
  departure_time TEXT,
  stop_id TEXT NOT NULL,
  stop_sequence INTEGER NOT NULL,
  PRIMARY KEY (trip_id, stop_sequence),
  FOREIGN KEY (trip_id) REFERENCES "arg.redsube.trips"(trip_id)
);

CREATE TABLE IF NOT EXISTS "arg.redsube.shapes" (
  shape_id TEXT NOT NULL,
  shape_pt_lat REAL NOT NULL,
  shape_pt_lon REAL NOT NULL,
  shape_pt_sequence INTEGER NOT NULL,
  shape_dist_traveled REAL,
  PRIMARY KEY (shape_id, shape_pt_sequence)
);

-- 7. Telemetría en Tiempo Real
CREATE TABLE IF NOT EXISTS "arg.redsube.gtfs_transit_unidad_recorrido" (
  vehicle_id TEXT PRIMARY KEY,
  linea_code TEXT NOT NULL,
  ramal_code TEXT,
  empresa_id TEXT,
  interno TEXT,
  patente TEXT,
  trip_id TEXT,
  route_id TEXT,
  shape_id TEXT,
  headsign TEXT,
  source TEXT DEFAULT 'redsube',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  speed_kmh REAL DEFAULT 0,
  bearing REAL DEFAULT 0,
  last_updated INTEGER NOT NULL
);

-- Índices de Rendimiento
CREATE INDEX IF NOT EXISTS "idx_arg_redsube_branches_line" ON "arg.redsube.branches"(line_id);
CREATE INDEX IF NOT EXISTS "idx_arg_redsube_shapes_branch" ON "arg.redsube.route_shapes"(branch_id);
CREATE INDEX IF NOT EXISTS "idx_arg_redsube_stops_branch" ON "arg.redsube.stops"(branch_id);
CREATE INDEX IF NOT EXISTS "idx_arg_redsube_trips_route" ON "arg.redsube.trips"(route_id);
CREATE INDEX IF NOT EXISTS "idx_arg_redsube_stoptimes_trip" ON "arg.redsube.stop_times"(trip_id);
