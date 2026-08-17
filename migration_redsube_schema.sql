-- ==============================================================================
-- Migración D1: Esquemas 'redsube.gtfs.' y 'redsube.caba.' para Collie Transit
-- ==============================================================================

-- ==========================================
-- 1. ESQUEMA: redsube.gtfs.* (Datos Estáticos)
-- ==========================================

CREATE TABLE IF NOT EXISTS "redsube.gtfs.agencies" (
  agency_id TEXT PRIMARY KEY,
  agency_name TEXT NOT NULL,
  agency_url TEXT,
  agency_timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires',
  agency_lang TEXT DEFAULT 'es'
);

CREATE TABLE IF NOT EXISTS "redsube.gtfs.routes" (
  route_id TEXT PRIMARY KEY,
  agency_id TEXT,
  route_short_name TEXT NOT NULL,
  route_long_name TEXT,
  route_desc TEXT,
  route_type INTEGER DEFAULT 3,
  route_color TEXT,
  route_text_color TEXT,
  FOREIGN KEY (agency_id) REFERENCES "redsube.gtfs.agencies"(agency_id)
);

CREATE TABLE IF NOT EXISTS "redsube.gtfs.trips" (
  trip_id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  service_id TEXT,
  trip_headsign TEXT,
  direction_id INTEGER,
  shape_id TEXT,
  FOREIGN KEY (route_id) REFERENCES "redsube.gtfs.routes"(route_id)
);

CREATE TABLE IF NOT EXISTS "redsube.gtfs.stops" (
  stop_id TEXT PRIMARY KEY,
  stop_name TEXT NOT NULL,
  stop_desc TEXT,
  stop_lat REAL NOT NULL,
  stop_lon REAL NOT NULL,
  zone_id TEXT
);

CREATE TABLE IF NOT EXISTS "redsube.gtfs.stop_times" (
  trip_id TEXT NOT NULL,
  arrival_time TEXT,
  departure_time TEXT,
  stop_id TEXT NOT NULL,
  stop_sequence INTEGER NOT NULL,
  PRIMARY KEY (trip_id, stop_sequence),
  FOREIGN KEY (trip_id) REFERENCES "redsube.gtfs.trips"(trip_id),
  FOREIGN KEY (stop_id) REFERENCES "redsube.gtfs.stops"(stop_id)
);

CREATE TABLE IF NOT EXISTS "redsube.gtfs.shapes" (
  shape_id TEXT NOT NULL,
  shape_pt_lat REAL NOT NULL,
  shape_pt_lon REAL NOT NULL,
  shape_pt_sequence INTEGER NOT NULL,
  shape_dist_traveled REAL,
  PRIMARY KEY (shape_id, shape_pt_sequence)
);

CREATE INDEX IF NOT EXISTS "idx_redsube_gtfs_trips_route" ON "redsube.gtfs.trips"(route_id);
CREATE INDEX IF NOT EXISTS "idx_redsube_gtfs_trips_shape" ON "redsube.gtfs.trips"(shape_id);
CREATE INDEX IF NOT EXISTS "idx_redsube_gtfs_shapes_id" ON "redsube.gtfs.shapes"(shape_id);
CREATE INDEX IF NOT EXISTS "idx_redsube_gtfs_stoptimes_trip" ON "redsube.gtfs.stop_times"(trip_id);

-- ==========================================
-- 2. ESQUEMA: redsube.caba.* (Entidades Operativas y Telemetría)
-- ==========================================

CREATE TABLE IF NOT EXISTS "redsube.caba.agencies" (
  empresa_id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  nombre_corto TEXT,
  marquesina_fallback TEXT,
  all_lines TEXT,       -- JSON array de líneas
  all_ramales TEXT,     -- JSON array de ramales
  last_updated INTEGER
);

CREATE TABLE IF NOT EXISTS "redsube.caba.lines" (
  linea_code TEXT PRIMARY KEY,
  display_name TEXT,
  agency_name TEXT,
  agency_id TEXT,
  color TEXT,
  last_updated INTEGER
);

CREATE TABLE IF NOT EXISTS "redsube.caba.branches" (
  ramal_code TEXT PRIMARY KEY,
  linea_code TEXT NOT NULL,
  route_id TEXT,
  nombre_largo TEXT,
  headsign_ida TEXT,
  headsign_vuelta TEXT,
  shape_id_ida TEXT,
  shape_id_vuelta TEXT,
  color TEXT,
  last_updated INTEGER,
  FOREIGN KEY (linea_code) REFERENCES "redsube.caba.lines"(linea_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "redsube.caba.vehicles" (
  vehicle_id TEXT PRIMARY KEY,
  interno TEXT,
  empresa_id TEXT,
  patente TEXT,
  ramal_code TEXT,
  linea_code TEXT,
  agency_name TEXT,
  trip_headsign TEXT,
  route_id TEXT,
  trip_id TEXT,
  source TEXT DEFAULT 'v1',
  first_seen INTEGER,
  last_seen INTEGER
);

CREATE TABLE IF NOT EXISTS "redsube.caba.positions" (
  vehicle_id TEXT PRIMARY KEY,
  latitude REAL,
  longitude REAL,
  speed_kmh REAL DEFAULT 0,
  bearing INTEGER DEFAULT 0,
  odometer REAL,
  trip_id TEXT,
  route_id TEXT,
  linea_code TEXT,
  ramal_code TEXT,
  trip_headsign TEXT,
  timestamp INTEGER,
  timestamp_formatted TEXT,
  FOREIGN KEY (vehicle_id) REFERENCES "redsube.caba.vehicles"(vehicle_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "redsube.caba.gtfs_transit_unidad_recorrido" (
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
  source TEXT DEFAULT 'gtfs-realtime',
  lat REAL,
  lng REAL,
  speed_kmh REAL DEFAULT 0,
  bearing INTEGER DEFAULT 0,
  last_updated INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_redsube_caba_vehicles_linea" ON "redsube.caba.vehicles"(linea_code);
CREATE INDEX IF NOT EXISTS "idx_redsube_caba_positions_linea" ON "redsube.caba.positions"(linea_code);
CREATE INDEX IF NOT EXISTS "idx_redsube_caba_gtfs_linea" ON "redsube.caba.gtfs_transit_unidad_recorrido"(linea_code);
