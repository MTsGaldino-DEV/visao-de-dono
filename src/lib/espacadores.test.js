import { describe, it, expect } from 'vitest';
import {
  MAX_VAOS, isEspacador, ordenarResultadosTrafo, pendenciasVao, vaoCompleto,
  podeEnviarParaFechamento, resumoVaos, agruparVaos, proximoNumeroVao, proximoIdVD,
  proximaEtapa, montarPayloadInicio, montarPayloadTransicao, montarPayloadExclusao, filtrarPorBusca, filtrarPorEtapa, contarPorEtapa, permissoesFluxo,
  validarArquivo, caminhoArquivo, elegivelGerarOs, bloqueioNovaInstalacao, ativosNoFluxo,
} from './espacadores';

const user = { label: 'Ana', matricula: '123' };
const agora = '2026-09-25T12:00:00.000Z';
const vaoOk = { numero: 1, fotos_antes: ['a'], fotos_depois: ['d'], croqui_url: 'c.pdf' };

describe('isEspacador', () => {
  it('reconhece variações com e sem acento', () => {
    expect(isEspacador({ desc: 'Levantamento para instalação de espaçador.' })).toBe(true);
    expect(isEspacador({ desc: 'ESPACADORES no trafo' })).toBe(true);
    expect(isEspacador({ desc: 'Troca de placa' })).toBe(false);
    expect(isEspacador({ desc: null })).toBe(false);
  });
});

describe('ordenarResultadosTrafo', () => {
  it('coloca exato, depois prefixo com hífen, depois prefixo, depois contém', () => {
    const lista = [{ equip: '17630-1-15' }, { equip: '7630-1-15' }, { equip: '763-3-45' }, { equip: '763' }];
    expect(ordenarResultadosTrafo(lista, ' 763 ').map(s => s.equip))
      .toEqual(['763', '763-3-45', '7630-1-15', '17630-1-15']);
  });
});

describe('vãos', () => {
  it('lista o que falta em cada vão', () => {
    expect(pendenciasVao({ fotos_antes: [], fotos_depois: ['d'], croqui_url: null }))
      .toEqual(['foto de antes', 'croqui']);
    expect(pendenciasVao(vaoOk)).toEqual([]);
    expect(vaoCompleto(vaoOk)).toBe(true);
  });

  it('só permite enviar com pelo menos um vão e todos completos', () => {
    expect(podeEnviarParaFechamento([])).toBe(false);
    expect(podeEnviarParaFechamento([vaoOk, { ...vaoOk, croqui_url: null }])).toBe(false);
    expect(podeEnviarParaFechamento([vaoOk, vaoOk])).toBe(true);
  });

  it('resume total e completos', () => {
    expect(resumoVaos([vaoOk, { ...vaoOk, fotos_antes: [] }])).toEqual({ total: 2, completos: 1 });
  });

  it('agrupa por serviço ordenando por número', () => {
    const g = agruparVaos([{ servico_id: 'A', numero: 2 }, { servico_id: 'B', numero: 1 }, { servico_id: 'A', numero: 1 }]);
    expect(g.A.map(v => v.numero)).toEqual([1, 2]);
    expect(g.B).toHaveLength(1);
  });
});

describe('proximoNumeroVao', () => {
  const nums = (...ns) => ns.map(numero => ({ numero }));
  it('começa em 1 e continua depois do maior', () => {
    expect(proximoNumeroVao([])).toBe(1);
    expect(proximoNumeroVao(nums(1, 2, 4))).toBe(5);
  });
  it('reaproveita buraco quando o maior já é 20', () => {
    const quase = nums(...Array.from({ length: 20 }, (_, i) => i + 1).filter(n => n !== 7));
    expect(proximoNumeroVao(quase)).toBe(7);
  });
  it('retorna null no limite', () => {
    expect(proximoNumeroVao(nums(...Array.from({ length: MAX_VAOS }, (_, i) => i + 1)))).toBeNull();
  });
});

describe('proximoIdVD', () => {
  it('incrementa com 4 dígitos e trata ausência', () => {
    expect(proximoIdVD('VD0999')).toBe('VD1000');
    expect(proximoIdVD(undefined)).toBe('VD0001');
    expect(proximoIdVD('VD12345')).toBe('VD12346');
  });
});

