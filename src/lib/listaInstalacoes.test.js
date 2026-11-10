import { describe, it, expect } from 'vitest';
import {
  selecaoDoMenu,
  VAZIO, COLUNAS_INSTALACOES, colunasVisiveis, valorColuna, filtrarPorColunas, valoresDaColuna, ordenarPorColuna,
} from './listaInstalacoes';

const ids = (cols) => cols.map(c => c.id);

const serv = (id, extra = {}) => ({ id, etapa_espacador: 'instalacao', ...extra });

describe('colunasVisiveis', () => {
  it('mantém todas as colunas na ordem definida em todas as etapas finais', () => {
    expect(ids(colunasVisiveis('todas'))).toEqual(ids(COLUNAS_INSTALACOES));
  });

  it('esconde NSMP, NSPR, Apropriação e dados do SalesForce em instalação e revisão', () => {
    for (const etapa of ['instalacao', 'revisao']) {
      expect(ids(colunasVisiveis(etapa))).toEqual(['id', 'local', 'equip', 'servico', 'qtd', 'situacao', 'tipo_equipe', 'equipe', 'desde']);
    }
  });

  it('mostra NSMP e NSPR, mas não Apropriação nem SalesForce, em aguardando NSPR e em SF', () => {
    for (const etapa of ['aguardando_nsmc', 'sf']) {
      expect(ids(colunasVisiveis(etapa))).toEqual(['id', 'local', 'equip', 'servico', 'qtd', 'situacao', 'nsmp', 'nspr', 'tipo_equipe', 'equipe', 'desde']);
    }
  });

  it('Apropriação, Lançamento SF e Valor da nota só aparecem em apropriação, pago e em todas', () => {
    for (const etapa of ['apropriacao', 'pago', 'todas']) {
      expect(ids(colunasVisiveis(etapa))).toEqual(
        ['id', 'local', 'equip', 'servico', 'qtd', 'situacao', 'nsmp', 'nspr', 'valor_nota', 'tipo_equipe', 'equipe', 'desde', 'apropriacao', 'lancamento_sf'],
      );
    }
    for (const etapa of ['instalacao', 'revisao', 'aguardando_nsmp', 'aguardando_nsmc', 'sf']) {
      expect(ids(colunasVisiveis(etapa))).not.toContain('valor_nota');
      expect(ids(colunasVisiveis(etapa))).not.toContain('apropriacao');
    }
  });

  it('esconde NSMP e NSPR em aguardando NSMP e mostra tudo em apropriação e pago', () => {
    expect(ids(colunasVisiveis('apropriacao'))).toEqual(ids(COLUNAS_INSTALACOES));
    expect(ids(colunasVisiveis('aguardando_nsmp'))).not.toContain('nsmp');
    expect(ids(colunasVisiveis('pago'))).toEqual(ids(COLUNAS_INSTALACOES));
  });
});

