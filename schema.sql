-- 1. Empresas de Colectivos / Transporte (Companies)
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Líneas de Colectivo Publicadas (Lines)
CREATE TABLE IF NOT EXISTS lines (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    company_id TEXT NOT NULL DEFAULT 'company-sit',
    company TEXT NOT NULL DEFAULT 'SIT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 3. Ramales de cada Línea (Branches)
CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    line_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    company_id TEXT NOT NULL DEFAULT 'company-sit',
    company TEXT NOT NULL DEFAULT 'SIT',
    description TEXT,
    FOREIGN KEY (line_id) REFERENCES lines(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 4. Paradas de Colectivos (Stops)
CREATE TABLE IF NOT EXISTS stops (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('ida', 'vuelta')),
    stop_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    proj_lat REAL NOT NULL,
    proj_lng REAL NOT NULL,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- 5. Trazado Vectorial de Recorridos (Route Shapes)
CREATE TABLE IF NOT EXISTS route_shapes (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('ida', 'vuelta')),
    coordinates_json TEXT NOT NULL,
    total_distance_km REAL NOT NULL,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- 6. Tipos de Día para la Selección de Horarios (Day Types)
CREATE TABLE IF NOT EXISTS day_types (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    aws_schedule_type_prefix TEXT NOT NULL
);

-- 7. Horarios de Salida y Puntos Intermedios (Schedules)
CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('ida', 'vuelta')),
    day_types_id TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    dispatch_order INTEGER NOT NULL,
    trip_times_json TEXT,
    headers_json TEXT,
    header_aliases_json TEXT,
    stop_addresses_json TEXT,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (day_types_id) REFERENCES day_types(id) ON DELETE CASCADE
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_lines_company ON lines(company_id);
CREATE INDEX IF NOT EXISTS idx_branches_line ON branches(line_id);
CREATE INDEX IF NOT EXISTS idx_stops_branch ON stops(branch_id, direction);
CREATE INDEX IF NOT EXISTS idx_schedules_branch ON schedules(branch_id, day_types_id);
