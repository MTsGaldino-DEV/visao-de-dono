# Instalação de espaçadores: uma instalação = um vão — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o fluxo "um serviço com até 20 vãos" por "uma instalação = um vão": o despachante registra trafo, foto e coordenada de antes e depois e a quantidade; o sistema vincula ao serviço de espaçador mais perto; o Fechamento anexa o croqui e confere a quantidade na revisão.

**Architecture:** As regras ficam puras em `src/lib/espacadores.js` (testadas com Vitest); o I/O fica em `src/lib/espacadoresApi.js`; as telas em `src/components/espacadores/`. A tabela `vaos` continua, com uma linha por serviço (`numero = 1`) e três colunas novas.

**Tech Stack:** React 19 + Vite, Supabase (Postgres, Storage, Realtime), Vitest. Estilos inline, `alert`/`confirm` nativos.

**Spec:** `docs/superpowers/specs/2026-10-21-instalacao-um-vao-design.md`

## Global Constraints

- Limite de vínculo automático: `LIMITE_VINCULO_M = 100` metros, inclusivo ("até 100 m").
- Uma foto de antes e uma de depois; fotos só `image/*`, croqui só `application/pdf` (`validarArquivo` atual).
- Quantidade: inteiro maior que zero.
- Coordenadas aceitas: `-18.844040 -41.957216`, `-18.844040, -41.957216`, `-18.844040,-41.957216`, `-18.844040;-41.957216`, e vírgula decimal (`-18,844040 -41,957216`, `-18,844040;-41,957216`). Lat em [-90, 90], lng em [-180, 180].
- Texto fixo: "Coordenada inválida", "Anexe o croqui para aprovar", "Sem croqui", "Instalação de espaçadores excluída", "Quantidade de espaçadores corrigida de X para Y", "A instalação foi salva incompleta em {ID}. Abra-a em Em instalação para terminar.", "O serviço mais próximo está a {N} m", "Nenhum serviço deste trafo tem coordenada".
- Coordenada do serviço existente (`servicos.coord`) nunca é sobrescrita pela instalação.
- Migrações só acrescentam; o usuário roda no SQL Editor do Supabase. Nada é executado no banco de produção pelo agente.
- Mesmo estilo do app: estilos inline, paleta `#0f2544`/`#e2e8f0`/…, `alert` e `confirm`.

## Review Focus

1. Coordenada digitada com vírgula decimal no padrão brasileiro (`-18,844040 -41,957216`) — deve ser aceita, não marcada como inválida. Teste em Task 1.
2. Quantidade `0`, `-1`, `2.5`, vazia ou texto vindo do input (`"3"`) — só inteiros > 0 passam, e `"3"` conta como 3. Teste em Task 1.
3. Candidato exatamente a 100 m e candidato com `coord` ilegível — o de 100 m é sugerido; o ilegível vai para o fim e nunca é sugerido. Teste em Task 1.
4. Duplo clique em "Enviar para fechamento" — não pode criar dois serviços nem dois vãos. Passo em Task 4.
5. Instalação que ficou sem linha em `vaos` (envio caiu entre vincular e criar o vão) — o modo edição precisa conseguir completá-la. Passo em Task 5.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `src/lib/espacadores.js` | Regras puras: coordenadas, vínculo, pendências, payloads | Modificar |
| `src/lib/espacadores.test.js` | Testes das regras | Modificar |
| `supabase/migrations/instalacao_um_vao.sql` | Colunas novas e política de upload | Criar |
| `src/lib/espacadoresApi.js` | I/O do fluxo | Modificar |
| `src/components/espacadores/CampoFoto.jsx` | Uma foto + coordenada embaixo (novo e edição) | Criar |
| `src/components/espacadores/NovaInstalacaoModal.jsx` | Cadastro da instalação e vínculo | Reescrever |
| `src/components/espacadores/VaoCard.jsx` | O vão único nos modos edição/revisão/leitura | Reescrever |
| `src/components/espacadores/InstalacaoModal.jsx` | Tela da instalação | Modificar |
| `src/components/espacadores/FluxoInstalacoes.jsx` | Coluna Espaçadores e selo "Sem croqui" | Modificar |
| `scripts/limpar-instalacoes-teste.sql` | Listagem e limpeza das 3 instalações de teste | Criar |

