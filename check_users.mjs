import { createClient } from '@supabase/supabase-js';

const url = 'https://dexysqibeaqkwinmcbeb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRleHlzcWliZWFxa3dpbm1jYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTA5MDY1NSwiZXhwIjoyMDk2NjY2NjU1fQ.Bzf8nl_KwCRYKDPoNqb2k69CFE5rZYI3s2D8UolWddg';
const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.from('usuarios').select('*');
  if (error) { console.error('❌ Erro:', error.message); return; }
  console.log('Usuários no Supabase:', data.length);
  if (data.length > 0) console.log(data[0]);
}
main();
