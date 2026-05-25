import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const ARCHIVE_DIR = path.join(MIGRATIONS_DIR, 'archive');
const BASELINE_FILE_NAME = '202605250000_baseline_schema.sql';
const BASELINE_PATH = path.join(MIGRATIONS_DIR, BASELINE_FILE_NAME);

// The starting file for our consolidation (everything prior to this is already squashed here)
const START_MIGRATION = '202604250000_fresh_odyssey_clinic_complete_schema.sql';

console.log('=== Supabase Migration Squasher (Docker-Free Mode) ===');
console.log('Consolidating migrations starting from the April 25 baseline...');

try {
  // 1. Read all files in the migrations directory
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found at: ${MIGRATIONS_DIR}`);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => /^\d+.*\.sql$/.test(file)) // only SQL migration files
    .sort(); // sort chronologically

  // Find the index of the start migration
  const startIndex = files.indexOf(START_MIGRATION);
  if (startIndex === -1) {
    throw new Error(`Could not find the baseline start migration file: ${START_MIGRATION}`);
  }

  // Get all files starting from the baseline
  const filesToConsolidate = files.slice(startIndex);
  console.log(`Found ${filesToConsolidate.length} migration files to consolidate.`);

  // 2. Concatenate the files in order
  let consolidatedSql = `-- ============================================================================\n`;
  consolidatedSql += `-- CONSOLIDATED BASELINE SCHEMA (DOCKER-FREE GENERATION)\n`;
  consolidatedSql += `-- Generated on: ${new Date().toISOString()}\n`;
  consolidatedSql += `-- ============================================================================\n\n`;

  filesToConsolidate.forEach((file) => {
    console.log(`  → Merging: ${file}`);
    const filePath = path.join(MIGRATIONS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');

    consolidatedSql += `-- ============================================================================\n`;
    const cleanFileName = file.replace(/^\d+_/, '').replace(/\.sql$/, '').toUpperCase().replace(/_/g, ' ');
    consolidatedSql += `-- SECTION: ${cleanFileName} (${file})\n`;
    consolidatedSql += `-- ============================================================================\n\n`;
    consolidatedSql += content;
    consolidatedSql += `\n\n`;
  });

  // 3. Write consolidated SQL to the baseline file path
  fs.writeFileSync(BASELINE_PATH, consolidatedSql, 'utf8');
  console.log(`\n✓ Consolidated baseline SQL file successfully created:`);
  console.log(`  → ${BASELINE_PATH}`);

  // 4. Archive the migration files
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }

  let archivedCount = 0;
  files.forEach((file) => {
    // Archive all original migration files (including pre-April 25 ones and the ones we just merged)
    if (file !== BASELINE_FILE_NAME) {
      const oldPath = path.join(MIGRATIONS_DIR, file);
      const newPath = path.join(ARCHIVE_DIR, file);
      fs.renameSync(oldPath, newPath);
      archivedCount++;
    }
  });

  console.log(`✓ Moved ${archivedCount} historical migration files to archive/`);
  console.log('\n======================================');
  console.log('SUCCESS: Database Baselining Complete!');
  console.log('You can now run "node scripts/squash-migrations.js" whenever you want to re-squash.');
  console.log('======================================');

} catch (error) {
  console.error('\n❌ Error occurred during baselining:', error.message);
  process.exit(1);
}
