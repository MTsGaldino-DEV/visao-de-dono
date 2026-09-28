# Usuários × Colaboradores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar usuários administrativos (dono, despachante, fechamento) de colaboradores de campo (papel `colaborador`), com tela própria de Colaboradores gerenciada por dono e despachante.

**Architecture:** Mesma tabela `usuarios`; papel `colaborador` substitui `tecnico`/`levantador`, com `faz_execucao`/`faz_levantamento` e dados de cadastro. Regras puras em `src/lib/colaboradores.js` (Vitest); permissões no banco (policy nova) e na Edge Function (checagem no servidor). Colaborador é barrado no web; app de celular não muda.

**Tech Stack:** React 19 + Vite, Supabase (Postgres/RLS, Auth, Edge Functions em Deno), Vitest, Playwright (verificação manual via scripts no scratchpad).

**Spec:** `docs/superpowers/specs/2026-09-28-usuarios-colaboradores-design.md`

## Global Constraints

- Nunca apagar em massa: sem `DELETE` sem filtro por chave, sem `DROP COLUMN`/`DROP TABLE`. Registros de teste são apagados um a um.
- Papéis válidos após a migração: `dono`, `despachante`, `fechamento`, `colaborador`.
- Até a limpeza posterior, o código web aceita também `tecnico`/`levantador` como colaborador.
- Login é `matricula@visaodedono.com`; matrícula de colaborador não é editável.
- Mensagem de bloqueio no web: `Colaboradores acessam pelo app de celular.`
- Estilo: inline styles e paleta existente (`#0f2544`, slate); comentários e textos em português.

## Review Focus

- CPF digitado com pontuação ou colado com espaços → gravado só com dígitos; CPF repetido → mensagem clara, não erro cru do Postgres (Task 6, teste de `payloadColaborador` + tratamento de `23505`).
- Despachante tentando mexer em administrativo por `update` direto (sem passar pela tela) → nenhuma linha alterada (Task 8, script).
- Colaborador com sessão já aberta no web antes da mudança → derrubado ao recarregar, não só no login (Task 4, `checkInitialSession`/`onAuthStateChange`).
- Serviço já despachado para um `tecnico` migrado → continua visível no app (a policy usa `uid`) (Task 8, leitura como colaborador).
- Editar colaborador sem marcar nenhum tipo → bloqueado na tela e no servidor (Task 1 teste + Task 3 função).

---

### Task 1: Regras puras de colaboradores

**Files:**
- Create: `src/lib/colaboradores.js`
- Test: `src/lib/colaboradores.test.js`

**Interfaces:**
- Produces: `PAPEIS_ADMIN: string[]`, `FUNCOES: string[]`, `MSG_COLABORADOR_WEB: string`, `ehColaborador(u) → bool`, `ehAdministrativo(u) → bool`, `podeDespachar(u) → bool`, `somenteDigitos(s) → string`, `validarCpf(s) → bool`, `formatarCpf(s) → string`, `formatarTelefone(s) → string`, `validarColaborador(dados, { novo }) → { [campo]: mensagem }`, `payloadColaborador(dados) → { nome, funcao, telefone, cpf, faz_execucao, faz_levantamento, equipe }`.

- [ ] **Step 1: Write the failing test** (`src/lib/colaboradores.test.js`)

