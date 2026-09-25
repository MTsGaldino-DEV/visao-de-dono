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
