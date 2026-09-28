# Separar usuários administrativos de colaboradores de campo

**Data:** 2026-09-28
**Parte 1 de 3** da reorganização de pessoas (1: usuários × colaboradores; 2: frotas; 3: despacho por frota).

## Objetivo

Hoje a tabela `usuarios` e a tela Admin › Usuários misturam quem trabalha no escritório (dono, despachante, fechamento) com quem trabalha em campo (técnico, levantador), e o cadastro exige "equipe" de todo mundo. Esta parte separa os dois grupos:

- **Usuários**: pessoas do administrativo que usam o sistema web. Sem equipe.
- **Colaboradores**: pessoas de campo, cada uma com login próprio no app de celular.

**Sucesso:** o dono cadastra um usuário de fechamento sem informar equipe; dono e despachante cadastram colaboradores com todos os dados; o despachante enxerga os colaboradores ao despachar; colaborador continua usando o app de celular sem nenhuma atualização do app.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Modelo de dados | Mesma tabela `usuarios` (abordagem A). Papel novo `colaborador` substitui `tecnico` e `levantador`. |
| Dados do colaborador | Nome, matrícula, senha do app, ativo, função, telefone, CPF, o que faz no app, equipe (opcional). |
| O que faz no app | Pode ser os dois: `faz_execucao` e `faz_levantamento` (pelo menos um). |
| Quem gerencia colaboradores | Dono e despachante. Usuários administrativos: só o dono. |
| Campo equipe | Mantido opcional para colaboradores até a parte 2 (frota substitui). Some da tela para usuários. |
| Acesso ao web | Colaborador não entra no sistema web. |
| App de celular | Sem mudança nesta parte. |

## Contexto relevante (estado atual)

- `usuarios`: `uid, nome, matricula, role, equipe, ativo, dt_criacao, ultimo_acesso, session_expiry`. Login é `matricula@visaodedono.com` no Supabase Auth.
- Policies de `usuarios`: `dono_acesso_total_usuarios` (`get_my_role() = 'dono'`) e `usuario_ve_proprio` (`uid = auth.uid()`).
- **Bug atual:** o despachante não lê nenhum técnico (testado: 0 visíveis; dono: 3). Por isso a lista do "Despachar" fica vazia e aprovar levantamento falha ("Técnico não encontrado") quando feito pelo despachante.
- O app de celular (`visao-de-dono-app`) lê o próprio perfil em `usuarios`, confere só `ativo`, e não decide nada pelo `role`. A policy `tecnico_ve_proprios_servicos` usa `atribuido_para->>'uid'`, não o papel.
- Código web que depende de `'tecnico'`: `ServicosTable.jsx` (lista do Despachar) e `UsuariosTab.jsx`.

## 1. Banco de dados

Arquivo: `supabase/migrations/separar_colaboradores.sql`. Idempotente, sem `DROP` de coluna nem `DELETE`.

1. Colunas novas em `usuarios`:
   - `funcao TEXT`, `telefone TEXT`, `cpf TEXT`
   - `faz_execucao BOOLEAN NOT NULL DEFAULT false`, `faz_levantamento BOOLEAN NOT NULL DEFAULT false`
2. Índice único parcial em `cpf` (`WHERE cpf IS NOT NULL`), guardado só com dígitos.
3. Troca da CHECK de `role` (descobrindo o nome como na migration anterior):
   - remove as CHECKs de role existentes;
   - migra os dados: `tecnico` → `colaborador` + `faz_execucao = true`; `levantador` → `colaborador` + `faz_levantamento = true`;
   - cria `usuarios_role_check`: `role IN ('dono', 'despachante', 'fechamento', 'colaborador')`.
4. Policy nova:
   ```sql
   CREATE POLICY "despachante_colaboradores" ON usuarios FOR ALL
     USING (get_my_role() = 'despachante' AND role = 'colaborador')
     WITH CHECK (get_my_role() = 'despachante' AND role = 'colaborador');
   ```
   O `WITH CHECK` impede o despachante de gravar uma linha que não seja `colaborador` (não promove ninguém, não edita administrativos). Usa `get_my_role()` (já existente) para não recursar na RLS de `usuarios`.

CPF e telefone só ficam visíveis para quem lê linhas de colaborador: dono e despachante.

## 2. Edge Function `gerenciar-usuarios`

- Identifica o papel de quem chama (como hoje).
- **Dono:** tudo, como hoje.
- **Despachante:**
  - `criar`: só se `dados.role === 'colaborador'`;
  - `trocar_senha` e `deletar`: só se a linha alvo tiver `role = 'colaborador'` (lida no servidor com a service role).
  - Qualquer outro caso: 403.