```js
import { describe, it, expect } from 'vitest';
import {
  ehColaborador, ehAdministrativo, podeDespachar, somenteDigitos, validarCpf, formatarCpf,
  formatarTelefone, validarColaborador, payloadColaborador,
} from './colaboradores';

describe('papéis', () => {
  it('separa administrativo de campo (aceitando os papéis antigos na transição)', () => {
    expect(['dono', 'despachante', 'fechamento'].every(role => ehAdministrativo({ role }))).toBe(true);
    expect(['colaborador', 'tecnico', 'levantador'].every(role => ehColaborador({ role }))).toBe(true);
    expect(ehColaborador({ role: 'dono' })).toBe(false);
    expect(ehColaborador(null)).toBe(false);
  });
  it('despacha só para ativos que executam serviço', () => {
    expect(podeDespachar({ role: 'colaborador', ativo: true, faz_execucao: true })).toBe(true);
    expect(podeDespachar({ role: 'colaborador', ativo: true, faz_execucao: false, faz_levantamento: true })).toBe(false);
    expect(podeDespachar({ role: 'colaborador', ativo: false, faz_execucao: true })).toBe(false);
    expect(podeDespachar({ role: 'tecnico', ativo: true })).toBe(true);
    expect(podeDespachar({ role: 'despachante', ativo: true, faz_execucao: true })).toBe(false);
  });
});

describe('CPF e telefone', () => {
  it('valida os dígitos verificadores', () => {
    expect(validarCpf('529.982.247-25')).toBe(true);
    expect(validarCpf(' 52998224725 ')).toBe(true);
    expect(validarCpf('529.982.247-24')).toBe(false);
    expect(validarCpf('111.111.111-11')).toBe(false);
    expect(validarCpf('123')).toBe(false);
  });
  it('formata progressivamente enquanto digita', () => {
    expect(formatarCpf('5299')).toBe('529.9');
    expect(formatarCpf('529982247')).toBe('529.982.247');
    expect(formatarCpf('52998224725999')).toBe('529.982.247-25');
    expect(formatarTelefone('33999998888')).toBe('(33) 99999-8888');
    expect(formatarTelefone('3332221111')).toBe('(33) 3222-1111');
    expect(formatarTelefone('339')).toBe('(33) 9');
    expect(formatarTelefone('')).toBe('');
    expect(somenteDigitos('(33) 9-8')).toBe('3398');
  });
});

describe('validarColaborador', () => {
  const ok = { nome: 'João', matricula: '1234', senha: '123456', faz_execucao: true };
  it('aceita um cadastro completo', () => {
    expect(validarColaborador(ok, { novo: true })).toEqual({});
  });
  it('exige nome, matrícula e senha no cadastro novo', () => {
    expect(Object.keys(validarColaborador({ faz_execucao: true }, { novo: true }))).toEqual(['nome', 'matricula', 'senha']);
    expect(validarColaborador({ ...ok, senha: '123' }, { novo: true }).senha).toMatch(/6/);
  });
  it('na edição não exige senha', () => {
    expect(validarColaborador({ nome: 'João', faz_levantamento: true }, { novo: false })).toEqual({});
  });
  it('exige pelo menos um tipo e valida CPF e telefone informados', () => {
    const e = validarColaborador({ ...ok, faz_execucao: false, cpf: '111.111.111-11', telefone: '339' }, { novo: true });
    expect(e.tipos).toMatch(/pelo menos um/);
    expect(e.cpf).toMatch(/CPF/);
    expect(e.telefone).toMatch(/Telefone/);
  });
});

describe('payloadColaborador', () => {
  it('normaliza texto e guarda CPF/telefone só com dígitos', () => {
    expect(payloadColaborador({
      nome: '  João  ', funcao: ' Eletricista ', cpf: '529.982.247-25', telefone: '(33) 99999-8888',
      faz_execucao: 1, faz_levantamento: undefined, equipe: '  ',
    })).toEqual({
      nome: 'João', funcao: 'Eletricista', cpf: '52998224725', telefone: '33999998888',
      faz_execucao: true, faz_levantamento: false, equipe: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/colaboradores.test.js`
Expected: FAIL (módulo `./colaboradores` não existe)

- [ ] **Step 3: Write minimal implementation** (`src/lib/colaboradores.js`)