---

### Task 1: Coordenadas, vínculo e pendências (puro)

**Files:**
- Modify: `src/lib/espacadores.js`
- Test: `src/lib/espacadores.test.js`

**Interfaces:**
- Produces:
  - `LIMITE_VINCULO_M = 100`
  - `lerCoordenada(texto: string) => { lat: number, lng: number } | null`
  - `distanciaMetros(a: {lat,lng}, b: {lat,lng}) => number` (Haversine, R = 6371000)
  - `sugerirVinculo(candidatos: Servico[], coordAntes: string) => { ordenados: Array<Servico & { distancia: number|null }>, sugerido: Servico|null }` — `ordenados` crescente por distância, os de `distancia: null` no fim; `sugerido` é o primeiro se `distancia <= LIMITE_VINCULO_M`, senão `null`. Com `coordAntes` ilegível: todas as distâncias `null`, `sugerido: null`.
  - `qtdValida(valor: any) => number | null` — inteiro > 0 (aceita string numérica) ou `null`.
  - `pendenciasInstalacao(vao: Vao|null) => string[]` — na ordem: `'foto de antes'`, `'coordenada do antes'`, `'foto de depois'`, `'coordenada do depois'`, `'quantidade'`. `vao` nulo devolve as cinco.
  - `podeEnviarInstalacao(vao) => boolean` — `pendenciasInstalacao(vao).length === 0`.
  - `podeAprovar(vao) => boolean` — `!!vao?.croqui_url`.
- Removes: `MAX_VAOS`, `proximoNumeroVao`, `resumoVaos`, `podeEnviarParaFechamento`, `pendenciasVao`, `vaoCompleto` e os testes deles. `agruparVaos` fica.

- [ ] **Step 1: Escrever os testes que falham**