- **Demais papéis:** 403.
- `criar` aceita os campos novos (`funcao, telefone, cpf, faz_execucao, faz_levantamento, equipe`) e valida no servidor: `role` entre os quatro papéis; colaborador com pelo menos um tipo marcado; CPF só dígitos.
- Mantém o rollback do usuário do Auth se o insert em `usuarios` falhar.

## 3. Telas

### Sidebar (grupo Admin)
- **Usuários**: só dono.
- **Colaboradores** (novo): dono e despachante.
- `ESCRITORIO` (hoje "qualquer perfil exceto fechamento") passa a ser a lista explícita `['dono', 'despachante']`; Instalações passa a `['dono', 'despachante', 'fechamento']`. Perfil desconhecido não vê nada.

### Usuários (`UsuariosTab.jsx`, enxugada)
- Lista só dono, despachante e fechamento; filtros perfil/status.
- Cadastro: nome, matrícula, senha, perfil (despachante ou fechamento). Sem equipe.
- Ações como hoje: ativar/desativar, trocar perfil (despachante, fechamento, dono), senha, excluir; dono protegido.

### Colaboradores (`ColaboradoresTab.jsx`, nova)
- Lista: nome/matrícula, função, etiquetas **Execução**/**Levantamento**, telefone, equipe, status. Busca por nome, matrícula ou CPF; filtros por função, tipo e status.
- "+ Novo colaborador" abre formulário: nome, matrícula, senha (só no cadastro), função (lista Eletricista, Encarregado, Motorista, Ajudante, ou outra digitada), CPF (máscara + dígitos verificadores), telefone (máscara), ☐ Execução de serviços ☐ Levantamento (pelo menos um), equipe (opcional).
- Ações: **Editar** (mesmo formulário; matrícula não editável porque é o login), **Senha**, **Ativar/Desativar**, **Excluir** (confirmação sugerindo desativar; o histórico dos serviços guarda nome e matrícula, então não se perde).
- Criar, trocar senha e excluir passam pela Edge Function; editar e ativar/desativar são `update` direto (liberados pela policy nova).

### Outras telas
- **Despacho (`ServicosTable.jsx`)**: a lista do "Despachar" busca `role IN ('tecnico', 'colaborador')` e ativos, e mostra quem é `tecnico` ou tem `faz_execucao`. Aceitar `tecnico` mantém o site publicado funcionando antes e depois da migração; esse suporte sai numa limpeza posterior.
- **Levantamentos**: sem mudança (busca por matrícula; passa a funcionar para o despachante com a policy nova).

### Regras puras (`src/lib/colaboradores.js`, com Vitest)
- `PAPEIS_ADMIN`, `ehColaborador(u)` (inclui `tecnico`/`levantador` durante a transição).
- `validarCpf`, `somenteDigitos`, `formatarCpf`, `formatarTelefone`.
- `validarColaborador(dados, { novo })`: nome, matrícula, senha (só novo, ≥ 6), pelo menos um tipo, CPF válido se informado.
- `FUNCOES` (lista sugerida) e `podeDespachar(u)`.

## 4. Login no web

`AuthContext.jsx` (web): se o perfil carregado for `colaborador`, encerra a sessão; o login lança "Colaboradores acessam pelo app de celular." e a tela de login mostra essa mensagem. Vale para o login e para a sessão já aberta.

## 5. Testes

- **Vitest:** `colaboradores.test.js` (CPF, máscaras, validação, `podeDespachar`) e `navegacao.test.js` (menus de dono, despachante, fechamento e colaborador).
- **Banco + Edge Function** (scripts com os usuários de teste `teste-claude-*` e um colaborador de teste):
  - despachante cria, edita, troca senha e exclui um colaborador de teste;
  - despachante recebe 403 ao criar fechamento e ao trocar senha/excluir um administrativo; `update` direto em administrativo não altera nada; não consegue mudar o papel de um colaborador para administrativo;
  - despachante lê os colaboradores ativos (correção do Despachar);
  - colaborador de teste faz login e lê o próprio perfil e seus serviços como o app faz, e é barrado no web.
- **Navegador (Playwright):** Usuários e Colaboradores como dono e despachante, desktop e celular; tentativa de login web do colaborador.
- **Limpeza:** registros de teste apagados um a um, nunca em massa.

## 6. Ordem de publicação

1. Código web compatível com `tecnico` e `colaborador`.
2. Rodar `separar_colaboradores.sql` no banco e publicar a Edge Function (`supabase functions deploy gerenciar-usuarios`).
3. Publicar o site (`npm run deploy`) logo em seguida — entre os passos 2 e 3 o site antigo não consegue criar técnico (CHECK nova).
4. Limpeza posterior: remover o suporte a `tecnico`/`levantador` do código.

## Fora do escopo

- Frotas, escolha de frota no app e despacho por frota (partes 2 e 3).
- Qualquer mudança no app de celular.
- Remover a coluna `equipe`.