```js
// Regras de usuários administrativos × colaboradores de campo.
// Módulo puro (sem Supabase) para poder ser testado com Vitest.

export const PAPEIS_ADMIN = ['dono', 'despachante', 'fechamento'];
export const FUNCOES = ['Eletricista', 'Encarregado', 'Motorista', 'Ajudante'];
export const MSG_COLABORADOR_WEB = 'Colaboradores acessam pelo app de celular.';

// 'tecnico' e 'levantador' ainda existem até a migração separar_colaboradores rodar
const PAPEIS_CAMPO = ['colaborador', 'tecnico', 'levantador'];

export const ehColaborador = (u) => PAPEIS_CAMPO.includes(u?.role);
export const ehAdministrativo = (u) => PAPEIS_ADMIN.includes(u?.role);

export const podeDespachar = (u) =>
  !!u?.ativo && (u.role === 'tecnico' || (u.role === 'colaborador' && !!u.faz_execucao));

export const somenteDigitos = (s) => String(s || '').replace(/\D/g, '');

export const validarCpf = (cpf) => {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(d.slice(0, 9)) === Number(d[9]) && dv(d.slice(0, 10)) === Number(d[10]);
};

export const formatarCpf = (s) => somenteDigitos(s).slice(0, 11)
  .replace(/(\d{3})(\d)/, '$1.$2')
  .replace(/(\d{3})(\d)/, '$1.$2')
  .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

export const formatarTelefone = (s) => {
  const d = somenteDigitos(s).slice(0, 11);
  if (d.length <= 2) return d;
  const ddd = `(${d.slice(0, 2)}) `;
  const resto = d.slice(2);
  const corte = d.length === 11 ? 5 : 4;
  return resto.length > corte ? `${ddd}${resto.slice(0, corte)}-${resto.slice(corte)}` : `${ddd}${resto}`;
};

export const validarColaborador = (dados, { novo }) => {
  const erros = {};
  if (!String(dados.nome || '').trim()) erros.nome = 'Informe o nome.';
  if (novo && !String(dados.matricula || '').trim()) erros.matricula = 'Informe a matrícula.';
  if (novo && String(dados.senha || '').length < 6) erros.senha = 'A senha deve ter no mínimo 6 caracteres.';
  if (!dados.faz_execucao && !dados.faz_levantamento) erros.tipos = 'Marque pelo menos um: Execução ou Levantamento.';
  if (somenteDigitos(dados.cpf) && !validarCpf(dados.cpf)) erros.cpf = 'CPF inválido.';
  const tel = somenteDigitos(dados.telefone);
  if (tel && tel.length !== 10 && tel.length !== 11) erros.telefone = 'Telefone inválido (DDD + número).';
  return erros;
};

const textoOuNulo = (s) => String(s || '').trim() || null;

export const payloadColaborador = (dados) => ({
  nome: String(dados.nome || '').trim(),
  funcao: textoOuNulo(dados.funcao),
  cpf: somenteDigitos(dados.cpf) || null,
  telefone: somenteDigitos(dados.telefone) || null,
  faz_execucao: !!dados.faz_execucao,
  faz_levantamento: !!dados.faz_levantamento,
  equipe: textoOuNulo(dados.equipe),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/colaboradores.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/colaboradores.js src/lib/colaboradores.test.js
git commit -m "Adiciona regras puras de colaboradores (papeis, CPF, telefone, validacao)"
```

---

### Task 2: Navegação por perfil com Colaboradores

**Files:**
- Modify: `src/lib/navegacao.js`
- Modify: `src/lib/navegacao.test.js`
- Modify: `src/components/Sidebar.jsx` (ícone `colaboradores`)

**Interfaces:**
- Produces: item de menu com `key: 'colaboradores'` (grupo `admin`), visível para `dono` e `despachante`.

- [ ] **Step 1: Write the failing test** — em `navegacao.test.js`, substituir o bloco `describe('menuDoPerfil', …)` por:

```js
describe('menuDoPerfil', () => {
  it('fechamento vê só Instalações', () => {
    expect(estrutura('fechamento')).toEqual([['despacho', ['instalacoes']]]);
  });
  it('dono vê tudo, com Usuários e Colaboradores no Admin', () => {
    expect(estrutura('dono')).toEqual([
      ['cadastro', ['cadastrar']],
      ['despacho', ['servicos', 'placas', 'espacadores', 'instalacoes', 'levantamentos']],
      ['mapa', ['mapa']],
      ['gestao', ['painel', 'faturamento']],
      ['admin', ['gerar-os', 'duplicidade', 'usuarios', 'colaboradores', 'logs']],
    ]);
  });
  it('despachante vê Despacho, Mapa e Colaboradores', () => {
    expect(estrutura('despachante')).toEqual([
      ['despacho', ['servicos', 'placas', 'espacadores', 'instalacoes', 'levantamentos']],
      ['mapa', ['mapa']],
      ['admin', ['colaboradores']],
    ]);
  });
  it('colaborador e perfis desconhecidos não veem nada no web', () => {
    expect(estrutura('colaborador')).toEqual([]);
    expect(estrutura('tecnico')).toEqual([]);
    expect(estrutura(undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/navegacao.test.js`
Expected: FAIL (dono sem `colaboradores`; despachante sem grupo admin; tecnico ainda vê Despacho)

- [ ] **Step 3: Implementation** — em `navegacao.js`:

Trocar as constantes do topo:
```js
const DONO = ['dono'];
const ESCRITORIO = ['dono', 'despachante'];
const COM_FECHAMENTO = ['dono', 'despachante', 'fechamento'];
```
(remover `TODOS` e o comentário "qualquer perfil, exceto fechamento"). Trocar `perfis: TODOS` de `instalacoes` por `perfis: COM_FECHAMENTO`. No grupo `admin`, depois de `usuarios`:
```js
    { key: 'colaboradores', label: 'Colaboradores', perfis: ESCRITORIO },
```
Substituir `podeVer` por:
```js
const podeVer = (item, role) => item.perfis.includes(role);
```

Em `Sidebar.jsx`, no objeto `ICONES`, depois de `usuarios`:
```jsx
  colaboradores: <Svg><path d="M2 18a10 10 0 0 1 20 0" /><path d="M10 10V5a2 2 0 0 1 4 0v5" /><path d="M4 15v-3a6 6 0 0 1 3-5.2" /><path d="M20 15v-3a6 6 0 0 0-3-5.2" /><line x1="1" y1="18" x2="23" y2="18" /></Svg>,
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS (todos)

- [ ] **Step 5: Commit**

```bash
git add src/lib/navegacao.js src/lib/navegacao.test.js src/components/Sidebar.jsx
git commit -m "Adiciona Colaboradores ao menu e restringe telas a perfis explicitos"
```

---

### Task 3: Migration SQL e Edge Function

**Files:**
- Create: `supabase/migrations/separar_colaboradores.sql`
- Modify: `supabase/functions/gerenciar-usuarios/index.ts`

**Interfaces:**
- Produces (banco): colunas `funcao, telefone, cpf, faz_execucao, faz_levantamento`; papel `colaborador`; policy `despachante_colaboradores`.
- Produces (função): ação `criar` aceita `{ nome, matricula, senha, role, equipe, funcao, telefone, cpf, faz_execucao, faz_levantamento }`; despachante limitado a colaboradores; respostas de erro `{ error }` com 400/403/500.

- [ ] **Step 1: Criar `supabase/migrations/separar_colaboradores.sql`**

```sql
-- Separa usuários administrativos de colaboradores de campo (parte 1)
-- Rodar no SQL Editor do Supabase. Idempotente; não apaga colunas nem linhas.

-- 1. Dados do colaborador
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS funcao TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS faz_execucao BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS faz_levantamento BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_cpf_unico ON usuarios (cpf) WHERE cpf IS NOT NULL;

-- 2. Papel 'colaborador' no lugar de 'tecnico' e 'levantador'
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'usuarios'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

UPDATE usuarios SET role = 'colaborador', faz_execucao = true WHERE role = 'tecnico';
UPDATE usuarios SET role = 'colaborador', faz_levantamento = true WHERE role = 'levantador';

ALTER TABLE usuarios ADD CONSTRAINT usuarios_role_check
  CHECK (role IN ('dono', 'despachante', 'fechamento', 'colaborador'));

