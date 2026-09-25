# Instalação de Espaçadores por Vão + Fechamento — Plano de Implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** permitir que o despachante registre instalações de espaçadores por vão (fotos de antes, fotos de depois e croqui em PDF) e que um novo perfil, Fechamento, revise a instalação, informe a NSMP e depois a NSMC.

**Arquitetura:** a regra de negócio pura (etapas, transições, validação de vãos e navegação por perfil) fica em módulos sem dependência do Supabase, cobertos por Vitest. O acesso ao Supabase fica num módulo de API separado. A interface é feita de componentes pequenos em `src/components/espacadores/`, mais a aba nova `FechamentoTab`. O banco ganha a tabela `vaos` e quatro colunas em `servicos`, por meio de um script SQL que o usuário roda manualmente.

**Stack:** React 19, Vite 8, Supabase JS v2 (Postgres, Storage e Realtime), Vitest (novo, só para a lógica pura), estilos inline.

**Spec:** `docs/superpowers/specs/2026-09-25-instalacao-espacadores-design.md`

## Restrições globais

- Máximo de **20** vãos por serviço, com `numero` de 1 a 20 e único por serviço.
- Etapas (valores exatos): `instalacao`, `revisao`, `aguardando_nsmp`, `aguardando_nsmc`, `pago`.
- A NSMP é gravada em `servicos.numServ`. A NSMC é gravada em `servicos.nsmc`.
- Toda transição atualiza `dt_etapa` e acrescenta `{ who, matricula, when, msg }` em `hist`.
- Ao `enviar`, o `status` do serviço vira `concluido`.
- Serviço de espaçador = `desc` que casa com `/esp.{0,2}ac.{0,2}dor/` depois de normalizada (minúsculas, sem acentos), a mesma regra de `ServicosTable`.
- Arquivos vão para o bucket `levantamentos`, no caminho `espacadores/{servicoId}/vao-{numero}/{antes|depois|croqui}-{sufixo}.{ext}`.
- O croqui só aceita `application/pdf`. As fotos só aceitam `image/*`.
- Perfil `fechamento`: vê **só** a aba Fechamento. O Dono vê tudo, mais a aba Fechamento.
- Serviços com `etapa_espacador` preenchida **não** aparecem em Aguardando Aprovação, Aguardando OS nem Concluídos (o fluxo do app).
- Estilo do app: estilos inline, paleta `#0f2544` / `#e2e8f0` / `#64748b` / `#94a3b8`, e `alert` e `confirm` nativos.
- A migração SQL só **acrescenta** coisas. Não altera nem apaga políticas existentes.

## Foco de revisão

1. **Busca por trafo parcial:** digitar `763` também encontra `7630-1-15`. O esperado é que o trafo exato apareça primeiro, depois os que começam com `763-`, e só então os demais. Coberto por testes de `ordenarResultadosTrafo` na Tarefa 1.
2. **Aba salva no navegador que não serve para o perfil:** um usuário `fechamento` que abre o app num navegador onde ficou salvo `vd_tab = 'despacho'` deve cair em Fechamento, e não numa tela vazia. Coberto por testes de `abaInicial` na Tarefa 1.
3. **Numeração com buracos no limite:** vãos 1..20 com um removido. O próximo vão deve reaproveitar o número livre e nunca gerar 21. Coberto por testes de `proximoNumeroVao` na Tarefa 1.
4. **Transição a partir de estado velho ou clique duplo:** aprovar um serviço que outra pessoa já reprovou, ou clicar duas vezes em "Salvar NSMP". O esperado é que a segunda ação seja recusada com uma mensagem clara, sem gravar duas vezes. Coberto por testes de `proximaEtapa` na Tarefa 1 e pelo `update` condicionado à etapa na Tarefa 3.
5. **Número ou motivo em branco:** NSMP, NSMC ou motivo de reprovação só com espaços devem ser recusados antes de ir ao banco. Coberto por testes de `montarPayloadTransicao` na Tarefa 1.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/espacadores.js` (novo) | Regras puras: etapas, transições, vãos, busca, arquivos e histórico. |
| `src/lib/espacadores.test.js` (novo) | Testes Vitest das regras puras. |
| `src/lib/navegacao.js` (novo) | Abas por perfil e aba inicial. |
| `src/lib/navegacao.test.js` (novo) | Testes de navegação. |
| `supabase/migrations/add_instalacao_espacadores.sql` (novo) | Colunas, tabela `vaos`, RLS, perfil, storage e realtime. |
| `src/lib/espacadoresApi.js` (novo) | Todas as chamadas ao Supabase do fluxo novo. |
| `src/components/espacadores/useFluxoEspacadores.js` (novo) | Hook que carrega os serviços do fluxo e os vãos, com realtime. |
| `src/components/espacadores/EtapaBadge.jsx` (novo) | Selo colorido da etapa. |
| `src/components/espacadores/VaoCard.jsx` (novo) | Cartão de um vão. |
| `src/components/espacadores/InstalacaoModal.jsx` (novo) | Tela da instalação (edição, revisão e leitura). |
| `src/components/espacadores/NovaInstalacaoModal.jsx` (novo) | Busca do trafo e cadastro. |
| `src/components/espacadores/InstalacoesSection.jsx` (novo) | Seção "Instalações" dentro de Espaçadores. |
| `src/components/FechamentoTab.jsx` (novo) | Aba Fechamento. |
| `src/components/EspacadoresTab.jsx` (alterar) | Seção nova e exclusão do fluxo novo nas seções do app. |
| `src/pages/home.jsx` (alterar) | Abas por perfil e aba Fechamento. |
| `src/components/UsuariosTab.jsx` (alterar) | Perfil Fechamento. |
| `package.json` (alterar) | Vitest e script `test`. |

---

### Tarefa 1: Regras puras + Vitest

**Arquivos:**
- Alterar: `package.json` (devDependency `vitest` e script `"test": "vitest run"`)
- Criar: `src/lib/espacadores.js`, `src/lib/espacadores.test.js`, `src/lib/navegacao.js`, `src/lib/navegacao.test.js`

**Interfaces:**
- Consome: nada.
- Produz (`src/lib/espacadores.js`):
  - `MAX_VAOS: 20`
  - `ETAPAS: Record<etapa, { label, cor, bg, borda }>`
  - `isEspacador(servico) => boolean`
  - `normalizarTrafo(texto) => string`
  - `ordenarResultadosTrafo(lista, texto) => servico[]`
  - `pendenciasVao(vao) => string[]`
  - `vaoCompleto(vao) => boolean`
  - `podeEnviarParaFechamento(vaos) => boolean`
  - `resumoVaos(vaos) => { total, completos }`
  - `agruparVaos(vaos) => Record<servico_id, vao[]>` (cada lista ordenada por `numero`)
  - `proximoNumeroVao(vaos) => number | null`
  - `proximoIdVD(ultimoId) => string`
  - `entradaHist(user, msg, agora) => { who, matricula, when, msg }`
  - `proximaEtapa(etapaAtual, acao) => etapa` (lança erro se a transição for inválida). Ações: `'enviar' | 'aprovar' | 'reprovar' | 'nsmp' | 'nsmc'`.
  - `montarPayloadInicio(servico, { user, agora }) => payload`
  - `montarPayloadTransicao(servico, acao, { user, agora, numero?, motivo? }) => payload`
  - `filtrarPorBusca(lista, termo) => servico[]`
  - `validarArquivo(tipo, file) => string | null`. `tipo` é `'antes' | 'depois' | 'croqui'`.
  - `caminhoArquivo(servicoId, numero, tipo, nomeArquivo, sufixo) => string`
  - `formatarData(iso) => string`
- Produz (`src/lib/navegacao.js`):
  - `abasDoPerfil(role) => { key, label }[]`
  - `abaInicial(role, salva) => string`

- [ ] **Passo 1: Instalar o Vitest e criar o script de teste**

Rodar: `npm install -D vitest`

Em `package.json`, dentro de `"scripts"`, acrescentar a linha:

```json
    "test": "vitest run",
```

- [ ] **Passo 2: Escrever os testes que devem falhar**

Criar `src/lib/espacadores.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  MAX_VAOS, isEspacador, ordenarResultadosTrafo, pendenciasVao, vaoCompleto,
  podeEnviarParaFechamento, resumoVaos, agruparVaos, proximoNumeroVao, proximoIdVD,
  proximaEtapa, montarPayloadInicio, montarPayloadTransicao, filtrarPorBusca,
  validarArquivo, caminhoArquivo,
} from './espacadores';

const user = { label: 'Ana', matricula: '123' };
const agora = '2026-09-25T12:00:00.000Z';
const vaoOk = { numero: 1, fotos_antes: ['a'], fotos_depois: ['d'], croqui_url: 'c.pdf' };

describe('isEspacador', () => {
  it('reconhece variações com e sem acento', () => {
    expect(isEspacador({ desc: 'Levantamento para instalação de espaçador.' })).toBe(true);
    expect(isEspacador({ desc: 'ESPACADORES no trafo' })).toBe(true);
    expect(isEspacador({ desc: 'Troca de placa' })).toBe(false);
    expect(isEspacador({ desc: null })).toBe(false);
  });
});

describe('ordenarResultadosTrafo', () => {
  it('coloca exato, depois prefixo com hífen, depois prefixo, depois contém', () => {
    const lista = [{ equip: '17630-1-15' }, { equip: '7630-1-15' }, { equip: '763-3-45' }, { equip: '763' }];
    expect(ordenarResultadosTrafo(lista, ' 763 ').map(s => s.equip))
      .toEqual(['763', '763-3-45', '7630-1-15', '17630-1-15']);
  });
});

