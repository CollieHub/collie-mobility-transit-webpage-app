const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sqlFile = path.resolve(__dirname, '../seed_redsube.sql');
const content = fs.readFileSync(sqlFile, 'utf8');

// Split into statements
const stmts = content
  .split(/;\s*[\r\n]+/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Total statements: ${stmts.length}`);

const batchSize = 40;
for (let i = 0; i < stmts.length; i += batchSize) {
  const batch = stmts.slice(i, i + batchSize);
  const tempFile = path.resolve(__dirname, `../temp_batch_${i}.sql`);
  fs.writeFileSync(tempFile, batch.join(';\n') + ';\n');
  console.log(`Executing batch ${i / batchSize + 1} / ${Math.ceil(stmts.length / batchSize)} (${batch.length} stmts)...`);
  try {
    execSync(`npx wrangler d1 execute collie-mobility-transit-db --remote --file=${tempFile}`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Error in batch ${i}:`, err.message);
    process.exit(1);
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

console.log('All batches executed successfully!');