-- 3. Despachante lê e edita só colaboradores (WITH CHECK impede promover alguém)
DROP POLICY IF EXISTS "despachante_colaboradores" ON usuarios;
CREATE POLICY "despachante_colaboradores" ON usuarios FOR ALL
  USING (get_my_role() = 'despachante' AND role = 'colaborador')
  WITH CHECK (get_my_role() = 'despachante' AND role = 'colaborador');
```

- [ ] **Step 2: Reescrever `supabase/functions/gerenciar-usuarios/index.ts`**

```ts
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
```

- [ ] **Step 3: Conferir tipagem/sintaxe localmente**

Run: `npx esbuild supabase/functions/gerenciar-usuarios/index.ts --format=esm --outfile=/dev/null --log-level=error` (ou `deno check` se disponível)
Expected: sem erros de sintaxe

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/separar_colaboradores.sql supabase/functions/gerenciar-usuarios/index.ts
git commit -m "Adiciona migration de colaboradores e limita despachante a colaboradores na Edge Function"
```

(Aplicar no banco e publicar a função fica na Task 8, depois do código web compatível.)

---

### Task 4: Colaborador barrado no web

**Files:**
- Modify: `src/context/AuthContext.jsx`
- Modify: `src/pages/Login.jsx`

**Interfaces:**
- Consumes: `ehColaborador`, `MSG_COLABORADOR_WEB` (Task 1).
- Produces: `login()` lança `Error` com `code = 'colaborador'` e `message = MSG_COLABORADOR_WEB`.

- [ ] **Step 1: AuthContext** — importar `import { ehColaborador, MSG_COLABORADOR_WEB } from '../lib/colaboradores';` e:

No `login`, logo após `if (!fullUser) { … }`:
```js
      if (ehColaborador(fullUser)) {
        await supabase.auth.signOut();
        const bloqueio = new Error(MSG_COLABORADOR_WEB);
        bloqueio.code = 'colaborador';
        throw bloqueio;
      }
```
Em `checkInitialSession`, trocar `if (mounted && profile) {` por:
```js
          if (profile && ehColaborador(profile)) {
            await supabase.auth.signOut();
          } else if (mounted && profile) {
```
No `onAuthStateChange` (evento `SIGNED_IN`), trocar `if (mounted && profile) {` por:
```js
        if (profile && ehColaborador(profile)) {
          // o login() já encerra a sessão e mostra o aviso
        } else if (mounted && profile) {
```

- [ ] **Step 2: Login.jsx** — no `catch` do `handleSubmit`:
```js
      setError(err.code === 'colaborador' ? err.message : "Matrícula ou senha inválidos");
```

- [ ] **Step 3: Verificar**

Run: `npx eslint src/context/AuthContext.jsx src/pages/Login.jsx && npx vite build`
Expected: sem erros novos; build ok. (Teste de ponta a ponta com colaborador real na Task 8.)

- [ ] **Step 4: Commit**

```bash
git add src/context/AuthContext.jsx src/pages/Login.jsx
git commit -m "Barra login de colaboradores no sistema web"
```

---

### Task 5: Tela Usuários só com administrativos

**Files:**
- Create: `src/lib/gerenciarUsuarios.js` (chamada compartilhada da Edge Function)
- Modify: `src/components/UsuariosTab.jsx`

**Interfaces:**
- Produces: `chamarGerenciarUsuarios(acao: 'criar'|'trocar_senha'|'deletar', dados) → Promise<data>` (lança `Error` com o motivo real e o status HTTP).
- Consumes: `ehAdministrativo` (Task 1).

- [ ] **Step 1: Mover o helper** — criar `src/lib/gerenciarUsuarios.js` com a função `chamarGerenciarUsuarios` hoje no topo de `UsuariosTab.jsx` (mesmo corpo, com `import { supabase } from './supabase';` e `export`), e em `UsuariosTab.jsx` remover a definição local e importar `import { chamarGerenciarUsuarios } from '../lib/gerenciarUsuarios';`.

