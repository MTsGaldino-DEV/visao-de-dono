// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAPEIS = ['dono', 'despachante', 'fechamento', 'colaborador'];

const resposta = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return resposta({ error: 'Missing Authorization header' }, 401);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) return resposta({ error: 'Unauthorized' }, 401);

    const { data: quem, error: roleError } = await supabaseAdmin.from('usuarios').select('role').eq('uid', user.id).single();
    if (roleError || !['dono', 'despachante'].includes(quem?.role)) return resposta({ error: 'Forbidden' }, 403);

    // Despachante só gerencia colaboradores; a checagem é aqui, não na tela
    const soColaborador = quem.role === 'despachante';
    const papelDoAlvo = async (uid) => {
      const { data } = await supabaseAdmin.from('usuarios').select('role').eq('uid', uid).single();
      return data?.role;
    };

    const { acao, dados } = await req.json();

    if (acao === 'criar') {
      const { nome, matricula, senha, role, equipe, funcao, telefone, cpf, faz_execucao, faz_levantamento } = dados;
      if (!PAPEIS.includes(role)) return resposta({ error: 'Perfil inválido' }, 400);
      if (soColaborador && role !== 'colaborador') return resposta({ error: 'Forbidden' }, 403);
      const colaborador = role === 'colaborador';
      if (colaborador && !faz_execucao && !faz_levantamento) {
        return resposta({ error: 'Marque pelo menos um: Execução ou Levantamento.' }, 400);
      }

      const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: `${matricula}@visaodedono.com`,
        password: senha,
        email_confirm: true,
      });
      if (createAuthError) throw createAuthError;
      if (!authData.user) throw new Error('Usuário não retornado após criação');

      const uid = authData.user.id;
      const { error: dbError } = await supabaseAdmin.from('usuarios').insert({
        uid,
        nome,
        matricula,
        role,
        ativo: true,
        equipe: colaborador ? (equipe || null) : null,
        ...(colaborador ? {
          funcao: funcao || null,
          telefone: telefone ? String(telefone).replace(/\D/g, '') : null,
          cpf: cpf ? String(cpf).replace(/\D/g, '') : null,
          faz_execucao: !!faz_execucao,
          faz_levantamento: !!faz_levantamento,
        } : {}),
      });

      if (dbError) {
        await supabaseAdmin.auth.admin.deleteUser(uid);
        if (dbError.code === '23505') return resposta({ error: 'CPF já cadastrado para outro colaborador.' }, 400);
        throw dbError;
      }

      return resposta({ success: true, uid });
    }

    if (acao === 'trocar_senha') {
      const { uid, novaSenha } = dados;
      if (soColaborador && (await papelDoAlvo(uid)) !== 'colaborador') return resposta({ error: 'Forbidden' }, 403);
      const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, { password: novaSenha });
      if (error) throw error;
      return resposta({ success: true });
    }

    if (acao === 'deletar') {
      const { uid } = dados;
      if (soColaborador && (await papelDoAlvo(uid)) !== 'colaborador') return resposta({ error: 'Forbidden' }, 403);
      const { error: dbError } = await supabaseAdmin.from('usuarios').delete().eq('uid', uid);
      if (dbError) throw dbError;
      const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
      if (error) throw error;
      return resposta({ success: true });
    }

    return resposta({ error: 'Ação inválida' }, 400);
  } catch (error) {
    return resposta({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
