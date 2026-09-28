// Regras de usuários administrativos × colaboradores de campo.
// Módulo puro (sem Supabase) para poder ser testado com Vitest.

export const PAPEIS_ADMIN = ['dono', 'despachante', 'fechamento'];
export const FUNCOES = ['Eletricista', 'Encarregado', 'Motorista', 'Ajudante'];
export const MSG_COLABORADOR_WEB = 'Colaboradores acessam pelo app de celular.';

// 'tecnico' e 'levantador' ainda existem até a migração separar_colaboradores rodar
const PAPEIS_CAMPO = ['colaborador', 'tecnico', 'levantador'];

export const ehColaborador = (u) => PAPEIS_CAMPO.includes(u?.role);
export const ehAdministrativo = (u) => PAPEIS_ADMIN.includes(u?.role);

export const podeDespachar = (u) =>
  !!u?.ativo && (u.role === 'tecnico' || (u.role === 'colaborador' && !!u.faz_execucao));

export const somenteDigitos = (s) => String(s || '').replace(/\D/g, '');

export const validarCpf = (cpf) => {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(d.slice(0, 9)) === Number(d[9]) && dv(d.slice(0, 10)) === Number(d[10]);
};

export const formatarCpf = (s) => somenteDigitos(s).slice(0, 11)
  .replace(/(\d{3})(\d)/, '$1.$2')
  .replace(/(\d{3})(\d)/, '$1.$2')
  .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

export const formatarTelefone = (s) => {
  const d = somenteDigitos(s).slice(0, 11);
  if (d.length <= 2) return d;
  const ddd = `(${d.slice(0, 2)}) `;
  const resto = d.slice(2);
  const corte = d.length === 11 ? 5 : 4;
  return resto.length > corte ? `${ddd}${resto.slice(0, corte)}-${resto.slice(corte)}` : `${ddd}${resto}`;
};

export const validarColaborador = (dados, { novo }) => {
  const erros = {};
  if (!String(dados.nome || '').trim()) erros.nome = 'Informe o nome.';
  if (novo && !String(dados.matricula || '').trim()) erros.matricula = 'Informe a matrícula.';
  if (novo && String(dados.senha || '').length < 6) erros.senha = 'A senha deve ter no mínimo 6 caracteres.';
  if (!dados.faz_execucao && !dados.faz_levantamento) erros.tipos = 'Marque pelo menos um: Execução ou Levantamento.';
  if (somenteDigitos(dados.cpf) && !validarCpf(dados.cpf)) erros.cpf = 'CPF inválido.';
  const tel = somenteDigitos(dados.telefone);
  if (tel && tel.length !== 10 && tel.length !== 11) erros.telefone = 'Telefone inválido (DDD + número).';
  return erros;
};

const textoOuNulo = (s) => String(s || '').trim() || null;

export const payloadColaborador = (dados) => ({
  nome: String(dados.nome || '').trim(),
  funcao: textoOuNulo(dados.funcao),
  cpf: somenteDigitos(dados.cpf) || null,
  telefone: somenteDigitos(dados.telefone) || null,
  faz_execucao: !!dados.faz_execucao,
  faz_levantamento: !!dados.faz_levantamento,
  equipe: textoOuNulo(dados.equipe),
});