describe('vãos', () => {
  it('lista o que falta em cada vão', () => {
    expect(pendenciasVao({ fotos_antes: [], fotos_depois: ['d'], croqui_url: null }))
      .toEqual(['foto de antes', 'croqui']);
    expect(pendenciasVao(vaoOk)).toEqual([]);
    expect(vaoCompleto(vaoOk)).toBe(true);
  });

  it('só permite enviar com pelo menos um vão e todos completos', () => {
    expect(podeEnviarParaFechamento([])).toBe(false);
    expect(podeEnviarParaFechamento([vaoOk, { ...vaoOk, croqui_url: null }])).toBe(false);
    expect(podeEnviarParaFechamento([vaoOk, vaoOk])).toBe(true);
  });

  it('resume total e completos', () => {
    expect(resumoVaos([vaoOk, { ...vaoOk, fotos_antes: [] }])).toEqual({ total: 2, completos: 1 });
  });

  it('agrupa por serviço ordenando por número', () => {
    const g = agruparVaos([{ servico_id: 'A', numero: 2 }, { servico_id: 'B', numero: 1 }, { servico_id: 'A', numero: 1 }]);
    expect(g.A.map(v => v.numero)).toEqual([1, 2]);
    expect(g.B).toHaveLength(1);
  });
});

describe('proximoNumeroVao', () => {
  const nums = (...ns) => ns.map(numero => ({ numero }));
  it('começa em 1 e continua depois do maior', () => {
    expect(proximoNumeroVao([])).toBe(1);
    expect(proximoNumeroVao(nums(1, 2, 4))).toBe(5);
  });
  it('reaproveita buraco quando o maior já é 20', () => {
    const quase = nums(...Array.from({ length: 20 }, (_, i) => i + 1).filter(n => n !== 7));
    expect(proximoNumeroVao(quase)).toBe(7);
  });
  it('retorna null no limite', () => {
    expect(proximoNumeroVao(nums(...Array.from({ length: MAX_VAOS }, (_, i) => i + 1)))).toBeNull();
  });
});

describe('proximoIdVD', () => {
  it('incrementa com 4 dígitos e trata ausência', () => {
    expect(proximoIdVD('VD0999')).toBe('VD1000');
    expect(proximoIdVD(undefined)).toBe('VD0001');
    expect(proximoIdVD('VD12345')).toBe('VD12346');
  });
});

describe('transições', () => {
  it('aceita só a transição da etapa certa', () => {
    expect(proximaEtapa('instalacao', 'enviar')).toBe('revisao');
    expect(proximaEtapa('revisao', 'reprovar')).toBe('instalacao');
    expect(() => proximaEtapa('instalacao', 'aprovar')).toThrow(/Em instalação/);
    expect(() => proximaEtapa('pago', 'nsmc')).toThrow();
    expect(() => proximaEtapa('revisao', 'voar')).toThrow(/desconhecida/);
  });

  it('início grava etapa, data e histórico; recusa quem já tem etapa', () => {
    const p = montarPayloadInicio({ hist: [] }, { user, agora });
    expect(p).toMatchObject({ etapa_espacador: 'instalacao', dt_etapa: agora });
    expect(p.hist).toHaveLength(1);
    expect(p.hist[0]).toMatchObject({ who: 'Ana', matricula: '123', when: agora });
    expect(() => montarPayloadInicio({ etapa_espacador: 'revisao' }, { user, agora })).toThrow();
  });

  it('enviar conclui o serviço e limpa o motivo', () => {
    const p = montarPayloadTransicao({ etapa_espacador: 'instalacao', hist: [{ msg: 'x' }] }, 'enviar', { user, agora });
    expect(p).toMatchObject({ etapa_espacador: 'revisao', status: 'concluido', motivo_reprovacao_fechamento: null, dt_etapa: agora });
    expect(p.hist).toHaveLength(2);
  });

  it('reprovar exige motivo não vazio', () => {
    expect(() => montarPayloadTransicao({ etapa_espacador: 'revisao' }, 'reprovar', { user, agora, motivo: '   ' })).toThrow(/motivo/);
    const p = montarPayloadTransicao({ etapa_espacador: 'revisao' }, 'reprovar', { user, agora, motivo: ' foto borrada ' });
    expect(p).toMatchObject({ etapa_espacador: 'instalacao', motivo_reprovacao_fechamento: 'foto borrada' });
  });

  it('nsmp grava numServ e nsmc grava nsmc, ambos exigem número', () => {
    expect(() => montarPayloadTransicao({ etapa_espacador: 'aguardando_nsmp' }, 'nsmp', { user, agora, numero: '' })).toThrow(/NSMP/);
    expect(montarPayloadTransicao({ etapa_espacador: 'aguardando_nsmp' }, 'nsmp', { user, agora, numero: ' 123 ' }))
      .toMatchObject({ etapa_espacador: 'aguardando_nsmc', numServ: '123' });
    expect(() => montarPayloadTransicao({ etapa_espacador: 'aguardando_nsmc' }, 'nsmc', { user, agora, numero: ' ' })).toThrow(/NSMC/);
    expect(montarPayloadTransicao({ etapa_espacador: 'aguardando_nsmc' }, 'nsmc', { user, agora, numero: '999' }))
      .toMatchObject({ etapa_espacador: 'pago', nsmc: '999' });
  });
});

describe('filtrarPorBusca', () => {
  it('busca em id, trafo e localidade ignorando acento', () => {
    const lista = [{ id: 'VD0001', equip: '763-3-45', local: 'Governador Valadares' }, { id: 'VD0002', equip: '1', local: 'São Geraldo' }];
    expect(filtrarPorBusca(lista, 'sao')).toHaveLength(1);
    expect(filtrarPorBusca(lista, '763')[0].id).toBe('VD0001');
    expect(filtrarPorBusca(lista, '  ')).toHaveLength(2);
  });
});

describe('arquivos', () => {
  it('valida tipo por destino', () => {
    expect(validarArquivo('croqui', { type: 'application/pdf' })).toBeNull();
    expect(validarArquivo('croqui', { type: 'image/png' })).toMatch(/PDF/);
    expect(validarArquivo('antes', { type: 'image/jpeg' })).toBeNull();
    expect(validarArquivo('depois', { type: 'application/pdf' })).toMatch(/imagens/);
  });
  it('monta o caminho com extensão segura', () => {
    expect(caminhoArquivo('VD0001', 3, 'antes', 'IMG_1.JPG', '17-0')).toBe('espacadores/VD0001/vao-3/antes-17-0.jpg');
    expect(caminhoArquivo('VD0001', 3, 'depois', 'semextensao', '17-1')).toBe('espacadores/VD0001/vao-3/depois-17-1.jpg');
    expect(caminhoArquivo('VD0001', 3, 'croqui', 'rede.PDF', '17')).toBe('espacadores/VD0001/vao-3/croqui-17.pdf');
  });
});
```

Criar `src/lib/navegacao.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { abasDoPerfil, abaInicial } from './navegacao';

const keys = (role) => abasDoPerfil(role).map(a => a.key);

describe('abasDoPerfil', () => {
  it('fechamento vê só Fechamento', () => {
    expect(keys('fechamento')).toEqual(['fechamento']);
  });
  it('dono vê tudo, incluindo Fechamento', () => {
    expect(keys('dono')).toEqual(['cadastrar', 'despacho', 'mapa', 'painel', 'faturamento', 'fechamento', 'admin']);
  });
  it('despachante mantém Despacho e Mapa', () => {
    expect(keys('despachante')).toEqual(['despacho', 'mapa']);
  });
});

describe('abaInicial', () => {
  it('mantém a aba salva quando ela é permitida', () => {
    expect(abaInicial('dono', 'painel')).toBe('painel');
  });
  it('troca aba salva não permitida pela primeira do perfil', () => {
    expect(abaInicial('fechamento', 'despacho')).toBe('fechamento');
    expect(abaInicial('despachante', 'fechamento')).toBe('despacho');
    expect(abaInicial('dono', '')).toBe('cadastrar');
  });
});
```

- [ ] **Passo 3: Rodar e ver falhar**

Rodar: `npm test`
Esperado: FAIL com "Failed to resolve import './espacadores'" e "'./navegacao'".

- [ ] **Passo 4: Implementar `src/lib/espacadores.js`**

```js
// Regras do fluxo de instalação de espaçadores por vão.
// Módulo puro (sem Supabase) para poder ser testado com Vitest.

export const MAX_VAOS = 20;

export const ETAPAS = {
  instalacao:      { label: 'Em instalação',   cor: '#1d4ed8', bg: '#eff6ff', borda: '#bfdbfe' },
  revisao:         { label: 'Em revisão',      cor: '#854d0e', bg: '#fef9c3', borda: '#fde68a' },
  aguardando_nsmp: { label: 'Aguardando NSMP', cor: '#7c3aed', bg: '#faf5ff', borda: '#ddd6fe' },
  aguardando_nsmc: { label: 'Aguardando NSMC', cor: '#c2410c', bg: '#fff7ed', borda: '#fed7aa' },
  pago:            { label: 'Pago',            cor: '#15803d', bg: '#f0fdf4', borda: '#bbf7d0' },
};

const TRANSICOES = {
  enviar:   { de: 'instalacao',      para: 'revisao' },
  aprovar:  { de: 'revisao',         para: 'aguardando_nsmp' },
  reprovar: { de: 'revisao',         para: 'instalacao' },
  nsmp:     { de: 'aguardando_nsmp', para: 'aguardando_nsmc' },
  nsmc:     { de: 'aguardando_nsmc', para: 'pago' },
};

const normStr = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Mesma regra de ServicosTable (filterType 'espacadores')
const ESPACADOR_REGEX = /esp.{0,2}ac.{0,2}dor/;
export const isEspacador = (servico) => ESPACADOR_REGEX.test(normStr(servico?.desc));

export const normalizarTrafo = (texto) => (texto || '').trim().toLowerCase();

// Exato primeiro, depois "763-…", depois "763…", depois o resto
export const ordenarResultadosTrafo = (lista, texto) => {
  const alvo = normalizarTrafo(texto);
  const rank = (s) => {
    const e = normalizarTrafo(s.equip);
    if (e === alvo) return 0;
    if (e.startsWith(`${alvo}-`)) return 1;
    if (e.startsWith(alvo)) return 2;
    return 3;
  };
  return [...lista].sort((a, b) => rank(a) - rank(b) || String(a.equip).localeCompare(String(b.equip)));
};

export const pendenciasVao = (vao) => {
  const faltando = [];
  if (!vao.fotos_antes?.length) faltando.push('foto de antes');
  if (!vao.fotos_depois?.length) faltando.push('foto de depois');
  if (!vao.croqui_url) faltando.push('croqui');
  return faltando;
};

export const vaoCompleto = (vao) => pendenciasVao(vao).length === 0;

