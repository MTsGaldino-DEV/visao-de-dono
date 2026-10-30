import { describe, it, expect } from 'vitest';
import {
  lerCoordenada, validarCoordenada, formatarCoordenada, distanciaMetros, MENSAGEM_COORDENADA,
  validarCoordenadaVao, coordenadaComVirgula,
} from './coordenadas';

describe('lerCoordenada', () => {
  const ok = { lat: -18.85, lng: -41.95 };
  it.each([
    '-18.85 -41.95', '-18.85, -41.95', '-18.85,-41.95', '-18.85;-41.95',
    '-18,85 -41,95', '-18,85; -41,95', '-18,85, -41,95', '-18,85,-41,95', ' -18,85 , -41,95 ',
  ])('lê %s', (t) => {
    const c = lerCoordenada(t);
    expect(c.lat).toBeCloseTo(ok.lat, 6);
    expect(c.lng).toBeCloseTo(ok.lng, 6);
  });
  it.each(['', null, undefined, 'abc', '-18.8', '-95 -41', '-18 -200', '-18.8 -41.9 3', '-18,85,-41', '-18.85,', '; -41.95'])('recusa %s', (t) => {
    expect(lerCoordenada(t)).toBeNull();
  });
});

describe('validarCoordenada', () => {
  it('aceita coordenada no Brasil', () => {
    expect(validarCoordenada('-18,85 -41,95')).toEqual({ ok: true, lat: -18.85, lng: -41.95 });
  });
  it('separa vazia, ilegível e fora do Brasil', () => {
    expect(validarCoordenada('  ')).toEqual({ ok: false, motivo: 'vazia' });
    expect(validarCoordenada('abc')).toEqual({ ok: false, motivo: 'formato' });
    // latitude sem o sinal de menos cai no Atlântico Norte
    expect(validarCoordenada('18.85 -41.95')).toEqual({ ok: false, motivo: 'fora_brasil' });
    expect(validarCoordenada('0 0')).toEqual({ ok: false, motivo: 'fora_brasil' });
    // latitude e longitude trocadas
    expect(validarCoordenada('-41.95 -18.85')).toEqual({ ok: false, motivo: 'fora_brasil' });
  });
  it('tem mensagem para cada motivo de erro', () => {
    expect(MENSAGEM_COORDENADA.formato).toBeTruthy();
    expect(MENSAGEM_COORDENADA.fora_brasil).toBeTruthy();
  });
});

describe('formatarCoordenada', () => {
  it('grava "lat lng" com ponto e 6 casas', () => {
    expect(formatarCoordenada('-18,85,-41,95')).toBe('-18.850000 -41.950000');
    expect(formatarCoordenada(' -18.8440401, -41.95 ')).toBe('-18.844040 -41.950000');
    expect(formatarCoordenada('xx')).toBeNull();
  });
});

describe('validarCoordenadaVao', () => {
  it.each(['-18,844040 -41,957216', ' -18,84   -41,95 ', '-18 -41'])('aceita %s', (t) => {
    expect(validarCoordenadaVao(t).ok).toBe(true);
  });
  it.each(['-18.85 -41.95', '-18.85, -41.95', '-18,85;-41,95', '-18,85, -41,95', '-18,85,-41,95', '-18,85 -41,95 3'])(
    'exige vírgula nos decimais e espaço entre latitude e longitude: %s', (t) => {
      expect(validarCoordenadaVao(t)).toEqual({ ok: false, motivo: 'virgula' });
    });
  it('vazia e fora do Brasil seguem a regra geral', () => {
    expect(validarCoordenadaVao('  ')).toEqual({ ok: false, motivo: 'vazia' });
    expect(validarCoordenadaVao('18,85 -41,95')).toEqual({ ok: false, motivo: 'fora_brasil' });
    expect(MENSAGEM_COORDENADA.virgula).toMatch(/-18,844040 -41,957216/);
  });
  it('formata qualquer coordenada legível no padrão do vão', () => {
    expect(coordenadaComVirgula('-18.844040 -41.957216')).toBe('-18,844040 -41,957216');
    expect(coordenadaComVirgula('-18,84 -41,9')).toBe('-18,840000 -41,900000');
    expect(coordenadaComVirgula('lixo')).toBeNull();
  });
});

describe('distanciaMetros', () => {
  it('calcula em metros', () => {
    expect(distanciaMetros({ lat: -18.844, lng: -41.957 }, { lat: -18.845, lng: -41.957 })).toBeCloseTo(111.2, 0);
  });
});
