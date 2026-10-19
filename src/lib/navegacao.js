// Menu lateral por perfil de usuário

const DONO = ['dono'];
const ESCRITORIO = ['dono', 'despachante'];
const COM_FECHAMENTO = ['dono', 'despachante', 'fechamento'];

// Telas que mudaram de nome ou saíram: a salva no navegador abre na equivalente
const RENOMEADAS = { fechamento: 'instalacoes', placas: 'servicos' };

const GRUPOS = [
  { id: 'cadastro', label: 'Cadastro', itens: [
    { key: 'cadastrar', label: 'Cadastrar', perfis: DONO },
  ] },
  { id: 'despacho', label: 'Despacho', itens: [
    { key: 'servicos', label: 'Serviços', perfis: ESCRITORIO },
    { key: 'espacadores', label: 'Espaçadores', perfis: ESCRITORIO },
    { key: 'instalacoes', label: 'Instalações', perfis: COM_FECHAMENTO },
    { key: 'levantamentos', label: 'Levantamentos', perfis: ESCRITORIO },
  ] },
  { id: 'mapa', label: 'Mapa', itens: [
    { key: 'mapa', label: 'Mapa', perfis: ESCRITORIO },
  ] },
  { id: 'gestao', label: 'Gestão', itens: [
    { key: 'painel', label: 'Painel', perfis: DONO },
    { key: 'faturamento', label: 'Faturamento', perfis: DONO },
  ] },
  { id: 'admin', label: 'Admin', itens: [
    { key: 'gerar-os', label: 'Gerar OS', perfis: DONO },
    { key: 'duplicidade', label: 'Duplicidade', perfis: DONO },
    { key: 'usuarios', label: 'Usuários', perfis: DONO },
    { key: 'colaboradores', label: 'Colaboradores', perfis: ESCRITORIO },
    { key: 'logs', label: 'Logs', perfis: DONO },
  ] },
];

const podeVer = (item, role) => item.perfis.includes(role);

export const menuDoPerfil = (role) => GRUPOS
  .map(({ itens, ...grupo }) => ({
    ...grupo,
    itens: itens.filter(i => podeVer(i, role)).map(({ key, label }) => ({ key, label })),
  }))
  .filter(g => g.itens.length > 0);

// Mantém a tela salva se o perfil pode vê-la; senão, a primeira tela do perfil
export const telaInicial = (role, salva) => {
  const telas = menuDoPerfil(role).flatMap(g => g.itens.map(i => i.key));
  const atual = RENOMEADAS[salva] || salva;
  return telas.includes(atual) ? atual : telas[0];
};

// Converte a aba/sub-aba salvas pela navegação antiga (abas no topo)
export const telaSalvaLegada = ({ aba, subDespacho, subAdmin }) => {
  if (aba === 'despacho') return subDespacho || 'servicos';
  if (aba === 'admin') return subAdmin || 'gerar-os';
  return aba || '';
};

export const localizarTela = (key) => {
  for (const grupo of GRUPOS) {
    const item = grupo.itens.find(i => i.key === key);
    if (item) return { grupo, item };
  }
  return null;
};