```js
describe('lerCoordenada', () => {
  const ok = { lat: -18.84404, lng: -41.957216 };
  it.each([
    '-18.844040 -41.957216', '-18.844040, -41.957216', '-18.844040,-41.957216',
    '-18.844040;-41.957216', ' -18,844040 -41,957216 ', '-18,844040;-41,957216',
  ])('lê %s', (t) => {
    const c = lerCoordenada(t);
    expect(c.lat).toBeCloseTo(ok.lat, 6);
    expect(c.lng).toBeCloseTo(ok.lng, 6);
  });
  it.each(['', null, 'abc', '-18.8', '-95 -41', '-18 -200', '-18.8 -41.9 3'])('recusa %s', (t) => {
    expect(lerCoordenada(t)).toBeNull();
  });
});

describe('distanciaMetros', () => {
  it('calcula em metros', () => {
    expect(distanciaMetros({ lat: -18.844040, lng: -41.957216 }, { lat: -18.844040, lng: -41.957216 })).toBe(0);
    // 0.001° de latitude ≈ 111 m
    expect(distanciaMetros({ lat: -18.844, lng: -41.957 }, { lat: -18.845, lng: -41.957 })).toBeCloseTo(111.2, 0);
  });
});

describe('sugerirVinculo', () => {
  const base = { lat: -18.844, lng: -41.957 };
  // ~0.0009° ≈ 100.07 m; ~0.00089° ≈ 98.97 m
  const s = (id, coord) => ({ id, coord });
  it('ordena por distância, sem coordenada no fim, e sugere até 100 m', () => {
    const r = sugerirVinculo([s('LONGE', '-18.850 -41.957'), s('RUIM', 'xx'), s('PERTO', '-18.84489 -41.957')], '-18.844 -41.957');
    expect(r.ordenados.map(c => c.id)).toEqual(['PERTO', 'LONGE', 'RUIM']);
    expect(r.ordenados[2].distancia).toBeNull();
    expect(r.sugerido.id).toBe('PERTO');
  });
  it('100 m exatos ainda sugere; acima não', () => {
    const exato = `${base.lat - 100 / 111195} ${base.lng}`;
    expect(sugerirVinculo([s('A', exato)], '-18.844 -41.957').sugerido?.id).toBe('A');
    expect(sugerirVinculo([s('A', '-18.8450 -41.957')], '-18.844 -41.957').sugerido).toBeNull();
  });
  it('sem coordenada do antes não sugere nada', () => {
    const r = sugerirVinculo([s('A', '-18.844 -41.957')], '');
    expect(r.sugerido).toBeNull();
    expect(r.ordenados[0].distancia).toBeNull();
  });
});

describe('instalação de um vão', () => {
  const vao = { fotos_antes: ['a'], fotos_depois: ['d'], coord_antes: '-18.8 -41.9', coord_depois: '-18.8 -41.9', qtd_espacadores: 3 };
  it('qtdValida aceita só inteiro > 0', () => {
    expect(qtdValida('3')).toBe(3);
    expect(qtdValida(4)).toBe(4);
    [0, -1, 2.5, '', null, 'abc'].forEach(v => expect(qtdValida(v)).toBeNull());
  });
  it('lista pendências na ordem e libera o envio', () => {
    expect(pendenciasInstalacao(null)).toEqual(['foto de antes', 'coordenada do antes', 'foto de depois', 'coordenada do depois', 'quantidade']);
    expect(pendenciasInstalacao({ ...vao, coord_depois: 'xx', qtd_espacadores: 0 })).toEqual(['coordenada do depois', 'quantidade']);
    expect(podeEnviarInstalacao(vao)).toBe(true);
  });
  it('aprovar exige croqui', () => {
    expect(podeAprovar(vao)).toBe(false);
    expect(podeAprovar({ ...vao, croqui_url: 'c.pdf' })).toBe(true);
  });
});
```

Apagar os blocos `describe('vãos')` (menos o teste de `agruparVaos`, que vai para dentro de `describe('instalação de um vão')`) e `describe('proximoNumeroVao')`, e tirar os nomes removidos do `import`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/espacadores.test.js`
Expected: FAIL (`lerCoordenada is not a function` etc.)

- [ ] **Step 3: Implementar em `src/lib/espacadores.js`**

`lerCoordenada`, algoritmo (as regras de separador não saem da assinatura):

```js
// Separadores: ";", ", " (vírgula seguida de espaço) ou espaço. Sem nenhum deles, tenta "," simples.
// Depois troca a vírgula decimal por ponto em cada parte.
let partes = t.split(/\s*;\s*|\s*,\s+|\s+/);
if (partes.length === 1) partes = t.split(',');
if (partes.length !== 2) return null;
```

Antes, `t = String(texto ?? '').trim()` (vazio → `null`). Depois `parseFloat` de cada parte com `,`→`.`, recusar `NaN` e fora da faixa. Remover `MAX_VAOS`, `proximoNumeroVao`, `resumoVaos`, `podeEnviarParaFechamento`, `pendenciasVao`, `vaoCompleto`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/lib/espacadores.test.js`
Expected: PASS (o build ainda quebra nos componentes; isso é resolvido nas Tasks 3–6)

- [ ] **Step 5: Commit**

```bash
git add src/lib/espacadores.js src/lib/espacadores.test.js
git commit -m "Espacadores: regras de coordenada, vinculo e pendencias de um vao"
```

---

### Task 2: Payloads de início, exclusão e correção de quantidade (puro)

**Files:**
- Modify: `src/lib/espacadores.js`
- Test: `src/lib/espacadores.test.js` (bloco `describe('transições')`)