export const podeEnviarParaFechamento = (vaos) => vaos.length > 0 && vaos.every(vaoCompleto);

export const resumoVaos = (vaos) => ({ total: vaos.length, completos: vaos.filter(vaoCompleto).length });

export const agruparVaos = (vaos) => {
  const grupos = {};
  vaos.forEach(v => { (grupos[v.servico_id] = grupos[v.servico_id] || []).push(v); });
  Object.values(grupos).forEach(lista => lista.sort((a, b) => a.numero - b.numero));
  return grupos;
};

// Continua depois do maior; se o maior já é 20, reaproveita o primeiro número livre
export const proximoNumeroVao = (vaos) => {
  if (vaos.length >= MAX_VAOS) return null;
  const usados = new Set(vaos.map(v => v.numero));
  const maior = Math.max(0, ...usados);
  if (maior < MAX_VAOS) return maior + 1;
  for (let n = 1; n <= MAX_VAOS; n++) if (!usados.has(n)) return n;
  return null;
};

// Mesma numeração de CadastroForm
export const proximoIdVD = (ultimoId) => {
  const atual = ultimoId ? (parseInt(String(ultimoId).replace('VD', ''), 10) || 0) : 0;
  return `VD${String(atual + 1).padStart(4, '0')}`;
};

export const entradaHist = (user, msg, agora) => ({
  who: user?.label || 'Sistema', matricula: user?.matricula, when: agora, msg,
});

export const proximaEtapa = (etapaAtual, acao) => {
  const t = TRANSICOES[acao];
  if (!t) throw new Error(`Ação desconhecida: ${acao}`);
  if (etapaAtual !== t.de) {
    const rotulo = ETAPAS[etapaAtual]?.label || etapaAtual || 'sem etapa';
    throw new Error(`Não é possível fazer isso com o serviço na etapa "${rotulo}".`);
  }
  return t.para;
};

export const montarPayloadInicio = (servico, { user, agora }) => {
  if (servico.etapa_espacador) throw new Error('Este serviço já está no fluxo de instalação.');
  return {
    etapa_espacador: 'instalacao',
    dt_etapa: agora,
    hist: [...(servico.hist || []), entradaHist(user, 'Instalação de espaçadores iniciada', agora)],
  };
};

const exigir = (valor, mensagem) => {
  const limpo = (valor || '').trim();
  if (!limpo) throw new Error(mensagem);
  return limpo;
};

export const montarPayloadTransicao = (servico, acao, { user, agora, numero, motivo } = {}) => {
  const payload = { etapa_espacador: proximaEtapa(servico.etapa_espacador, acao), dt_etapa: agora };
  let msg;
  if (acao === 'enviar') {
    payload.status = 'concluido';
    payload.motivo_reprovacao_fechamento = null;
    msg = 'Instalação enviada para o fechamento';
  } else if (acao === 'aprovar') {
    msg = 'Instalação aprovada pelo fechamento';
  } else if (acao === 'reprovar') {
    payload.motivo_reprovacao_fechamento = exigir(motivo, 'Informe o motivo da reprovação.');
    msg = `Instalação reprovada pelo fechamento: ${payload.motivo_reprovacao_fechamento}`;
  } else if (acao === 'nsmp') {
    payload.numServ = exigir(numero, 'Informe o número da NSMP.');
    msg = `NSMP informada: ${payload.numServ}`;
  } else if (acao === 'nsmc') {
    payload.nsmc = exigir(numero, 'Informe o número da NSMC.');
    msg = `NSMC informada: ${payload.nsmc}`;
  }
  payload.hist = [...(servico.hist || []), entradaHist(user, msg, agora)];
  return payload;
};

export const filtrarPorBusca = (lista, termo) => {
  const t = normStr(termo).trim();
  if (!t) return lista;
  return lista.filter(s => [s.id, s.equip, s.local].some(v => normStr(v).includes(t)));
};

export const validarArquivo = (tipo, file) => {
  if (tipo === 'croqui') return file?.type === 'application/pdf' ? null : 'O croqui precisa ser um arquivo PDF.';
  return file?.type?.startsWith('image/') ? null : 'Envie apenas imagens.';
};

export const caminhoArquivo = (servicoId, numero, tipo, nomeArquivo, sufixo) => {
  const m = /\.([a-z0-9]+)$/i.exec(nomeArquivo || '');
  const ext = tipo === 'croqui' ? 'pdf' : (m ? m[1].toLowerCase() : 'jpg');
  return `espacadores/${servicoId}/vao-${numero}/${tipo}-${sufixo}.${ext}`;
};

export const formatarData = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');
```

- [ ] **Passo 5: Implementar `src/lib/navegacao.js`**

```js
// Abas principais por perfil de usuário

export const abasDoPerfil = (role) => {
  if (role === 'fechamento') return [{ key: 'fechamento', label: 'Fechamento' }];
  const isDono = role === 'dono';
  return [
    ...(isDono ? [{ key: 'cadastrar', label: 'Cadastrar' }] : []),
    { key: 'despacho', label: 'Despacho' },
    { key: 'mapa', label: 'Mapa' },
    ...(isDono ? [
      { key: 'painel', label: 'Painel' },
      { key: 'faturamento', label: 'Faturamento' },
      { key: 'fechamento', label: 'Fechamento' },
      { key: 'admin', label: 'Admin' },
    ] : []),
  ];
};

// Mantém a aba salva se o perfil pode vê-la; senão, a primeira aba do perfil
export const abaInicial = (role, salva) => {
  const abas = abasDoPerfil(role);
  return abas.some(a => a.key === salva) ? salva : abas[0].key;
};
```

- [ ] **Passo 6: Rodar e ver passar**

Rodar: `npm test`
Esperado: PASS em todos os testes de `espacadores.test.js` e `navegacao.test.js`.

- [ ] **Passo 7: Lint**

Rodar: `npx eslint src/lib/espacadores.js src/lib/navegacao.js src/lib/espacadores.test.js src/lib/navegacao.test.js`
Esperado: nenhum erro.

- [ ] **Passo 8: Commit**

```bash
git add package.json package-lock.json src/lib/espacadores.js src/lib/espacadores.test.js src/lib/navegacao.js src/lib/navegacao.test.js
git commit -m "Adiciona regras puras do fluxo de espacadores por vao e testes com Vitest"
```

---

### Tarefa 2: Migração SQL

**Arquivos:**
- Criar: `supabase/migrations/add_instalacao_espacadores.sql`

**Interfaces:**
- Produz: colunas `servicos.etapa_espacador`, `servicos.motivo_reprovacao_fechamento`, `servicos.nsmc` e `servicos.dt_etapa`; a tabela `vaos` (`id`, `servico_id`, `numero`, `fotos_antes`, `fotos_depois`, `croqui_url`, `criado_em`); o perfil `fechamento` aceito em `usuarios.role`; `vaos` no realtime.

- [ ] **Passo 1: Escrever o script**

```sql
-- Fluxo de instalação de espaçadores por vão + perfil Fechamento
-- Rodar manualmente no SQL Editor do Supabase.
-- Só ACRESCENTA: não altera nem remove políticas existentes.

-- 1. Colunas novas em servicos
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS etapa_espacador TEXT
    CHECK (etapa_espacador IN ('instalacao', 'revisao', 'aguardando_nsmp', 'aguardando_nsmc', 'pago')),
  ADD COLUMN IF NOT EXISTS motivo_reprovacao_fechamento TEXT,
  ADD COLUMN IF NOT EXISTS nsmc TEXT,
  ADD COLUMN IF NOT EXISTS dt_etapa TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS servicos_etapa_espacador_idx
  ON servicos (etapa_espacador) WHERE etapa_espacador IS NOT NULL;

-- 2. Tabela de vãos
CREATE TABLE IF NOT EXISTS vaos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id   TEXT NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  numero       INT  NOT NULL CHECK (numero BETWEEN 1 AND 20),
  fotos_antes  TEXT[] NOT NULL DEFAULT '{}',
  fotos_depois TEXT[] NOT NULL DEFAULT '{}',
  croqui_url   TEXT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (servico_id, numero)
);

ALTER TABLE vaos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vaos_escritorio" ON vaos;
CREATE POLICY "vaos_escritorio" ON vaos FOR ALL
  USING ((SELECT role FROM usuarios WHERE uid = auth.uid()) IN ('dono', 'despachante', 'fechamento'))
  WITH CHECK ((SELECT role FROM usuarios WHERE uid = auth.uid()) IN ('dono', 'despachante', 'fechamento'));

-- 3. Perfil fechamento pode ler e atualizar servicos
DROP POLICY IF EXISTS "fechamento_servicos" ON servicos;
CREATE POLICY "fechamento_servicos" ON servicos FOR ALL
  USING ((SELECT role FROM usuarios WHERE uid = auth.uid()) = 'fechamento')
  WITH CHECK ((SELECT role FROM usuarios WHERE uid = auth.uid()) = 'fechamento');

-- 4. Aceitar o perfil 'fechamento' em usuarios.role (o nome da CHECK é descoberto aqui)
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

ALTER TABLE usuarios ADD CONSTRAINT usuarios_role_check
  CHECK (role IN ('dono', 'tecnico', 'despachante', 'levantador', 'fechamento'));

-- 5. Upload de arquivos de espaçadores (pasta espacadores/ do bucket levantamentos)
DROP POLICY IF EXISTS "espacadores_upload" ON storage.objects;
CREATE POLICY "espacadores_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'levantamentos'
    AND (storage.foldername(name))[1] = 'espacadores'
    AND (SELECT role FROM public.usuarios WHERE uid = auth.uid()) IN ('dono', 'despachante')
  );

-- 6. Tempo real para vaos
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE vaos;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

- [ ] **Passo 2: Checagem prévia (o usuário roda no SQL Editor antes do script)**

```sql
SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS tipo,
       EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = 'servicos'::regclass
               AND i.indisunique AND a.attnum = ANY(i.indkey) AND i.indnatts = 1) AS unico
FROM pg_attribute a WHERE a.attrelid = 'servicos'::regclass AND a.attname = 'id';

SELECT DISTINCT role FROM usuarios;
```

Esperado: `tipo = text` e `unico = true`, e os perfis estão todos dentro de `dono, tecnico, despachante, levantador`.

