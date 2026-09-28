import { describe, it, expect } from 'vitest';
import {
  ehColaborador, ehAdministrativo, podeDespachar, somenteDigitos, validarCpf, formatarCpf,
  formatarTelefone, validarColaborador, payloadColaborador,
} from './colaboradores';

describe('papéis', () => {
  it('separa administrativo de campo (aceitando os papéis antigos na transição)', () => {
    expect(['dono', 'despachante', 'fechamento'].every(role => ehAdministrativo({ role }))).toBe(true);
    expect(['colaborador', 'tecnico', 'levantador'].every(role => ehColaborador({ role }))).toBe(true);
    expect(ehColaborador({ role: 'dono' })).toBe(false);
    expect(ehColaborador(null)).toBe(false);
  });
  it('despacha só para ativos que executam serviço', () => {
    expect(podeDespachar({ role: 'colaborador', ativo: true, faz_execucao: true })).toBe(true);
    expect(podeDespachar({ role: 'colaborador', ativo: true, faz_execucao: false, faz_levantamento: true })).toBe(false);
    expect(podeDespachar({ role: 'colaborador', ativo: false, faz_execucao: true })).toBe(false);
    expect(podeDespachar({ role: 'tecnico', ativo: true })).toBe(true);
    expect(podeDespachar({ role: 'despachante', ativo: true, faz_execucao: true })).toBe(false);
  });
});

describe('CPF e telefone', () => {
  it('valida os dígitos verificadores', () => {
    expect(validarCpf('529.982.247-25')).toBe(true);
    expect(validarCpf(' 52998224725 ')).toBe(true);
    expect(validarCpf('529.982.247-24')).toBe(false);
    expect(validarCpf('111.111.111-11')).toBe(false);
    expect(validarCpf('123')).toBe(false);
  });
  it('formata progressivamente enquanto digita', () => {
    expect(formatarCpf('5299')).toBe('529.9');
    expect(formatarCpf('529982247')).toBe('529.982.247');
    expect(formatarCpf('52998224725999')).toBe('529.982.247-25');
    expect(formatarTelefone('33999998888')).toBe('(33) 99999-8888');
    expect(formatarTelefone('3332221111')).toBe('(33) 3222-1111');
    expect(formatarTelefone('339')).toBe('(33) 9');
    expect(formatarTelefone('')).toBe('');
    expect(somenteDigitos('(33) 9-8')).toBe('3398');
  });
});

describe('validarColaborador', () => {
  const ok = { nome: 'João', matricula: '1234', senha: '123456', faz_execucao: true };
  it('aceita um cadastro completo', () => {
    expect(validarColaborador(ok, { novo: true })).toEqual({});
  });
  it('exige nome, matrícula e senha no cadastro novo', () => {
    expect(Object.keys(validarColaborador({ faz_execucao: true }, { novo: true }))).toEqual(['nome', 'matricula', 'senha']);
    expect(validarColaborador({ ...ok, senha: '123' }, { novo: true }).senha).toMatch(/6/);
  });
  it('na edição não exige senha', () => {
    expect(validarColaborador({ nome: 'João', faz_levantamento: true }, { novo: false })).toEqual({});
  });
  it('exige pelo menos um tipo e valida CPF e telefone informados', () => {
    const e = validarColaborador({ ...ok, faz_execucao: false, cpf: '111.111.111-11', telefone: '339' }, { novo: true });
    expect(e.tipos).toMatch(/pelo menos um/);
    expect(e.cpf).toMatch(/CPF/);
    expect(e.telefone).toMatch(/Telefone/);
  });
});

describe('payloadColaborador', () => {
  it('normaliza texto e guarda CPF/telefone só com dígitos', () => {
    expect(payloadColaborador({
      nome: '  João  ', funcao: ' Eletricista ', cpf: '529.982.247-25', telefone: '(33) 99999-8888',
      faz_execucao: 1, faz_levantamento: undefined, equipe: '  ',
    })).toEqual({
      nome: 'João', funcao: 'Eletricista', cpf: '52998224725', telefone: '33999998888',
      faz_execucao: true, faz_levantamento: false, equipe: null,
    });
  });
});
