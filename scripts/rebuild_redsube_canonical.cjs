const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function uuidv5(name) {
  const hash = crypto.createHash('md5').update('redsube_v3_' + name).digest('hex');
  return `${hash.substr(0,8)}-${hash.substr(8,4)}-5${hash.substr(13,3)}-8${hash.substr(17,3)}-${hash.substr(20,12)}`;
}

function escapeSql(str) {
  return String(str || '').replace(/'/g, "''").replace(/\\/g, '').trim();
}

function getBranchColor(branchCode) {
  const ROUTE_COLORS_PALETTE = [
    '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444',
    '#ec4899', '#06b6d4', '#eab308', '#14b8a6', '#f43f5e',
    '#6366f1', '#84cc16', '#a855f7', '#0ea5e9', '#d97706'
  ];
  if (!branchCode) return ROUTE_COLORS_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < branchCode.length; i++) {
    hash = branchCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ROUTE_COLORS_PALETTE[Math.abs(hash) % ROUTE_COLORS_PALETTE.length];
}

function main() {
  const dataDir = path.resolve(__dirname, '../../cuandosubo/investigacion/datos');
  console.log('📦 Cargando archivos JSON de RedSUBE desde:', dataDir);

  const agenciasRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'agencias.json')));
  const agenciasList = agenciasRaw.agencies || agenciasRaw.data?.list || [];
  const agenciasMap = require('../src/lib/redsube/agencies_map.json');
  const gtfsLines = require('../src/lib/redsube/all_gtfs_lines.json');

  const rutasRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'rutas_completas.json')));
  const rutasMap = rutasRaw.routes || rutasRaw;
  const rutasEntries = Array.isArray(rutasMap) ? rutasMap : Object.entries(rutasMap).map(([id, r]) => ({ id, ...r }));

  const polys = JSON.parse(fs.readFileSync(path.join(dataDir, 'recorridos_polylines.json'))).polylines || {};
  const rp = JSON.parse(fs.readFileSync(path.join(dataDir, 'rutas_paradas.json'))).routeStops || {};
  const stopsList = JSON.parse(fs.readFileSync(path.join(dataDir, 'paradas.json'))).stops || [];
  const stopMap = new Map(stopsList.map(s => [String(s.id), s]));

  // GTFS Ramales map for high-precision names & headsigns
  const gtfsRamalesMap = new Map();
  for (const l of gtfsLines) {
    if (Array.isArray(l.ramales)) {
      for (const r of l.ramales) {
        if (r.route_id) gtfsRamalesMap.set(String(r.route_id), { ...r, lineCode: l.lineCode, agencyName: l.agencyName });
        if (r.shortName) gtfsRamalesMap.set(String(r.shortName), { ...r, lineCode: l.lineCode, agencyName: l.agencyName });
      }
    }
  }

  // 1. Agrupar rutas en Ramales canónicos (Línea + Ramal)
  // Cada ramal tiene 1 o 2 rutas asociadas (Ida y Vuelta)
  const canonicalBranches = new Map(); // key: agencyId + '__' + lineCode + '__' + shortName
  const canonicalLines = new Map(); // key: agencyId + '__' + lineCode

  for (const r of rutasEntries) {
    const shortName = String(r.shortName || '').trim();
    const agencyId = String(r.agencyId || '0').trim();
    const agencyName = agenciasMap[agencyId] || r._agencyName || `Empresa ${agencyId}`;

    // Determinar código comercial de la línea (e.g. 6A -> 6, 194J -> 194, 228A -> 228, 501 -> 501)
    let lineCode = '';
    const numMatch = shortName.match(/^([0-9]+)/);
    if (numMatch) {
      lineCode = numMatch[1];
    } else {
      lineCode = shortName;
    }

    const lineKey = `${agencyId}__${lineCode}`;
    if (!canonicalLines.has(lineKey)) {
      canonicalLines.set(lineKey, {
        id: uuidv5(`line_${lineKey}`),
        lineKey,
        lineCode,
        agencyId,
        agencyName,
        displayName: `Línea ${lineCode} (${agencyName})`,
        color: '#38bdf8',
        jurisdiction: 'Nacional / Provincial'
      });
    }

    const branchKey = `${agencyId}__${lineCode}__${shortName}`;
    if (!canonicalBranches.has(branchKey)) {
      canonicalBranches.set(branchKey, {
        id: uuidv5(`branch_${branchKey}`),
        branchKey,
        lineKey,
        lineId: canonicalLines.get(lineKey).id,
        lineCode,
        shortName,
        agencyId,
        agencyName,
        color: getBranchColor(shortName),
        description: r.longName || r.description || '',
        routes: []
      });
    }

    canonicalBranches.get(branchKey).routes.push(r);
  }

  console.log(`✅ Líneas canónicas únicas: ${canonicalLines.size}`);
  console.log(`✅ Ramales canónicos únicos: ${canonicalBranches.size}`);

  // 2. Procesar cabeceras, recorridos y paradas por ramal
  const sqlLines = [];
  const sqlBranches = [];
  const sqlShapes = [];
  const sqlStops = [];

  for (const l of canonicalLines.values()) {
    sqlLines.push(`INSERT INTO "arg.redsube.lines" (id, code, name, color, jurisdiction, agency_id)
VALUES ('${l.id}', '${escapeSql(l.lineCode)}', '${escapeSql(l.displayName)}', '${l.color}', '${l.jurisdiction}', '${escapeSql(l.agencyId)}');`);
  }

  for (const b of canonicalBranches.values()) {
    let headsignIda = '';
    let headsignVuelta = '';
    let routeIda = null;
    let routeVuelta = null;

    // Buscar en GTFS primero
    const g = gtfsRamalesMap.get(b.shortName);
    if (g) {
      headsignIda = g.headsignIda || '';
      headsignVuelta = g.headsignVuelta || '';
      if ((!headsignIda || !headsignVuelta) && g.longName && g.longName.includes('⇄')) {
        const parts = g.longName.split('⇄').map(s => s.trim());
        headsignIda = parts[0];
        headsignVuelta = parts[1];
      }
    }

    // Clasificar las rutas internas de Ida y Vuelta
    if (b.routes.length === 1) {
      routeIda = b.routes[0];
    } else if (b.routes.length >= 2) {
      const r1 = b.routes[0];
      const r2 = b.routes[1];
      const d1 = (r1.description || '').toLowerCase();
      const d2 = (r2.description || '').toLowerCase();

      if (d1.includes('a ') && d2.includes('a ')) {
        routeIda = r1;
        routeVuelta = r2;
        if (!headsignIda) headsignIda = r1.description.split(':').pop()?.replace(/^ a /i, '').trim();
        if (!headsignVuelta) headsignVuelta = r2.description.split(':').pop()?.replace(/^ a /i, '').trim();
      } else {
        routeIda = r1;
        routeVuelta = r2;
      }
    }

    if (!headsignIda && routeIda?.description) {
      const desc = routeIda.description;
      if (desc.includes('⇄')) {
        const parts = desc.split('⇄').map(s => s.trim());
        headsignIda = parts[0];
        headsignVuelta = parts[1];
      } else if (desc.includes(':')) {
        const parts = desc.split(':').map(s => s.trim());
        headsignIda = parts[0];
        if (parts[1]) headsignVuelta = parts[1];
      } else if (desc.includes('-')) {
        const parts = desc.split('-').map(s => s.trim());
        headsignIda = parts[0];
        headsignVuelta = parts[parts.length - 1];
      }
    }

    const branchName = headsignIda && headsignVuelta ? `${headsignIda} ⇄ ${headsignVuelta}` : (b.shortName ? `Ramal ${b.shortName}` : 'Ramal');

    sqlBranches.push(`INSERT INTO "arg.redsube.branches" (id, line_id, code, name, agency_id, headsign_ida, headsign_vuelta, color, description)
VALUES ('${b.id}', '${b.lineId}', '${escapeSql(b.shortName)}', '${escapeSql(branchName)}', '${escapeSql(b.agencyId)}', '${escapeSql(headsignIda || 'Ida')}', '${escapeSql(headsignVuelta || 'Vuelta')}', '${b.color}', '${escapeSql(b.description)}');`);

    // Shape Ida
    if (routeIda) {
      const polyIda = polys[routeIda.id];
      if (Array.isArray(polyIda) && polyIda.length > 0) {
        const coords = polyIda.map(pt => [pt.lat, pt.lon]);
        sqlShapes.push(`INSERT INTO "arg.redsube.route_shapes" (id, branch_id, direction, coordinates_json, total_distance_km)
VALUES ('${uuidv5(`shape_ida_${b.id}`)}', '${b.id}', 'ida', '${escapeSql(JSON.stringify(coords))}', 0);`);
      }

      // Paradas Ida
      const stopIdsIda = rp[routeIda.id] || [];
      stopIdsIda.forEach((sid, idx) => {
        const st = stopMap.get(String(sid));
        if (st) {
          sqlStops.push(`INSERT INTO "arg.redsube.stops" (id, branch_id, direction, stop_order, name, lat, lng, proj_lat, proj_lng, stop_desc)
VALUES ('${uuidv5(`stop_ida_${b.id}_${idx}`)}', '${b.id}', 'ida', ${idx + 1}, '${escapeSql(st.name || 'Parada')}', ${st.lat}, ${st.lon}, ${st.lat}, ${st.lon}, '${escapeSql(st.desc || '')}');`);
        }
      });
    }

    // Shape Vuelta
    if (routeVuelta) {
      const polyVuelta = polys[routeVuelta.id];
      if (Array.isArray(polyVuelta) && polyVuelta.length > 0) {
        const coords = polyVuelta.map(pt => [pt.lat, pt.lon]);
        sqlShapes.push(`INSERT INTO "arg.redsube.route_shapes" (id, branch_id, direction, coordinates_json, total_distance_km)
VALUES ('${uuidv5(`shape_vuelta_${b.id}`)}', '${b.id}', 'vuelta', '${escapeSql(JSON.stringify(coords))}', 0);`);
      }

      // Paradas Vuelta
      const stopIdsVuelta = rp[routeVuelta.id] || [];
      stopIdsVuelta.forEach((sid, idx) => {
        const st = stopMap.get(String(sid));
        if (st) {
          sqlStops.push(`INSERT INTO "arg.redsube.stops" (id, branch_id, direction, stop_order, name, lat, lng, proj_lat, proj_lng, stop_desc)
VALUES ('${uuidv5(`stop_vuelta_${b.id}_${idx}`)}', '${b.id}', 'vuelta', ${idx + 1}, '${escapeSql(st.name || 'Parada')}', ${st.lat}, ${st.lon}, ${st.lat}, ${st.lon}, '${escapeSql(st.desc || '')}');`);
        }
      });
    }
  }

  console.log(`📊 Generados:`);
  console.log(`- Líneas SQL: ${sqlLines.length}`);
  console.log(`- Ramales SQL: ${sqlBranches.length}`);
  console.log(`- Shapes SQL: ${sqlShapes.length}`);
  console.log(`- Paradas SQL: ${sqlStops.length}`);

  // 1. Archivo de Reset DDL
  const ddlReset = `
DROP TABLE IF EXISTS "arg.redsube.stops";
DROP TABLE IF EXISTS "arg.redsube.route_shapes";
DROP TABLE IF EXISTS "arg.redsube.branches";
DROP TABLE IF EXISTS "arg.redsube.lines";

CREATE TABLE "arg.redsube.lines" (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  jurisdiction TEXT DEFAULT 'Nacional / Provincial',
  agency_id TEXT,
  last_updated INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES "arg.redsube.agencies"(agency_id)
);

CREATE TABLE "arg.redsube.branches" (
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

CREATE TABLE "arg.redsube.route_shapes" (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  coordinates_json TEXT NOT NULL,
  total_distance_km REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES "arg.redsube.branches"(id) ON DELETE CASCADE
);

CREATE TABLE "arg.redsube.stops" (
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
`;

  fs.writeFileSync('./temp_00_reset_ddl.sql', ddlReset);

  // Inserciones de Líneas y Ramales (chunks de 300)
  const batchSize = 300;
  const lbChunks = [];
  for (let i = 0; i < sqlLines.length; i += batchSize) {
    const chunk = sqlLines.slice(i, i + batchSize);
    const chunkFile = `./temp_01_lines_part_${Math.floor(i / batchSize) + 1}.sql`;
    fs.writeFileSync(chunkFile, 'PRAGMA foreign_keys = OFF;\n' + chunk.join('\n'));
    lbChunks.push(chunkFile);
  }

  for (let i = 0; i < sqlBranches.length; i += batchSize) {
    const chunk = sqlBranches.slice(i, i + batchSize);
    const chunkFile = `./temp_02_branches_part_${Math.floor(i / batchSize) + 1}.sql`;
    fs.writeFileSync(chunkFile, 'PRAGMA foreign_keys = OFF;\n' + chunk.join('\n'));
    lbChunks.push(chunkFile);
  }

  const shapeChunks = [];
  for (let i = 0; i < sqlShapes.length; i += batchSize) {
    const chunk = sqlShapes.slice(i, i + batchSize);
    const chunkFile = `./temp_03_shapes_part_${Math.floor(i / batchSize) + 1}.sql`;
    fs.writeFileSync(chunkFile, 'PRAGMA foreign_keys = OFF;\n' + chunk.join('\n'));
    shapeChunks.push(chunkFile);
  }

  console.log(`💾 Generado temp_00_reset_ddl.sql`);
  console.log(`💾 Generados ${lbChunks.length} archivos de líneas/ramales y ${shapeChunks.length} archivos de shapes`);
}

main();
