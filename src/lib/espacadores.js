// Regras do fluxo de instalação de espaçadores por vão.
// Módulo puro (sem Supabase) para poder ser testado com Vitest.

export const LIMITE_VINCULO_M = 100;

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

const NUMERO_COORD = /^[+-]?\d+(?:[.,]\d+)?$/;

// Separadores: ";", ", " (vírgula seguida de espaço) ou espaço. Sem nenhum deles, tenta "," simples.
// Depois troca a vírgula decimal por ponto em cada parte.
export const lerCoordenada = (texto) => {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  let partes = t.split(/\s*;\s*|\s*,\s+|\s+/);
  if (partes.length === 1) partes = t.split(',');
  if (partes.length !== 2 || !partes.every(p => NUMERO_COORD.test(p))) return null;
  const [lat, lng] = partes.map(p => Number(p.replace(',', '.')));
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

// Formato gravado no banco, o mesmo que o Mapa lê ("lat lng" com ponto decimal)
export const formatarCoordenada = (texto) => {
  const c = lerCoordenada(texto);
  return c ? `${c.lat.toFixed(6)} ${c.lng.toFixed(6)}` : null;
};

export const distanciaMetros = (a, b) => {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

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

// O que falta para o despachante enviar a instalação (o croqui é do fechamento)
export const pendenciasInstalacao = (vao) => {
  const faltando = [];
  if (!vao?.fotos_antes?.length) faltando.push('foto de antes');
  if (!lerCoordenada(vao?.coord_antes)) faltando.push('coordenada do antes');
  if (!vao?.fotos_depois?.length) faltando.push('foto de depois');
  if (!lerCoordenada(vao?.coord_depois)) faltando.push('coordenada do depois');
  if (!qtdValida(vao?.qtd_espacadores)) faltando.push('quantidade');
  return faltando;
};

// Compara o que está digitado na tela com o vão salvo: campos = o que gravar (já normalizado);
// invalido = há um valor digitado que não pode ser gravado. Enviar e aprovar esperam pendente = false.
export const alteracoesPendentes = (vao, { coordAntes, coordDepois, qtd }) => {
  const campos = {};
  let invalido = false;
  [['coord_antes', coordAntes], ['coord_depois', coordDepois]].forEach(([campo, digitado]) => {
    const texto = String(digitado ?? '').trim();
    const salvo = vao?.[campo] || '';
    if (!texto && !salvo) return;
    const novo = formatarCoordenada(texto);
    if (!novo) { invalido = true; return; }
    if (novo !== (formatarCoordenada(salvo) ?? salvo)) campos[campo] = novo;
  });
  const qtdSalva = vao?.qtd_espacadores ?? null;
  if (String(qtd ?? '').trim() !== '' || qtdSalva !== null) {
    const nova = qtdValida(qtd);
    if (nova === null) invalido = true;
    else if (nova !== qtdSalva) campos.qtd_espacadores = nova;
  }
  return { campos, pendente: invalido || Object.keys(campos).length > 0, invalido };
};

export const podeEnviarInstalacao = (vao) => pendenciasInstalacao(vao).length === 0;

export const podeAprovar = (vao) => !!vao?.croqui_url;

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
    hist: [...(servico.hist || []), entradaHist(user, 'Instalação de espaçadores excluída', agora)],
  };
};

// Correção feita pelo fechamento na revisão; null quando não mudou nada
export const montarPayloadQuantidade = (servico, de, para, { user, agora }) => {
  const nova = qtdValida(para);
  if (nova === null) throw new Error('Informe uma quantidade inteira maior que zero.');
  if (nova === de) return null;
  return {
    hist: [...(servico.hist || []), entradaHist(user, `Quantidade de espaçadores corrigida de ${de} para ${nova}`, agora)],
  };
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

// Quem preenche a instalação (instalar) e quem aprova/informa NSMP e NSMC (fechar)
export const permissoesFluxo = (role) => ({
  instalar: role === 'dono' || role === 'despachante',
  fechar: role === 'dono' || role === 'fechamento',
  filtroInicial: role === 'fechamento' ? 'revisao' : 'instalacao',
});

export const validarArquivo =(tipo, file) => {
  if (tipo === 'croqui') return file?.type === 'application/pdf' ? null : 'O croqui precisa ser um arquivo PDF.';
  return file?.type?.startsWith('image/') ? null : 'Envie apenas imagens.';
};

export const caminhoArquivo = (servicoId, numero, tipo, nomeArquivo, sufixo) => {
  const m = /\.([a-z0-9]+)$/i.exec(nomeArquivo || '');
  const ext = tipo === 'croqui' ? 'pdf' : (m ? m[1].toLowerCase() : 'jpg');
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

// ── Painel ───────────────────────────────────────────────────────────────────

// Trafo = parte do equip antes do primeiro traço (mesma regra de Duplicidade/GerarServicos)
const trafoDoEquip = (equip) => {
  const raw = (equip || '').trim();
  return raw ? raw.split('-')[0].trim() : null;
};

// Cada serviço de espaçador é 1 vão. Cancelados e reprovados ficam fora da conta.
export const resumoEspacadoresPainel = (servicos) => {
  const esp = servicos.filter(s => isEspacador(s) || s.etapa_espacador);
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
  servicos.filter(s => isEspacador(s) || s.etapa_espacador).forEach(s => {
    const chave = chaveDe(s);
    (grupos[chave] = grupos[chave] || []).push(s);
  });
  return Object.entries(grupos)
    .map(([chave, lista]) => ({ chave, ...resumoEspacadoresPainel(lista) }))
    .filter(g => g.aInstalar + g.concluidos > 0);
};
