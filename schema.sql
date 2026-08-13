-- 1. Empresas de Colectivos / Transporte (Companies)
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1b. Estado de Publicación de Línea (Line Publication Statuses)
CREATE TABLE IF NOT EXISTS line_publication_statuses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#10B981',
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Líneas de Colectivo Publicadas (Lines)
CREATE TABLE IF NOT EXISTS lines (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    company_id TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT 'SIT',
    line_publication_statuses_id TEXT REFERENCES line_publication_statuses(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 3. Estado Operativo del Ramal (Branch Statuses)
CREATE TABLE IF NOT EXISTS branch_statuses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#047857',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3b. Paleta de Colores de Ramales (Branch Colors)
CREATE TABLE IF NOT EXISTS branch_colors (
    id TEXT PRIMARY KEY,
    code_hexa TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3c. Estado de Publicación del Ramal (Branch Publication Statuses)
CREATE TABLE IF NOT EXISTS branch_publication_statuses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#10B981',
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Ramales de cada Línea (Branches)
CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    line_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    company_id TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT 'SIT',
    branch_statuses_id TEXT NOT NULL,
    branch_colors_id TEXT,
    branch_publication_statuses_id TEXT REFERENCES branch_publication_statuses(id),
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (line_id) REFERENCES lines(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_statuses_id) REFERENCES branch_statuses(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_colors_id) REFERENCES branch_colors(id) ON DELETE SET NULL
);

-- 4b. Relación entre Ramales y Empresas de Transporte (Branch Companies Junction Table)
CREATE TABLE IF NOT EXISTS branch_companies (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE(branch_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_companies_branch ON branch_companies(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_companies_company ON branch_companies(company_id);

-- 5. Grupos de Paradas Unificadas / Estaciones (Stop Groups)
CREATE TABLE IF NOT EXISTS stop_groups (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    description TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1
);

-- 5b. Detalles y Coordenadas Específicas de Grupos de Paradas (Stop Group Details)
CREATE TABLE IF NOT EXISTS stop_group_details (
    id TEXT PRIMARY KEY,
    stop_group_id TEXT NOT NULL,
    name TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    address TEXT,
    platform_code TEXT,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (stop_group_id) REFERENCES stop_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stop_group_details_stop_group_id ON stop_group_details(stop_group_id);

-- 6. Paradas de Colectivos (Stops)
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
    stop_group_id TEXT,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (stop_group_id) REFERENCES stop_groups(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stops_stop_group_id ON stops(stop_group_id);

-- 6. Trazado Vectorial de Recorridos (Route Shapes)
CREATE TABLE IF NOT EXISTS route_shapes (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('ida', 'vuelta')),
    coordinates_json TEXT NOT NULL,
    total_distance_km REAL NOT NULL,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- 7. Tipos de Día para la Selección de Horarios (Day Types)
CREATE TABLE IF NOT EXISTS day_types (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    aws_schedule_type_prefix TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1
);

-- 8. Grillas / Horarios Maestros por Ramal, Sentido y Tipo de Día (Schedules)
CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('ida', 'vuelta')),
    day_types_id TEXT NOT NULL,
    name TEXT,
    headers_json TEXT,
    header_aliases_json TEXT,
    stop_addresses_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (day_types_id) REFERENCES day_types(id) ON DELETE CASCADE
);

-- 9. Despachos / Horarios Individuales (Schedule Items)
CREATE TABLE IF NOT EXISTS schedule_items (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    dispatch_order INTEGER NOT NULL,
    trip_times_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_lines_company ON lines(company_id);
CREATE INDEX IF NOT EXISTS idx_lines_pub_status ON lines(line_publication_statuses_id);
CREATE INDEX IF NOT EXISTS idx_branches_line ON branches(line_id);
CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(branch_statuses_id);
CREATE INDEX IF NOT EXISTS idx_branches_colors_pub ON branches(branch_colors_id, branch_publication_statuses_id, display_order);
CREATE INDEX IF NOT EXISTS idx_stops_branch ON stops(branch_id, direction);
CREATE INDEX IF NOT EXISTS idx_stops_branch_order ON stops(branch_id, direction, stop_order);
CREATE INDEX IF NOT EXISTS idx_route_shapes_branch_dir ON route_shapes(branch_id, direction);
CREATE INDEX IF NOT EXISTS idx_schedules_branch ON schedules(branch_id, day_types_id);
CREATE INDEX IF NOT EXISTS idx_schedules_lookup ON schedules(branch_id, direction, day_types_id);
CREATE INDEX IF NOT EXISTS idx_schedule_items_schedule ON schedule_items(schedule_id, dispatch_order);
CREATE INDEX IF NOT EXISTS idx_schedule_items_dept ON schedule_items(schedule_id, departure_time);

-- Vistas Reutilizables de Optimización (Views)
CREATE VIEW IF NOT EXISTS v_public_routes AS
SELECT 
  b.id AS branch_id,
  b.code AS branch_code,
  b.name AS branch_name,
  b.company AS branch_company,
  b.description AS branch_description,
  b.display_order AS branch_display_order,
  l.id AS line_id,
  l.code AS line_code,
  l.name AS line_name,
  l.color AS line_color,
  l.jurisdiction,
  bs.code AS status_code,
  bs.name AS status_name,
  bs.color AS status_color,
  bps.code AS publication_status_code,
  bps.name AS publication_status_name,
  COALESCE(bc.code_hexa, bc_by_order.code_hexa, l.color, '#10B981') AS effective_color
FROM branches b
JOIN lines l ON b.line_id = l.id
LEFT JOIN branch_statuses bs ON b.branch_statuses_id = bs.id
LEFT JOIN branch_publication_statuses bps ON b.branch_publication_statuses_id = bps.id
LEFT JOIN branch_colors bc ON b.branch_colors_id = bc.id
LEFT JOIN branch_colors bc_by_order ON b.display_order = bc_by_order.display_order;

CREATE VIEW IF NOT EXISTS v_schedules_full AS
SELECT 
  s.id AS schedule_id,
  s.branch_id,
  b.code AS branch_code,
  b.name AS branch_name,
  l.code AS line_code,
  s.direction,
  s.day_types_id,
  dt.code AS day_type_code,
  dt.name AS day_type_name,
  s.headers_json,
  s.header_aliases_json,
  s.stop_addresses_json,
  s.created_at
FROM schedules s
JOIN branches b ON s.branch_id = b.id
JOIN lines l ON b.line_id = l.id
JOIN day_types dt ON s.day_types_id = dt.id;

CREATE VIEW IF NOT EXISTS v_active_dispatches AS
SELECT 
  si.id AS item_id,
  si.schedule_id,
  si.departure_time,
  si.dispatch_order,
  si.trip_times_json,
  s.branch_id,
  b.code AS branch_code,
  s.direction,
  s.day_types_id,
  dt.code AS day_type_code
FROM schedule_items si
JOIN schedules s ON si.schedule_id = s.id
JOIN branches b ON s.branch_id = b.id
JOIN day_types dt ON s.day_types_id = dt.id;

-- 10. Feriados Nacionales (Holidays)
CREATE TABLE IF NOT EXISTS holidays (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('inamovible', 'trasladable', 'turistico', 'no_laborable')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Excepciones de Calendario / Cronogramas (Calendar Exceptions)
CREATE TABLE IF NOT EXISTS calendar_exceptions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT 'SIT',
    override_day_type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_date ON calendar_exceptions(date);

-- Semillas de Feriados Nacionales 2026 Argentina
INSERT OR IGNORE INTO holidays (id, date, name, type) VALUES
('hol_2026_01_01', '2026-01-01', 'Año Nuevo', 'inamovible'),
('hol_2026_02_16', '2026-02-16', 'Carnaval', 'inamovible'),
('hol_2026_02_17', '2026-02-17', 'Carnaval', 'inamovible'),
('hol_2026_03_23', '2026-03-23', 'Feriado con fines turísticos', 'turistico'),
('hol_2026_03_24', '2026-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible'),
('hol_2026_04_02', '2026-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible'),
('hol_2026_04_03', '2026-04-03', 'Viernes Santo', 'inamovible'),
('hol_2026_05_01', '2026-05-01', 'Día del Trabajador', 'inamovible'),
('hol_2026_05_25', '2026-05-25', 'Día de la Revolución de Mayo', 'inamovible'),
('hol_2026_06_15', '2026-06-15', 'Paso a la Inmortalidad del Gral. Güemes', 'trasladable'),
('hol_2026_06_20', '2026-06-20', 'Paso a la Inmortalidad del Gral. Manuel Belgrano', 'inamovible'),
('hol_2026_07_09', '2026-07-09', 'Día de la Independencia', 'inamovible'),
('hol_2026_07_10', '2026-07-10', 'Feriado con fines turísticos', 'turistico'),
('hol_2026_08_17', '2026-08-17', 'Paso a la Inmortalidad del Gral. San Martín', 'trasladable'),
('hol_2026_10_12', '2026-10-12', 'Día del Respeto a la Diversidad Cultural', 'trasladable'),
('hol_2026_11_23', '2026-11-23', 'Día de la Soberanía Nacional', 'trasladable'),
('hol_2026_12_08', '2026-12-08', 'Inmaculada Concepción de María', 'inamovible'),
('hol_2026_12_25', '2026-12-25', 'Navidad', 'inamovible');

