import { supabase } from './supabase';

// Chama a Edge Function gerenciar-usuarios (criar, trocar_senha, deletar).
// O supabase-js troca o erro da função por "non-2xx status code";
// lê o corpo da resposta para mostrar o motivo real (ex.: Forbidden, matrícula já cadastrada)
export const chamarGerenciarUsuarios = async (acao, dados) => {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke('gerenciar-usuarios', {
    body: { acao, dados },
    headers: { Authorization: `Bearer ${session?.access_token}` }
  });
  if (error) {
    let motivo = error.message;
    try {
      const corpo = await error.context?.json();
      if (corpo?.error) motivo = `${corpo.error} (HTTP ${error.context.status})`;
    } catch { /* corpo não é JSON: fica a mensagem original */ }
    throw new Error(motivo);
  }
  if (data?.error) throw new Error(data.error);
  return data;
};
