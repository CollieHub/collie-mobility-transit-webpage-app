const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function decodePolyline(str, precision = 5) {
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

async function main() {
  const dataDir = path.resolve(__dirname, '../../cuandosubo/investigacion/datos');
  const polys = JSON.parse(fs.readFileSync(path.join(dataDir, 'recorridos_polylines.json'))).polylines;
  const rp = JSON.parse(fs.readFileSync(path.join(dataDir, 'rutas_paradas.json'))).routeStops;
  const stopsList = JSON.parse(fs.readFileSync(path.join(dataDir, 'paradas.json'))).stops;
  const stopMap = new Map(stopsList.map(s => [s.id, s]));

  const agencies = [
    { id: '228', name: 'Empresa de Transporte San Isidro S.A. / Metropol' },
    { id: '194', name: 'Chevallier Metropolitana / Metropol' },
    { id: '204', name: 'La Nueva Metropol / UTENOR' },
    { id: '314', name: 'La Primera de Martínez S.A.' }
  ];

  const lines = [
    { code: '228', name: 'Línea 228 (La Nueva Metropol / MOTSA)', color: '#ec4899', agencyId: '228' },
    { code: '194', name: 'Línea 194 (Chevallier Metropolitana)', color: '#e65100', agencyId: '194' },
    { code: '204', name: 'Línea 204 (La Nueva Metropol / UTENOR)', color: '#00acc1', agencyId: '204' },
    { code: '314', name: 'Línea 314 (La Primera de Martínez S.A.)', color: '#059669', agencyId: '314' }
  ];

  const redSubeMappings = [
    // Line 228
    { lineCode: '228', ramal: '228AC', name: 'Pte. Saavedra ⇄ Zárate', idaId: '710_148', vueltaId: '710_149', idaLabel: 'Pte. Saavedra', vueltaLabel: 'Zárate' },
    { lineCode: '228', ramal: '228BA', name: 'Escobar ⇄ Fonavi ⇄ Garín ⇄ Saavedra', idaId: '138_1704', vueltaId: '138_1705', idaLabel: 'Escobar', vueltaLabel: 'Saavedra' },
    { lineCode: '228', ramal: '228CB', name: 'Ariel del Plata ⇄ Zárate', idaId: '146_2121', vueltaId: '146_2122', idaLabel: 'Ariel del Plata', vueltaLabel: 'Zárate' },
    { lineCode: '228', ramal: '228CC', name: 'Lima ⇄ Zárate (Original)', idaId: '146_2123', vueltaId: '146_2124', idaLabel: 'Lima', vueltaLabel: 'Zárate' },
    { lineCode: '228', ramal: '228CD', name: 'Luján ⇄ Zárate (x Cardales)', idaId: '146_2125', vueltaId: '146_2126', idaLabel: 'Luján', vueltaLabel: 'Zárate' },
    { lineCode: '228', ramal: '228EA', name: 'Pque. Industrial Pilar ⇄ Est. Pilar', idaId: '146_1271', vueltaId: null, idaLabel: 'Pque. Industrial', vueltaLabel: 'Est. Pilar' },
    { lineCode: '228', ramal: '228EB', name: 'Benavídez ⇄ Bº Las Mascotas', idaId: '146_1273', vueltaId: '146_1272', idaLabel: 'Benavídez', vueltaLabel: 'Bº Las Mascotas' },
    { lineCode: '228', ramal: '228FA', name: 'Pte. Saavedra ⇄ Del Viso Est. Toro', idaId: '131_1908', vueltaId: '131_1909', idaLabel: 'Pte. Saavedra', vueltaLabel: 'Del Viso' },
    // Line 194
    { lineCode: '194', ramal: '194-EXPRESS', name: 'Zárate ⇄ Plaza Miserere (Once)', idaId: '709_112', vueltaId: '709_111', idaLabel: 'Once', vueltaLabel: 'Zárate' },
    { lineCode: '194', ramal: '194-DIRECTO', name: 'Zárate ⇄ Escobar ⇄ Once', idaId: '709_119', vueltaId: '709_115', idaLabel: 'Once', vueltaLabel: 'Zárate' },
    { lineCode: '194', ramal: '194-COMUN', name: 'Zárate ⇄ Campana ⇄ Saavedra ⇄ Once', idaId: '709_117', vueltaId: '709_116', idaLabel: 'Once', vueltaLabel: 'Zárate' },
    // Line 204
    { lineCode: '204', ramal: '204A', name: 'Zárate ⇄ Campana x Colectora', idaId: '146_1794', vueltaId: '146_1795', idaLabel: 'Campana', vueltaLabel: 'Zárate' },
    { lineCode: '204', ramal: '204B', name: 'Saavedra ⇄ Escobar', idaId: '146_1796', vueltaId: '146_1797', idaLabel: 'Escobar', vueltaLabel: 'Saavedra' },
    // Line 314
    { lineCode: '314', ramal: '314A', name: 'Puente Saavedra ⇄ Villa Adelina', idaId: '133_1121', vueltaId: '133_1122', idaLabel: 'Villa Adelina', vueltaLabel: 'Pte. Saavedra' },
    { lineCode: '314', ramal: '314B', name: 'Puente Saavedra ⇄ Boulogne', idaId: '133_1123', vueltaId: '133_1124', idaLabel: 'Boulogne', vueltaLabel: 'Pte. Saavedra' }
  ];

  let sqlStatements = [];

  // 1. Agencies
  for (const a of agencies) {
    sqlStatements.push(`INSERT INTO "arg.redsube.agencies" (agency_id, agency_name) VALUES ('${a.id}', '${a.name.replace(/'/g, "''")}') ON CONFLICT(agency_id) DO UPDATE SET agency_name = excluded.agency_name;`);
  }

  // 2. Lines
  for (const l of lines) {
    const lineId = generateDeterministicUUID(`redsube:line:${l.code}`);
    sqlStatements.push(`INSERT INTO "arg.redsube.lines" (id, code, name, color, agency_id) VALUES ('${lineId}', '${l.code}', '${l.name.replace(/'/g, "''")}', '${l.color}', '${l.agencyId}') ON CONFLICT(code) DO UPDATE SET name = excluded.name, color = excluded.color;`);
  }

  // 3. Branches, Shapes & Stops
  for (const m of redSubeMappings) {
    const lineId = generateDeterministicUUID(`redsube:line:${m.lineCode}`);
    const branchId = generateDeterministicUUID(`redsube:branch:${m.ramal}`);

    sqlStatements.push(`INSERT INTO "arg.redsube.branches" (id, line_id, code, name, agency_id, headsign_ida, headsign_vuelta)
VALUES ('${branchId}', '${lineId}', '${m.ramal}', '${m.name.replace(/'/g, "''")}', '${m.lineCode}', '${m.idaLabel}', '${m.vueltaLabel || ''}')
ON CONFLICT(id) DO UPDATE SET name = excluded.name, code = excluded.code;`);

    // Process IDA Shape & Stops
    if (m.idaId && polys[m.idaId] && polys[m.idaId][0]) {
      const coords = decodePolyline(polys[m.idaId][0].points);
      if (coords.length > 0) {
        const shapeId = generateDeterministicUUID(`redsube:shape:${branchId}:ida`);
        const coordsJson = JSON.stringify(coords).replace(/'/g, "''");
        sqlStatements.push(`INSERT INTO "arg.redsube.route_shapes" (id, branch_id, direction, coordinates_json, total_distance_km)
VALUES ('${shapeId}', '${branchId}', 'ida', '${coordsJson}', 0)
ON CONFLICT(id) DO UPDATE SET coordinates_json = excluded.coordinates_json;`);
      }

      const stopIds = rp[m.idaId] || [];
      stopIds.forEach((sid, idx) => {
        const sObj = stopMap.get(sid);
        if (sObj) {
          const stopRecordId = generateDeterministicUUID(`redsube:stop:${branchId}:ida:${sid}`);
          const sName = (sObj.name || `Parada ${idx+1}`).replace(/'/g, "''");
          sqlStatements.push(`INSERT INTO "arg.redsube.stops" (id, branch_id, direction, name, stop_order, lat, lng, proj_lat, proj_lng)
VALUES ('${stopRecordId}', '${branchId}', 'ida', '${sName}', ${idx+1}, ${sObj.lat}, ${sObj.lon}, ${sObj.lat}, ${sObj.lon})
ON CONFLICT(id) DO UPDATE SET name = excluded.name, stop_order = excluded.stop_order, lat = excluded.lat, lng = excluded.lng;`);
        }
      });
    }

    // Process VUELTA Shape & Stops
    if (m.vueltaId && polys[m.vueltaId] && polys[m.vueltaId][0]) {
      const coords = decodePolyline(polys[m.vueltaId][0].points);
      if (coords.length > 0) {
        const shapeId = generateDeterministicUUID(`redsube:shape:${branchId}:vuelta`);
        const coordsJson = JSON.stringify(coords).replace(/'/g, "''");
        sqlStatements.push(`INSERT INTO "arg.redsube.route_shapes" (id, branch_id, direction, coordinates_json, total_distance_km)
VALUES ('${shapeId}', '${branchId}', 'vuelta', '${coordsJson}', 0)
ON CONFLICT(id) DO UPDATE SET coordinates_json = excluded.coordinates_json;`);
      }

      const stopIds = rp[m.vueltaId] || [];
      stopIds.forEach((sid, idx) => {
        const sObj = stopMap.get(sid);
        if (sObj) {
          const stopRecordId = generateDeterministicUUID(`redsube:stop:${branchId}:vuelta:${sid}`);
          const sName = (sObj.name || `Parada ${idx+1}`).replace(/'/g, "''");
          sqlStatements.push(`INSERT INTO "arg.redsube.stops" (id, branch_id, direction, name, stop_order, lat, lng, proj_lat, proj_lng)
VALUES ('${stopRecordId}', '${branchId}', 'vuelta', '${sName}', ${idx+1}, ${sObj.lat}, ${sObj.lon}, ${sObj.lat}, ${sObj.lon})
ON CONFLICT(id) DO UPDATE SET name = excluded.name, stop_order = excluded.stop_order, lat = excluded.lat, lng = excluded.lng;`);
        }
      });
    }
  }

  console.log(`Generated ${sqlStatements.length} statements for arg.redsube.*`);

  const batchSize = 50;
  for (let i = 0; i < sqlStatements.length; i += batchSize) {
    const batch = sqlStatements.slice(i, i + batchSize);
    const tempFile = path.resolve(__dirname, `../temp_arg_redsube_batch_${i}.sql`);
    fs.writeFileSync(tempFile, batch.join('\n'));
    console.log(`Executing arg.redsube batch ${i / batchSize + 1} / ${Math.ceil(sqlStatements.length / batchSize)} (${batch.length} stmts)...`);
    try {
      execSync(`npx wrangler d1 execute collie-mobility-transit-db --remote --file=${tempFile}`, { stdio: 'inherit' });
    } catch (err) {
      console.error(`Error in batch ${i}:`, err.message);
      process.exit(1);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  }

  console.log('All RedSUBE data seeded into arg.redsube.* successfully!');
}

main().catch(console.error);