describe('transições', () => {
  it('aceita só a transição da etapa certa', () => {
    expect(proximaEtapa('instalacao', 'enviar')).toBe('revisao');
    expect(proximaEtapa('revisao', 'reprovar')).toBe('instalacao');
    expect(() => proximaEtapa('instalacao', 'aprovar')).toThrow(/Em instalação/);
    expect(() => proximaEtapa('pago', 'nsmc')).toThrow();
    expect(() => proximaEtapa('revisao', 'voar')).toThrow(/desconhecida/);
  });

  it('início grava etapa, data e histórico; recusa quem já tem etapa', () => {
    const p = montarPayloadInicio({ hist: [] }, { user, agora });
    expect(p).toMatchObject({ etapa_espacador: 'instalacao', dt_etapa: agora });
    expect(p.hist).toHaveLength(1);
    expect(p.hist[0]).toMatchObject({ who: 'Ana', matricula: '123', when: agora });
    expect(() => montarPayloadInicio({ etapa_espacador: 'revisao' }, { user, agora })).toThrow();
  });

  it('enviar conclui o serviço e limpa o motivo', () => {
    const p = montarPayloadTransicao({ etapa_espacador: 'instalacao', hist: [{ msg: 'x' }] }, 'enviar', { user, agora });
    expect(p).toMatchObject({ etapa_espacador: 'revisao', status: 'concluido', motivo_reprovacao_fechamento: null, dt_etapa: agora });
    expect(p.hist).toHaveLength(2);
  });

  it('reprovar exige motivo não vazio', () => {
    expect(() => montarPayloadTransicao({ etapa_espacador: 'revisao' }, 'reprovar', { user, agora, motivo: '   ' })).toThrow(/motivo/);
    const p = montarPayloadTransicao({ etapa_espacador: 'revisao' }, 'reprovar', { user, agora, motivo: ' foto borrada ' });
    expect(p).toMatchObject({ etapa_espacador: 'instalacao', motivo_reprovacao_fechamento: 'foto borrada' });
  });

  it('nsmp grava numServ e nsmc grava nsmc, ambos exigem número', () => {
    expect(() => montarPayloadTransicao({ etapa_espacador: 'aguardando_nsmp' }, 'nsmp', { user, agora, numero: '' })).toThrow(/NSMP/);
    expect(montarPayloadTransicao({ etapa_espacador: 'aguardando_nsmp' }, 'nsmp', { user, agora, numero: ' 123 ' }))
      .toMatchObject({ etapa_espacador: 'aguardando_nsmc', numServ: '123' });
    expect(() => montarPayloadTransicao({ etapa_espacador: 'aguardando_nsmc' }, 'nsmc', { user, agora, numero: ' ' })).toThrow(/NSMC/);
    expect(montarPayloadTransicao({ etapa_espacador: 'aguardando_nsmc' }, 'nsmc', { user, agora, numero: '999' }))
      .toMatchObject({ etapa_espacador: 'pago', nsmc: '999' });
  });

  it('excluir cancela o serviço e só vale na etapa de instalação', () => {
    const p = montarPayloadExclusao({ etapa_espacador: 'instalacao', hist: [{ msg: 'x' }] }, { user, agora });
    expect(p).toMatchObject({ status: 'cancelado', dt_etapa: agora });
    expect(p.hist).toHaveLength(2);
    expect(p.hist[1]).toMatchObject({ who: 'Ana', when: agora, msg: expect.stringMatching(/excluída/) });
    expect(() => montarPayloadExclusao({ etapa_espacador: 'revisao' }, { user, agora })).toThrow(/Em revisão|revis/i);
  });
});

describe('filtrarPorBusca', () => {
  it('busca em id, trafo e localidade ignorando acento', () => {
    const lista = [{ id: 'VD0001', equip: '763-3-45', local: 'Governador Valadares' }, { id: 'VD0002', equip: '1', local: 'São Geraldo' }];
    expect(filtrarPorBusca(lista, 'sao')).toHaveLength(1);
    expect(filtrarPorBusca(lista, '763')[0].id).toBe('VD0001');
    expect(filtrarPorBusca(lista, '  ')).toHaveLength(2);
  });
});