**Interfaces:**
- Produces:
  - `montarPayloadInicio(servico, { user, agora, criadoPelaInstalacao = false })` — como hoje, mais `status_antes_instalacao: criadoPelaInstalacao ? 'cancelado' : servico.status`.
  - `montarPayloadExclusao(servico, { user, agora })` — continua recusando etapa ≠ `instalacao`; devolve `{ etapa_espacador: null, dt_etapa: null, motivo_reprovacao_fechamento: null, status_antes_instalacao: null, status: servico.status_antes_instalacao || 'cancelado', hist: [...hist, entrada 'Instalação de espaçadores excluída'] }`.
  - `montarPayloadQuantidade(servico, de, para, { user, agora }) => { hist } | null` — `null` se `qtdValida(para) === de`; lança `'Informe uma quantidade inteira maior que zero.'` se `qtdValida(para)` for `null`; msg `Quantidade de espaçadores corrigida de ${de} para ${para}`.

- [ ] **Step 1: Escrever os testes que falham**

Substituir o teste "início grava etapa…" e o "excluir cancela…":

```js
it('início grava etapa, histórico e o status para onde voltar', () => {
  const p = montarPayloadInicio({ status: 'pendente', hist: [] }, { user, agora });
  expect(p).toMatchObject({ etapa_espacador: 'instalacao', dt_etapa: agora, status_antes_instalacao: 'pendente' });
  expect(p.hist[0]).toMatchObject({ who: 'Ana', matricula: '123', when: agora });
  expect(montarPayloadInicio({ status: 'cadastrado' }, { user, agora, criadoPelaInstalacao: true }).status_antes_instalacao).toBe('cancelado');
  expect(() => montarPayloadInicio({ etapa_espacador: 'revisao' }, { user, agora })).toThrow();
});

it('excluir devolve o serviço ao status anterior e tira do fluxo', () => {
  const p = montarPayloadExclusao({ etapa_espacador: 'instalacao', status: 'concluido', status_antes_instalacao: 'pendente', motivo_reprovacao_fechamento: 'x', hist: [{ msg: 'x' }] }, { user, agora });
  expect(p).toMatchObject({ etapa_espacador: null, dt_etapa: null, motivo_reprovacao_fechamento: null, status_antes_instalacao: null, status: 'pendente' });
  expect(p.hist[1]).toMatchObject({ who: 'Ana', when: agora, msg: 'Instalação de espaçadores excluída' });
  expect(montarPayloadExclusao({ etapa_espacador: 'instalacao', hist: [] }, { user, agora }).status).toBe('cancelado');
  expect(() => montarPayloadExclusao({ etapa_espacador: 'revisao' }, { user, agora })).toThrow(/Em revisão|revis/i);
});

it('correção de quantidade registra no histórico', () => {
  const p = montarPayloadQuantidade({ hist: [] }, 3, '4', { user, agora });
  expect(p.hist[0].msg).toBe('Quantidade de espaçadores corrigida de 3 para 4');
  expect(montarPayloadQuantidade({ hist: [] }, 3, '3', { user, agora })).toBeNull();
  expect(() => montarPayloadQuantidade({ hist: [] }, 3, '0', { user, agora })).toThrow(/maior que zero/);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- src/lib/espacadores.test.js` → FAIL nos três.
- [ ] **Step 3: Implementar** as três funções em `src/lib/espacadores.js` (a msg de `montarPayloadQuantidade` usa o número já validado em `para`).
- [ ] **Step 4: Rodar e ver passar** — `npm test` → PASS em tudo.
- [ ] **Step 5: Commit** — `git commit -m "Espacadores: status anterior na exclusao e correcao de quantidade"`

---

### Task 3: Migração e API

**Files:**
- Create: `supabase/migrations/instalacao_um_vao.sql`
- Modify: `src/lib/espacadoresApi.js`