Se `tipo` for diferente, trocar `servico_id TEXT` pelo tipo retornado. Se `unico = false`, parar e avisar o usuário: a chave estrangeira não pode ser criada.

- [ ] **Passo 3: Pedir ao usuário que rode o script e confirmar**

Mostrar ao usuário o caminho do arquivo e pedir que ele cole o conteúdo no SQL Editor do Supabase e rode. Depois, confirmar pela API (leitura com a chave de serviço, num script temporário **fora do repositório** que lê `.env` e `.env.local`, como os scripts de contagem usados antes):

```js
const { error: e1 } = await sb.from('vaos').select('id').limit(1);
const { error: e2 } = await sb.from('servicos').select('etapa_espacador,nsmc,dt_etapa,motivo_reprovacao_fechamento').limit(1);
console.log('vaos:', e1?.message || 'ok', '| colunas:', e2?.message || 'ok');
```

Esperado: `vaos: ok | colunas: ok`.

- [ ] **Passo 4: Commit**

```bash
git add supabase/migrations/add_instalacao_espacadores.sql
git commit -m "Adiciona migracao da tabela vaos, etapas de espacador e perfil fechamento"
```

---

### Tarefa 3: Módulo de API do Supabase

**Arquivos:**
- Criar: `src/lib/espacadoresApi.js`

**Interfaces:**
- Consome: `supabase` e `fetchAll` de `./supabase`, e da Tarefa 1: `isEspacador`, `normalizarTrafo`, `ordenarResultadosTrafo`, `proximoIdVD`, `proximoNumeroVao`, `MAX_VAOS`, `entradaHist`, `montarPayloadInicio`, `montarPayloadTransicao`, `validarArquivo` e `caminhoArquivo`.
- Produz (todas `async`, lançam `Error` com mensagem em português):
  - `buscarServicosPorTrafo(texto) => servico[]`
  - `criarServicoEspacador({ equip, local, coord }, user) => servico`
  - `iniciarInstalacao(servico, user) => servico`
  - `aplicarTransicao(servico, acao, { user, numero?, motivo? }) => servico`
  - `carregarServico(id) => servico`
  - `carregarServicosFluxo() => servico[]`
  - `carregarTodosVaos() => vao[]`
  - `carregarVaos(servicoId) => vao[]`
  - `adicionarVao(servicoId) => vao`
  - `removerVao(vaoId) => void`
  - `anexarFotos(vao, tipo, files) => vao` (`tipo` é `'antes' | 'depois'`)
  - `removerFoto(vao, tipo, url) => vao`
  - `anexarCroqui(vao, file) => vao`
  - `assinarMudancas(canal, onChange) => () => void`, que devolve a função de cancelar a assinatura.

- [ ] **Passo 1: Implementar**

```js
// Acesso ao Supabase do fluxo de instalação de espaçadores.
// As regras ficam em ./espacadores (puro, testado); aqui só I/O.
import { supabase, fetchAll } from './supabase';
import {
  MAX_VAOS, isEspacador, normalizarTrafo, ordenarResultadosTrafo, proximoIdVD, proximoNumeroVao,
  entradaHist, montarPayloadInicio, montarPayloadTransicao, validarArquivo, caminhoArquivo,
} from './espacadores';

const BUCKET = 'levantamentos';
const agora = () => new Date().toISOString();

export const buscarServicosPorTrafo = async (texto) => {
  const alvo = normalizarTrafo(texto);
  if (!alvo) return [];
  const padrao = `%${alvo.replace(/[%_\\]/g, '\\$&')}%`;
  const { data, error } = await supabase
    .from('servicos')
    .select('*')
    .ilike('equip', padrao)
    .neq('status', 'cancelado');
  if (error) throw error;
  return ordenarResultadosTrafo((data || []).filter(isEspacador), alvo);
};

export const criarServicoEspacador = async ({ equip, local, coord }, user) => {
  const { data: ultimo, error: erroUltimo } = await supabase
    .from('servicos').select('id').order('dtCadastro', { ascending: false }).limit(1);
  if (erroUltimo) throw erroUltimo;
  const t = agora();
  const novo = {
    id: proximoIdVD(ultimo?.[0]?.id),
    tipo: 'NSIS',
    desc: 'Instalação de espaçador',
    equip: equip.trim(),
    local: local.trim(),
    coord: coord.trim(),
    data: t.slice(0, 10),
    status: 'cadastrado',
    numServ: '',
    autor: user.label,
    matriculaAutor: user.matricula,
    dtCadastro: t,
    hist: [entradaHist(user, 'Serviço cadastrado pela Nova instalação de espaçadores.', t)],
  };
  const { data, error } = await supabase.from('servicos').insert(novo).select().single();
  if (error) throw error;
  return data;
};

export const iniciarInstalacao = async (servico, user) => {
  const payload = montarPayloadInicio(servico, { user, agora: agora() });
  const { data, error } = await supabase
    .from('servicos').update(payload)
    .eq('id', servico.id).is('etapa_espacador', null)
    .select();
  if (error) throw error;
  if (!data?.length) throw new Error('Este serviço já foi iniciado por outra pessoa. Abra-o pela lista de Instalações.');
  return data[0];
};

// O update só acontece se a etapa no banco ainda for a que o usuário viu
export const aplicarTransicao = async (servico, acao, opcoes = {}) => {
  const payload = montarPayloadTransicao(servico, acao, { ...opcoes, agora: agora() });
  const { data, error } = await supabase
    .from('servicos').update(payload)
    .eq('id', servico.id).eq('etapa_espacador', servico.etapa_espacador)
    .select();
  if (error) throw error;
  if (!data?.length) throw new Error('Este serviço mudou de etapa enquanto você trabalhava. Confira a lista atualizada e tente de novo.');
  return data[0];
};

export const carregarServico = async (id) => {
  const { data, error } = await supabase.from('servicos').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const carregarServicosFluxo = async () => {
  const { data, error } = await fetchAll(() => supabase.from('servicos').select('*').not('etapa_espacador', 'is', null));
  if (error) throw error;
  return data;
};

export const carregarTodosVaos = async () => {
  const { data, error } = await fetchAll(() => supabase.from('vaos').select('*'));
  if (error) throw error;
  return data;
};

export const carregarVaos = async (servicoId) => {
  const { data, error } = await supabase.from('vaos').select('*').eq('servico_id', servicoId).order('numero');
  if (error) throw error;
  return data || [];
};

// Se outra aba criou o mesmo número ao mesmo tempo (23505), recarrega e tenta de novo
export const adicionarVao = async (servicoId) => {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const numero = proximoNumeroVao(await carregarVaos(servicoId));
    if (numero == null) throw new Error(`Limite de ${MAX_VAOS} vãos atingido.`);
    const { data, error } = await supabase.from('vaos').insert({ servico_id: servicoId, numero }).select().single();
    if (!error) return data;
    if (error.code !== '23505') throw error;
  }
  throw new Error('Não foi possível adicionar o vão. Tente novamente.');
};

export const removerVao = async (vaoId) => {
  const { error } = await supabase.from('vaos').delete().eq('id', vaoId);
  if (error) throw error;
};

const enviarArquivo = async (vao, tipo, file, sufixo) => {
  const path = caminhoArquivo(vao.servico_id, vao.numero, tipo, file.name, sufixo);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
};

const campoFotos = (tipo) => (tipo === 'antes' ? 'fotos_antes' : 'fotos_depois');

// Lê o array atual do banco antes de gravar, para não perder fotos adicionadas por outra pessoa
const atualizarFotos = async (vao, campo, transformar) => {
  const { data: atual, error: erroLeitura } = await supabase.from('vaos').select(campo).eq('id', vao.id).single();
  if (erroLeitura) throw erroLeitura;
  const { data, error } = await supabase
    .from('vaos').update({ [campo]: transformar(atual[campo] || []) })
    .eq('id', vao.id).select().single();
  if (error) throw error;
  return data;
};

export const anexarFotos = async (vao, tipo, files) => {
  for (const f of files) {
    const erro = validarArquivo(tipo, f);
    if (erro) throw new Error(`${f.name}: ${erro}`);
  }
  const base = Date.now();
  const urls = [];
  for (let i = 0; i < files.length; i++) urls.push(await enviarArquivo(vao, tipo, files[i], `${base}-${i}`));
  return atualizarFotos(vao, campoFotos(tipo), (lista) => [...lista, ...urls]);
};

export const removerFoto = async (vao, tipo, url) =>
  atualizarFotos(vao, campoFotos(tipo), (lista) => lista.filter(u => u !== url));

export const anexarCroqui = async (vao, file) => {
  const erro = validarArquivo('croqui', file);
  if (erro) throw new Error(erro);
  const url = await enviarArquivo(vao, 'croqui', file, String(Date.now()));
  const { data, error } = await supabase.from('vaos').update({ croqui_url: url }).eq('id', vao.id).select().single();
  if (error) throw error;
  return data;
};

export const assinarMudancas = (canal, onChange) => {
  const ch = supabase.channel(canal)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vaos' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(ch);
};
```

- [ ] **Passo 2: Build e lint**

Rodar: `npx eslint src/lib/espacadoresApi.js && npx vite build`
Esperado: nenhum erro de lint e "built in".

- [ ] **Passo 3: Commit**

```bash
git add src/lib/espacadoresApi.js
git commit -m "Adiciona modulo de acesso ao Supabase do fluxo de espacadores"
```

---

### Tarefa 4: Cartão de vão e tela da instalação

**Arquivos:**
- Criar: `src/components/espacadores/EtapaBadge.jsx`, `src/components/espacadores/VaoCard.jsx`, `src/components/espacadores/InstalacaoModal.jsx`

**Interfaces:**
- Consome: da Tarefa 1, `ETAPAS`, `MAX_VAOS`, `pendenciasVao`, `podeEnviarParaFechamento` e `formatarData`; da Tarefa 3, `carregarServico`, `carregarVaos`, `adicionarVao`, `removerVao`, `anexarFotos`, `removerFoto`, `anexarCroqui`, `aplicarTransicao` e `assinarMudancas`; e `useAuth` de `../../context/AuthContext`.
- Produz:
  - `<EtapaBadge etapa={string} />`
  - `<VaoCard vao editavel enviando={{ antes?, depois?, croqui? }} onAnexarFotos(vao, tipo, files) onRemoverFoto(vao, tipo, url) onAnexarCroqui(vao, file) onRemover(vao) onAmpliar(url) />`
  - `<InstalacaoModal servicoId={string} modo={'edicao' | 'revisao' | 'leitura'} onClose={() => void} />`. `edicao` só é editável quando a etapa é `instalacao`, e `revisao` só mostra Aprovar e Reprovar quando a etapa é `revisao`.

