import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const { data: userData, error: roleError } = await supabaseAdmin
      .from('usuarios')
      .select('role')
      .eq('uid', user.id)
      .single();
      
    if (roleError || userData?.role !== 'dono') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const { acao, ...payload } = await req.json();
    
    if (acao === 'criar') {
      const { nome, matricula, senha, role, equipe } = payload;
      const email = `${matricula}@visaodedono.com`;
      
      const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
      });
      
      if (createAuthError) throw createAuthError;
      
      const uid = authData.user.id;
      
      const { error: dbError } = await supabaseAdmin.from('usuarios').insert({
        uid,
        nome,
        matricula,
        role,
        equipe,
        ativo: true
      });
      
      if (dbError) {
        await supabaseAdmin.auth.admin.deleteUser(uid);
        throw dbError;
      }
      
      return new Response(JSON.stringify({ success: true, uid }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    if (acao === 'trocar_senha') {
      const { uid, novaSenha } = payload;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, { password: novaSenha });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    if (acao === 'deletar') {
      const { uid } = payload;
      const { error: dbError } = await supabaseAdmin.from('usuarios').delete().eq('uid', uid);
      if (dbError) throw dbError;
      const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
