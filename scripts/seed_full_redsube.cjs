const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function decodePolyline(str, precision = 5) {
  if (!str) return [];
  let index = 0, lat = 0, lng = 0, coordinates = [];
  let factor = Math.pow(10, precision);
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

function generateDeterministicUUID(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '5' + hash.substring(13, 16),
    '8' + hash.substring(17, 20),
    hash.substring(20, 32)
  ].join('-');
}

function executeSqlFile(filePath, label) {
  console.log(`🚀 Ejecutando ${label} (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)...`);
  try {
    execSync(`npx wrangler d1 execute collie-mobility-transit-db --remote --file=${filePath}`, { stdio: 'inherit' });
    console.log(`✅ ${label} completado.`);
  } catch (err) {
    console.error(`❌ Error en ${label}:`, err.message);
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

async function main() {
  const dataDir = path.resolve(__dirname, '../../cuandosubo/investigacion/datos');
  console.log('📦 Cargando archivos JSON de RedSUBE desde:', dataDir);

  const agenciasRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'agencias.json')));
  const agenciasList = agenciasRaw.agencies || agenciasRaw.data?.list || [];
  console.log(`- Agencias: ${agenciasList.length}`);

  const rutasRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'rutas_completas.json')));
  const rutasMap = rutasRaw.routes || rutasRaw;
  const rutasEntries = Array.isArray(rutasMap) ? rutasMap : Object.entries(rutasMap).map(([id, r]) => ({ id, ...r }));
  console.log(`- Rutas/Ramales: ${rutasEntries.length}`);

  const polys = JSON.parse(fs.readFileSync(path.join(dataDir, 'recorridos_polylines.json'))).polylines || {};
  const rp = JSON.parse(fs.readFileSync(path.join(dataDir, 'rutas_paradas.json'))).routeStops || {};
  const stopsList = JSON.parse(fs.readFileSync(path.join(dataDir, 'paradas.json'))).stops || [];
  const stopMap = new Map(stopsList.map(s => [s.id, s]));
  console.log(`- Paradas en catálogo: ${stopsList.length}`);

  // ==========================================
  // PASO 1: AGENCIAS Y LÍNEAS ÚNICAS
  // ==========================================
  const step1Sql = ['PRAGMA foreign_keys = OFF;'];

  for (const a of agenciasList) {
    const aid = (a.id || a.agency_id || '').replace(/'/g, "''");
    const aname = (a.name || a.agency_name || `Empresa ${aid}`).replace(/'/g, "''");
    const aurl = (a.url || a.agency_url || '').replace(/'/g, "''");
    if (aid) {
      step1Sql.push(`INSERT INTO "arg.redsube.agencies" (agency_id, agency_name, agency_url)
VALUES ('${aid}', '${aname}', '${aurl}')
ON CONFLICT(agency_id) DO UPDATE SET agency_name = excluded.agency_name, agency_url = excluded.agency_url;`);
    }
  }

  const uniqueLines = new Map();
  for (const r of rutasEntries) {
    const lineCode = String(r.shortName || r.route_short_name || (r.id ? r.id.split('_')[0] : 'Línea')).trim();
    if (!uniqueLines.has(lineCode)) {
      uniqueLines.set(lineCode, {
        id: generateDeterministicUUID(`redsube:line:${lineCode}`),
        code: lineCode,
        name: `Línea ${lineCode}`,
        color: r.color ? (r.color.startsWith('#') ? r.color : `#${r.color}`) : '#e65100',
        agencyId: r.agencyId || r.agency_id || null
      });
    }
  }

  for (const [code, l] of uniqueLines.entries()) {
    const aidVal = l.agencyId ? `'${l.agencyId.replace(/'/g, "''")}'` : 'NULL';
    step1Sql.push(`INSERT INTO "arg.redsube.lines" (id, code, name, color, agency_id)
VALUES ('${l.id}', '${code.replace(/'/g, "''")}', '${l.name.replace(/'/g, "''")}', '${l.color}', ${aidVal})
ON CONFLICT(code) DO UPDATE SET name = excluded.name, color = excluded.color;`);
  }

  const fileStep1 = path.resolve(__dirname, '../temp_step1_agencies_lines.sql');
  fs.writeFileSync(fileStep1, step1Sql.join('\n'));
  executeSqlFile(fileStep1, `Paso 1: ${agenciasList.length} Agencias y ${uniqueLines.size} Líneas`);

  // ==========================================
  // PASO 2: RAMALES (BRANCHES)
  // ==========================================
  const step2Sql = ['PRAGMA foreign_keys = OFF;'];
  for (const r of rutasEntries) {
    const routeId = r.id || r.route_id;
    if (!routeId) continue;

    const lineCode = String(r.shortName || r.route_short_name || routeId.split('_')[0]).trim();
    const lineObj = uniqueLines.get(lineCode);
    const lineId = lineObj ? lineObj.id : generateDeterministicUUID(`redsube:line:${lineCode}`);
    const branchId = generateDeterministicUUID(`redsube:branch:${routeId}`);

    const branchName = (r.longName || r.description || r.name || `Ramal ${routeId}`).replace(/'/g, "''");
    const agencyIdVal = r.agencyId ? `'${r.agencyId.replace(/'/g, "''")}'` : 'NULL';
    const colorVal = r.color ? (r.color.startsWith('#') ? r.color : `#${r.color}`) : (lineObj ? lineObj.color : '#e65100');

    step2Sql.push(`INSERT INTO "arg.redsube.branches" (id, line_id, code, name, agency_id, route_id, color, description)
VALUES ('${branchId}', '${lineId}', '${routeId.replace(/'/g, "''")}', '${branchName}', ${agencyIdVal}, '${routeId.replace(/'/g, "''")}', '${colorVal}', '${branchName}')
ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color, description = excluded.description;`);
  }

  const fileStep2 = path.resolve(__dirname, '../temp_step2_branches.sql');
  fs.writeFileSync(fileStep2, step2Sql.join('\n'));
  executeSqlFile(fileStep2, `Paso 2: ${rutasEntries.length} Ramales`);

  // ==========================================
  // PASO 3: TRAZADOS (SHAPES)
  // ==========================================
  let shapesSql = ['PRAGMA foreign_keys = OFF;'];
  let shapeCount = 0;
  let shapeChunkIdx = 1;

  for (const r of rutasEntries) {
    const routeId = r.id || r.route_id;
    if (!routeId) continue;
    const branchId = generateDeterministicUUID(`redsube:branch:${routeId}`);

    const polyArr = polys[routeId];
    if (polyArr && Array.isArray(polyArr) && polyArr.length > 0) {
      polyArr.forEach((pObj, pIdx) => {
        const coords = decodePolyline(pObj.points);
        if (coords.length > 0) {
          const dir = pIdx === 0 ? 'ida' : (pIdx === 1 ? 'vuelta' : `dir_${pIdx}`);
          const shapeId = generateDeterministicUUID(`redsube:shape:${branchId}:${dir}`);
          const coordsJson = JSON.stringify(coords).replace(/'/g, "''");
          shapesSql.push(`INSERT INTO "arg.redsube.route_shapes" (id, branch_id, direction, coordinates_json, total_distance_km)
VALUES ('${shapeId}', '${branchId}', '${dir}', '${coordsJson}', 0)
ON CONFLICT(id) DO UPDATE SET coordinates_json = excluded.coordinates_json;`);
          shapeCount++;
        }
      });
    }

    if (shapesSql.length >= 300) {
      const fileShape = path.resolve(__dirname, `../temp_step3_shapes_${shapeChunkIdx}.sql`);
      fs.writeFileSync(fileShape, shapesSql.join('\n'));
      executeSqlFile(fileShape, `Paso 3 [Lote ${shapeChunkIdx}]: ${shapesSql.length - 1} Shapes`);
      shapesSql = ['PRAGMA foreign_keys = OFF;'];
      shapeChunkIdx++;
    }
  }

  if (shapesSql.length > 1) {
    const fileShape = path.resolve(__dirname, `../temp_step3_shapes_${shapeChunkIdx}.sql`);
    fs.writeFileSync(fileShape, shapesSql.join('\n'));
    executeSqlFile(fileShape, `Paso 3 [Lote ${shapeChunkIdx} Final]: ${shapesSql.length - 1} Shapes`);
  }

  // ==========================================
  // PASO 4: PARADAS (STOPS)
  // ==========================================
  let stopsSql = ['PRAGMA foreign_keys = OFF;'];
  let stopInsertCount = 0;
  let stopChunkIdx = 1;

  for (const r of rutasEntries) {
    const routeId = r.id || r.route_id;
    if (!routeId) continue;
    const branchId = generateDeterministicUUID(`redsube:branch:${routeId}`);

    const routeStopIds = rp[routeId];
    if (routeStopIds && Array.isArray(routeStopIds) && routeStopIds.length > 0) {
      routeStopIds.forEach((sid, sIdx) => {
        const sObj = stopMap.get(sid);
        if (sObj) {
          const stopRecordId = generateDeterministicUUID(`redsube:stop:${branchId}:${sid}`);
          const sName = (sObj.name || `Parada ${sIdx + 1}`).replace(/'/g, "''");
          const sDesc = (sObj.code || sObj.direction || '').replace(/'/g, "''");
          stopsSql.push(`INSERT INTO "arg.redsube.stops" (id, branch_id, direction, name, stop_order, lat, lng, proj_lat, proj_lng, stop_desc)
VALUES ('${stopRecordId}', '${branchId}', 'ida', '${sName}', ${sIdx + 1}, ${sObj.lat}, ${sObj.lon}, ${sObj.lat}, ${sObj.lon}, '${sDesc}')
ON CONFLICT(id) DO UPDATE SET name = excluded.name, stop_order = excluded.stop_order, lat = excluded.lat, lng = excluded.lng;`);
          stopInsertCount++;
        }
      });
    }

    if (stopsSql.length >= 600) {
      const fileStop = path.resolve(__dirname, `../temp_step4_stops_${stopChunkIdx}.sql`);
      fs.writeFileSync(fileStop, stopsSql.join('\n'));
      executeSqlFile(fileStop, `Paso 4 [Lote ${stopChunkIdx}]: ${stopsSql.length - 1} Paradas`);
      stopsSql = ['PRAGMA foreign_keys = OFF;'];
      stopChunkIdx++;
    }
  }

  if (stopsSql.length > 1) {
    const fileStop = path.resolve(__dirname, `../temp_step4_stops_${stopChunkIdx}.sql`);
    fs.writeFileSync(fileStop, stopsSql.join('\n'));
    executeSqlFile(fileStop, `Paso 4 [Lote ${stopChunkIdx} Final]: ${stopsSql.length - 1} Paradas`);
  }

  console.log(`🎉 Ingesta masiva finalizada: ${agenciasList.length} agencias, ${uniqueLines.size} líneas, ${rutasEntries.length} ramales, ${shapeCount} shapes, ${stopInsertCount} paradas insertadas en arg.redsube.*!`);
}

main().catch(console.error);
