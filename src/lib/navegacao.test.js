import { describe, it, expect } from 'vitest';
import { menuDoPerfil, telaInicial, telaSalvaLegada, localizarTela } from './navegacao';

const estrutura = (role) => menuDoPerfil(role).map(g => [g.id, g.itens.map(i => i.key)]);

describe('menuDoPerfil', () => {
  it('fechamento vê só Instalações', () => {
    expect(estrutura('fechamento')).toEqual([['despacho', ['instalacoes']]]);
  });
  it('dono vê tudo, com Usuários e Colaboradores no Admin', () => {
    expect(estrutura('dono')).toEqual([
      ['cadastro', ['cadastrar']],
      ['despacho', ['servicos', 'espacadores', 'instalacoes', 'levantamentos', 'mapa']],
      ['gestao', ['painel', 'faturamento']],
      ['admin', ['gerar-os', 'duplicidade', 'usuarios', 'colaboradores', 'logs']],
    ]);
  });
  it('despachante vê Despacho (com o Mapa) e Colaboradores', () => {
    expect(estrutura('despachante')).toEqual([
      ['despacho', ['servicos', 'espacadores', 'instalacoes', 'levantamentos', 'mapa']],
      ['admin', ['colaboradores']],
    ]);
  });
  it('o Mapa fica no grupo Despacho e a tela salva continua abrindo', () => {
    expect(localizarTela('mapa')).toMatchObject({ grupo: { label: 'Despacho' }, item: { label: 'Mapa' } });
    expect(telaInicial('despachante', 'mapa')).toBe('mapa');
  });
  it('colaborador e perfis desconhecidos não veem nada no web', () => {
    expect(estrutura('colaborador')).toEqual([]);
    expect(estrutura('tecnico')).toEqual([]);
    expect(estrutura(undefined)).toEqual([]);
  });
});

describe('telaInicial', () => {
  it('mantém a tela salva quando ela é permitida', () => {
    expect(telaInicial('dono', 'painel')).toBe('painel');
    expect(telaInicial('despachante', 'espacadores')).toBe('espacadores');
  });
  it('troca tela salva não permitida pela primeira do perfil', () => {
    expect(telaInicial('fechamento', 'servicos')).toBe('instalacoes');
    expect(telaInicial('despachante', 'painel')).toBe('servicos');
    expect(telaInicial('dono', '')).toBe('cadastrar');
  });
  it('a antiga tela Fechamento abre em Instalações', () => {
    expect(telaInicial('dono', 'fechamento')).toBe('instalacoes');
    expect(telaInicial('fechamento', 'fechamento')).toBe('instalacoes');
  });
  it('a antiga tela Placas, que saiu do sistema, abre em Serviços', () => {
    expect(telaInicial('dono', 'placas')).toBe('servicos');
    expect(telaInicial('despachante', 'placas')).toBe('servicos');
  });
});

describe('telaSalvaLegada', () => {
  it('converte aba + sub-aba antigas na tela equivalente', () => {
    expect(telaSalvaLegada({ aba: 'despacho', subDespacho: 'espacadores' })).toBe('espacadores');
    expect(telaSalvaLegada({ aba: 'despacho' })).toBe('servicos');
    expect(telaSalvaLegada({ aba: 'admin', subAdmin: 'logs' })).toBe('logs');
    expect(telaSalvaLegada({ aba: 'admin' })).toBe('gerar-os');
    expect(telaSalvaLegada({ aba: 'painel' })).toBe('painel');
    expect(telaSalvaLegada({})).toBe('');
  });
});

describe('localizarTela', () => {
  it('devolve grupo e item para o título da página', () => {
    expect(localizarTela('espacadores')).toMatchObject({ grupo: { label: 'Despacho' }, item: { label: 'Espaçadores' } });
    expect(localizarTela('inexistente')).toBeNull();
  });
});
