// Regras do fluxo de instalação de espaçadores por vão.
// Módulo puro (sem Supabase) para poder ser testado com Vitest.

import {
  lerCoordenada, formatarCoordenada, distanciaMetros, validarCoordenadaVao, coordenadaComVirgula, MENSAGEM_COORDENADA,
} from './coordenadas';

export const LIMITE_VINCULO_M = 100;

export const ETAPAS = {
  instalacao:      { label: 'Em instalação',   cor: '#1d4ed8', bg: '#eff6ff', borda: '#bfdbfe' },
  revisao:         { label: 'Em revisão',      cor: '#854d0e', bg: '#fef9c3', borda: '#fde68a' },
  aguardando_nsmp: { label: 'Aguardando NSMP', cor: '#7c3aed', bg: '#faf5ff', borda: '#ddd6fe' },
  aguardando_nsmc: { label: 'Aguardando NSPR', cor: '#c2410c', bg: '#fff7ed', borda: '#fed7aa' },
  sf:              { label: 'SF',              cor: '#0f766e', bg: '#f0fdfa', borda: '#99f6e4' },
  pago:            { label: 'Pago',            cor: '#15803d', bg: '#f0fdf4', borda: '#bbf7d0' },
};

const TRANSICOES = {
  enviar:   { de: 'instalacao',      para: 'revisao' },
  aprovar:  { de: 'revisao',         para: 'aguardando_nsmp' },
  reprovar: { de: 'revisao',         para: 'instalacao' },
  nsmp:     { de: 'aguardando_nsmp', para: 'aguardando_nsmc' },
  nsmc:     { de: 'aguardando_nsmc', para: 'sf' },
  // Depois da NSPR o fechamento informa data, valor da nota e apropriação no SalesForce; aí o serviço está Pago
  salesforce: { de: 'sf', para: 'pago' },
};

const normStr = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Mesma regra de ServicosTable (filterType 'espacadores')
const ESPACADOR_REGEX = /esp.{0,2}ac.{0,2}dor/;
export const isEspacador = (servico) => ESPACADOR_REGEX.test(normStr(servico?.desc));

// Poda de árvore usa o mesmo fluxo do espaçador. O tipo vem de servicos.desc e a quantidade de árvores
// podadas é gravada na mesma coluna vaos.qtd_espacadores (mesmo precedente de nsmc = NSPR e de etapa_espacador).
const PODA_REGEX = /\bpoda/;
// Se a descrição citar os dois, continua sendo espaçador
export const isPoda = (servico) => PODA_REGEX.test(normStr(servico?.desc)) && !isEspacador(servico);

export const TIPOS_SERVICO = {
  espacador: {
    label: 'Espaçador',
    descNovo: 'Instalação de espaçador',
    campoQtd: 'Espaçadores instalados neste vão',
    tituloQtd: 'Espaçadores instalados',
    rotuloHist: 'Quantidade de espaçadores',
    iniciado: 'Instalação de espaçadores iniciada',
    excluido: 'Instalação de espaçadores excluída',
    cadastrado: 'Serviço cadastrado pela Nova instalação de espaçadores.',
    tituloModal: 'Instalação de espaçadores',
  },
  poda: {
    label: 'Poda de árvore',
    descNovo: 'Poda de árvore',
    campoQtd: 'Árvores podadas',
    tituloQtd: 'Árvores podadas',
    rotuloHist: 'Quantidade de árvores podadas',
    iniciado: 'Poda de árvore iniciada',
    excluido: 'Poda de árvore excluída',
    cadastrado: 'Serviço cadastrado pelo Novo serviço: poda de árvore.',
    tituloModal: 'Poda de árvore',
  },
};

// Serviço do fluxo com descrição desconhecida continua tratado como espaçador
export const tipoServicoDe = (servico) => (isPoda(servico) ? 'poda' : 'espacador');

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

// Coordenadas vêm da leitura única do sistema; reexportadas para quem já importa daqui
export { lerCoordenada, formatarCoordenada, distanciaMetros, validarCoordenadaVao, coordenadaComVirgula, MENSAGEM_COORDENADA };

// Candidatos do mais perto ao mais longe da coordenada do antes; sem coordenada no fim
export const sugerirVinculo = (candidatos, coordAntes) => {
  const origem = lerCoordenada(coordAntes);
  const ordenados = candidatos
    .map(c => {
      const destino = origem && lerCoordenada(c.coord);
      return { ...c, distancia: destino ? distanciaMetros(origem, destino) : null };
    })
    .sort((a, b) => (a.distancia ?? Infinity) - (b.distancia ?? Infinity));
  const primeiro = ordenados[0];
  const sugerido = primeiro?.distancia != null && primeiro.distancia <= LIMITE_VINCULO_M ? primeiro : null;
  return { ordenados, sugerido };
};