- [ ] **Step 2: Enxugar `UsuariosTab.jsx`** (edições pontuais):
- remover `import { useAuth } …` e `const { user } = useAuth();` (não usado);
- remover o perfil `tecnico` e `levantador` de `PERFIS`;
- `useState('tecnico')` → `useState('despachante')` (em `role` e `novaRole`) e `setRole('tecnico')` → `setRole('despachante')`;
- remover o estado `equipe`/`setEquipe`, o campo "Equipe" do formulário, `setEquipe('')`, e a exigência `!equipe.trim()` na validação;
- `chamarGerenciarUsuarios('criar', { nome, matricula, senha, role })`;
- selects de perfil do formulário e da edição: `despachante`, `fechamento` (+ `dono` só na edição); filtro: `todos`, `despachante`, `fechamento`, `dono`;
- `usuariosFiltrados` começa com `if (!ehAdministrativo(u)) return false;`;
- título da coluna "Role / Equipe" → "Perfil" e remover a linha `{u.equipe || '-'}`;
- título "Gerenciamento de Usuários" ganha o subtítulo `Pessoas do administrativo. Pessoal de campo fica em Colaboradores.`

- [ ] **Step 3: Verificar**

Run: `npx eslint src/components/UsuariosTab.jsx src/lib/gerenciarUsuarios.js && npx vitest run && npx vite build`
Expected: lint limpo nesses arquivos; testes e build ok

- [ ] **Step 4: Commit**

```bash
git add src/lib/gerenciarUsuarios.js src/components/UsuariosTab.jsx
git commit -m "Tela de Usuarios passa a listar so o administrativo, sem equipe"
```

---

### Task 6: Tela Colaboradores

**Files:**
- Create: `src/components/colaboradores/ColaboradorForm.jsx`
- Create: `src/components/colaboradores/ColaboradoresTab.jsx`
- Modify: `src/pages/home.jsx` (tela `colaboradores`)

**Interfaces:**
- Consumes: Task 1 (`FUNCOES, ehColaborador, formatarCpf, formatarTelefone, validarColaborador, payloadColaborador`), Task 5 (`chamarGerenciarUsuarios`), Task 2 (tela `colaboradores`).
- Produces: `<ColaboradorForm colaborador={u|null} onSalvo={fn} onClose={fn} />`; `<ColaboradoresTab />`.

- [ ] **Step 1: Criar `ColaboradorForm.jsx`** — modal com os campos da spec. Novo: chama `chamarGerenciarUsuarios('criar', { ...payloadColaborador(form), matricula: form.matricula.trim(), senha: form.senha, role: 'colaborador' })`. Edição: `supabase.from('usuarios').update(payloadColaborador(form)).eq('uid', colaborador.uid).select()`; se `data` vier vazio → erro "Sem permissão para editar este colaborador."; erro `23505` → "CPF já cadastrado para outro colaborador.". Erros de `validarColaborador` aparecem abaixo de cada campo (`erros.tipos` abaixo das caixas). Função usa `<input list>` com `<datalist>` de `FUNCOES`. CPF e telefone guardam no estado o texto formatado (`formatarCpf`/`formatarTelefone` no `onChange`). Matrícula `disabled` na edição com a dica "A matrícula é o login do app e não pode ser alterada.".

- [ ] **Step 2: Criar `ColaboradoresTab.jsx`** — busca `supabase.from('usuarios').select('*').in('role', ['colaborador', 'tecnico', 'levantador']).order('nome')`; mostra erro de carregamento em faixa vermelha. Filtros: busca (nome, matrícula, CPF só dígitos), função (valores distintos existentes), tipo (`todos | execucao | levantamento`), status. Colunas: Nome/Matrícula, Função, O que faz (etiquetas Execução/Levantamento; `tecnico` conta como Execução), Telefone (formatado), Equipe, Status, Ações (Editar, Senha inline como em Usuários, Ativar/Desativar via `update` direto, Excluir via `chamarGerenciarUsuarios('deletar')` com `confirm` sugerindo desativar). Recarrega a lista depois de cada ação. Tabela dentro de contêiner com `overflowX: 'auto'`.

