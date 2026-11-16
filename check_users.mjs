// Conferência rápida da tabela `usuarios` (precisa da chave service_role, que NUNCA vai no código).
// Uso (PowerShell):  $env:SUPABASE_SERVICE_ROLE_KEY = '<chave>'; node check_users.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://dexysqibeaqkwinmcbeb.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('❌ Defina a variável de ambiente SUPABASE_SERVICE_ROLE_KEY (não escreva a chave neste arquivo).');
  process.exit(1);
}
const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.from('usuarios').select('*');
  if (error) { console.error('❌ Erro:', error.message); return; }
  console.log('Usuários no Supabase:', data.length);
  if (data.length > 0) console.log(data[0]);
}
main();
