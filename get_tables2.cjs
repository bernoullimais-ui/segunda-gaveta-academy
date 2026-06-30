const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bjihfkhkfjiraopieuev.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqaWhma2hrZmppcmFvcGlldWV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU3NzUyNiwiZXhwIjoyMDk0MTUzNTI2fQ.D9pD2yzWFR7zbMenJj00nYrvtdlbQ4w7V6__8CXof-Y');

async function run() {
  const { data: tables, error } = await supabase.rpc('get_tables');
  if (error) console.error(error);
  console.log(tables);
}
run();
