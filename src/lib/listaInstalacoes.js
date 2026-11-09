import { ETAPAS, TIPOS_SERVICO, tipoServicoDe, lerValorNota, formatarMoeda, formatarDataDia, rotuloTipoEquipe } from './espacadores';

// Regras puras da grade de instalações (colunas, filtros estilo Excel e ordenação).
// Sem React nem Supabase: tudo aqui é testável isoladamente.

export const VAZIO = '(vazio)';

// curto: título no cabeçalho, para a grade caber sem esconder o valor; menus, etiquetas e Excel usam o rótulo inteiro
export const COLUNAS_INSTALACOES = [
  { id: 'id', rotulo: 'ID' },
  { id: 'local', rotulo: 'Localidade' },
  { id: 'equip', rotulo: 'Trafo' },
  { id: 'servico', rotulo: 'Serviço' },
  { id: 'qtd', rotulo: 'Quantidade', curto: 'Qtd.', numero: true },
  { id: 'situacao', rotulo: 'Situação' },
  { id: 'nsmp', rotulo: 'NSMP' },
  { id: 'nspr', rotulo: 'NSPR' },
  { id: 'valor_nota', rotulo: 'Valor da nota', curto: 'Valor', numero: true },
  { id: 'tipo_equipe', rotulo: 'Tipo de equipe', curto: 'Tipo eq.' },
  { id: 'equipe', rotulo: 'Equipe' },
  { id: 'desde', rotulo: 'Desde' },
  { id: 'apropriacao', rotulo: 'Apropriação', curto: 'Aprop.' },
  { id: 'lancamento_sf', rotulo: 'Lançamento SF', curto: 'Lanç. SF' },
];

const ETAPAS_COM_NUMEROS = ['aguardando_nsmc', 'sf', 'pago', 'todas'];
const ETAPAS_COM_SALESFORCE = ['pago', 'todas'];

// Colunas que aparecem para a etapa selecionada: NSMP/NSPR nas etapas finais; apropriação e dados do SalesForce só no Pago
export const colunasVisiveis = (filtroEtapa) => COLUNAS_INSTALACOES.filter(c => {
  if (c.id === 'nsmp' || c.id === 'nspr') return ETAPAS_COM_NUMEROS.includes(filtroEtapa);
  if (['apropriacao', 'lancamento_sf', 'valor_nota'].includes(c.id)) return ETAPAS_COM_SALESFORCE.includes(filtroEtapa);
  return true;
});

// Texto da célula usado para filtrar/ordenar; '' quando vazio
export const valorColuna = (colunaId, s, vao) => {
  let v;
  switch (colunaId) {
    case 'id': v = s.id; break;
    case 'local': v = s.local; break;
    case 'equip': v = s.equip; break;
    case 'servico': v = TIPOS_SERVICO[tipoServicoDe(s)].label; break;
    case 'qtd': v = vao?.qtd_espacadores; break;
    case 'situacao':
      v = s.etapa_espacador === 'instalacao' && s.motivo_reprovacao_fechamento
        ? 'Reprovado'
        : ETAPAS[s.etapa_espacador]?.label;
      break;
    case 'nsmp': v = s.numServ; break;
    case 'nspr': v = s.nsmc; break;
    case 'equipe': v = vao?.equipe; break;
    case 'tipo_equipe': v = rotuloTipoEquipe(vao?.tipo_equipe); break;
    case 'desde': v = s.dt_etapa ? new Date(s.dt_etapa).toLocaleDateString('pt-BR') : ''; break;
    case 'apropriacao': v = s.apropriacao; break;
    case 'lancamento_sf': v = formatarDataDia(s.data_lancamento_sf); break;
    case 'valor_nota': v = formatarMoeda(s.valor_nota); break;
    default: v = '';
  }
  return String(v ?? '').trim();
};

const vaoDe = (s, vaosPorServico) => vaosPorServico?.[s.id]?.[0];

export const filtrarPorColunas = (lista, filtros, vaosPorServico, { ignorar, visiveis } = {}) => {
  const ativos = Object.entries(filtros || {})
    .filter(([id, marcados]) => Array.isArray(marcados) && id !== ignorar && (!visiveis || visiveis.includes(id)))
    .map(([id, marcados]) => [id, new Set(marcados)]);
  if (!ativos.length) return lista;
  return lista.filter(s => {
    const vao = vaoDe(s, vaosPorServico);
    return ativos.every(([id, marcados]) => marcados.has(valorColuna(id, s, vao) || VAZIO));
  });
};

// O que o OK do menu grava: null quando os marcados cobrem todos os valores da coluna (sem filtro)
export const selecaoDoMenu = (todos, marcados) => {
  const conjunto = new Set(marcados);
  return todos.every(v => conjunto.has(v)) ? null : marcados;
};

// Chave de comparação de um valor: número (qtd, valor da nota), data (desde, lançamento) ou texto; null = vazio
const chaveDoValor = (colunaId, valor) => {
  if (!valor || valor === VAZIO) return null;
  if (colunaId === 'qtd') {
    const n = Number(valor.replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  }
  if (colunaId === 'valor_nota') return lerValorNota(valor);
  if (colunaId === 'desde' || colunaId === 'lancamento_sf') {
    const [d, m, a] = valor.split('/').map(Number);
    return a * 10000 + m * 100 + d;
  }
  return valor;
};

const chaveDaLinha = (colunaId, s, vao) => {
  if (colunaId === 'desde') {
    const t = s.dt_etapa ? Date.parse(s.dt_etapa) : NaN;
    return Number.isNaN(t) ? null : t;
  }
  if (colunaId === 'valor_nota') {
    const n = s.valor_nota === null || s.valor_nota === undefined || s.valor_nota === '' ? NaN : Number(s.valor_nota);
    return Number.isFinite(n) ? n : null;
  }
  return chaveDoValor(colunaId, valorColuna(colunaId, s, vao));
};

const comparar = (a, b) => (typeof a === 'number' && typeof b === 'number'
  ? a - b
  : String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' }));

// Vazios sempre no fim, em qualquer sentido
const compararComVazio = (a, b, sinal) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return sinal * comparar(a, b);
};

export const valoresDaColuna = (lista, colunaId, vaosPorServico) => {
  const contagem = new Map();
  lista.forEach(s => {
    const v = valorColuna(colunaId, s, vaoDe(s, vaosPorServico)) || VAZIO;
    contagem.set(v, (contagem.get(v) || 0) + 1);
  });
  return [...contagem.entries()]
    .map(([valor, n]) => ({ valor, n }))
    .sort((a, b) => compararComVazio(chaveDoValor(colunaId, a.valor), chaveDoValor(colunaId, b.valor), 1));
};

export const ordenarPorColuna = (lista, ordem, vaosPorServico) => {
  if (!ordem?.coluna) return [...lista];
  const sinal = ordem.dir === 'desc' ? -1 : 1;
  const chaves = new Map(lista.map(s => [s, chaveDaLinha(ordem.coluna, s, vaoDe(s, vaosPorServico))]));
  // sort nativo é estável: empates mantêm a ordem de entrada
  return [...lista].sort((a, b) => compararComVazio(chaves.get(a), chaves.get(b), sinal));
};
