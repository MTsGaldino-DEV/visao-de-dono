// Valor da US em reais (apostilamento do contrato). Mesma regra do Central NEO (tabela neo_valor_us):
// R$ = US × valor da US vigente na DATA DE EXECUÇÃO. Antes da primeira vigência não há valor em R$.
// Para um novo apostilamento, acrescente uma linha aqui (a mais recente primeiro).
export const VALORES_US = [
  { inicio: '2026-05-24', reais: 2964.33 }, // valor a partir de 24/05/2026
  { inicio: '2025-05-24', reais: 2880.23 }, // 24/05/2025 a 23/05/2026
];

// Aceita 'AAAA-MM-DD', ISO com hora ou Date; devolve 'AAAA-MM-DD' (UTC) ou null
const diaDe = (data) => {
  if (!data) return null;
  if (data instanceof Date) return Number.isNaN(data.getTime()) ? null : data.toISOString().slice(0, 10);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(data).trim());
  return m ? m[1] : null;
};

// R$ da US vigente na data; null sem data ou antes da primeira vigência
export const valorUSNaData = (data, tabela = VALORES_US) => {
  const dia = diaDe(data);
  if (!dia) return null;
  const v = tabela.find((x) => x.inicio <= dia);
  return v ? v.reais : null;
};

// US convertida em R$ pela vigência da data de execução; null se não houver valor
export const usParaReais = (us, data, tabela = VALORES_US) => {
  const taxa = valorUSNaData(data, tabela);
  const n = Number(us);
  return taxa === null || !Number.isFinite(n) ? null : Math.round(n * taxa * 100) / 100;
};

export const formatarReais = (valor) => {
  if (valor === null || valor === undefined || String(valor).trim() === '') return '';
  const n = Number(valor);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
};

// Valor da nota (lançado em US) em R$, pela US vigente na data de lançamento no SalesForce;
// null sem valor, sem data ou antes da primeira vigência
export const notaEmReais = (servico, tabela = VALORES_US) => usParaReais(servico?.valor_nota, servico?.data_lancamento_sf, tabela);