export const qtdValida = (valor) => {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// O que falta para o despachante enviar a instalação
export const pendenciasInstalacao = (vao) => {
  const faltando = [];
  if (!vao?.fotos_antes?.length) faltando.push('foto de antes');
  if (!lerCoordenada(vao?.coord_antes)) faltando.push('coordenada do antes');
  if (!vao?.fotos_depois?.length) faltando.push('foto de depois');
  if (!lerCoordenada(vao?.coord_depois)) faltando.push('coordenada do depois');
  if (!qtdValida(vao?.qtd_espacadores)) faltando.push('quantidade');
  if (!String(vao?.equipe ?? '').trim()) faltando.push('equipe');
  return faltando;
};

// Compara o que está digitado na tela com o vão salvo: campos = o que gravar (já normalizado);
// invalido = há um valor digitado que não pode ser gravado. Enviar e aprovar esperam pendente = false.
export const alteracoesPendentes = (vao, { coordAntes, coordDepois, qtd, equipe }) => {
  const campos = {};
  let invalido = false;
  [['coord_antes', coordAntes], ['coord_depois', coordDepois]].forEach(([campo, digitado]) => {
    const texto = String(digitado ?? '').trim();
    const salvo = vao?.[campo] || '';
    if (!texto && !salvo) return;
    // O digitado precisa estar no formato do vão; o salvo pode estar em formato antigo ("lat lng" com ponto)
    if (!validarCoordenadaVao(texto).ok) { invalido = true; return; }
    if (formatarCoordenada(texto) !== (formatarCoordenada(salvo) ?? salvo)) campos[campo] = coordenadaComVirgula(texto);
  });
  const qtdSalva = vao?.qtd_espacadores ?? null;
  if (String(qtd ?? '').trim() !== '' || qtdSalva !== null) {
    const nova = qtdValida(qtd);
    if (nova === null) invalido = true;
    else if (nova !== qtdSalva) campos.qtd_espacadores = nova;
  }
  if (equipe !== undefined) {
    const nova = String(equipe ?? '').trim() || null;
    if (nova !== (String(vao?.equipe ?? '').trim() || null)) campos.equipe = nova;
  }
  return { campos, pendente: invalido || Object.keys(campos).length > 0, invalido };
};

export const podeEnviarInstalacao = (vao) => pendenciasInstalacao(vao).length === 0;

// Só o administrador vê o botão que apaga a instalação de vez (qualquer etapa)
const MATRICULA_ADMIN_APAGAR = '27630';
export const podeApagarInstalacao = (user) => String(user?.matricula ?? '') === MATRICULA_ADMIN_APAGAR;

export const agruparVaos = (vaos) => {
  const grupos = {};
  vaos.forEach(v => { (grupos[v.servico_id] = grupos[v.servico_id] || []).push(v); });
  Object.values(grupos).forEach(lista => lista.sort((a, b) => a.numero - b.numero));
  return grupos;
};

// Mesma numeração de CadastroForm
export const proximoIdVD = (ultimoId) => {
  const atual = ultimoId ? (parseInt(String(ultimoId).replace('VD', ''), 10) || 0) : 0;
  return `VD${String(atual + 1).padStart(4, '0')}`;
};

// ── Valor da nota e data do lançamento (SalesForce) ─────────────────────────

// Aceita número ou texto ("1.234,56", "1234,56", "1234.56", "R$ 1.234,56"); null se inválido
export const lerValorNota = (texto) => {
  let n;
  if (typeof texto === 'number') {
    n = texto;
  } else {
    let s = String(texto ?? '').replace(/R\$/gi, '').replace(/\s/g, '');
    if (!/^[\d.,]+$/.test(s)) return null;
    if (s.includes(',')) {
      // Com vírgula, o ponto só vale como milhar: "1.50,00" é erro de digitação, não R$ 150,00
      if (!/^(\d+|\d{1,3}(\.\d{3})+),\d*$/.test(s)) return null;
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    n = Number(s);
  }
  if (!Number.isFinite(n) || n <= 0 || n >= 10000000000) return null;
  // No máximo 2 casas decimais
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return null;
  return Math.round(n * 100) / 100;
};

export const formatarMoeda = (valor) => {
  if (valor === null || valor === undefined || String(valor).trim() === '') return '';
  const n = Number(valor);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
};

// 'AAAA-MM-DD' vira 'DD/MM/AAAA' cortando o texto (new Date voltaria um dia pelo fuso)
export const formatarDataDia = (iso) => {
  const texto = String(iso ?? '').trim();
  if (!texto) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : texto;
};

// 'AAAA-MM-DD' que existe no calendário
const dataDiaValida = (texto) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto ?? '').trim());
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const data = new Date(Date.UTC(a, mes - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === mes - 1 && data.getUTCDate() === d;
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

// status_antes_instalacao: para onde o serviço volta se a instalação for excluída
export const montarPayloadInicio = (servico, { user, agora, criadoPelaInstalacao = false }) => {
  if (servico.etapa_espacador) throw new Error('Este serviço já está no fluxo de instalação.');
  return {
    etapa_espacador: 'instalacao',
    dt_etapa: agora,
    status_antes_instalacao: criadoPelaInstalacao ? 'cancelado' : servico.status,
    hist: [...(servico.hist || []), entradaHist(user, TIPOS_SERVICO[tipoServicoDe(servico)].iniciado, agora)],
  };
};

const exigir = (valor, mensagem) => {
  const limpo = (valor || '').trim();
  if (!limpo) throw new Error(mensagem);
  return limpo;
};

export const montarPayloadTransicao = (servico, acao, {
  user, agora, numero, motivo, dataLancamento, valorNota, apropriacao,
} = {}) => {
  const payload = { etapa_espacador: proximaEtapa(servico.etapa_espacador, acao) };
  // "Desde" conta a entrada na etapa
  payload.dt_etapa = agora;
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
    payload.nsmc = exigir(numero, 'Informe o número da NSPR.');
    msg = `NSPR informada: ${payload.nsmc}`;
  } else if (acao === 'salesforce') {
    const data = String(dataLancamento ?? '').trim();
    if (!dataDiaValida(data)) throw new Error('Informe a data de lançamento no SalesForce.');
    const valor = lerValorNota(valorNota);
    if (valor === null) throw new Error('Informe um valor da nota válido.');
    payload.data_lancamento_sf = data;
    payload.valor_nota = valor;
    payload.apropriacao = exigir(apropriacao, 'Informe o número da apropriação.');
    msg = `SalesForce informado: lançamento ${formatarDataDia(data)}, nota ${formatarMoeda(valor)}, apropriação ${payload.apropriacao}`;
  }
  payload.hist = [...(servico.hist || []), entradaHist(user, msg, agora)];
  return payload;
};

// Excluir a instalação tira o serviço do fluxo e devolve o status anterior; os vãos são apagados à parte
export const montarPayloadExclusao = (servico, { user, agora }) => {
  if (servico.etapa_espacador !== 'instalacao') {
    const rotulo = ETAPAS[servico.etapa_espacador]?.label || servico.etapa_espacador || 'sem etapa';
    throw new Error(`Não é possível excluir a instalação com o serviço na etapa "${rotulo}".`);
  }
  return {
    etapa_espacador: null,
    dt_etapa: null,
    motivo_reprovacao_fechamento: null,
    status_antes_instalacao: null,
    status: servico.status_antes_instalacao || 'cancelado',
    hist: [...(servico.hist || []), entradaHist(user, TIPOS_SERVICO[tipoServicoDe(servico)].excluido, agora)],
  };
};

// ── Correção da instalação por quem fecha (qualquer etapa) ───────────────────

const mostrar = (v) => (v === null || v === undefined || String(v).trim() === '' ? '—' : v);

const ROTULOS_VAO = {
  coord_antes: 'Coordenada do antes',
  coord_depois: 'Coordenada do depois',
  qtd_espacadores: 'Quantidade de espaçadores',
  equipe: 'Equipe',
};

// campos = saída de alteracoesPendentes; uma frase por campo para o histórico.
// O rótulo da quantidade depende do tipo do serviço (sem serviço = espaçador).
export const descreverAlteracoesVao = (vao, campos, servico) =>
  Object.keys(ROTULOS_VAO).filter(c => c in campos).map(c => {
    const antes = c.startsWith('coord_') ? coordenadaComVirgula(vao?.[c]) ?? vao?.[c] : vao?.[c];
    const rotulo = c === 'qtd_espacadores' ? TIPOS_SERVICO[tipoServicoDe(servico)].rotuloHist : ROTULOS_VAO[c];
    return `${rotulo}: ${mostrar(antes)} → ${mostrar(campos[c])}`;
  });

// [campo, rótulo, mensagem quando apagam um valor que já existia]
const CAMPOS_SERVICO = [
  ['equip', 'Trafo', 'Informe o trafo.'],
  ['local', 'Localidade', 'Informe a localidade.'],
  ['numServ', 'NSMP', 'Informe o número da NSMP.'],
  ['nsmc', 'NSPR', 'Informe o número da NSPR.'],
  ['apropriacao', 'Apropriação', 'Informe o número da apropriação.'],
  ['data_lancamento_sf', 'Lançamento SF', 'Informe a data de lançamento no SalesForce.'],
  ['valor_nota', 'Valor da nota', 'Informe o valor da nota.'],
];

// Só os números que a etapa já alcançou podem ser corrigidos
export const camposCorrigiveis = (etapa) => [
  'equip', 'local',
  ...(['aguardando_nsmc', 'sf', 'pago'].includes(etapa) ? ['numServ'] : []),
  ...(['sf', 'pago'].includes(etapa) ? ['nsmc'] : []),
  ...(etapa === 'pago' ? ['apropriacao', 'data_lancamento_sf', 'valor_nota'] : []),
];

export const alteracoesServico = (servico, digitado) => {
  const campos = {};
  const mensagens = [];
  let erro = null;
  CAMPOS_SERVICO.forEach(([campo, rotulo, msgVazio]) => {
    if (!(campo in digitado)) return;
    const novo = String(digitado[campo] ?? '').trim();
    const salvo = String(servico?.[campo] ?? '').trim();
    if (campo === 'valor_nota') {
      // Compara pelo número: "1.234,50" digitado é igual a 1234.5 salvo
      const salvoNum = salvo === '' ? null : Number(salvo);
      if (!novo) {
        if (salvoNum !== null) erro = erro || msgVazio;
        return;
      }
      const valor = lerValorNota(novo);
      if (valor === null) { erro = erro || 'Informe um valor da nota válido.'; return; }
      if (salvoNum !== null && Math.round(salvoNum * 100) === Math.round(valor * 100)) return;
      campos.valor_nota = valor;
      mensagens.push(`${rotulo}: ${mostrar(formatarMoeda(salvoNum))} → ${formatarMoeda(valor)}`);
      return;
    }
    if (novo === salvo) return;
    if (!novo && salvo && msgVazio) { erro = erro || msgVazio; return; }
    if (campo === 'data_lancamento_sf' && novo && !dataDiaValida(novo)) { erro = erro || msgVazio; return; }
    campos[campo] = novo || null;
    const texto = campo === 'data_lancamento_sf' ? formatarDataDia : (v) => v;
    mensagens.push(`${rotulo}: ${mostrar(texto(salvo))} → ${mostrar(texto(novo))}`);
  });
  return { campos, mensagens, erro };
};

// null quando não mudou nada
export const montarPayloadCorrecao = (servico, mensagens, { user, agora }) => {
  if (!mensagens.length) return null;
  return { hist: [...(servico.hist || []), entradaHist(user, `Instalação corrigida: ${mensagens.join('; ')}`, agora)] };
};

export const filtrarPorBusca = (lista, termo) => {
  const t = normStr(termo).trim();
  if (!t) return lista;
  return lista.filter(s => [s.id, s.equip, s.local].some(v => normStr(v).includes(t)));
};

export const filtrarPorEtapa = (lista, etapa) =>
  (etapa === 'todas' ? lista : lista.filter(s => s.etapa_espacador === etapa));

export const contarPorEtapa = (lista) => {
  const contagem = Object.fromEntries(Object.keys(ETAPAS).map(e => [e, 0]));
  lista.forEach(s => { if (s.etapa_espacador in contagem) contagem[s.etapa_espacador]++; });
  return { ...contagem, todas: lista.length };
};

// Quem preenche a instalação (instalar) e quem aprova/informa NSMP e NSPR (fechar)
export const permissoesFluxo = (role) => ({
  instalar: role === 'dono' || role === 'despachante',
  fechar: role === 'dono' || role === 'fechamento',
  filtroInicial: role === 'fechamento' ? 'revisao' : 'instalacao',
});

export const validarArquivo = (file) => (file?.type?.startsWith('image/') ? null : 'Envie apenas imagens.');

export const caminhoArquivo = (servicoId, numero, tipo, nomeArquivo, sufixo) => {
  const m = /\.([a-z0-9]+)$/i.exec(nomeArquivo || '');
  const ext = m ? m[1].toLowerCase() : 'jpg';
  return `espacadores/${servicoId}/vao-${numero}/${tipo}-${sufixo}.${ext}`;
};

// ── Convivência com o fluxo antigo (app de celular / Gerar OS) ────────────────

// Gerar OS: só serviços sem número e fora do fluxo novo (a NSMP do fluxo novo é informada no Fechamento)
export const elegivelGerarOs = (s) => !s.etapa_espacador && !String(s.numServ || '').trim();

// Nova instalação não pode assumir um serviço já executado/aprovado ou com OS pelo fluxo antigo
export const bloqueioNovaInstalacao = (s) => {
  if (s.etapa_espacador) return null;
  const os = String(s.numServ || '').trim();
  if (os) return `Já tem OS ${os} pelo fluxo antigo — cadastre um serviço novo para este trafo.`;
  if (s.execucao || s.aprovacaoespacador) return 'Já foi executado pelo app de celular — cadastre um serviço novo para este trafo.';
  return null;
};

export const ativosNoFluxo = (lista) => lista.filter(s => s.status !== 'cancelado');

export const formatarData =(iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

// Planilha da etapa que está na tela: uma linha por serviço (= um vão)
export const linhasPlanilhaInstalacoes = (lista, vaosPorServico) => lista.map(s => {
  const vao = vaosPorServico[s.id]?.[0];
  return {
    'ID': s.id,
    'Localidade': s.local || '',
    'Trafo': s.equip || '',
    'Tipo de serviço': TIPOS_SERVICO[tipoServicoDe(s)].label,
    'Quantidade': vao?.qtd_espacadores ?? '',
    'Situação': ETAPAS[s.etapa_espacador]?.label || '',
    'Motivo da reprovação': s.motivo_reprovacao_fechamento || '',
    'NSMP': s.numServ || '',
    'NSPR': s.nsmc || '',
    'Equipe': vao?.equipe || '',
    'Desde': s.dt_etapa ? formatarData(s.dt_etapa) : '',
    'Apropriação': s.apropriacao || '',
    'Lançamento SF': formatarDataDia(s.data_lancamento_sf),
    'Valor da nota': s.valor_nota === null || s.valor_nota === undefined || s.valor_nota === '' ? '' : Number(s.valor_nota),
    'Coordenada do antes': coordenadaComVirgula(vao?.coord_antes) || vao?.coord_antes || '',
    'Coordenada do depois': coordenadaComVirgula(vao?.coord_depois) || vao?.coord_depois || '',
    'Foto do antes': vao?.fotos_antes?.[0] || '',
    'Foto do depois': vao?.fotos_depois?.[0] || '',
  };
});

// ── Painel ───────────────────────────────────────────────────────────────────

// Trafo = parte do equip antes do primeiro traço (mesma regra de Duplicidade/GerarServicos)
const trafoDoEquip = (equip) => {
  const raw = (equip || '').trim();
  return raw ? raw.split('-')[0].trim() : null;
};

// Poda de árvore fica fora da conta de espaçadores, mesmo no fluxo (etapa_espacador preenchida)
const contaComoEspacador = (s) => isEspacador(s) || (s.etapa_espacador && !isPoda(s));

// Cada serviço de espaçador é 1 vão. Cancelados e reprovados ficam fora da conta.
export const resumoEspacadoresPainel = (servicos) => {
  const esp = servicos.filter(contaComoEspacador);
  const aInstalar = esp.filter(s => !['cancelado', 'reprovado', 'concluido'].includes(s.status));
  const cadastrados = aInstalar.filter(s => s.status === 'cadastrado').length;
  const pendentes = aInstalar.filter(s => s.status === 'pendente').length;
  return {
    aInstalar: aInstalar.length,
    cadastrados,
    pendentes,
    outros: aInstalar.length - cadastrados - pendentes,
    concluidos: esp.filter(s => s.status === 'concluido').length,
    trafosAInstalar: new Set(aInstalar.map(s => trafoDoEquip(s.equip)).filter(Boolean)).size,
  };
};

// Mesmo resumo, separado por grupo (posto, localidade…). Grupos sem nenhum vão na conta ficam fora.
export const resumoEspacadoresPorGrupo = (servicos, chaveDe) => {
  const grupos = {};
  servicos.filter(contaComoEspacador).forEach(s => {
    const chave = chaveDe(s);
    (grupos[chave] = grupos[chave] || []).push(s);
  });
  return Object.entries(grupos)
    .map(([chave, lista]) => ({ chave, ...resumoEspacadoresPainel(lista) }))
    .filter(g => g.aInstalar + g.concluidos > 0);
};