- [ ] **Passo 1: `EtapaBadge.jsx`**

```jsx
import { ETAPAS } from '../../lib/espacadores';

const EtapaBadge = ({ etapa }) => {
  const e = ETAPAS[etapa];
  if (!e) return null;
  return (
    <span style={{ background: e.bg, color: e.cor, border: `1px solid ${e.borda}`, fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
      {e.label}
    </span>
  );
};

export default EtapaBadge;
```

- [ ] **Passo 2: `VaoCard.jsx`**

```jsx
import { pendenciasVao } from '../../lib/espacadores';

const titulo = { fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.5px', marginBottom: '6px', textTransform: 'uppercase' };
const botaoArquivo = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', background: '#f1f5f9', color: '#475569', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box' };

const Fotos = ({ rotulo, tipo, urls, editavel, enviando, onAdicionar, onRemover, onAmpliar }) => (
  <div>
    <div style={titulo}>{rotulo} ({urls.length})</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {urls.map(url => (
        <div key={url} style={{ position: 'relative', width: '72px', height: '72px' }}>
          <img src={url} alt={rotulo} onClick={() => onAmpliar(url)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'zoom-in' }} />
          {editavel && (
            <button onClick={() => onRemover(tipo, url)} title="Remover foto" style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', border: 'none', background: '#dc2626', color: '#fff', fontSize: '13px', lineHeight: 1, cursor: 'pointer' }}>×</button>
          )}
        </div>
      ))}
      {editavel && (
        <label style={{ ...botaoArquivo, width: '72px', height: '72px', opacity: enviando ? 0.6 : 1, cursor: enviando ? 'wait' : 'pointer' }}>
          {enviando ? 'Enviando…' : '+ Foto'}
          <input type="file" accept="image/*" multiple disabled={enviando} style={{ display: 'none' }}
            onChange={e => { const files = [...e.target.files]; e.target.value = null; if (files.length) onAdicionar(tipo, files); }} />
        </label>
      )}
      {!editavel && urls.length === 0 && <span style={{ fontSize: '12px', color: '#94a3b8' }}>Sem fotos</span>}
    </div>
  </div>
);

const VaoCard = ({ vao, editavel, enviando = {}, onAnexarFotos, onRemoverFoto, onAnexarCroqui, onRemover, onAmpliar }) => {
  const pendencias = pendenciasVao(vao);
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f2544' }}>Vão {vao.numero}</span>
          {pendencias.length === 0 ? (
            <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>✓ Completo</span>
          ) : (
            <span style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>Falta: {pendencias.join(', ')}</span>
          )}
        </div>
        {editavel && (
          <button onClick={() => onRemover(vao)} style={{ padding: '6px 12px', background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            Remover vão
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <Fotos rotulo="Fotos antes" tipo="antes" urls={vao.fotos_antes || []} editavel={editavel} enviando={enviando.antes}
          onAdicionar={(t, f) => onAnexarFotos(vao, t, f)} onRemover={(t, u) => onRemoverFoto(vao, t, u)} onAmpliar={onAmpliar} />
        <Fotos rotulo="Fotos depois" tipo="depois" urls={vao.fotos_depois || []} editavel={editavel} enviando={enviando.depois}
          onAdicionar={(t, f) => onAnexarFotos(vao, t, f)} onRemover={(t, u) => onRemoverFoto(vao, t, u)} onAmpliar={onAmpliar} />
        <div>
          <div style={titulo}>Croqui (PDF)</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {vao.croqui_url ? (
              <a href={vao.croqui_url} target="_blank" rel="noreferrer" style={{ padding: '8px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>
                📄 Abrir croqui
              </a>
            ) : (
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Nenhum croqui</span>
            )}
            {editavel && (
              <label style={{ ...botaoArquivo, opacity: enviando.croqui ? 0.6 : 1, cursor: enviando.croqui ? 'wait' : 'pointer' }}>
                {enviando.croqui ? 'Enviando…' : vao.croqui_url ? 'Trocar' : '+ Anexar PDF'}
                <input type="file" accept="application/pdf" disabled={enviando.croqui} style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files[0]; e.target.value = null; if (f) onAnexarCroqui(vao, f); }} />
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaoCard;
```

- [ ] **Passo 3: `InstalacaoModal.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MAX_VAOS, podeEnviarParaFechamento, formatarData } from '../../lib/espacadores';
import {
  carregarServico, carregarVaos, adicionarVao, removerVao, anexarFotos, removerFoto,
  anexarCroqui, aplicarTransicao, assinarMudancas,
} from '../../lib/espacadoresApi';
import VaoCard from './VaoCard';
import EtapaBadge from './EtapaBadge';

const secao = { fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' };

const InstalacaoModal = ({ servicoId, modo = 'leitura', onClose }) => {
  const { user } = useAuth();
  const [servico, setServico] = useState(null);
  const [vaos, setVaos] = useState([]);
  const [enviando, setEnviando] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [mostrarReprovacao, setMostrarReprovacao] = useState(false);
  const [motivo, setMotivo] = useState('');

  const recarregar = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([carregarServico(servicoId), carregarVaos(servicoId)]);
      setServico(s);
      setVaos(v);
    } catch (e) {
      alert('Erro ao carregar a instalação: ' + e.message);
    }
  }, [servicoId]);

  useEffect(() => {
    recarregar();
    return assinarMudancas(`instalacao_${servicoId}`, recarregar);
  }, [servicoId, recarregar]);

  if (!servico) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        Carregando…
      </div>
    );
  }

  const editavel = modo === 'edicao' && servico.etapa_espacador === 'instalacao';
  const podeRevisar = modo === 'revisao' && servico.etapa_espacador === 'revisao';

  const executar = async (fn) => {
    setOcupado(true);
    try { await fn(); } catch (e) { alert(e.message); }
    finally { setOcupado(false); recarregar(); }
  };

  const comEnvio = async (chave, fn) => {
    setEnviando(p => ({ ...p, [chave]: true }));
    try { await fn(); } catch (e) { alert('Erro ao enviar arquivo: ' + e.message); }
    finally { setEnviando(p => ({ ...p, [chave]: false })); recarregar(); }
  };

  const transicionar = async (acao, opcoes = {}) => {
    setOcupado(true);
    try {
      await aplicarTransicao(servico, acao, { user, ...opcoes });
      onClose();
    } catch (e) {
      alert(e.message);
      setOcupado(false);
      recarregar();
    }
  };

  const handleRemoverVao = (vao) => {
    if (!window.confirm(`Remover o Vão ${vao.numero} com todas as fotos e o croqui?`)) return;
    executar(() => removerVao(vao.id));
  };

  const handleRemoverFoto = (vao, tipo, url) => {
    if (!window.confirm('Remover esta foto?')) return;
    executar(() => removerFoto(vao, tipo, url));
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.65)', zIndex: 1000, backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1001, background: '#f8fafc', borderRadius: '16px', width: '94%', maxWidth: '960px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(15,37,68,0.25)' }}>

        {/* Cabeçalho */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Instalação de espaçadores</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '18px', fontWeight: '800', color: '#0f2544' }}>{servico.id}</span>
              <EtapaBadge etapa={servico.etapa_espacador} />
            </div>
            <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
              <span style={{ color: '#94a3b8' }}>Trafo:</span> <b>{servico.equip || '—'}</b>
              <span style={{ color: '#cbd5e1', margin: '0 8px' }}>·</span>
              <span style={{ color: '#94a3b8' }}>Local:</span> {servico.local || '—'}
              {servico.numServ && <><span style={{ color: '#cbd5e1', margin: '0 8px' }}>·</span><span style={{ color: '#94a3b8' }}>NSMP:</span> <b>{servico.numServ}</b></>}
              {servico.nsmc && <><span style={{ color: '#cbd5e1', margin: '0 8px' }}>·</span><span style={{ color: '#94a3b8' }}>NSMC:</span> <b>{servico.nsmc}</b></>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '18px', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>×</button>
        </div>

        {/* Corpo */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {servico.etapa_espacador === 'instalacao' && servico.motivo_reprovacao_fechamento && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', padding: '12px 14px', fontSize: '13px' }}>
              <b>Reprovado pelo fechamento:</b> {servico.motivo_reprovacao_fechamento}
            </div>
          )}

          <div style={secao}>Vãos ({vaos.length}/{MAX_VAOS})</div>
          {vaos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '12px', fontSize: '13px', background: '#fff' }}>
              Nenhum vão ainda.{editavel && ' Clique em "+ Adicionar Vão".'}
            </div>
          )}
          {vaos.map(vao => (
            <VaoCard
              key={vao.id}
              vao={vao}
              editavel={editavel}
              enviando={{ antes: enviando[`${vao.id}:antes`], depois: enviando[`${vao.id}:depois`], croqui: enviando[`${vao.id}:croqui`] }}
              onAnexarFotos={(v, tipo, files) => comEnvio(`${v.id}:${tipo}`, () => anexarFotos(v, tipo, files))}
              onRemoverFoto={handleRemoverFoto}
              onAnexarCroqui={(v, file) => comEnvio(`${v.id}:croqui`, () => anexarCroqui(v, file))}
              onRemover={handleRemoverVao}
              onAmpliar={setFotoAmpliada}
            />
          ))}
          {editavel && (
            <button
              onClick={() => executar(() => adicionarVao(servico.id))}
              disabled={ocupado || vaos.length >= MAX_VAOS}
              style={{ padding: '14px', background: '#fff', color: '#0f2544', border: '2px dashed #cbd5e1', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: ocupado || vaos.length >= MAX_VAOS ? 'not-allowed' : 'pointer', opacity: vaos.length >= MAX_VAOS ? 0.5 : 1 }}
            >
              {vaos.length >= MAX_VAOS ? `Limite de ${MAX_VAOS} vãos atingido` : '+ Adicionar Vão'}
            </button>
          )}

          {servico.hist?.length > 0 && (
            <details style={{ marginTop: '8px' }}>
              <summary style={{ ...secao, cursor: 'pointer', marginBottom: 0 }}>Histórico ({servico.hist.length})</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                {[...servico.hist].reverse().map((h, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px' }}>
                    <div><b style={{ color: '#0f2544' }}>{h.who}</b> <span style={{ color: '#475569' }}>{h.msg}</span></div>
                    <div style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatarData(h.when)}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Rodapé */}
        {editavel && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {podeEnviarParaFechamento(vaos) ? 'Tudo pronto para o fechamento.' : 'Cada vão precisa de foto de antes, foto de depois e croqui.'}
            </span>
            <button
              onClick={() => transicionar('enviar')}
              disabled={ocupado || !podeEnviarParaFechamento(vaos)}
              style={{ padding: '12px 22px', background: podeEnviarParaFechamento(vaos) ? '#16a34a' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: ocupado || !podeEnviarParaFechamento(vaos) ? 'not-allowed' : 'pointer' }}
            >
              Enviar para fechamento →
            </button>
          </div>
        )}
        {podeRevisar && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
            {mostrarReprovacao ? (
              <div>
                <textarea autoFocus placeholder="Descreva o motivo da reprovação..." value={motivo} onChange={e => setMotivo(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #fca5a5', fontSize: '13px', marginBottom: '10px', resize: 'vertical', minHeight: '72px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setMostrarReprovacao(false); setMotivo(''); }} style={{ padding: '10px 20px', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
                  <button onClick={() => transicionar('reprovar', { motivo })} disabled={ocupado} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>✗ Confirmar reprovação</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setMostrarReprovacao(true)} disabled={ocupado} style={{ flex: 1, padding: '12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>✗ Reprovar</button>
                <button onClick={() => transicionar('aprovar')} disabled={ocupado} style={{ flex: 1, padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>✓ Aprovar</button>
              </div>
            )}
          </div>
        )}
      </div>

      {fotoAmpliada && (
        <div onClick={() => setFotoAmpliada(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', cursor: 'zoom-out' }}>
          <img src={fotoAmpliada} alt="Ampliada" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
        </div>
      )}
    </>
  );
};

export default InstalacaoModal;
```

