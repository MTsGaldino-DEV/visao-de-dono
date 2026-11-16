import { describe, it, expect } from 'vitest';
import { valorUSNaData, usParaReais, notaEmReais, formatarReais } from './valorUS';

describe('valorUSNaData', () => {
  it('usa a vigência da data de execução', () => {
    expect(valorUSNaData('2026-05-24')).toBe(2964.33);
    expect(valorUSNaData('2026-11-16')).toBe(2964.33);
    expect(valorUSNaData('2026-05-23')).toBe(2880.23);
    expect(valorUSNaData('2025-05-24')).toBe(2880.23);
    expect(valorUSNaData('2026-05-23T23:00:00.000Z')).toBe(2880.23);
    expect(valorUSNaData(new Date('2026-06-01T00:00:00Z'))).toBe(2964.33);
  });
  it('sem valor antes da primeira vigência ou sem data', () => {
    expect(valorUSNaData('2025-05-23')).toBeNull();
    for (const d of [null, undefined, '', 'abc']) expect(valorUSNaData(d)).toBeNull();
  });
});

describe('usParaReais', () => {
  it('multiplica pela US vigente e arredonda em centavos', () => {
    expect(usParaReais(1, '2026-06-01')).toBe(2964.33);
    expect(usParaReais(0.119, '2026-06-01')).toBe(352.76);
    expect(usParaReais(2, '2025-12-01')).toBe(5760.46);
    expect(usParaReais(1, '2025-01-01')).toBeNull();
    expect(usParaReais('x', '2026-06-01')).toBeNull();
  });
});

describe('notaEmReais', () => {
  it('converte o valor da nota pela US vigente na data de lançamento no SalesForce', () => {
    expect(notaEmReais({ valor_nota: '0.119', data_lancamento_sf: '2026-11-05' })).toBe(352.76);
    expect(notaEmReais({ valor_nota: 1, data_lancamento_sf: '2026-05-23' })).toBe(2880.23);
    expect(notaEmReais({ valor_nota: 1, data_lancamento_sf: '2025-01-01' })).toBeNull();
    expect(notaEmReais({ valor_nota: 1, data_lancamento_sf: null })).toBeNull();
    expect(notaEmReais({ valor_nota: null, data_lancamento_sf: '2026-11-05' })).toBeNull();
    expect(notaEmReais(undefined)).toBeNull();
  });
});

describe('formatarReais', () => {
  it('formata em reais e devolve vazio sem valor', () => {
    expect(formatarReais(2964.33).replace(/\s/g, ' ')).toBe('R$ 2.964,33');
    for (const v of [null, undefined, '', 'abc']) expect(formatarReais(v)).toBe('');
  });
});