**Interfaces:**
- Consumes: Task 1 e 2.
- Produces:
  - `iniciarInstalacao(servico, user, { criadoPelaInstalacao = false } = {})` — repassa a opção para `montarPayloadInicio`.
  - `salvarDadosVao(servicoId: string, vao: Vao|null, campos: { coord_antes?, coord_depois?, qtd_espacadores? }) => Promise<Vao>` — insere com `numero: 1` se `vao` for nulo, senão atualiza.
  - `trocarFoto(vao: Vao, tipo: 'antes'|'depois', file: File) => Promise<Vao>` — valida, envia (caminho `caminhoArquivo(vao.servico_id, 1, tipo, file.name, Date.now())`) e grava `[url]` no campo; se o envio falhar, o banco não muda.
  - `corrigirQuantidade(servico, vao, qtd, user) => Promise<void>` — `montarPayloadQuantidade`; se `null` não faz nada; senão atualiza `vaos.qtd_espacadores` e depois `servicos.hist`.
  - `registrarInstalacao({ servico, novo, fotoAntes, fotoDepois, coordAntes, coordDepois, qtd }, user) => Promise<string>` — exatamente um de `servico` (existente) ou `novo = { equip, local }`. Ordem do spec: criar serviço (com `coord: coordAntes`) → `iniciarInstalacao` → `salvarDadosVao` → `trocarFoto` antes e depois → `aplicarTransicao(…, 'enviar')`. Devolve o ID. Erro depois de `iniciarInstalacao` ter dado certo vira `new Error(\`A instalação foi salva incompleta em ${id}. Abra-a em Em instalação para terminar. (${e.message})\`)` com `erro.servicoId = id`.
  - `excluirInstalacao(servico, user)` — mesma ordem e filtro de hoje (update condicionado a `etapa_espacador = 'instalacao'`, depois apaga `vaos`), com o payload novo de `montarPayloadExclusao`. Se o delete falhar, sobra uma linha órfã; por isso `registrarInstalacao`, logo depois de `iniciarInstalacao`, apaga qualquer linha de `vaos` daquele serviço antes de criar a nova (senão o `UNIQUE (servico_id, numero)` barra o novo vínculo).
- Removes: `adicionarVao`, `removerVao`, `anexarFotos`, `removerFoto`, `atualizarFotos`, e os imports `MAX_VAOS`, `proximoNumeroVao`.

- [ ] **Step 1: Criar a migração**, só com acréscimos: as colunas do spec (`vaos.coord_antes TEXT`, `vaos.coord_depois TEXT`, `vaos.qtd_espacadores INT CHECK (qtd_espacadores > 0)`, `servicos.status_antes_instalacao TEXT`) e `DROP POLICY IF EXISTS "espacadores_upload"` + recriação idêntica à de `add_instalacao_espacadores.sql` com `IN ('dono', 'despachante', 'fechamento')`. Cabeçalho: "Rodar manualmente no SQL Editor do Supabase."
- [ ] **Step 2: Implementar as mudanças em `espacadoresApi.js`** conforme Interfaces.
- [ ] **Step 3: Verificar** — `npm test` → PASS. (O build ainda quebra nos componentes que usam o que saiu; resolvido nas Tasks 4–6.)
- [ ] **Step 4: Commit** — `git commit -m "Espacadores: migracao e API da instalacao de um vao"`

---

### Task 4: Modal "Nova instalação"

**Files:**
- Create: `src/components/espacadores/CampoFoto.jsx`
- Rewrite: `src/components/espacadores/NovaInstalacaoModal.jsx`

**Interfaces:**
- Consumes: `lerCoordenada`, `sugerirVinculo`, `qtdValida`, `bloqueioNovaInstalacao`, `LIMITE_VINCULO_M`; `buscarServicosPorTrafo`, `registrarInstalacao`.
- Produces:
  - `<CampoFoto rotulo src coord onCoord onArquivo editavel enviando onAmpliar />` — miniatura (ou área "📷 Selecionar foto"), `input type=file accept="image/*"` de um arquivo, "Trocar" quando há foto, campo de coordenada logo abaixo com placeholder `-18.844040 -41.957216`, borda vermelha e "Coordenada inválida" quando o texto não é vazio e `lerCoordenada` devolve `null`. Com `editavel=false`, só mostra a foto e a coordenada.
  - `NovaInstalacaoModal({ onClose, onConcluir(servicoId), onErroParcial(servicoId) })` — `onAbrir` some.

