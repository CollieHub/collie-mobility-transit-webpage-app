const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

  const existingCompanyIds = {
    'SIT': '6c49f84e-e422-5b6f-b94d-ac5807983f35',
    '228': '23ccf89e-8e47-5a03-836c-4a3998975f6a'
  };

  const existingLineIds = {
    'SIT': '48da358e-2e8b-56b2-9c90-617ec53187e9',
    '228': 'b5ff40e5-b64b-5e9d-898b-91c8ece372d3'
  };

  const defaultStatusId = '8e55813d-5f75-50a0-ba40-c15b4d2e9df3';

  // Companies to ensure
  const companiesToEnsure = [
    { code: '228', name: 'Empresa de Transporte San Isidro S.A. / Metropol' },
    { code: '194', name: 'Chevallier Metropolitana / Metropol' },
    { code: '204', name: 'La Nueva Metropol / UTENOR' },
    { code: '314', name: 'La Primera de Martínez S.A.' }
  ];

  // Lines to ensure
  const linesToEnsure = [
    { code: '228', name: 'Línea 228 (La Nueva Metropol / MOTSA)', color: '#ec4899', companyCode: '228' },
    { code: '194', name: 'Línea 194 (Chevallier Metropolitana)', color: '#e65100', companyCode: '194' },
    { code: '204', name: 'Línea 204 (La Nueva Metropol / UTENOR)', color: '#00acc1', companyCode: '204' },
    { code: '314', name: 'Línea 314 (La Primera de Martínez S.A.)', color: '#059669', companyCode: '314' }
  ];

  // Mapping from our V3 ramal code to CuandoSubo route IDs
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
  sqlStatements.push(`-- Seed RedSUBE Lines, Branches, Route Shapes and Stops`);

  for (const c of companiesToEnsure) {
    const compId = existingCompanyIds[c.code] || generateDeterministicUUID(`company:${c.code}`);
    sqlStatements.push(`INSERT INTO "arg.core.companies" (id, code, name, description) VALUES ('${compId}', '${c.code}', '${c.name.replace(/'/g, "''")}', 'Empresa Operadora de Transporte')
ON CONFLICT(code) DO UPDATE SET name = excluded.name;`);
  }

  for (const l of linesToEnsure) {
    const lineId = existingLineIds[l.code] || generateDeterministicUUID(`line:${l.code}`);
    const compId = existingCompanyIds[l.companyCode] || generateDeterministicUUID(`company:${l.companyCode}`);
    sqlStatements.push(`INSERT INTO "arg.core.lines" (id, code, name, color, jurisdiction, company_id, company, line_publication_statuses_id)
VALUES ('${lineId}', '${l.code}', '${l.name.replace(/'/g, "''")}', '${l.color}', 'Provincial', '${compId}', '${l.code}', 'lpub_published')
ON CONFLICT(code) DO UPDATE SET name = excluded.name, color = excluded.color;`);
  }

  for (const m of redSubeMappings) {
    const lineId = existingLineIds[m.lineCode] || generateDeterministicUUID(`line:${m.lineCode}`);
    const compId = existingCompanyIds[m.lineCode] || generateDeterministicUUID(`company:${m.lineCode}`);
    const branchId = generateDeterministicUUID(`branch:${m.ramal}`);

    sqlStatements.push(`INSERT INTO "arg.core.branches" (id, line_id, code, name, company_id, company, branch_statuses_id, branch_publication_statuses_id)
VALUES ('${branchId}', '${lineId}', '${m.ramal}', '${m.name.replace(/'/g, "''")}', '${compId}', '${m.lineCode}', '${defaultStatusId}', 'bpub_published')
ON CONFLICT(id) DO UPDATE SET name = excluded.name, code = excluded.code;`);

    // Process IDA Shape & Stops
    if (m.idaId && polys[m.idaId] && polys[m.idaId][0]) {
      const coords = decodePolyline(polys[m.idaId][0].points);
      if (coords.length > 0) {
        const shapeId = generateDeterministicUUID(`shape:${branchId}:ida`);
        const coordsJson = JSON.stringify(coords).replace(/'/g, "''");
        sqlStatements.push(`INSERT INTO "arg.core.route_shapes" (id, branch_id, direction, coordinates_json, total_distance_km)
VALUES ('${shapeId}', '${branchId}', 'ida', '${coordsJson}', 0)
ON CONFLICT(id) DO UPDATE SET coordinates_json = excluded.coordinates_json;`);
      }

      const stopIds = rp[m.idaId] || [];
      stopIds.forEach((sid, idx) => {
        const sObj = stopMap.get(sid);
        if (sObj) {
          const stopRecordId = generateDeterministicUUID(`stop:${branchId}:ida:${sid}`);
          const sName = (sObj.name || `Parada ${idx+1}`).replace(/'/g, "''");
          sqlStatements.push(`INSERT OR IGNORE INTO "arg.core.stops" (id, branch_id, direction, name, stop_order, lat, lng)
VALUES ('${stopRecordId}', '${branchId}', 'ida', '${sName}', ${idx+1}, ${sObj.lat}, ${sObj.lon});`);
        }
      });
    }

    // Process VUELTA Shape & Stops
    if (m.vueltaId && polys[m.vueltaId] && polys[m.vueltaId][0]) {
      const coords = decodePolyline(polys[m.vueltaId][0].points);
      if (coords.length > 0) {
        const shapeId = generateDeterministicUUID(`shape:${branchId}:vuelta`);
        const coordsJson = JSON.stringify(coords).replace(/'/g, "''");
        sqlStatements.push(`INSERT INTO "arg.core.route_shapes" (id, branch_id, direction, coordinates_json, total_distance_km)
VALUES ('${shapeId}', '${branchId}', 'vuelta', '${coordsJson}', 0)
ON CONFLICT(id) DO UPDATE SET coordinates_json = excluded.coordinates_json;`);
      }

      const stopIds = rp[m.vueltaId] || [];
      stopIds.forEach((sid, idx) => {
        const sObj = stopMap.get(sid);
        if (sObj) {
          const stopRecordId = generateDeterministicUUID(`stop:${branchId}:vuelta:${sid}`);
          const sName = (sObj.name || `Parada ${idx+1}`).replace(/'/g, "''");
          sqlStatements.push(`INSERT OR IGNORE INTO "arg.core.stops" (id, branch_id, direction, name, stop_order, lat, lng)
VALUES ('${stopRecordId}', '${branchId}', 'vuelta', '${sName}', ${idx+1}, ${sObj.lat}, ${sObj.lon});`);
        }
      });
    }
  }

  const outSql = path.resolve(__dirname, '../seed_redsube.sql');
  fs.writeFileSync(outSql, sqlStatements.join('\n'));
  console.log(`Generated ${sqlStatements.length} SQL statements in ${outSql}`);
}

main().catch(console.error);