- [ ] **Step 3: Ligar em `home.jsx`** — `import ColaboradoresTab from '../components/colaboradores/ColaboradoresTab';` e, junto das telas do admin:
```jsx
          <div style={mostrar('colaboradores')}>
            {tela === 'colaboradores' && <ColaboradoresTab />}
          </div>
```

- [ ] **Step 4: Verificar**

Run: `npx eslint src/components/colaboradores src/pages/home.jsx && npx vitest run && npx vite build`
Expected: lint limpo; testes e build ok

- [ ] **Step 5: Commit**

```bash
git add src/components/colaboradores src/pages/home.jsx
git commit -m "Adiciona tela de Colaboradores para dono e despachante"
```

---

### Task 7: Despachar para colaboradores

**Files:**
- Modify: `src/components/ServicosTable.jsx:1214-1219` e `:2096-2107`

**Interfaces:**
- Consumes: `podeDespachar` (Task 1).

- [ ] **Step 1: Busca** — em `fetchTecnicos`:
```js
        const { data } = await supabase.from('usuarios').select('*').in('role', ['tecnico', 'colaborador']).eq('ativo', true);
        if (data) setTecnicos(data.filter(podeDespachar).sort((a, b) => a.nome.localeCompare(b.nome)));
```
e importar `import { podeDespachar } from '../lib/colaboradores';`.

- [ ] **Step 2: Lista** — `key={t.id}` → `key={t.uid}`; a linha de baixo mostra `[t.funcao, t.equipe].filter(Boolean).join(' · ')` quando houver; texto vazio "Nenhum técnico disponível" → "Nenhum colaborador disponível".

- [ ] **Step 3: Verificar**

Run: `npx vitest run && npx vite build`
Expected: ok

- [ ] **Step 4: Commit**

```bash
git add src/components/ServicosTable.jsx
git commit -m "Despachar lista colaboradores que executam servico"
```

---

### Task 8: Aplicar no banco, publicar a função e testar de ponta a ponta

**Files:**
- Scripts de teste no scratchpad (fora do repositório); `.env.test.local` (git-ignorado) recebe o colaborador de teste.

- [ ] **Step 1: Aplicar `separar_colaboradores.sql`** — pelo Supabase CLI ligado ao projeto; se o CLI não tiver acesso, pedir ao usuário para colar o arquivo no SQL Editor. Conferir com a service role: nenhuma linha com `role IN ('tecnico','levantador')`; os 3 técnicos agora `colaborador` com `faz_execucao = true`.

- [ ] **Step 2: Publicar a função** — `supabase functions deploy gerenciar-usuarios`. Se pedir login/token, avisar o usuário.

- [ ] **Step 3: Script de permissões** (despachante de teste, chave pública):
- lista colaboradores ativos → ≥ 3;
- `criar` colaborador `teste-claude-colaborador` (execução, CPF `529.982.247-25`) → 200; grava senha no `.env.test.local`;
- `criar` com `role: 'fechamento'` → 403;
- `update` do nome de `teste-claude-fechamento` → 0 linhas;
- `update` do colaborador de teste para `role: 'dono'` → erro de policy;
- `update` da função do colaborador de teste → 1 linha;
- `trocar_senha` de `teste-claude-fechamento` → 403; do colaborador de teste → 200 (atualiza `.env.test.local`).

- [ ] **Step 4: Script do app** (colaborador de teste, chave pública): login ok; lê a própria linha de `usuarios` (`ativo = true`); `select` em `servicos` sem erro.

- [ ] **Step 5: Navegador (Playwright)**: Usuários e Colaboradores como dono (desktop e 390px) e como despachante; cadastro de um colaborador pela tela com CPF repetido → mensagem "CPF já cadastrado…"; login web de `teste-claude-colaborador` → aviso "Colaboradores acessam pelo app de celular." e continua na tela de login; console sem erros.

- [ ] **Step 6: Limpeza** — excluir pelo `deletar` da função (um registro por vez) o colaborador de teste criado pela tela; manter `teste-claude-colaborador` para testes futuros.

- [ ] **Step 7: Publicação do site** — `npm run deploy` logo após os Steps 1–2 (pedir autorização ao usuário antes de publicar).
