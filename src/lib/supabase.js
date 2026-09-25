import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// O Supabase limita cada requisição a 1000 linhas. Recebe uma função que monta
// a query (from/select/filtros/order) e busca página por página até esgotar.
// Ordena por 'id' como desempate para as páginas não repetirem/pularem linhas.
const PAGE_SIZE = 1000;
export const fetchAll = async (buildQuery) => {
  let todos = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery()
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    todos = todos.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: todos, error: null };
};
