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
