import { describe, it, expect } from 'vitest';
import { abasDoPerfil, abaInicial } from './navegacao';

const keys = (role) => abasDoPerfil(role).map(a => a.key);

describe('abasDoPerfil', () => {
  it('fechamento vê só Fechamento', () => {
    expect(keys('fechamento')).toEqual(['fechamento']);
  });
  it('dono vê tudo, incluindo Fechamento', () => {
    expect(keys('dono')).toEqual(['cadastrar', 'despacho', 'mapa', 'painel', 'faturamento', 'fechamento', 'admin']);
  });
  it('despachante mantém Despacho e Mapa', () => {
    expect(keys('despachante')).toEqual(['despacho', 'mapa']);
  });
});

describe('abaInicial', () => {
  it('mantém a aba salva quando ela é permitida', () => {
    expect(abaInicial('dono', 'painel')).toBe('painel');
  });
  it('troca aba salva não permitida pela primeira do perfil', () => {
    expect(abaInicial('fechamento', 'despacho')).toBe('fechamento');
    expect(abaInicial('despachante', 'fechamento')).toBe('despacho');
    expect(abaInicial('dono', '')).toBe('cadastrar');
  });
});
