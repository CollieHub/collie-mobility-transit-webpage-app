-- ==============================================================================
-- Schema Cloudflare D1: Collie Transit (Esquema 'arg.core.')
-- ==============================================================================

-- 1. Empresas de Colectivos / Transporte (Companies)
CREATE TABLE IF NOT EXISTS "arg.core.companies" (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1b. Estado de Publicación de Línea (Line Publication Statuses)
CREATE TABLE IF NOT EXISTS "arg.core.line_publication_statuses" (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#10B981',
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Líneas de Colectivo Publicadas (Lines)
CREATE TABLE IF NOT EXISTS "arg.core.lines" (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    company_id TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT 'SIT',
    line_publication_statuses_id TEXT REFERENCES "arg.core.line_publication_statuses"(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES "arg.core.companies"(id) ON DELETE CASCADE
);

-- 3. Estado Operativo del Ramal (Branch Statuses)
CREATE TABLE IF NOT EXISTS "arg.core.branch_statuses" (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#047857',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3b. Paleta de Colores de Ramales (Branch Colors)
CREATE TABLE IF NOT EXISTS "arg.core.branch_colors" (
    id TEXT PRIMARY KEY,
    code_hexa TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3c. Estado de Publicación del Ramal (Branch Publication Statuses)
CREATE TABLE IF NOT EXISTS "arg.core.branch_publication_statuses" (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#10B981',
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Ramales de cada Línea (Branches)
CREATE TABLE IF NOT EXISTS "arg.core.branches" (
    id TEXT PRIMARY KEY,
    line_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    company_id TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT 'SIT',
    branch_statuses_id TEXT NOT NULL,
    branch_colors_id TEXT,
    branch_publication_statuses_id TEXT REFERENCES "arg.core.branch_publication_statuses"(id),
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (line_id) REFERENCES "arg.core.lines"(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES "arg.core.companies"(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_statuses_id) REFERENCES "arg.core.branch_statuses"(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_colors_id) REFERENCES "arg.core.branch_colors"(id) ON DELETE SET NULL
);

-- 4b. Relación entre Ramales y Empresas de Transporte (Branch Companies Junction Table)
CREATE TABLE IF NOT EXISTS "arg.core.branch_companies" (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES "arg.core.branches"(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES "arg.core.companies"(id) ON DELETE CASCADE,
    UNIQUE(branch_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_companies_branch ON "arg.core.branch_companies"(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_companies_company ON "arg.core.branch_companies"(company_id);

-- 5. Grupos de Paradas Unificadas / Estaciones (Stop Groups)
CREATE TABLE IF NOT EXISTS "arg.core.stop_groups" (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    description TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1
);

-- 5b. Detalles y Coordenadas Específicas de Grupos de Paradas (Stop Group Details)
CREATE TABLE IF NOT EXISTS "arg.core.stop_group_details" (
    id TEXT PRIMARY KEY,
    stop_group_id TEXT NOT NULL,
    name TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    address TEXT,
    platform_code TEXT,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (stop_group_id) REFERENCES "arg.core.stop_groups"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stop_group_details_stop_group_id ON "arg.core.stop_group_details"(stop_group_id);

-- 6. Paradas de Colectivos (Stops)
CREATE TABLE IF NOT EXISTS "arg.core.stops" (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('ida', 'vuelta')),
    stop_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    proj_lat REAL NOT NULL,
    proj_lng REAL NOT NULL,
    is_control_point INTEGER DEFAULT 0,
    stop_group_id TEXT,
    FOREIGN KEY (branch_id) REFERENCES "arg.core.branches"(id) ON DELETE CASCADE,
    FOREIGN KEY (stop_group_id) REFERENCES "arg.core.stop_groups"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stops_stop_group_id ON "arg.core.stops"(stop_group_id);

-- 6b. Trazado Vectorial de Recorridos (Route Shapes)
CREATE TABLE IF NOT EXISTS "arg.core.route_shapes" (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('ida', 'vuelta')),
    coordinates_json TEXT NOT NULL,
    total_distance_km REAL NOT NULL,
    FOREIGN KEY (branch_id) REFERENCES "arg.core.branches"(id) ON DELETE CASCADE
);

-- 7. Tipos de Día para la Selección de Horarios (Day Types)
CREATE TABLE IF NOT EXISTS "arg.core.day_types" (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    aws_schedule_type_prefix TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1
);

-- 8. Grillas / Horarios Maestros por Ramal, Sentido y Tipo de Día (Schedules)
CREATE TABLE IF NOT EXISTS "arg.core.schedules" (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('ida', 'vuelta')),
    day_types_id TEXT NOT NULL,
    name TEXT,
    headers_json TEXT,
    header_aliases_json TEXT,
    stop_addresses_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES "arg.core.branches"(id) ON DELETE CASCADE,
    FOREIGN KEY (day_types_id) REFERENCES "arg.core.day_types"(id) ON DELETE CASCADE
);

-- 9. Despachos / Horarios Individuales (Schedule Items)
CREATE TABLE IF NOT EXISTS "arg.core.schedule_items" (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    dispatch_order INTEGER NOT NULL,
    trip_times_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES "arg.core.schedules"(id) ON DELETE CASCADE
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_lines_company ON "arg.core.lines"(company_id);
CREATE INDEX IF NOT EXISTS idx_lines_pub_status ON "arg.core.lines"(line_publication_statuses_id);
CREATE INDEX IF NOT EXISTS idx_branches_line ON "arg.core.branches"(line_id);
CREATE INDEX IF NOT EXISTS idx_branches_status ON "arg.core.branches"(branch_statuses_id);
CREATE INDEX IF NOT EXISTS idx_branches_colors_pub ON "arg.core.branches"(branch_colors_id, branch_publication_statuses_id, display_order);
CREATE INDEX IF NOT EXISTS idx_stops_branch ON "arg.core.stops"(branch_id, direction);
CREATE INDEX IF NOT EXISTS idx_stops_branch_order ON "arg.core.stops"(branch_id, direction, stop_order);
CREATE INDEX IF NOT EXISTS idx_route_shapes_branch_dir ON "arg.core.route_shapes"(branch_id, direction);
CREATE INDEX IF NOT EXISTS idx_schedules_branch ON "arg.core.schedules"(branch_id, day_types_id);
CREATE INDEX IF NOT EXISTS idx_schedules_lookup ON "arg.core.schedules"(branch_id, direction, day_types_id);
CREATE INDEX IF NOT EXISTS idx_schedule_items_schedule ON "arg.core.schedule_items"(schedule_id, dispatch_order);
CREATE INDEX IF NOT EXISTS idx_schedule_items_dept ON "arg.core.schedule_items"(schedule_id, departure_time);

-- 10. Feriados Nacionales (Holidays)
CREATE TABLE IF NOT EXISTS "arg.core.holidays" (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('inamovible', 'trasladable', 'turistico', 'no_laborable')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Excepciones de Calendario / Cronogramas (Calendar Exceptions)
CREATE TABLE IF NOT EXISTS "arg.core.calendar_exceptions" (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT 'SIT',
    branch_id TEXT DEFAULT NULL,
    override_day_type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON "arg.core.holidays"(date);
CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_date ON "arg.core.calendar_exceptions"(date);

-- 12. Anuncios y Publicidades Comerciales / Afiliados (Ads)
CREATE TABLE IF NOT EXISTS ads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    image_url TEXT,
    redirect_url TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#FFE600',
    border TEXT NOT NULL DEFAULT '#E6CF00',
    text_color TEXT NOT NULL DEFAULT '#2D3277',
    display_order INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    price TEXT,
    original_price TEXT,
    discount TEXT,
    badge TEXT,
    installments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- Vistas con Prefijo 'arg.core.'
-- ==============================================================================
CREATE VIEW IF NOT EXISTS "arg.core.v_public_routes" AS
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
FROM "arg.core.branches" b
JOIN "arg.core.lines" l ON b.line_id = l.id
LEFT JOIN "arg.core.branch_statuses" bs ON b.branch_statuses_id = bs.id
LEFT JOIN "arg.core.branch_publication_statuses" bps ON b.branch_publication_statuses_id = bps.id
LEFT JOIN "arg.core.branch_colors" bc ON b.branch_colors_id = bc.id
LEFT JOIN "arg.core.branch_colors" bc_by_order ON b.display_order = bc_by_order.display_order;

CREATE VIEW IF NOT EXISTS "arg.core.v_schedules_full" AS
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
FROM "arg.core.schedules" s
JOIN "arg.core.branches" b ON s.branch_id = b.id
JOIN "arg.core.lines" l ON b.line_id = l.id
JOIN "arg.core.day_types" dt ON s.day_types_id = dt.id;

CREATE VIEW IF NOT EXISTS "arg.core.v_active_dispatches" AS
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
FROM "arg.core.schedule_items" si
JOIN "arg.core.schedules" s ON si.schedule_id = s.id
JOIN "arg.core.branches" b ON s.branch_id = b.id
JOIN "arg.core.day_types" dt ON s.day_types_id = dt.id;

-- ==============================================================================
-- Vistas de Compatibilidad Retrocompatible
-- ==============================================================================
CREATE VIEW IF NOT EXISTS companies AS SELECT * FROM "arg.core.companies";
CREATE VIEW IF NOT EXISTS line_publication_statuses AS SELECT * FROM "arg.core.line_publication_statuses";
CREATE VIEW IF NOT EXISTS lines AS SELECT * FROM "arg.core.lines";
CREATE VIEW IF NOT EXISTS branch_statuses AS SELECT * FROM "arg.core.branch_statuses";
CREATE VIEW IF NOT EXISTS branch_colors AS SELECT * FROM "arg.core.branch_colors";
CREATE VIEW IF NOT EXISTS branch_publication_statuses AS SELECT * FROM "arg.core.branch_publication_statuses";
CREATE VIEW IF NOT EXISTS branches AS SELECT * FROM "arg.core.branches";
CREATE VIEW IF NOT EXISTS branch_companies AS SELECT * FROM "arg.core.branch_companies";
CREATE VIEW IF NOT EXISTS stop_groups AS SELECT * FROM "arg.core.stop_groups";
CREATE VIEW IF NOT EXISTS stop_group_details AS SELECT * FROM "arg.core.stop_group_details";
CREATE VIEW IF NOT EXISTS stops AS SELECT * FROM "arg.core.stops";
CREATE VIEW IF NOT EXISTS route_shapes AS SELECT * FROM "arg.core.route_shapes";
CREATE VIEW IF NOT EXISTS day_types AS SELECT * FROM "arg.core.day_types";
CREATE VIEW IF NOT EXISTS schedules AS SELECT * FROM "arg.core.schedules";
CREATE VIEW IF NOT EXISTS schedule_items AS SELECT * FROM "arg.core.schedule_items";
CREATE VIEW IF NOT EXISTS holidays AS SELECT * FROM "arg.core.holidays";
CREATE VIEW IF NOT EXISTS calendar_exceptions AS SELECT * FROM "arg.core.calendar_exceptions";
CREATE VIEW IF NOT EXISTS v_public_routes AS SELECT * FROM "arg.core.v_public_routes";
CREATE VIEW IF NOT EXISTS v_schedules_full AS SELECT * FROM "arg.core.v_schedules_full";
CREATE VIEW IF NOT EXISTS v_active_dispatches AS SELECT * FROM "arg.core.v_active_dispatches";
