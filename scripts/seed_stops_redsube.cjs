const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

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
  const rp = JSON.parse(fs.readFileSync(path.join(dataDir, 'rutas_paradas.json'))).routeStops;
  const stopsList = JSON.parse(fs.readFileSync(path.join(dataDir, 'paradas.json'))).stops;
  const stopMap = new Map(stopsList.map(s => [s.id, s]));

  // Mapping from our V3 ramal code to CuandoSubo route IDs
  const redSubeMappings = [
    // Line 228
    { lineCode: '228', ramal: '228AC', name: 'Pte. Saavedra ⇄ Zárate', idaId: '710_148', vueltaId: '710_149' },
    { lineCode: '228', ramal: '228BA', name: 'Escobar ⇄ Fonavi ⇄ Garín ⇄ Saavedra', idaId: '138_1704', vueltaId: '138_1705' },
    { lineCode: '228', ramal: '228CB', name: 'Ariel del Plata ⇄ Zárate', idaId: '146_2121', vueltaId: '146_2122' },
    { lineCode: '228', ramal: '228CC', name: 'Lima ⇄ Zárate (Original)', idaId: '146_2123', vueltaId: '146_2124' },
    { lineCode: '228', ramal: '228CD', name: 'Luján ⇄ Zárate (x Cardales)', idaId: '146_2125', vueltaId: '146_2126' },
    { lineCode: '228', ramal: '228EA', name: 'Pque. Industrial Pilar ⇄ Est. Pilar', idaId: '146_1271', vueltaId: null },
    { lineCode: '228', ramal: '228EB', name: 'Benavídez ⇄ Bº Las Mascotas', idaId: '146_1273', vueltaId: '146_1272' },
    { lineCode: '228', ramal: '228FA', name: 'Pte. Saavedra ⇄ Del Viso Est. Toro', idaId: '131_1908', vueltaId: '131_1909' },
    // Line 194
    { lineCode: '194', ramal: '194-EXPRESS', name: 'Zárate ⇄ Plaza Miserere (Once)', idaId: '709_112', vueltaId: '709_111' },
    { lineCode: '194', ramal: '194-DIRECTO', name: 'Zárate ⇄ Escobar ⇄ Once', idaId: '709_119', vueltaId: '709_115' },
    { lineCode: '194', ramal: '194-COMUN', name: 'Zárate ⇄ Campana ⇄ Saavedra ⇄ Once', idaId: '709_117', vueltaId: '709_116' },
    // Line 204
    { lineCode: '204', ramal: '204A', name: 'Zárate ⇄ Campana x Colectora', idaId: '146_1794', vueltaId: '146_1795' },
    { lineCode: '204', ramal: '204B', name: 'Saavedra ⇄ Escobar', idaId: '146_1796', vueltaId: '146_1797' },
    // Line 314
    { lineCode: '314', ramal: '314A', name: 'Puente Saavedra ⇄ Villa Adelina', idaId: '133_1121', vueltaId: '133_1122' },
    { lineCode: '314', ramal: '314B', name: 'Puente Saavedra ⇄ Boulogne', idaId: '133_1123', vueltaId: '133_1124' }
  ];

  let sqlStatements = [];

  for (const m of redSubeMappings) {
    const branchId = generateDeterministicUUID(`branch:${m.ramal}`);

    // Process IDA Stops
    if (m.idaId) {
      const stopIds = rp[m.idaId] || [];
      stopIds.forEach((sid, idx) => {
        const sObj = stopMap.get(sid);
        if (sObj) {
          const stopRecordId = generateDeterministicUUID(`stop:${branchId}:ida:${sid}`);
          const sName = (sObj.name || `Parada ${idx+1}`).replace(/'/g, "''");
          sqlStatements.push(`INSERT INTO "arg.core.stops" (id, branch_id, direction, name, stop_order, lat, lng, proj_lat, proj_lng)
VALUES ('${stopRecordId}', '${branchId}', 'ida', '${sName}', ${idx+1}, ${sObj.lat}, ${sObj.lon}, ${sObj.lat}, ${sObj.lon})
ON CONFLICT(id) DO UPDATE SET name = excluded.name, stop_order = excluded.stop_order, lat = excluded.lat, lng = excluded.lng;`);
        }
      });
    }

    // Process VUELTA Stops
    if (m.vueltaId) {
      const stopIds = rp[m.vueltaId] || [];
      stopIds.forEach((sid, idx) => {
        const sObj = stopMap.get(sid);
        if (sObj) {
          const stopRecordId = generateDeterministicUUID(`stop:${branchId}:vuelta:${sid}`);
          const sName = (sObj.name || `Parada ${idx+1}`).replace(/'/g, "''");
          sqlStatements.push(`INSERT INTO "arg.core.stops" (id, branch_id, direction, name, stop_order, lat, lng, proj_lat, proj_lng)
VALUES ('${stopRecordId}', '${branchId}', 'vuelta', '${sName}', ${idx+1}, ${sObj.lat}, ${sObj.lon}, ${sObj.lat}, ${sObj.lon})
ON CONFLICT(id) DO UPDATE SET name = excluded.name, stop_order = excluded.stop_order, lat = excluded.lat, lng = excluded.lng;`);
        }
      });
    }
  }

  console.log(`Generated ${sqlStatements.length} stop SQL statements.`);

  const batchSize = 50;
  for (let i = 0; i < sqlStatements.length; i += batchSize) {
    const batch = sqlStatements.slice(i, i + batchSize);
    const tempFile = path.resolve(__dirname, `../temp_stops_batch_${i}.sql`);
    fs.writeFileSync(tempFile, batch.join('\n'));
    console.log(`Executing stops batch ${i / batchSize + 1} / ${Math.ceil(sqlStatements.length / batchSize)} (${batch.length} stmts)...`);
    try {
      execSync(`npx wrangler d1 execute collie-mobility-transit-db --remote --file=${tempFile}`, { stdio: 'inherit' });
    } catch (err) {
      console.error(`Error in stops batch ${i}:`, err.message);
      process.exit(1);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  }

  console.log('All RedSUBE stops seeded successfully into D1!');
}

main().catch(console.error);