describe('valorColuna', () => {
  it('devolve Reprovado só em instalação com motivo de reprovação', () => {
    const s = serv('A', { motivo_reprovacao_fechamento: 'Foto ruim' });
    expect(valorColuna('situacao', s)).toBe('Reprovado');
    expect(valorColuna('situacao', { ...s, etapa_espacador: 'revisao' })).toBe('Em revisão');
  });

  it('devolve o rótulo da etapa e vazio quando a etapa é desconhecida', () => {
    expect(valorColuna('situacao', serv('A', { etapa_espacador: 'pago' }))).toBe('Pago');
    expect(valorColuna('situacao', serv('A', { etapa_espacador: 'x' }))).toBe('');
  });

  it('coluna Serviço devolve o tipo: poda ou espaçador (padrão para descrição desconhecida)', () => {
    expect(valorColuna('servico', serv('A', { desc: 'Poda de árvore' }))).toBe('Poda de árvore');
    expect(valorColuna('servico', serv('B', { desc: 'Instalação de espaçador' }))).toBe('Espaçador');
    expect(valorColuna('servico', serv('C', { desc: 'Outra coisa' }))).toBe('Espaçador');
    expect(valorColuna('servico', serv('D'))).toBe('Espaçador');
  });

  it('rótulos novos: Serviço logo depois de Trafo e Quantidade no lugar de Espaçadores', () => {
    const cols = Object.fromEntries(COLUNAS_INSTALACOES.map(c => [c.id, c]));
    expect(cols.servico.rotulo).toBe('Serviço');
    expect(cols.qtd).toMatchObject({ rotulo: 'Quantidade', numero: true });
    expect(ids(COLUNAS_INSTALACOES).slice(0, 5)).toEqual(['id', 'local', 'equip', 'servico', 'qtd']);
  });

  it('coluna Tipo de equipe mostra o rótulo em maiúsculas e fica vazia em vão antigo', () => {
    const s = serv('A');
    expect(valorColuna('tipo_equipe', s, { tipo_equipe: 'umpla' })).toBe('UMPLA');
    expect(valorColuna('tipo_equipe', s, { tipo_equipe: 'dupla' })).toBe('DUPLA');
    expect(valorColuna('tipo_equipe', s, { tipo_equipe: 'moto' })).toBe('MOTO');
    expect(valorColuna('tipo_equipe', s, { tipo_equipe: null })).toBe('');
    expect(valorColuna('tipo_equipe', s, undefined)).toBe('');
    // ordem pedida: NSPR, Valor, Tipo eq., Equipe
    expect(ids(COLUNAS_INSTALACOES).slice(ids(COLUNAS_INSTALACOES).indexOf('nspr'), ids(COLUNAS_INSTALACOES).indexOf('equipe') + 1))
      .toEqual(['nspr', 'valor_nota', 'tipo_equipe', 'equipe']);
  });

  it('filtra e ordena pela coluna Tipo de equipe, com vazios no fim', () => {
    const lista = [serv('1'), serv('2'), serv('3'), serv('4')];
    const vaos = { 1: [{ tipo_equipe: 'moto' }], 2: [{ tipo_equipe: 'dupla' }], 3: [{ equipe: 'x' }], 4: [{ tipo_equipe: 'moto' }] };
    expect(filtrarPorColunas(lista, { tipo_equipe: ['MOTO'] }, vaos).map(s => s.id)).toEqual(['1', '4']);
    expect(filtrarPorColunas(lista, { tipo_equipe: [VAZIO] }, vaos).map(s => s.id)).toEqual(['3']);
    expect(ordenarPorColuna(lista, { coluna: 'tipo_equipe', dir: 'asc' }, vaos).map(s => s.id)).toEqual(['2', '1', '4', '3']);
    expect(valoresDaColuna(lista, 'tipo_equipe', vaos).map(v => v.valor)).toEqual(['DUPLA', 'MOTO', VAZIO]);
  });

  it('usa só o dia na coluna Desde', () => {
    const s = serv('A', { dt_etapa: '2026-03-05T12:30:00' });
    expect(valorColuna('desde', s)).toBe('05/03/2026');
    expect(valorColuna('desde', serv('B'))).toBe('');
  });

  it('lê campos do serviço e do vão', () => {
    const s = serv(' X1 ', { local: 'Centro', equip: 'T-9', numServ: 10, nsmc: 'N2', apropriacao: 'AP' });
    const vao = { qtd_espacadores: 4, equipe: 'Equipe 1' };
    expect(valorColuna('id', s, vao)).toBe('X1');
    expect(valorColuna('local', s, vao)).toBe('Centro');
    expect(valorColuna('equip', s, vao)).toBe('T-9');
    expect(valorColuna('qtd', s, vao)).toBe('4');
    expect(valorColuna('nsmp', s, vao)).toBe('10');
    expect(valorColuna('nspr', s, vao)).toBe('N2');
    expect(valorColuna('equipe', s, vao)).toBe('Equipe 1');
    expect(valorColuna('apropriacao', s, vao)).toBe('AP');
    expect(valorColuna('qtd', s, undefined)).toBe('');
  });

  it('Lançamento SF em DD/MM/AAAA sem desvio de fuso e Valor da nota em reais', () => {
    const s = serv('A', { data_lancamento_sf: '2026-11-05', valor_nota: '1234.50' });
    expect(valorColuna('lancamento_sf', s)).toBe('05/11/2026');
    expect(valorColuna('valor_nota', s).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
    expect(valorColuna('lancamento_sf', serv('B'))).toBe('');
    expect(valorColuna('valor_nota', serv('B', { valor_nota: null }))).toBe('');
  });
});

describe('filtrarPorColunas', () => {
  const lista = [
    serv('1', { local: 'Norte' }),
    serv('2', { local: 'Sul' }),
    serv('3', { local: '', equip: 'T1' }),
  ];
  const vaos = { 1: [{ equipe: 'A' }], 2: [{ equipe: 'B' }], 3: [{ equipe: 'A' }] };

  it('sem filtros devolve a mesma lista', () => {
    expect(filtrarPorColunas(lista, {}, vaos)).toBe(lista);
  });

  it('filtra pelos valores marcados e aceita VAZIO', () => {
    expect(filtrarPorColunas(lista, { local: ['Norte'] }, vaos).map(s => s.id)).toEqual(['1']);
    expect(filtrarPorColunas(lista, { local: [VAZIO] }, vaos).map(s => s.id)).toEqual(['3']);
    expect(filtrarPorColunas(lista, { local: [VAZIO, 'Sul'] }, vaos).map(s => s.id)).toEqual(['2', '3']);
  });

  it('combina colunas com E', () => {
    expect(filtrarPorColunas(lista, { equipe: ['A'], local: ['Norte'] }, vaos).map(s => s.id)).toEqual(['1']);
  });

  it('ignora a coluna indicada em ignorar', () => {
    const r = filtrarPorColunas(lista, { equipe: ['A'], local: ['Sul'] }, vaos, { ignorar: 'local' });
    expect(r.map(s => s.id)).toEqual(['1', '3']);
  });

  it('ignora filtro de coluna que não está visível', () => {
    const r = filtrarPorColunas(lista, { equipe: ['B'], local: ['Norte'] }, vaos, { visiveis: ['local'] });
    expect(r.map(s => s.id)).toEqual(['1']);
  });

  it('não muta a lista', () => {
    const copia = [...lista];
    filtrarPorColunas(lista, { local: ['Sul'] }, vaos);
    expect(lista).toEqual(copia);
  });
});

describe('valoresDaColuna', () => {
  it('conta valores distintos, ordena e põe VAZIO por último', () => {
    const lista = [serv('1', { local: 'Sul' }), serv('2', { local: '' }), serv('3', { local: 'Norte' }), serv('4', { local: 'Sul' })];
    expect(valoresDaColuna(lista, 'local', {})).toEqual([
      { valor: 'Norte', n: 1 },
      { valor: 'Sul', n: 2 },
      { valor: VAZIO, n: 1 },
    ]);
  });

  it('ordena datas em ordem cronológica, não alfabética', () => {
    const lista = [
      serv('1', { dt_etapa: '2026-12-01T10:00:00' }),
      serv('2', { dt_etapa: '2027-01-15T10:00:00' }),
      serv('3', { dt_etapa: '2026-02-20T10:00:00' }),
      serv('4', { dt_etapa: '2026-12-01T15:00:00' }),
    ];
    expect(valoresDaColuna(lista, 'desde', {})).toEqual([
      { valor: '20/02/2026', n: 1 },
      { valor: '01/12/2026', n: 2 },
      { valor: '15/01/2027', n: 1 },
    ]);
  });

  it('ordena Lançamento SF em ordem cronológica e Valor da nota pelo número', () => {
    const lista = [
      serv('1', { data_lancamento_sf: '2026-12-01', valor_nota: 1000 }),
      serv('2', { data_lancamento_sf: '2027-01-15', valor_nota: 99.9 }),
      serv('3', { data_lancamento_sf: '2026-02-20', valor_nota: 12000.5 }),
      serv('4'),
    ];
    expect(valoresDaColuna(lista, 'lancamento_sf', {}).map(v => v.valor)).toEqual(['20/02/2026', '01/12/2026', '15/01/2027', VAZIO]);
    expect(valoresDaColuna(lista, 'valor_nota', {}).map(v => v.n)).toEqual([1, 1, 1, 1]);
    expect(valoresDaColuna(lista, 'valor_nota', {}).map(v => v.valor.replace(/\s/g, ' ')))
      .toEqual(['R$ 99,90', 'R$ 1.000,00', 'R$ 12.000,50', VAZIO]);
  });

  it('ordena quantidades como números', () => {
    const lista = [serv('1'), serv('2'), serv('3')];
    const vaos = { 1: [{ qtd_espacadores: 10 }], 2: [{ qtd_espacadores: 2 }], 3: [{}] };
    expect(valoresDaColuna(lista, 'qtd', vaos).map(v => v.valor)).toEqual(['2', '10', VAZIO]);
  });
});

describe('ordenarPorColuna', () => {
  const lista = [serv('a'), serv('b'), serv('c'), serv('d')];
  const vaos = { a: [{ qtd_espacadores: 10 }], b: [{ qtd_espacadores: 2 }], c: [{}], d: [{ qtd_espacadores: 2 }] };

  it('ordena números como números (2 antes de 10) e preserva empates', () => {
    const r = ordenarPorColuna(lista, { coluna: 'qtd', dir: 'asc' }, vaos);
    expect(r.map(s => s.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('mantém vazios no fim também em ordem decrescente', () => {
    const r = ordenarPorColuna(lista, { coluna: 'qtd', dir: 'desc' }, vaos);
    expect(r.map(s => s.id)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('não muta a entrada', () => {
    const entrada = [...lista];
    const r = ordenarPorColuna(lista, { coluna: 'qtd', dir: 'asc' }, vaos);
    expect(lista).toEqual(entrada);
    expect(r).not.toBe(lista);
  });

  it('ordena texto com números embutidos de forma natural', () => {
    const itens = [serv('T10'), serv('T2'), serv('T1')];
    expect(ordenarPorColuna(itens, { coluna: 'id', dir: 'asc' }, {}).map(s => s.id)).toEqual(['T1', 'T2', 'T10']);
  });

  it('ordena Valor da nota pelo número (99 antes de 1.000) com vazios no fim', () => {
    const itens = [
      serv('a', { valor_nota: 1000 }), serv('b', { valor_nota: '99.90' }), serv('c'), serv('d', { valor_nota: 12000.5 }),
    ];
    expect(ordenarPorColuna(itens, { coluna: 'valor_nota', dir: 'asc' }, {}).map(s => s.id)).toEqual(['b', 'a', 'd', 'c']);
    expect(ordenarPorColuna(itens, { coluna: 'valor_nota', dir: 'desc' }, {}).map(s => s.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('ordena Lançamento SF cronologicamente com vazios no fim', () => {
    const itens = [
      serv('a', { data_lancamento_sf: '2026-12-01' }), serv('b', { data_lancamento_sf: '2026-02-20' }),
      serv('c'), serv('d', { data_lancamento_sf: '2027-01-15' }),
    ];
    expect(ordenarPorColuna(itens, { coluna: 'lancamento_sf', dir: 'asc' }, {}).map(s => s.id)).toEqual(['b', 'a', 'd', 'c']);
    expect(ordenarPorColuna(itens, { coluna: 'lancamento_sf', dir: 'desc' }, {}).map(s => s.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('ordena Desde pelo instante completo', () => {
    const itens = [
      serv('x', { dt_etapa: '2026-05-01T18:00:00' }),
      serv('y', { dt_etapa: '2026-05-01T08:00:00' }),
      serv('z'),
    ];
    expect(ordenarPorColuna(itens, { coluna: 'desde', dir: 'asc' }, {}).map(s => s.id)).toEqual(['y', 'x', 'z']);
    expect(ordenarPorColuna(itens, { coluna: 'desde', dir: 'desc' }, {}).map(s => s.id)).toEqual(['x', 'y', 'z']);
  });
});

describe('selecaoDoMenu', () => {
  const todos = ['60439871', '60439872', '70000000'];

  it('grava só os resultados marcados quando eles não cobrem a coluna', () => {
    expect(selecaoDoMenu(todos, ['60439871'])).toEqual(['60439871']);
    expect(selecaoDoMenu(todos, ['60439871', '60439872'])).toEqual(['60439871', '60439872']);
  });

  it('não grava filtro quando tudo está marcado', () => {
    expect(selecaoDoMenu(todos, [...todos])).toBeNull();
    expect(selecaoDoMenu([], [])).toBeNull();
  });
});
