-- ==============================================================================
-- Migración D1: Esquema 'arg.core.' para Collie Transit
-- ==============================================================================

-- 1. Eliminar vistas existentes para permitir renombrado de tablas
DROP VIEW IF EXISTS v_public_routes;
DROP VIEW IF EXISTS v_schedules_full;
DROP VIEW IF EXISTS v_active_dispatches;
DROP VIEW IF EXISTS "arg.core.v_public_routes";
DROP VIEW IF EXISTS "arg.core.v_schedules_full";
DROP VIEW IF EXISTS "arg.core.v_active_dispatches";

-- 2. Renombrar tablas a "arg.core.<nombre_tabla>"
ALTER TABLE companies RENAME TO "arg.core.companies";
ALTER TABLE line_publication_statuses RENAME TO "arg.core.line_publication_statuses";
ALTER TABLE lines RENAME TO "arg.core.lines";
ALTER TABLE branch_statuses RENAME TO "arg.core.branch_statuses";
ALTER TABLE branch_colors RENAME TO "arg.core.branch_colors";
ALTER TABLE branch_publication_statuses RENAME TO "arg.core.branch_publication_statuses";
ALTER TABLE branches RENAME TO "arg.core.branches";
ALTER TABLE branch_companies RENAME TO "arg.core.branch_companies";
ALTER TABLE stop_groups RENAME TO "arg.core.stop_groups";
ALTER TABLE stop_group_details RENAME TO "arg.core.stop_group_details";
ALTER TABLE stops RENAME TO "arg.core.stops";
ALTER TABLE route_shapes RENAME TO "arg.core.route_shapes";
ALTER TABLE day_types RENAME TO "arg.core.day_types";
ALTER TABLE schedules RENAME TO "arg.core.schedules";
ALTER TABLE schedule_items RENAME TO "arg.core.schedule_items";
ALTER TABLE holidays RENAME TO "arg.core.holidays";
ALTER TABLE calendar_exceptions RENAME TO "arg.core.calendar_exceptions";

-- 3. Crear Vistas con prefijo "arg.core."
CREATE VIEW IF NOT EXISTS "arg.core.v_public_routes" AS
SELECT 
    b.id AS branch_id,
    b.code AS branch_code,
    b.name AS branch_name,
    b.company_id,
    b.company,
    b.description AS branch_description,
    b.display_order,
    l.id AS line_id,
    l.code AS line_code,
    l.name AS line_name,
    l.color AS line_color,
    l.jurisdiction AS line_jurisdiction,
    bs.id AS status_id,
    bs.code AS status_code,
    bs.name AS status_name,
    bs.color AS status_color,
    bc.code_hexa AS branch_color_hexa,
    bps.id AS publication_status_id,
    bps.code AS publication_status_code,
    bps.name AS publication_status_name,
    bps.color AS publication_status_color
FROM "arg.core.branches" b
JOIN "arg.core.lines" l ON b.line_id = l.id
JOIN "arg.core.branch_statuses" bs ON b.branch_statuses_id = bs.id
LEFT JOIN "arg.core.branch_colors" bc ON b.branch_colors_id = bc.id
LEFT JOIN "arg.core.branch_publication_statuses" bps ON b.branch_publication_statuses_id = bps.id;

CREATE VIEW IF NOT EXISTS "arg.core.v_schedules_full" AS
SELECT 
    s.id AS schedule_id,
    s.branch_id,
    s.direction,
    s.valid_from,
    s.valid_to,
    dt.id AS day_type_id,
    dt.code AS day_type_code,
    dt.name AS day_type_name,
    si.id AS item_id,
    si.trip_id,
    si.departure_time,
    si.trip_times_json,
    si.dispatch_order
FROM "arg.core.schedules" s
JOIN "arg.core.day_types" dt ON s.day_types_id = dt.id
LEFT JOIN "arg.core.schedule_items" si ON s.id = si.schedule_id;

CREATE VIEW IF NOT EXISTS "arg.core.v_active_dispatches" AS
SELECT 
    si.id AS item_id,
    si.trip_id,
    si.departure_time,
    si.trip_times_json,
    si.dispatch_order,
    s.id AS schedule_id,
    s.branch_id,
    s.direction,
    dt.code AS day_type_code,
    b.code AS branch_code,
    b.name AS branch_name,
    l.code AS line_code,
    l.name AS line_name,
    l.color AS line_color
FROM "arg.core.schedule_items" si
JOIN "arg.core.schedules" s ON si.schedule_id = s.id
JOIN "arg.core.day_types" dt ON s.day_types_id = dt.id
JOIN "arg.core.branches" b ON s.branch_id = b.id
JOIN "arg.core.lines" l ON b.line_id = l.id;

-- 4. Vistas de compatibilidad para consultas estándar sin prefijo
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