- [ ] **Passo 4: Build e lint**

Rodar: `npx eslint src/components/espacadores && npx vite build`
Esperado: nenhum erro e "built in". Avisos de `react-hooks` iguais aos que já existem no projeto (chamar `recarregar` dentro do `useEffect`) são aceitáveis. Erros não são.

- [ ] **Passo 5: Commit**

```bash
git add src/components/espacadores/EtapaBadge.jsx src/components/espacadores/VaoCard.jsx src/components/espacadores/InstalacaoModal.jsx
git commit -m "Adiciona tela da instalacao de espacadores com cartao por vao"
```

---

### Tarefa 5: Nova instalação + seção Instalações em Espaçadores

**Arquivos:**
- Criar: `src/components/espacadores/useFluxoEspacadores.js`, `src/components/espacadores/NovaInstalacaoModal.jsx`, `src/components/espacadores/InstalacoesSection.jsx`
- Alterar: `src/components/EspacadoresTab.jsx` (imports, `finalizadoNoApp`, array `tabs` e renderização da seção)

**Interfaces:**
- Consome: da Tarefa 1, `agruparVaos`, `resumoVaos`, `filtrarPorBusca` e `formatarData`; da Tarefa 3, `buscarServicosPorTrafo`, `criarServicoEspacador`, `iniciarInstalacao`, `carregarServicosFluxo`, `carregarTodosVaos` e `assinarMudancas`; da Tarefa 4, `InstalacaoModal` e `EtapaBadge`; e `TODAS_LOCALIDADES` de `../ServicosTable`, no formato `{ loc, posto }[]`.
- Produz:
  - `useFluxoEspacadores(canal) => { servicos, vaosPorServico, carregando }`
  - `<NovaInstalacaoModal onClose onAbrir={(servicoId) => void} />`
  - `<InstalacoesSection />`

- [ ] **Passo 1: `useFluxoEspacadores.js`**

```js
import { useState, useEffect, useCallback } from 'react';
import { agruparVaos } from '../../lib/espacadores';
import { carregarServicosFluxo, carregarTodosVaos, assinarMudancas } from '../../lib/espacadoresApi';

// Serviços do fluxo novo (com etapa) + vãos agrupados por serviço, com realtime
export const useFluxoEspacadores = (canal) => {
  const [servicos, setServicos] = useState([]);
  const [vaosPorServico, setVaosPorServico] = useState({});
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([carregarServicosFluxo(), carregarTodosVaos()]);
      setServicos(s);
      setVaosPorServico(agruparVaos(v));
    } catch (e) {
      console.error('Erro ao carregar instalações:', e);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
    return assinarMudancas(canal, recarregar);
  }, [canal, recarregar]);

  return { servicos, vaosPorServico, carregando };
};
```

- [ ] **Passo 2: `NovaInstalacaoModal.jsx`**

```jsx
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { buscarServicosPorTrafo, criarServicoEspacador, iniciarInstalacao } from '../../lib/espacadoresApi';
import { TODAS_LOCALIDADES } from '../ServicosTable';
import EtapaBadge from './EtapaBadge';

const input = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', background: '#fff' };
const rotulo = { display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: '600' };

const NovaInstalacaoModal = ({ onClose, onAbrir }) => {
  const { user } = useAuth();
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState(null); // null = ainda não buscou
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState({ equip: '', local: '', coord: '' });

  const buscar = async () => {
    if (!texto.trim()) return;
    setBuscando(true);
    try {
      const r = await buscarServicosPorTrafo(texto);
      setResultados(r);
      if (r.length === 0) setNovo({ equip: texto.trim(), local: '', coord: '' });
    } catch (e) {
      alert('Erro na busca: ' + e.message);
    } finally {
      setBuscando(false);
    }
  };

  const usar = async (servico) => {
    if (servico.etapa_espacador) { onAbrir(servico.id); return; }
    setSalvando(true);
    try {
      await iniciarInstalacao(servico, user);
      onAbrir(servico.id);
    } catch (e) {
      alert(e.message);
      setSalvando(false);
    }
  };

  const cadastrar = async () => {
    if (!novo.equip.trim() || !novo.local.trim() || !novo.coord.trim()) {
      alert('Preencha trafo, localidade e coordenada.');
      return;
    }
    setSalvando(true);
    try {
      const criado = await criarServicoEspacador(novo, user);
      await iniciarInstalacao(criado, user);
      onAbrir(criado.id);
    } catch (e) {
      alert('Erro ao cadastrar: ' + e.message);
      setSalvando(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.65)', zIndex: 1000, backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1001, background: '#fff', borderRadius: '16px', width: '92%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(15,37,68,0.25)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ fontSize: '17px', fontWeight: '800', color: '#0f2544' }}>Nova instalação</div>
          <button onClick={onClose} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={rotulo}>Trafo</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input autoFocus value={texto} placeholder="Ex.: 763-3-45"
                onChange={e => { setTexto(e.target.value); setResultados(null); }}
                onKeyDown={e => { if (e.key === 'Enter') buscar(); }}
                style={input} />
              <button onClick={buscar} disabled={buscando || !texto.trim()} style={{ padding: '10px 18px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {buscando ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
          </div>

          {resultados && resultados.length > 1 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: '8px', padding: '10px 12px', fontSize: '12px' }}>
              Há mais de um serviço para este trafo — considere resolver na aba Duplicidade.
            </div>
          )}

          {resultados && resultados.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {resultados.map(s => (
                <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <b style={{ color: '#0f2544' }}>{s.id}</b>
                      <EtapaBadge etapa={s.etapa_espacador} />
                    </div>
                    <div><span style={{ color: '#94a3b8' }}>Trafo:</span> {s.equip} <span style={{ color: '#cbd5e1' }}>·</span> {s.local || '—'}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Status: {s.status}</div>
                  </div>
                  <button onClick={() => usar(s)} disabled={salvando} style={{ padding: '8px 14px', background: s.etapa_espacador ? '#f8fafc' : '#1d4ed8', color: s.etapa_espacador ? '#0f2544' : '#fff', border: s.etapa_espacador ? '1px solid #e2e8f0' : 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {s.etapa_espacador ? 'Abrir instalação' : 'Usar este serviço'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {resultados && resultados.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
              <div style={{ fontSize: '13px', color: '#475569' }}>
                Nenhum serviço de espaçador ativo para este trafo. Cadastre um novo:
              </div>
              <div>
                <label style={rotulo}>Trafo</label>
                <input value={novo.equip} onChange={e => setNovo(n => ({ ...n, equip: e.target.value }))} style={input} />
              </div>
              <div>
                <label style={rotulo}>Localidade</label>
                <select value={novo.local} onChange={e => setNovo(n => ({ ...n, local: e.target.value }))} style={input}>
                  <option value="">Selecione…</option>
                  {TODAS_LOCALIDADES.map(l => <option key={l.loc} value={l.loc}>{l.loc}</option>)}
                </select>
              </div>
              <div>
                <label style={rotulo}>Coordenada</label>
                <input value={novo.coord} placeholder="-18.844040 -41.957216" onChange={e => setNovo(n => ({ ...n, coord: e.target.value }))} style={input} />
              </div>
              <button onClick={cadastrar} disabled={salvando} style={{ padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                {salvando ? 'Cadastrando…' : 'Cadastrar e continuar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NovaInstalacaoModal;
```

- [ ] **Passo 3: `InstalacoesSection.jsx`**

