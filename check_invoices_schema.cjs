const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key] = val.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: invById, error: errById } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', 'f03add8c-c0ab-4f2a-bc61-2770793b45fa');

  const { data: invByNum, error: errByNum } = await supabase
    .from('invoices')
    .select('*')
    .eq('invoice_number', 'INV-2026-05-0016');

  console.log("Invoice by ID:", invById);
  console.log("Invoice by Number:", invByNum);
}
run();
