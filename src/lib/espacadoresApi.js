// Acesso ao Supabase do fluxo de instalação de espaçadores.
// As regras ficam em ./espacadores (puro, testado); aqui só I/O.
import { supabase, fetchAll } from './supabase';
import {
  isEspacador, normalizarTrafo, ordenarResultadosTrafo, proximoIdVD,
  entradaHist, formatarCoordenada, montarPayloadInicio, montarPayloadTransicao, montarPayloadExclusao, montarPayloadQuantidade,
  validarArquivo, caminhoArquivo,
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

export const iniciarInstalacao = async (servico, user, { criadoPelaInstalacao = false } = {}) => {
  const payload = montarPayloadInicio(servico, { user, agora: agora(), criadoPelaInstalacao });
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

// Tira o serviço do fluxo (só se ainda estiver em instalação no banco) e apaga o vão
export const excluirInstalacao = async (servico, user) => {
  const payload = montarPayloadExclusao(servico, { user, agora: agora() });
  const { data, error } = await supabase
    .from('servicos').update(payload)
    .eq('id', servico.id).eq('etapa_espacador', 'instalacao').neq('status', 'cancelado')
    .select();
  if (error) throw error;
  if (!data?.length) throw new Error('Este serviço mudou de etapa ou já foi excluído. Confira a lista atualizada.');
  const { error: erroVaos } = await supabase.from('vaos').delete().eq('servico_id', servico.id);
  if (erroVaos) throw erroVaos;
};

// Apaga o serviço do banco de vez (os vãos saem junto pelo ON DELETE CASCADE). Não tem volta.
export const apagarInstalacaoDefinitivo = async (servico) => {
  const { error } = await supabase.from('servicos').delete().eq('id', servico.id);
  if (error) throw error;
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

// Cria o vão único do serviço (numero = 1) ou atualiza o existente
export const salvarDadosVao = async (servicoId, vao, campos) => {
  const query = vao
    ? supabase.from('vaos').update(campos).eq('id', vao.id)
    : supabase.from('vaos').insert({ servico_id: servicoId, numero: 1, ...campos });
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
};

const enviarArquivo = async (vao, tipo, file, sufixo) => {
  const path = caminhoArquivo(vao.servico_id, vao.numero, tipo, file.name, sufixo);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
};

// Uma foto de cada: a nova substitui a anterior. Se o envio falhar, o banco não muda.
export const trocarFoto = async (vao, tipo, file) => {
  const erro = validarArquivo(file);
  if (erro) throw new Error(erro);
  const url = await enviarArquivo(vao, tipo, file, String(Date.now()));
  return salvarDadosVao(vao.servico_id, vao, { [tipo === 'antes' ? 'fotos_antes' : 'fotos_depois']: [url] });
};

export const corrigirQuantidade = async (servico, vao, qtd, user) => {
  const payload = montarPayloadQuantidade(servico, vao.qtd_espacadores, qtd, { user, agora: agora() });
  if (!payload) return;
  await salvarDadosVao(servico.id, vao, { qtd_espacadores: Number(qtd) });
  const { error } = await supabase.from('servicos').update(payload).eq('id', servico.id);
  if (error) throw error;
};

// Nova instalação: vincula (ou cria) o serviço, grava o vão com as fotos e envia para o fechamento.
// Se falhar depois do vínculo, o serviço fica em "Em instalação" para o despachante terminar.
export const registrarInstalacao = async ({ servico, novo, fotoAntes, fotoDepois, coordAntes, coordDepois, qtd, equipe }, user) => {
  const criadoPelaInstalacao = !servico;
  // Grava no formato que o Mapa lê, seja qual for o formato digitado
  const antes = formatarCoordenada(coordAntes);
  const depois = formatarCoordenada(coordDepois);
  if (!antes || !depois) throw new Error('Coordenada inválida.');
  const nomeEquipe = String(equipe ?? '').trim();
  if (!nomeEquipe) throw new Error('Informe a equipe.');
  const base = servico || await criarServicoEspacador({ ...novo, coord: antes }, user);
  const iniciado = await iniciarInstalacao(base, user, { criadoPelaInstalacao });
  try {
    // Uma exclusão que falhou no meio pode ter deixado um vão órfão para este serviço
    const { error: erroOrfao } = await supabase.from('vaos').delete().eq('servico_id', iniciado.id);
    if (erroOrfao) throw erroOrfao;
    let vao = await salvarDadosVao(iniciado.id, null, {
      coord_antes: antes, coord_depois: depois, qtd_espacadores: Number(qtd), equipe: nomeEquipe,
    });
    vao = await trocarFoto(vao, 'antes', fotoAntes);
    await trocarFoto(vao, 'depois', fotoDepois);
    await aplicarTransicao(iniciado, 'enviar', { user });
  } catch (e) {
    const erro = new Error(`A instalação foi salva incompleta em ${iniciado.id}. Abra-a em Em instalação para terminar. (${e.message})`);
    erro.servicoId = iniciado.id;
    throw erro;
  }
  return iniciado.id;
};

export const assinarMudancas = (canal, onChange) => {
  const ch = supabase.channel(canal)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vaos' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(ch);
};