```jsx
import { useState } from 'react';
import { resumoVaos, filtrarPorBusca, formatarData } from '../../lib/espacadores';
import { useFluxoEspacadores } from './useFluxoEspacadores';
import NovaInstalacaoModal from './NovaInstalacaoModal';
import InstalacaoModal from './InstalacaoModal';

const th = { padding: '12px 16px', fontWeight: '600' };
const td = { padding: '12px 16px' };

const InstalacoesSection = () => {
  const { servicos, vaosPorServico, carregando } = useFluxoEspacadores('espacadores_instalacoes');
  const [busca, setBusca] = useState('');
  const [novaAberta, setNovaAberta] = useState(false);
  const [abertoId, setAbertoId] = useState(null);

  // Reprovados primeiro, depois os mais recentes
  const lista = filtrarPorBusca(servicos.filter(s => s.etapa_espacador === 'instalacao'), busca)
    .sort((a, b) => (!!b.motivo_reprovacao_fechamento - !!a.motivo_reprovacao_fechamento)
      || String(b.dt_etapa || '').localeCompare(String(a.dt_etapa || '')));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setNovaAberta(true)} style={{ padding: '10px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
          + Nova instalação
        </button>
        <input type="text" placeholder="Buscar por ID, trafo ou localidade..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', flex: '1 1 260px', maxWidth: '400px' }} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
            <tr>
              <th style={th}>ID / Localidade</th>
              <th style={th}>Trafo</th>
              <th style={th}>Vãos</th>
              <th style={th}>Situação</th>
              <th style={th}>Desde</th>
              <th style={{ ...th, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Carregando…</td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Nenhuma instalação em andamento.</td></tr>
            ) : lista.map(s => {
              const { total, completos } = resumoVaos(vaosPorServico[s.id] || []);
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}>
                    <div style={{ fontWeight: '600', color: '#0f2544' }}>{s.id}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.local || '—'}</div>
                  </td>
                  <td style={{ ...td, color: '#334155' }}>{s.equip || '—'}</td>
                  <td style={td}>
                    <span style={{ fontWeight: '700', color: total > 0 && completos === total ? '#15803d' : '#475569' }}>{completos}/{total}</span>
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}> completos</span>
                  </td>
                  <td style={td}>
                    {s.motivo_reprovacao_fechamento ? (
                      <div>
                        <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>Reprovado</span>
                        <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '4px', maxWidth: '260px' }}>{s.motivo_reprovacao_fechamento}</div>
                      </div>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Em preenchimento</span>
                    )}
                  </td>
                  <td style={{ ...td, color: '#64748b', fontSize: '12px' }}>{formatarData(s.dt_etapa)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => setAbertoId(s.id)} style={{ padding: '6px 14px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                      Abrir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {novaAberta && (
        <NovaInstalacaoModal onClose={() => setNovaAberta(false)} onAbrir={(id) => { setNovaAberta(false); setAbertoId(id); }} />
      )}
      {abertoId && (
        <InstalacaoModal servicoId={abertoId} modo="edicao" onClose={() => setAbertoId(null)} />
      )}
    </div>
  );
};

export default InstalacoesSection;
```

- [ ] **Passo 4: Integrar em `EspacadoresTab.jsx`**

Acrescentar o import depois de `import { useAuth } from '../context/AuthContext';`:

```jsx
import InstalacoesSection from './espacadores/InstalacoesSection';
```

Substituir a função `finalizadoNoApp`, para que os serviços do fluxo novo fiquem fora das seções do app:

```jsx
  // ── Filtragem: apenas serviços finalizados pelo app (têm execucao preenchida) e fora do fluxo novo por vão
  const finalizadoNoApp = (s) => s.status === 'concluido' && s.execucao != null && !s.etapa_espacador;
```

Substituir o array `tabs`:

```jsx
  const tabs = [
    { id: 0, label: `Lista de Serviços`, count: null },
    { id: 4, label: `Instalações`, count: null },
    { id: 1, label: `Aguardando Aprovação`, count: aguardandoAprovacao.length },
    { id: 2, label: `Aguardando OS`, count: aguardandoOs.length },
    { id: 3, label: `Concluídos`, count: concluidos.length },
  ];
```

Logo depois do bloco `{activeSection === 0 && (<ServicosTable filterType="espacadores" />)}`, acrescentar:

```jsx
          {/* ── SEÇÃO 4: Instalações por vão (fluxo novo) ── */}
          {activeSection === 4 && <InstalacoesSection />}
```

- [ ] **Passo 5: Build, lint e teste manual**

Rodar: `npx eslint src/components/espacadores src/components/EspacadoresTab.jsx && npx vite build && npm test`
Esperado: nenhum erro, "built in" e os testes passando.

Rodar: `npm run dev`. Logado como Dono ou Despachante, ir em Despacho → Espaçadores → Instalações e:
1. "+ Nova instalação" → digitar `763` → Buscar. Deve aparecer a lista com o trafo exato primeiro e o aviso de duplicidade se houver mais de um resultado. Clicar em "Usar este serviço" deve abrir a tela da instalação.
2. "+ Adicionar Vão" três vezes deve criar Vão 1, Vão 2 e Vão 3. Anexar 2 fotos de antes no Vão 1 (seleção múltipla), 1 foto de depois e um PDF. O cartão deve mostrar "✓ Completo".
3. Tentar anexar um `.png` como croqui deve mostrar o alerta "O croqui precisa ser um arquivo PDF."
4. Com os Vãos 2 e 3 incompletos, "Enviar para fechamento" deve estar desativado. Remover os Vãos 2 e 3 (com confirmação) deve ativar o botão. Ainda **não** enviar.
5. "+ Nova instalação" com um trafo inexistente (ex.: `TESTE-000`) deve mostrar o formulário. Cadastrar deve abrir a tela da instalação do novo `VDxxxx`.
6. Conferir em Aguardando Aprovação, Aguardando OS e Concluídos que nenhum desses dois serviços aparece.

- [ ] **Passo 6: Commit**

```bash
git add src/components/espacadores/useFluxoEspacadores.js src/components/espacadores/NovaInstalacaoModal.jsx src/components/espacadores/InstalacoesSection.jsx src/components/EspacadoresTab.jsx
git commit -m "Adiciona Nova instalacao e secao Instalacoes na aba Espacadores"
```

---

### Tarefa 6: Aba Fechamento

**Arquivos:**
- Criar: `src/components/FechamentoTab.jsx`

**Interfaces:**
- Consome: da Tarefa 5, `useFluxoEspacadores`; da Tarefa 4, `InstalacaoModal` e `EtapaBadge`; da Tarefa 1, `resumoVaos`, `filtrarPorBusca` e `formatarData`; da Tarefa 3, `aplicarTransicao`; e `useAuth`.
- Produz: `<FechamentoTab />` (export default).

- [ ] **Passo 1: Implementar**

```jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { resumoVaos, filtrarPorBusca, formatarData } from '../lib/espacadores';
import { aplicarTransicao } from '../lib/espacadoresApi';
import { useFluxoEspacadores } from './espacadores/useFluxoEspacadores';
import InstalacaoModal from './espacadores/InstalacaoModal';

const SECOES = [
  { etapa: 'revisao', label: 'Revisão', vazio: 'Nenhuma instalação aguardando revisão.' },
  { etapa: 'aguardando_nsmp', label: 'Aguardando NSMP', vazio: 'Nenhuma instalação aguardando NSMP.', acao: 'nsmp', placeholder: 'Nº NSMP' },
  { etapa: 'aguardando_nsmc', label: 'Aguardando NSMC', vazio: 'Nenhuma instalação aguardando NSMC.', acao: 'nsmc', placeholder: 'Nº NSMC' },
  { etapa: 'pago', label: 'Pagos', vazio: 'Nenhuma instalação paga ainda.' },
];

const th = { padding: '12px 16px', fontWeight: '600' };
const td = { padding: '12px 16px' };
const botaoSec = { padding: '6px 14px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' };

const FechamentoTab = () => {
  const { user } = useAuth();
  const { servicos, vaosPorServico, carregando } = useFluxoEspacadores('fechamento_espacadores');
  const [ativa, setAtiva] = useState('revisao');
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(null); // { id, modo }
  const [editandoId, setEditandoId] = useState(null);
  const [numero, setNumero] = useState('');
  const [salvando, setSalvando] = useState(false);

  const secao = SECOES.find(s => s.etapa === ativa);
  const contagem = (etapa) => servicos.filter(s => s.etapa_espacador === etapa).length;
  const lista = filtrarPorBusca(servicos.filter(s => s.etapa_espacador === ativa), busca)
    .sort((a, b) => String(a.dt_etapa || '').localeCompare(String(b.dt_etapa || ''))); // mais antigo primeiro

  const cancelarEdicao = () => { setEditandoId(null); setNumero(''); };

  const salvarNumero = async (servico) => {
    if (salvando) return;
    setSalvando(true);
    try {
      await aplicarTransicao(servico, secao.acao, { user, numero });
      cancelarEdicao();
    } catch (e) {
      alert(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', flexWrap: 'wrap' }}>
        {SECOES.map(s => {
          const ativo = ativa === s.etapa;
          const n = contagem(s.etapa);
          return (
            <button key={s.etapa} onClick={() => { setAtiva(s.etapa); cancelarEdicao(); }}
              style={{ padding: '8px 16px', background: ativo ? '#0f2544' : '#fff', color: ativo ? '#fff' : '#64748b', border: '1px solid', borderColor: ativo ? '#0f2544' : '#e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {s.label}
              {n > 0 && <span style={{ background: ativo ? 'rgba(255,255,255,0.25)' : '#f1f5f9', color: ativo ? '#fff' : '#64748b', borderRadius: '20px', fontSize: '11px', fontWeight: '700', padding: '1px 7px' }}>{n}</span>}
            </button>
          );
        })}
      </div>

      <input type="text" placeholder="Buscar por ID, trafo ou localidade..." value={busca} onChange={e => setBusca(e.target.value)}
        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', maxWidth: '400px' }} />

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
            <tr>
              <th style={th}>ID / Localidade</th>
              <th style={th}>Trafo</th>
              <th style={th}>Vãos</th>
              {(ativa === 'aguardando_nsmc' || ativa === 'pago') && <th style={th}>NSMP</th>}
              {ativa === 'pago' && <th style={th}>NSMC</th>}
              <th style={th}>Desde</th>
              <th style={{ ...th, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Carregando…</td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>{secao.vazio}</td></tr>
            ) : lista.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={td}>
                  <div style={{ fontWeight: '600', color: '#0f2544' }}>{s.id}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.local || '—'}</div>
                </td>
                <td style={{ ...td, color: '#334155' }}>{s.equip || '—'}</td>
                <td style={{ ...td, fontWeight: '700', color: '#475569' }}>{resumoVaos(vaosPorServico[s.id] || []).total}</td>
                {(ativa === 'aguardando_nsmc' || ativa === 'pago') && <td style={{ ...td, fontWeight: '700', color: '#7c3aed' }}>{s.numServ || '—'}</td>}
                {ativa === 'pago' && <td style={{ ...td, fontWeight: '700', color: '#15803d' }}>{s.nsmc || '—'}</td>}
                <td style={{ ...td, color: '#64748b', fontSize: '12px' }}>{formatarData(s.dt_etapa)}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {secao.acao && editandoId === s.id ? (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <input autoFocus type="text" placeholder={secao.placeholder} value={numero} onChange={e => setNumero(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') salvarNumero(s); if (e.key === 'Escape') cancelarEdicao(); }}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', width: '130px', outline: 'none' }} />
                      <button onClick={() => salvarNumero(s)} disabled={salvando} style={{ padding: '6px 12px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: salvando ? 'wait' : 'pointer' }}>
                        {salvando ? 'Salvando…' : 'Salvar'}
                      </button>
                      <button onClick={cancelarEdicao} style={{ padding: '6px 10px', background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {ativa === 'revisao' ? (
                        <button onClick={() => setModal({ id: s.id, modo: 'revisao' })} style={{ padding: '6px 14px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                          Revisar →
                        </button>
                      ) : (
                        <button onClick={() => setModal({ id: s.id, modo: 'leitura' })} style={botaoSec}>Ver detalhes</button>
                      )}
                      {secao.acao && (
                        <button onClick={() => { setEditandoId(s.id); setNumero(''); }} style={{ padding: '6px 14px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                          Informar {secao.acao.toUpperCase()}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && <InstalacaoModal servicoId={modal.id} modo={modal.modo} onClose={() => setModal(null)} />}
    </div>
  );
};

export default FechamentoTab;
```