- [ ] **Step 1: `CampoFoto`.** Preview do arquivo local com `URL.createObjectURL`, revogado no cleanup.
- [ ] **Step 2: Estado e busca.** Campos `texto`, `resultados` (null = não buscou; mudar o trafo zera), `fotoAntes`, `fotoDepois` (File), `coordAntes`, `coordDepois`, `qtd`, `escolha` (`{ tipo: 'servico', servico } | { tipo: 'novo' } | null`), `escolhaManual` (boolean), `local`, `enviando`. Candidatos = resultados sem `etapa_espacador` e sem `bloqueioNovaInstalacao`. Os com etapa viram a linha "Já instalados neste trafo: …"; os bloqueados aparecem com o motivo.
- [ ] **Step 3: Vínculo.** Um `useMemo` com `sugerirVinculo(candidatos, coordAntes)`. Enquanto `escolhaManual` for falso, `escolha` segue a sugestão: `sugerido` → serviço; sem candidatos → `novo`; senão `null` com o aviso do spec ("O serviço mais próximo está a {N} m" arredondado, ou "Nenhum serviço deste trafo tem coordenada"). "trocar" abre a lista `ordenados` (cada um com "{N} m" ou "sem coordenada") e a opção "Criar serviço novo"; clicar marca `escolhaManual = true`. `novo` mostra o select Localidade (`TODAS_LOCALIDADES`).
- [ ] **Step 4: Enviar.** Ativo só com: busca feita, `escolha` definida (e `local` se for `novo`), duas fotos, duas coordenadas válidas, `qtdValida(qtd)`, e `!enviando`. `enviando` vira `true` antes do primeiro `await` e o botão fica desativado (Review Focus 4). Em erro: `alert(e.message)`; se `e.servicoId`, chama `onErroParcial(e.servicoId)`; se não, refaz a busca e mantém os campos.
- [ ] **Step 5: Ligar em `FluxoInstalacoes.jsx`** — `onConcluir={() => { setNovaAberta(false); trocarFiltro('revisao'); }}` e `onErroParcial={(id) => { setNovaAberta(false); trocarFiltro('instalacao'); setAberto({ id, modo: 'edicao' }); }}`.
- [ ] **Step 6: Commit** — `git commit -m "Espacadores: nova instalacao de um vao com vinculo pela coordenada"`

---

### Task 5: Tela da instalação e cartão do vão

**Files:**
- Rewrite: `src/components/espacadores/VaoCard.jsx`
- Modify: `src/components/espacadores/InstalacaoModal.jsx`

**Interfaces:**
- Consumes: `CampoFoto`; `pendenciasInstalacao`, `podeEnviarInstalacao`, `podeAprovar`, `lerCoordenada`, `distanciaMetros`, `qtdValida`; `salvarDadosVao`, `trocarFoto`, `anexarCroqui`, `corrigirQuantidade`, `aplicarTransicao`, `excluirInstalacao`.
- Produces: `<VaoCard vao modo enviando onTrocarFoto(tipo, file) onSalvarDados(campos) onSalvarQtd(qtd) onAnexarCroqui(file) onAmpliar />` com `modo ∈ 'edicao' | 'revisao' | 'leitura'`; `vao` pode ser `null`.

- [ ] **Step 1: `VaoCard`.** Dois `CampoFoto` (antes e depois), quantidade e croqui.
  - `edicao`: fotos trocáveis; coordenadas e quantidade num formulário local com "Salvar alterações" (chama `onSalvarDados` só com campos válidos); sem croqui; selo "Falta: …" com `pendenciasInstalacao`.
  - `revisao`: fotos e coordenadas só leitura; quantidade com "Salvar" (`onSalvarQtd`); croqui com anexar/abrir/trocar.
  - `leitura`: tudo só leitura, croqui com link se houver.
  - Com `vao === null` no modo edição, mostra os campos vazios; o primeiro "Salvar alterações" ou a primeira foto cria a linha (Review Focus 5). Para a foto, o modal chama `salvarDadosVao(servico.id, null, {})` antes de `trocarFoto`.