describe('filtro por etapa', () => {
  const lista = [
    { id: 'A', etapa_espacador: 'instalacao' }, { id: 'B', etapa_espacador: 'revisao' },
    { id: 'C', etapa_espacador: 'aguardando_nsmp' }, { id: 'D', etapa_espacador: 'aguardando_nsmp' },
  ];
  it('filtra pela etapa e "todas" devolve a lista inteira', () => {
    expect(filtrarPorEtapa(lista, 'aguardando_nsmp').map(s => s.id)).toEqual(['C', 'D']);
    expect(filtrarPorEtapa(lista, 'pago')).toEqual([]);
    expect(filtrarPorEtapa(lista, 'todas')).toHaveLength(4);
  });
  it('conta por etapa, com zero nas vazias e o total em "todas"', () => {
    expect(contarPorEtapa(lista)).toEqual({ instalacao: 1, revisao: 1, aguardando_nsmp: 2, aguardando_nsmc: 0, pago: 0, todas: 4 });
  });
});

describe('permissoesFluxo', () => {
  it('dono instala e fecha; despachante só instala; fechamento só fecha', () => {
    expect(permissoesFluxo('dono')).toEqual({ instalar: true, fechar: true, filtroInicial: 'instalacao' });
    expect(permissoesFluxo('despachante')).toEqual({ instalar: true, fechar: false, filtroInicial: 'instalacao' });
    expect(permissoesFluxo('fechamento')).toEqual({ instalar: false, fechar: true, filtroInicial: 'revisao' });
  });
  it('outros perfis só acompanham', () => {
    expect(permissoesFluxo('tecnico')).toEqual({ instalar: false, fechar: false, filtroInicial: 'instalacao' });
    expect(permissoesFluxo(undefined)).toEqual({ instalar: false, fechar: false, filtroInicial: 'instalacao' });
  });
});

describe('arquivos', () => {
  it('valida tipo por destino', () => {
    expect(validarArquivo('croqui', { type: 'application/pdf' })).toBeNull();
    expect(validarArquivo('croqui', { type: 'image/png' })).toMatch(/PDF/);
    expect(validarArquivo('antes', { type: 'image/jpeg' })).toBeNull();
    expect(validarArquivo('depois', { type: 'application/pdf' })).toMatch(/imagens/);
  });
  it('monta o caminho com extensão segura', () => {
    expect(caminhoArquivo('VD0001', 3, 'antes', 'IMG_1.JPG', '17-0')).toBe('espacadores/VD0001/vao-3/antes-17-0.jpg');
    expect(caminhoArquivo('VD0001', 3, 'depois', 'semextensao', '17-1')).toBe('espacadores/VD0001/vao-3/depois-17-1.jpg');
    expect(caminhoArquivo('VD0001', 3, 'croqui', 'rede.PDF', '17')).toBe('espacadores/VD0001/vao-3/croqui-17.pdf');
  });
});

describe('convivência com o fluxo antigo (revisão final)', () => {
  it('Gerar OS ignora serviços do fluxo novo e os que já têm número', () => {
    expect(elegivelGerarOs({ numServ: '' })).toBe(true);
    expect(elegivelGerarOs({ numServ: null })).toBe(true);
    expect(elegivelGerarOs({ numServ: '  ' })).toBe(true);
    expect(elegivelGerarOs({ numServ: '123' })).toBe(false);
    expect(elegivelGerarOs({ numServ: '', etapa_espacador: 'instalacao' })).toBe(false);
    expect(elegivelGerarOs({ numServ: '', etapa_espacador: 'aguardando_nsmp' })).toBe(false);
  });

  it('Nova instalação não assume serviço já executado ou com OS pelo fluxo antigo', () => {
    expect(bloqueioNovaInstalacao({ status: 'cadastrado', numServ: '' })).toBeNull();
    expect(bloqueioNovaInstalacao({ numServ: '12345' })).toMatch(/12345/);
    expect(bloqueioNovaInstalacao({ execucao: { dtConclusao: 'x' } })).toMatch(/app/);
    expect(bloqueioNovaInstalacao({ aprovacaoespacador: 'aprovado' })).toMatch(/app/);
    // serviço que já está no fluxo novo pode ser aberto, mesmo com NSMP
    expect(bloqueioNovaInstalacao({ etapa_espacador: 'pago', numServ: '999' })).toBeNull();
  });

  it('listas do fluxo novo escondem serviços cancelados', () => {
    const lista = [{ id: 'A', status: 'concluido' }, { id: 'B', status: 'cancelado' }, { id: 'C', status: 'cadastrado' }];
    expect(ativosNoFluxo(lista).map(s => s.id)).toEqual(['A', 'C']);
  });
});
