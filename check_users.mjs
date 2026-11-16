// Conferência rápida da tabela `usuarios`. Usa a chave secret (SUPABASE_SECRET_KEY) lida do .env.local,
// que está no .gitignore. NUNCA escreva a chave neste arquivo. Uso: node check_users.mjs
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: new URL('./.env.local', import.meta.url) });
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('❌ Defina VITE_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local.');
  process.exit(1);
}
const supabase = createClient(url, key);

const { data, error } = await supabase.from('usuarios').select('uid');
if (error) { console.error('❌ Erro:', error.message); process.exit(1); }
console.log('Usuários no Supabase:', data.length);
