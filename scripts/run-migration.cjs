const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_multi_user_schema.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

async function run() {
  console.log('Executing SQL migration against Supabase...');
  console.log('SQL file:', sqlPath);
  console.log('SQL length:', sql.length, 'chars');
  
  // Use Supabase's pg endpoint for raw SQL execution
  // This endpoint is available with service role key
  const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/exec_sql', {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ sql_text: sql }),
  });
  
  if (response.ok) {
    console.log('Migration executed successfully via RPC!');
    return;
  }
  
  const errText = await response.text();
  console.log('RPC method not available (expected):', response.status, errText.substring(0, 200));
  
  // Fallback: use the SQL query endpoint directly
  console.log('\nTrying direct SQL endpoint...');
  
  const response2 = await fetch(SUPABASE_URL + '/pg', {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (response2.ok) {
    const result = await response2.json();
    console.log('Migration executed successfully!');
    console.log(JSON.stringify(result, null, 2).substring(0, 500));
    return;
  }
  
  const errText2 = await response2.text();
  console.log('Direct SQL also failed:', response2.status, errText2.substring(0, 200));
  
  // Last resort: use the management API
  console.log('\nTrying Supabase Management API SQL endpoint...');
  
  const response3 = await fetch('https://api.supabase.com/v1/projects/frgkrogebppzqqapsuga/database/query', {
    method: 'POST', 
    headers: {
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (response3.ok) {
    console.log('Migration executed successfully via Management API!');
    const r = await response3.json();
    console.log(JSON.stringify(r, null, 2).substring(0, 500));
    return;
  }
  
  const errText3 = await response3.text();
  console.log('Management API failed:', response3.status, errText3.substring(0, 300));
  
  console.log('\n=== MANUAL EXECUTION REQUIRED ===');
  console.log('Please run the SQL file manually in your Supabase Dashboard SQL Editor:');
  console.log('1. Go to https://supabase.com/dashboard/project/frgkrogebppzqqapsuga/sql');
  console.log('2. Paste the contents of:', sqlPath);
  console.log('3. Click "Run"');
}

run().catch(err => {
  console.error('Error:', err.message);
});