- [ ] **Step 2: `InstalacaoModal`.** Usa `vaos[0] ?? null`. Sai a lista de vãos, "Adicionar Vão", "Remover vão" e `MAX_VAOS`. O cabeçalho ganha "Levantamento: {servico.coord}" e "a {N} m do antes" quando as duas coordenadas são legíveis. `modo` do cartão: `editavel ? 'edicao' : podeRevisar ? 'revisao' : 'leitura'`. Rodapé de edição: texto `podeEnviarInstalacao(vao) ? 'Tudo pronto para o fechamento.' : 'Falta: …'` e "Enviar para fechamento" desativado sem isso. Rodapé de revisão: "Aprovar" desativado sem `podeAprovar(vao)`, com o texto "Anexe o croqui para aprovar"; "Reprovar" igual a hoje.
- [ ] **Step 3: Commit** — `git commit -m "Espacadores: tela da instalacao com um vao e croqui no fechamento"`

---

### Task 6: Lista, build e verificação

**Files:**
- Modify: `src/components/espacadores/FluxoInstalacoes.jsx`

- [ ] **Step 1: Coluna.** "Vãos" vira "Espaçadores": `vaosPorServico[s.id]?.[0]?.qtd_espacadores ?? '—'`. Sai `resumoVaos` do import. Nas linhas em `revisao` sem `croqui_url`, um selo âmbar "Sem croqui" ao lado do selo da etapa. A mensagem de confirmação de "Excluir" passa a ser: `Excluir a instalação ${s.id}? O vão, as fotos e o croqui serão apagados e o serviço volta para a lista de serviços em aberto.`
- [ ] **Step 2: Verificar** — `npm test` → todos PASS; `npm run build` → sem erros; `grep -rn "MAX_VAOS\|adicionarVao\|removerVao\|anexarFotos\|resumoVaos\|pendenciasVao" src` → sem resultados.
- [ ] **Step 3: Commit** — `git commit -m "Espacadores: lista mostra quantidade e croqui pendente"`

---

### Task 7: Limpeza das instalações de teste e roteiro manual

**Files:**
- Create: `scripts/limpar-instalacoes-teste.sql`

- [ ] **Step 1: Escrever o script em duas partes.** Parte 1 (só leitura): `SELECT id, equip, local, status, etapa_espacador, "desc", "numServ", nsmc FROM servicos WHERE etapa_espacador IS NOT NULL` e `SELECT servico_id, numero FROM vaos ORDER BY servico_id, numero`. Parte 2, toda comentada e com um `-- IDS: ('VD....', ...)` para o usuário preencher: `DELETE FROM vaos WHERE servico_id IN (…)`; para os de `"desc" = 'Instalação de espaçador'`, `status = 'cancelado'`; para os demais, `status = 'cadastrado'`, `"numServ" = ''`; para todos, `etapa_espacador`, `dt_etapa`, `motivo_reprovacao_fechamento`, `nsmc` e `status_antes_instalacao = NULL`. Envolver em `BEGIN; … COMMIT;`.
- [ ] **Step 2: Commit e entregar ao usuário** — `git commit -m "Script de limpeza das instalacoes de teste"`. Pedir que ele rode `instalacao_um_vao.sql`, depois a Parte 1 do script, e confirme os IDs antes da Parte 2. **Não rodar nada no banco.**
- [ ] **Step 3: Roteiro manual** (depois da migração, com `npm run dev`): os itens do item 3 da Verificação do spec, mais o Review Focus 4 (duplo clique) e 5 (abrir uma instalação sem vão em "Em instalação" e completá-la).