- [ ] **Passo 2: Build e lint**

Rodar: `npx eslint src/components/FechamentoTab.jsx && npx vite build`
Esperado: nenhum erro e "built in".

- [ ] **Passo 3: Commit**

```bash
git add src/components/FechamentoTab.jsx
git commit -m "Adiciona aba Fechamento com revisao, NSMP e NSMC"
```

---

### Tarefa 7: Navegação por perfil + perfil Fechamento em Usuários

**Arquivos:**
- Alterar: `src/pages/home.jsx` (imports, aba padrão, `tabs`, blocos sempre montados e bloco da aba Fechamento)
- Alterar: `src/components/UsuariosTab.jsx` (três `<select>` e o selo do perfil, linhas ~191-194, ~226-229, ~258-262 e ~268-273)

**Interfaces:**
- Consome: da Tarefa 1, `abasDoPerfil` e `abaInicial`; da Tarefa 6, `FechamentoTab`.

- [ ] **Passo 1: `home.jsx` — imports**

Acrescentar depois de `import MapaTab from '../components/MapaTab';`:

```jsx
import FechamentoTab from '../components/FechamentoTab';
import { abasDoPerfil, abaInicial } from '../lib/navegacao';
```

- [ ] **Passo 2: `home.jsx` — aba padrão respeitando o perfil**

Remover a linha `const defaultTab = (role) => (role === 'dono' ? 'cadastrar' : 'despacho');` e substituir o `useEffect` que começa com `// Define aba padrão quando o usuário carrega pela primeira vez` por:

```jsx
  // Garante uma aba permitida para o perfil (inclusive quando a aba salva no navegador não serve)
  useEffect(() => {
    if (!user) return;
    const aba = abaInicial(user.role, activeTab);
    if (aba !== activeTab) {
      setActiveTab(aba);
      localStorage.setItem('vd_tab', aba);
    }
  }, [user, activeTab]);
```

Trocar `const isDono = user?.role === 'dono';` por:

```jsx
  const soFechamento = user?.role === 'fechamento';
```

Substituir o array `const tabs = [ ... ];` inteiro por:

```jsx
  const tabs = abasDoPerfil(user?.role);
```

- [ ] **Passo 3: `home.jsx` — não montar as abas pesadas para o perfil Fechamento, e renderizar Fechamento**

Envolver os quatro blocos sempre montados (`CadastroForm`, `ServicosTable`, `PlacasTab` e `EspacadoresTab`) e o bloco do `PainelTab` com `{!soFechamento && (<> … </>)}`, para que um usuário de Fechamento não baixe todos os serviços cinco vezes à toa:

```jsx
        {!soFechamento && (
          <>
            <div style={{ display: activeTab === 'cadastrar' ? 'block' : 'none' }}>
              <CadastroForm />
            </div>

            <div style={{ display: activeTab === 'despacho' && activeSubTabDespacho === 'servicos' ? 'block' : 'none' }}>
              <ServicosTable />
            </div>

            <div style={{ display: activeTab === 'despacho' && activeSubTabDespacho === 'placas' ? 'block' : 'none' }}>
              <PlacasTab />
            </div>

            <div style={{ display: activeTab === 'despacho' && activeSubTabDespacho === 'espacadores' ? 'block' : 'none' }}>
              <EspacadoresTab />
            </div>
          </>
        )}
```

e

```jsx
        {!soFechamento && (
          <div style={{ display: activeTab === 'painel' ? 'block' : 'none' }}>
            <PainelTab />
          </div>
        )}
```

Depois do bloco do `FaturamentoTab`, acrescentar:

```jsx
        <div style={{ display: activeTab === 'fechamento' ? 'block' : 'none' }}>
          {activeTab === 'fechamento' && <FechamentoTab />}
        </div>
```

- [ ] **Passo 4: `UsuariosTab.jsx` — perfil Fechamento**

Acrescentar a mesma linha abaixo nos três `<select>`: no do cadastro (depois de `<option value="despachante">Despachante</option>`, linha ~193), no do filtro (depois de `<option value="despachante">Despachantes</option>`, linha ~228) e no da edição de perfil (depois de `<option value="despachante">Despachante</option>`, linha ~260):

```jsx
                <option value="fechamento">Fechamento</option>
```

Antes de `const UsuariosTab`, acrescentar:

```jsx
const PERFIS = {
  tecnico: { label: 'Técnico', style: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' } },
  despachante: { label: 'Despachante', style: { background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe' } },
  fechamento: { label: 'Fechamento', style: { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' } },
  levantador: { label: 'Levantador', style: { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' } },
  dono: { label: 'Dono', style: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' } },
};
```

Substituir o selo (o `<div>` com `display: 'inline-block'` e o ternário de `u.role`) por:

```jsx
                          <div style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                            ...(PERFIS[u.role] || PERFIS.dono).style
                          }}>
                            {(PERFIS[u.role] || { label: u.role }).label}
                          </div>
```

- [ ] **Passo 5: Build, lint e testes**

Rodar: `npx eslint src/pages/home.jsx src/components/UsuariosTab.jsx && npx vite build && npm test`
Esperado: nenhum erro de lint novo (conferir com `git stash` se algum aviso já existia antes), "built in" e os testes passando.

- [ ] **Passo 6: Commit**

```bash
git add src/pages/home.jsx src/components/UsuariosTab.jsx
git commit -m "Adiciona perfil Fechamento na navegacao e na tela de Usuarios"
```

---

### Tarefa 8: Verificação de ponta a ponta

**Arquivos:** nenhum (só verificação). Os scripts de leitura do banco ficam **fora** do repositório, no diretório temporário da sessão.

- [ ] **Passo 1: Criar um usuário de Fechamento**

Pedir ao usuário que, como Dono, vá em Admin → Usuários e cadastre um usuário de teste com perfil **Fechamento**.

- [ ] **Passo 2: Percorrer o fluxo com o app rodando localmente (`npm run dev`)**

1. **Despachante/Dono:** abrir a instalação criada na Tarefa 5 (com 1 vão completo) → "Enviar para fechamento". Ela deve sumir de Instalações.
2. **Fechamento:** fazer login. Deve aparecer **só** a aba Fechamento, mesmo que o navegador tenha `vd_tab = 'despacho'` salvo. Em Revisão → "Revisar →" as fotos devem ampliar e o croqui deve abrir. "Reprovar" com o motivo em branco deve mostrar o alerta. Reprovar com um motivo.
3. **Despachante:** em Instalações, o item deve aparecer com o selo "Reprovado" e o motivo. Abrir, ver o aviso vermelho, trocar uma foto e reenviar.
4. **Fechamento:** Aprovar. Em Aguardando NSMP → "Informar NSMP", tentar salvar vazio (deve aparecer o alerta), depois `123456` + Enter. Em Aguardando NSMC → `987654`. Em Pagos, conferir a NSMP e a NSMC.
5. **Concorrência:** abrir a mesma instalação em Revisão em duas abas. Aprovar na primeira e depois clicar em Aprovar na segunda. Deve aparecer a mensagem "mudou de etapa", e o histórico deve ter uma aprovação só.
6. **Limite:** numa instalação de teste, adicionar vãos até 20. O botão deve mostrar "Limite de 20 vãos atingido".

- [ ] **Passo 3: Conferir o banco (leitura com a chave de serviço)**

```js
const { data: s } = await sb.from('servicos').select('id,status,etapa_espacador,numServ,nsmc,dt_etapa,motivo_reprovacao_fechamento,hist').not('etapa_espacador', 'is', null);
console.log(s.map(x => ({ ...x, hist: x.hist.map(h => h.msg) })));
const { data: v } = await sb.from('vaos').select('servico_id,numero,fotos_antes,fotos_depois,croqui_url');
console.log(v.map(x => ({ ...x, fotos_antes: x.fotos_antes.length, fotos_depois: x.fotos_depois.length, croqui: !!x.croqui_url })));
```

Esperado: o serviço pago tem `status = concluido`, `etapa_espacador = pago`, `numServ = 123456`, `nsmc = 987654` e `motivo_reprovacao_fechamento = null`, e o histórico tem, em ordem: iniciada → enviada → reprovada → enviada → aprovada → NSMP → NSMC.

- [ ] **Passo 4: Limpeza dos dados de teste**

Perguntar ao usuário se os serviços de teste (por exemplo `TESTE-000`) devem ser cancelados. **Não** apagar nada sem confirmação.

- [ ] **Passo 5: Relatório**

Relatar ao usuário o que passou e o que falhou, com a saída dos comandos. Publicar (`git push` e `npm run deploy`) só se o usuário pedir.
