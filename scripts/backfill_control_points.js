import { execSync } from 'child_process';

console.log('🚀 Iniciando script de backfill de is_control_point en Cloudflare D1...');

function executeD1(sql, isRemote = true) {
  const remoteFlag = isRemote ? '--remote' : '--local';
  // Escapar comillas dobles
  const escapedSql = sql.replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute collie-mobility-transit-db ${remoteFlag} --command="${escapedSql}" --json`;
  try {
    const stdout = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed) && parsed[0] && parsed[0].results) {
      return parsed[0].results;
    }
    return [];
  } catch (err) {
    console.error('Error executing D1 command:', err.message);
    return [];
  }
}

async function runBackfill(isRemote = true) {
  const target = isRemote ? 'PRODUCCIÓN (Remote)' : 'LOCAL (Dev)';
  console.log(`\n========================================`);
  console.log(`📦 Procesando entorno: ${target}`);
  console.log(`========================================`);

  // 1. Resetear todos los stops a is_control_point = 0
  console.log('🔄 Reseteando is_control_point = 0 en todas las paradas...');
  executeD1('UPDATE stops SET is_control_point = 0;', isRemote);

  // 2. Obtener todos los schedules existentes
  console.log('📡 Obteniendo registros de tabla schedules...');
  const schedules = executeD1('SELECT id, branch_id, direction, stop_addresses_json, headers_json FROM schedules;', isRemote);
  console.log(`Encontrados ${schedules.length} registros en tabla schedules.`);

  // 3. Obtener todas las paradas existentes
  const allStops = executeD1('SELECT id, branch_id, direction, name, stop_order FROM stops;', isRemote);
  console.log(`Encontradas ${allStops.length} paradas en tabla stops.`);

  // Helper de normalización
  function normalize(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  function cleanNum(str) {
    return (str || '').replace(/^\d+[\.\s\-]+\s*/, '');
  }

  const controlStopIdsToUpdate = new Set();

  for (const s of schedules) {
    const branchId = s.branch_id;
    const dir = s.direction;

    let declaredStops = [];
    try {
      if (s.stop_addresses_json) {
        const parsed = JSON.parse(s.stop_addresses_json);
        if (Array.isArray(parsed)) declaredStops.push(...parsed);
      }
    } catch (_) {}

    try {
      if (declaredStops.length === 0 && s.headers_json) {
        const parsed = JSON.parse(s.headers_json);
        if (Array.isArray(parsed)) declaredStops.push(...parsed);
      }
    } catch (_) {}

    if (declaredStops.length === 0) continue;

    // Filtrar paradas de esta rama y sentido
    const branchStops = allStops.filter(st => st.branch_id === branchId && st.direction === dir);

    for (const declared of declaredStops) {
      if (!declared) continue;
      const normDec = normalize(declared);
      const cleanDec = normalize(cleanNum(declared));

      // Buscar parada coincidente en branchStops
      const match = branchStops.find(st => {
        if (st.id === declared) return true;
        const normSt = normalize(st.name);
        const cleanSt = normalize(cleanNum(st.name));

        if (normDec === normSt || cleanDec === cleanSt || normDec === cleanSt || cleanDec === normSt) {
          return true;
        }
        if (normDec.length >= 4 && normSt.length >= 4) {
          if (normSt.startsWith(normDec) || normDec.startsWith(normSt) || cleanSt.startsWith(cleanDec) || cleanDec.startsWith(cleanSt)) {
            return true;
          }
        }
        return false;
      });

      if (match) {
        controlStopIdsToUpdate.add(match.id);
      }
    }
  }

  console.log(`🎯 Identificados ${controlStopIdsToUpdate.size} Puntos de Control únicos para marcar con is_control_point = 1.`);

  const idList = Array.from(controlStopIdsToUpdate);
  const CHUNK_SIZE = 50;
  let updatedCount = 0;

  for (let i = 0; i < idList.length; i += CHUNK_SIZE) {
    const chunk = idList.slice(i, i + CHUNK_SIZE);
    const sqlIn = chunk.map(id => `'${id}'`).join(',');
    executeD1(`UPDATE stops SET is_control_point = 1 WHERE id IN (${sqlIn});`, isRemote);
    updatedCount += chunk.length;
    console.log(`  -> Actualizados ${updatedCount}/${idList.length} registros...`);
  }

  // 4. Verificación
  const verifyResults = executeD1('SELECT count(*) as total_ctrl FROM stops WHERE is_control_point = 1;', isRemote);
  console.log(`✅ Backfill finalizado con éxito para ${target}. Total stops con is_control_point = 1:`, verifyResults[0]?.total_ctrl);
}

async function main() {
  await runBackfill(true); // Remote
  await runBackfill(false); // Local
}

main().catch(console.error);
