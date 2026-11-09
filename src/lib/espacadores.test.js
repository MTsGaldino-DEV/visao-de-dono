import { describe, it, expect } from 'vitest';
import {
  isEspacador, ordenarResultadosTrafo, agruparVaos, proximoIdVD,
  lerCoordenada, formatarCoordenada, podeApagarInstalacao, alteracoesPendentes, distanciaMetros, sugerirVinculo, qtdValida, pendenciasInstalacao, podeEnviarInstalacao,
  ETAPAS, proximaEtapa, montarPayloadInicio, montarPayloadTransicao, montarPayloadExclusao, filtrarPorBusca, filtrarPorEtapa, contarPorEtapa, permissoesFluxo,
  validarArquivo, caminhoArquivo, elegivelGerarOs, bloqueioNovaInstalacao, ativosNoFluxo, resumoEspacadoresPainel,
  resumoEspacadoresPorGrupo, descreverAlteracoesVao, alteracoesServico, camposCorrigiveis, montarPayloadCorrecao,
  linhasPlanilhaInstalacoes, lerValorNota, formatarMoeda, formatarDataDia, isPoda, tipoServicoDe, TIPOS_SERVICO,
  TIPOS_EQUIPE, tipoEquipeValido, rotuloTipoEquipe,
} from './espacadores';

const user = { label: 'Ana', matricula: '123' };
const agora = '2026-09-25T12:00:00.000Z';

describe('isEspacador', () => {
  it('reconhece variações com e sem acento', () => {
    expect(isEspacador({ desc: 'Levantamento para instalação de espaçador.' })).toBe(true);
    expect(isEspacador({ desc: 'ESPACADORES no trafo' })).toBe(true);
    expect(isEspacador({ desc: 'Troca de placa' })).toBe(false);
    expect(isEspacador({ desc: null })).toBe(false);
  });
});

describe('isPoda e tipoServicoDe', () => {
  it('reconhece poda de árvore', () => {
    expect(isPoda({ desc: 'Poda de árvore' })).toBe(true);
    expect(isPoda({ desc: 'PODA LEVE' })).toBe(true);
    expect(isPoda({ desc: 'podar galhos' })).toBe(true);
    expect(isPoda({ desc: 'Apoda' })).toBe(false);
    expect(isPoda({ desc: 'Troca de placa' })).toBe(false);
    expect(isPoda(null)).toBe(false);
    expect(isPoda({ desc: null })).toBe(false);
  });

  it('se a descrição citar espaçador e poda, continua sendo espaçador', () => {
    const misto = { desc: 'Poda e instalação de espaçador' };
    expect(isPoda(misto)).toBe(false);
    expect(isEspacador(misto)).toBe(true);
    expect(tipoServicoDe(misto)).toBe('espacador');
  });

  it('tipo do serviço: poda só quando a descrição é de poda; o resto é espaçador', () => {
    expect(tipoServicoDe({ desc: 'Poda de árvore' })).toBe('poda');
    expect(tipoServicoDe({ desc: 'Instalação de espaçador' })).toBe('espacador');
    expect(tipoServicoDe({ desc: 'Descrição desconhecida', etapa_espacador: 'instalacao' })).toBe('espacador');
    expect(tipoServicoDe(undefined)).toBe('espacador');
    expect(TIPOS_SERVICO.poda.label).toBe('Poda de árvore');
    expect(TIPOS_SERVICO.espacador.label).toBe('Espaçador');
  });
});

describe('ordenarResultadosTrafo', () => {
  it('coloca exato, depois prefixo com hífen, depois prefixo, depois contém', () => {
    const lista = [{ equip: '17630-1-15' }, { equip: '7630-1-15' }, { equip: '763-3-45' }, { equip: '763' }];
    expect(ordenarResultadosTrafo(lista, ' 763 ').map(s => s.equip))
      .toEqual(['763', '763-3-45', '7630-1-15', '17630-1-15']);
  });
});

describe('lerCoordenada', () => {
  const ok = { lat: -18.84404, lng: -41.957216 };
  it.each([
    '-18.844040 -41.957216', '-18.844040, -41.957216', '-18.844040,-41.957216',
    '-18.844040;-41.957216', ' -18,844040 -41,957216 ', '-18,844040;-41,957216',
  ])('lê %s', (t) => {
    const c = lerCoordenada(t);
    expect(c.lat).toBeCloseTo(ok.lat, 6);
    expect(c.lng).toBeCloseTo(ok.lng, 6);
  });
  it.each(['', null, 'abc', '-18.8', '-95 -41', '-18 -200', '-18.8 -41.9 3', '-18.844040,', '-18.844040;', '; -41.95', '0x10 0x20'])('recusa %s', (t) => {
    expect(lerCoordenada(t)).toBeNull();
  });
});

describe('formatarCoordenada', () => {
  it('grava no formato que o Mapa lê', () => {
    expect(formatarCoordenada('-18,844040;-41,957216')).toBe('-18.844040 -41.957216');
    expect(formatarCoordenada(' -18.8440401, -41.95 ')).toBe('-18.844040 -41.950000');
    expect(formatarCoordenada('xx')).toBeNull();
  });
});

describe('alteracoesPendentes', () => {
  const vao = { coord_antes: '-18.844040 -41.957216', coord_depois: '-18.844040 -41.957216', qtd_espacadores: 3 };
  const rascunho = { coordAntes: '-18,844040 -41,957216', coordDepois: '-18,844040 -41,957216', qtd: 3 };
  it('sem mudança não há nada pendente', () => {
    expect(alteracoesPendentes(vao, rascunho)).toEqual({ campos: {}, pendente: false, invalido: false });
  });
  it('só leva o que mudou, já no formato do vão', () => {
    const r = alteracoesPendentes(vao, { ...rascunho, coordDepois: '-18,9  -41,9', qtd: '4' });
    expect(r).toEqual({ campos: { coord_depois: '-18,900000 -41,900000', qtd_espacadores: 4 }, pendente: true, invalido: false });
  });
  it('mesma coordenada em outro formato não conta como mudança', () => {
    expect(alteracoesPendentes(vao, { ...rascunho, coordAntes: '-18,84404 -41,957216' }).pendente).toBe(false);
  });
  it('coordenada digitada fora do formato do vão não pode ser gravada', () => {
    expect(alteracoesPendentes(vao, { ...rascunho, coordAntes: '-18.9 -41.9' })).toEqual({ campos: {}, pendente: true, invalido: true });
    expect(alteracoesPendentes(vao, { ...rascunho, coordAntes: '18,9 -41,9' }).invalido).toBe(true);
  });
  it('valor inválido digitado fica pendente e marcado', () => {
    expect(alteracoesPendentes(vao, { ...rascunho, qtd: '0' })).toEqual({ campos: {}, pendente: true, invalido: true });
  });
  it('vão inexistente com campos vazios não tem pendência', () => {
    expect(alteracoesPendentes(null, { coordAntes: '', coordDepois: '', qtd: '' }).pendente).toBe(false);
    expect(alteracoesPendentes(null, { coordAntes: '', coordDepois: '', qtd: '', equipe: '  ' }).pendente).toBe(false);
  });
  it('equipe digitada vai sem espaços nas pontas; igual à salva não conta', () => {
    const comEquipe = { ...vao, equipe: '7812' };
    expect(alteracoesPendentes(comEquipe, { ...rascunho, equipe: ' 7812 ' }).pendente).toBe(false);
    expect(alteracoesPendentes(comEquipe, { ...rascunho, equipe: ' 7900 ' }))
      .toEqual({ campos: { equipe: '7900' }, pendente: true, invalido: false });
    expect(alteracoesPendentes(comEquipe, { ...rascunho, equipe: '' }).campos).toEqual({ equipe: null });
  });
});

describe('tipo de equipe', () => {
  it('TIPOS_EQUIPE tem UMPLA, DUPLA e MOTO, gravados em minúsculas', () => {
    expect(Object.keys(TIPOS_EQUIPE)).toEqual(['umpla', 'dupla', 'moto']);
    expect(Object.values(TIPOS_EQUIPE).map(t => t.label)).toEqual(['UMPLA', 'DUPLA', 'MOTO']);
  });
  it('tipoEquipeValido aceita só os três valores (ignora caixa e espaços)', () => {
    expect(tipoEquipeValido(' Moto ')).toBe('moto');
    expect(tipoEquipeValido('umpla')).toBe('umpla');
    ['', null, undefined, 'triplo', 'constructor', 'toString'].forEach(v => expect(tipoEquipeValido(v)).toBeNull());
  });
  it('rotuloTipoEquipe devolve o rótulo ou vazio', () => {
    expect(rotuloTipoEquipe('dupla')).toBe('DUPLA');
    expect(rotuloTipoEquipe(null)).toBe('');
    expect(rotuloTipoEquipe('x')).toBe('');
  });
  it('registro antigo sem tipo não ganha pendência nem bloqueia o envio', () => {
    const antigo = { fotos_antes: ['a'], fotos_depois: ['d'], coord_antes: '-18.8 -41.9', coord_depois: '-18.8 -41.9', qtd_espacadores: 3, equipe: '7812' };
    expect(pendenciasInstalacao(antigo)).toEqual([]);
    expect(podeEnviarInstalacao(antigo)).toBe(true);
  });
  it('alteracoesPendentes só grava o tipo quando mudou; vazio no vão antigo não é alteração', () => {
    const vao = { coord_antes: '-18.8 -41.9', coord_depois: '-18.8 -41.9', qtd_espacadores: 3 };
    const base = { coordAntes: '-18,800000 -41,900000', coordDepois: '-18,800000 -41,900000', qtd: 3 };
    expect(alteracoesPendentes(vao, { ...base, tipoEquipe: '' }).pendente).toBe(false);
    expect(alteracoesPendentes(vao, { ...base }).pendente).toBe(false);
    expect(alteracoesPendentes(vao, { ...base, tipoEquipe: 'moto' }).campos).toEqual({ tipo_equipe: 'moto' });
    expect(alteracoesPendentes({ ...vao, tipo_equipe: 'moto' }, { ...base, tipoEquipe: 'moto' }).pendente).toBe(false);
    expect(alteracoesPendentes({ ...vao, tipo_equipe: 'moto' }, { ...base, tipoEquipe: 'dupla' }).campos).toEqual({ tipo_equipe: 'dupla' });
    expect(alteracoesPendentes({ ...vao, tipo_equipe: 'moto' }, { ...base, tipoEquipe: '' }).campos).toEqual({ tipo_equipe: null });
  });
});

describe('podeApagarInstalacao', () => {
  it('só a matrícula 27630 vê o botão de apagar', () => {
    expect(podeApagarInstalacao({ matricula: '27630' })).toBe(true);
    expect(podeApagarInstalacao({ matricula: 27630 })).toBe(true);
    expect(podeApagarInstalacao({ matricula: '123' })).toBe(false);
    expect(podeApagarInstalacao(null)).toBe(false);
  });
});

describe('distanciaMetros', () => {
  it('calcula em metros', () => {
    expect(distanciaMetros({ lat: -18.844040, lng: -41.957216 }, { lat: -18.844040, lng: -41.957216 })).toBe(0);
    // 0.001° de latitude ≈ 111 m
    expect(distanciaMetros({ lat: -18.844, lng: -41.957 }, { lat: -18.845, lng: -41.957 })).toBeCloseTo(111.2, 0);
  });
});

describe('sugerirVinculo', () => {
  const base = { lat: -18.844, lng: -41.957 };
  const s = (id, coord) => ({ id, coord });
  it('ordena por distância, sem coordenada no fim, e sugere até 100 m', () => {
    const r = sugerirVinculo([s('LONGE', '-18.850 -41.957'), s('RUIM', 'xx'), s('PERTO', '-18.84489 -41.957')], '-18.844 -41.957');
    expect(r.ordenados.map(c => c.id)).toEqual(['PERTO', 'LONGE', 'RUIM']);
    expect(r.ordenados[2].distancia).toBeNull();
    expect(r.sugerido.id).toBe('PERTO');
  });
  it('100 m exatos ainda sugere; acima não', () => {
    const exato = `${base.lat - 100 / 111195} ${base.lng}`;
    expect(sugerirVinculo([s('A', exato)], '-18.844 -41.957').sugerido?.id).toBe('A');
    expect(sugerirVinculo([s('A', '-18.8450 -41.957')], '-18.844 -41.957').sugerido).toBeNull();
  });
  it('sem coordenada do antes não sugere nada', () => {
    const r = sugerirVinculo([s('A', '-18.844 -41.957')], '');
    expect(r.sugerido).toBeNull();
    expect(r.ordenados[0].distancia).toBeNull();
  });
});

describe('instalação de um vão', () => {
  const vao = { fotos_antes: ['a'], fotos_depois: ['d'], coord_antes: '-18.8 -41.9', coord_depois: '-18.8 -41.9', qtd_espacadores: 3, equipe: '7812' };
  it('qtdValida aceita só inteiro > 0', () => {
    expect(qtdValida('3')).toBe(3);
    expect(qtdValida(4)).toBe(4);
    [0, -1, 2.5, '', null, 'abc'].forEach(v => expect(qtdValida(v)).toBeNull());
  });
  it('lista pendências na ordem e libera o envio', () => {
    expect(pendenciasInstalacao(null)).toEqual(['foto de antes', 'coordenada do antes', 'foto de depois', 'coordenada do depois', 'quantidade', 'equipe']);
    expect(pendenciasInstalacao({ ...vao, coord_depois: 'xx', qtd_espacadores: 0 })).toEqual(['coordenada do depois', 'quantidade']);
    expect(pendenciasInstalacao({ ...vao, equipe: '   ' })).toEqual(['equipe']);
    expect(podeEnviarInstalacao(vao)).toBe(true);
  });
  it('agrupa por serviço ordenando por número', () => {
    const g = agruparVaos([{ servico_id: 'A', numero: 2 }, { servico_id: 'B', numero: 1 }, { servico_id: 'A', numero: 1 }]);
    expect(g.A.map(v => v.numero)).toEqual([1, 2]);
    expect(g.B).toHaveLength(1);
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

  it('nsmc vai para SF, salesforce vai para pago e pago não tem próxima ação', () => {
    expect(proximaEtapa('aguardando_nsmc', 'nsmc')).toBe('sf');
    expect(proximaEtapa('sf', 'salesforce')).toBe('pago');
    expect(() => proximaEtapa('aguardando_nsmc', 'salesforce')).toThrow(/Aguardando NSPR/);
    expect(() => proximaEtapa('pago', 'salesforce')).toThrow(/Pago/);
    expect(() => proximaEtapa('pago', 'apropriacao')).toThrow(/desconhecida/);
    expect(() => proximaEtapa('sf', 'apropriacao')).toThrow(/desconhecida/);
  });

  it('as pílulas seguem a ordem do fluxo, com SF entre NSPR e Pago', () => {
    expect(Object.keys(ETAPAS)).toEqual(['instalacao', 'revisao', 'aguardando_nsmp', 'aguardando_nsmc', 'sf', 'pago']);
    expect(ETAPAS.sf.label).toBe('SalesForce');
  });

  it('início grava etapa, histórico e o status para onde voltar', () => {
    const p = montarPayloadInicio({ status: 'pendente', hist: [] }, { user, agora });
    expect(p).toMatchObject({ etapa_espacador: 'instalacao', dt_etapa: agora, status_antes_instalacao: 'pendente' });
    expect(p.hist[0]).toMatchObject({ who: 'Ana', matricula: '123', when: agora });
    expect(montarPayloadInicio({ status: 'cadastrado' }, { user, agora, criadoPelaInstalacao: true }).status_antes_instalacao).toBe('cancelado');
    expect(() => montarPayloadInicio({ etapa_espacador: 'revisao' }, { user, agora })).toThrow();
  });

  it('histórico do início: texto atual no espaçador e texto próprio na poda', () => {
    expect(montarPayloadInicio({ desc: 'Instalação de espaçador', hist: [] }, { user, agora }).hist[0].msg).toBe('Instalação de espaçadores iniciada');
    expect(montarPayloadInicio({ status: 'pendente', hist: [] }, { user, agora }).hist[0].msg).toBe('Instalação de espaçadores iniciada');
    expect(montarPayloadInicio({ desc: 'Poda de árvore', hist: [] }, { user, agora }).hist[0].msg).toBe('Poda de árvore iniciada');
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
    expect(() => montarPayloadTransicao({ etapa_espacador: 'aguardando_nsmc' }, 'nsmc', { user, agora, numero: ' ' })).toThrow(/NSPR/);
    expect(montarPayloadTransicao({ etapa_espacador: 'aguardando_nsmc' }, 'nsmc', { user, agora, numero: '999' }))
      .toMatchObject({ etapa_espacador: 'sf', nsmc: '999', dt_etapa: agora });
  });

  it('salesforce: só na etapa SF e exige data, valor e apropriação', () => {
    const sf = { etapa_espacador: 'sf', hist: [] };
    const ok = { user, agora, dataLancamento: '2026-11-05', valorNota: '1.234,56', apropriacao: '9844' };
    expect(() => montarPayloadTransicao({ etapa_espacador: 'aguardando_nsmc' }, 'salesforce', ok)).toThrow(/Aguardando NSPR/);
    expect(() => montarPayloadTransicao({ etapa_espacador: 'pago' }, 'salesforce', ok)).toThrow(/Pago/);
    expect(() => montarPayloadTransicao(sf, 'salesforce', { ...ok, dataLancamento: '' })).toThrow('Informe a data de lançamento no SalesForce.');
    expect(() => montarPayloadTransicao(sf, 'salesforce', { ...ok, dataLancamento: '05/11/2026' })).toThrow(/data de lançamento/);
    expect(() => montarPayloadTransicao(sf, 'salesforce', { ...ok, dataLancamento: '2026-02-30' })).toThrow(/data de lançamento/);
    expect(() => montarPayloadTransicao(sf, 'salesforce', { ...ok, valorNota: '' })).toThrow('Informe um valor da nota válido.');
    expect(() => montarPayloadTransicao(sf, 'salesforce', { ...ok, valorNota: '1,234' })).toThrow('Informe um valor da nota válido.');
    expect(() => montarPayloadTransicao(sf, 'salesforce', { ...ok, apropriacao: '  ' })).toThrow('Informe o número da apropriação.');
    expect(() => montarPayloadTransicao(sf, 'salesforce', { ...ok, apropriacao: undefined })).toThrow('Informe o número da apropriação.');
  });

  it('salesforce grava data, valor, apropriação, dt_etapa e histórico e vai para pago', () => {
    const p = montarPayloadTransicao({ etapa_espacador: 'sf', hist: [{ msg: 'x' }] }, 'salesforce', {
      user, agora, dataLancamento: '2026-11-05', valorNota: 'R$ 1.234,56', apropriacao: ' 9844 ',
    });
    expect(p).toMatchObject({
      etapa_espacador: 'pago', data_lancamento_sf: '2026-11-05', valor_nota: 1234.56, apropriacao: '9844', dt_etapa: agora,
    });
    expect(p.hist).toHaveLength(2);
    expect(p.hist[1].msg).toBe(`SalesForce informado: lançamento 05/11/2026, nota ${formatarMoeda(1234.56)}, apropriação 9844`);
    expect(p.hist[1]).toMatchObject({ who: 'Ana', when: agora });
  });

  it('excluir devolve o serviço ao status anterior e tira do fluxo', () => {
    const p = montarPayloadExclusao({ etapa_espacador: 'instalacao', status: 'concluido', status_antes_instalacao: 'pendente', motivo_reprovacao_fechamento: 'x', hist: [{ msg: 'x' }] }, { user, agora });
    expect(p).toMatchObject({ etapa_espacador: null, dt_etapa: null, motivo_reprovacao_fechamento: null, status_antes_instalacao: null, status: 'pendente' });
    expect(p.hist[1]).toMatchObject({ who: 'Ana', when: agora, msg: 'Instalação de espaçadores excluída' });
    expect(montarPayloadExclusao({ etapa_espacador: 'instalacao', hist: [] }, { user, agora }).status).toBe('cancelado');
    expect(montarPayloadExclusao({ desc: 'Poda de árvore', etapa_espacador: 'instalacao', hist: [] }, { user, agora }).hist[0].msg).toBe('Poda de árvore excluída');
    expect(() => montarPayloadExclusao({ etapa_espacador: 'revisao' }, { user, agora })).toThrow(/Em revisão|revis/i);
  });

});

describe('correção da instalação por quem fecha', () => {
  it('descreve o que mudou no vão, na ordem da tela', () => {
    const vao = { coord_antes: '-18.8 -41.9', qtd_espacadores: 3, equipe: null };
    expect(descreverAlteracoesVao(vao, { equipe: '7812', qtd_espacadores: 4 }))
      .toEqual(['Quantidade de espaçadores: 3 → 4', 'Equipe: — → 7812']);
    expect(descreverAlteracoesVao(vao, {})).toEqual([]);
    expect(descreverAlteracoesVao(vao, { qtd_espacadores: 4 }, { desc: 'Instalação de espaçador' }))
      .toEqual(['Quantidade de espaçadores: 3 → 4']);
  });

  it('descreve o tipo de equipe com o rótulo em maiúsculas', () => {
    expect(descreverAlteracoesVao({ tipo_equipe: null }, { tipo_equipe: 'umpla' })).toEqual(['Tipo de equipe: — → UMPLA']);
    expect(descreverAlteracoesVao({ tipo_equipe: 'umpla' }, { tipo_equipe: 'moto' })).toEqual(['Tipo de equipe: UMPLA → MOTO']);
  });

  it('serviço de poda descreve a quantidade como árvores podadas', () => {
    const vao = { qtd_espacadores: 3, equipe: null };
    expect(descreverAlteracoesVao(vao, { equipe: '7812', qtd_espacadores: 5 }, { desc: 'Poda de árvore' }))
      .toEqual(['Quantidade de árvores podadas: 3 → 5', 'Equipe: — → 7812']);
  });

  it('dados do serviço: só o que mudou, sem espaços; número informado não pode ser apagado', () => {
    const servico = { equip: '763-3-45', local: 'Itambacuri', numServ: '111', nsmc: '222', apropriacao: null };
    expect(alteracoesServico(servico, { equip: ' 763-3-45 ', local: 'Itambacuri' }))
      .toEqual({ campos: {}, mensagens: [], erro: null });
    expect(alteracoesServico(servico, { equip: '763-3-46', nsmc: ' 333 ', apropriacao: '9844' })).toEqual({
      campos: { equip: '763-3-46', nsmc: '333', apropriacao: '9844' },
      mensagens: ['Trafo: 763-3-45 → 763-3-46', 'NSPR: 222 → 333', 'Apropriação: — → 9844'],
      erro: null,
    });
    expect(alteracoesServico(servico, { numServ: '  ' }).erro).toMatch(/NSMP/);
    expect(alteracoesServico(servico, { local: '' }).erro).toMatch(/localidade/);
    // apropriação nunca informada (serviço antigo em Pago) pode continuar vazia
    expect(alteracoesServico(servico, { apropriacao: '' }).erro).toBeNull();
    expect(alteracoesServico({ ...servico, apropriacao: '9844' }, { apropriacao: ' ' }).erro).toBe('Informe o número da apropriação.');
  });

  it('valor da nota compara pelo número, não pelo texto', () => {
    const servico = { equip: 'T', valor_nota: 1234.5, data_lancamento_sf: '2026-11-05' };
    expect(alteracoesServico(servico, { valor_nota: '1234,50' })).toEqual({ campos: {}, mensagens: [], erro: null });
    expect(alteracoesServico(servico, { valor_nota: 'R$ 1.234,5' }).campos).toEqual({});
    expect(alteracoesServico({ valor_nota: '1234.50' }, { valor_nota: '1.234,50' }).campos).toEqual({});
    const r = alteracoesServico(servico, { valor_nota: '2.000,00' });
    expect(r.campos).toEqual({ valor_nota: 2000 });
    expect(r.mensagens).toEqual([`Valor da nota: ${formatarMoeda(1234.5)} → ${formatarMoeda(2000)}`]);
    expect(r.erro).toBeNull();
  });

  it('valor da nota inválido ou apagado dá erro e não entra em campos', () => {
    const servico = { valor_nota: 1234.5, data_lancamento_sf: '2026-11-05' };
    for (const digitado of ['abc', '0', '-5', '1,234']) {
      expect(alteracoesServico(servico, { valor_nota: digitado })).toEqual({ campos: {}, mensagens: [], erro: 'Informe um valor da nota válido.' });
    }
    expect(alteracoesServico(servico, { valor_nota: '  ' })).toEqual({ campos: {}, mensagens: [], erro: 'Informe o valor da nota.' });
  });

  it('serviço antigo em Pago sem os dados do SalesForce não acusa erro nem alteração', () => {
    const antigo = { equip: 'T', apropriacao: null, data_lancamento_sf: null, valor_nota: null };
    expect(alteracoesServico(antigo, { data_lancamento_sf: '', valor_nota: '', apropriacao: '' }))
      .toEqual({ campos: {}, mensagens: [], erro: null });
    // quem fecha completa pelo Ver detalhes
    const r = alteracoesServico(antigo, { data_lancamento_sf: '2026-11-05', valor_nota: '10,5', apropriacao: '77' });
    expect(r.campos).toEqual({ data_lancamento_sf: '2026-11-05', valor_nota: 10.5, apropriacao: '77' });
    expect(r.mensagens).toEqual([
      'Apropriação: — → 77', 'Lançamento SF: — → 05/11/2026', `Valor da nota: — → ${formatarMoeda(10.5)}`,
    ]);
  });

  it('data de lançamento: compara o texto, descreve em DD/MM/AAAA e não deixa apagar', () => {
    const servico = { data_lancamento_sf: '2026-11-05' };
    expect(alteracoesServico(servico, { data_lancamento_sf: '2026-11-05' }).campos).toEqual({});
    const r = alteracoesServico(servico, { data_lancamento_sf: '2026-12-01' });
    expect(r.campos).toEqual({ data_lancamento_sf: '2026-12-01' });
    expect(r.mensagens).toEqual(['Lançamento SF: 05/11/2026 → 01/12/2026']);
    expect(alteracoesServico(servico, { data_lancamento_sf: '' }).erro).toBe('Informe a data de lançamento no SalesForce.');
  });

  it('cada etapa libera só os números que já existem nela', () => {
    expect(camposCorrigiveis('revisao')).toEqual(['equip', 'local']);
    expect(camposCorrigiveis('aguardando_nsmc')).toEqual(['equip', 'local', 'numServ']);
    expect(camposCorrigiveis('sf')).toEqual(['equip', 'local', 'numServ', 'nsmc']);
    expect(camposCorrigiveis('pago')).toEqual(['equip', 'local', 'numServ', 'nsmc', 'apropriacao', 'data_lancamento_sf', 'valor_nota']);
  });

  it('registra a correção no histórico; sem mudança não grava nada', () => {
    const p = montarPayloadCorrecao({ hist: [{ msg: 'x' }] }, ['Trafo: 1 → 2', 'Equipe: — → 7812'], { user, agora });
    expect(p.hist[1]).toMatchObject({ who: 'Ana', when: agora, msg: 'Instalação corrigida: Trafo: 1 → 2; Equipe: — → 7812' });
    expect(montarPayloadCorrecao({ hist: [] }, [], { user, agora })).toBeNull();
  });
});

describe('linhasPlanilhaInstalacoes', () => {
  it('uma linha por serviço com os dados do vão', () => {
    const lista = [{
      id: 'VD1', local: 'Itambacuri', equip: '763', etapa_espacador: 'pago', numServ: '111', nsmc: '222', apropriacao: '9844', dt_etapa: null,
      data_lancamento_sf: '2026-11-05', valor_nota: '1234.50',
    }];
    const vaos = { VD1: [{ qtd_espacadores: 4, equipe: '7812', tipo_equipe: 'dupla', coord_antes: '-18.8 -41.9', coord_depois: '-18.9 -41.9', fotos_antes: ['a.jpg'], fotos_depois: [] }] };
    expect(linhasPlanilhaInstalacoes(lista, vaos)).toEqual([{
      'ID': 'VD1', 'Localidade': 'Itambacuri', 'Trafo': '763', 'Tipo de serviço': 'Espaçador', 'Quantidade': 4, 'Situação': 'Pago', 'Motivo da reprovação': '',
      'NSMP': '111', 'NSPR': '222', 'Equipe': '7812', 'Tipo de equipe': 'DUPLA', 'Desde': '', 'Apropriação': '9844',
      'Lançamento SF': '05/11/2026', 'Valor da nota': 1234.5,
      'Coordenada do antes': '-18,800000 -41,900000', 'Coordenada do depois': '-18,900000 -41,900000', 'Foto do antes': 'a.jpg', 'Foto do depois': '',
    }]);
    expect(linhasPlanilhaInstalacoes([{ id: 'VD2', etapa_espacador: 'revisao' }], {})[0]).toMatchObject({
      'Tipo de serviço': 'Espaçador', 'Quantidade': '', 'Equipe': '', 'Tipo de equipe': '', 'Situação': 'Em revisão', 'Lançamento SF': '', 'Valor da nota': '',
    });
  });

  it('serviço de poda sai com o tipo e a quantidade de árvores', () => {
    const lista = [
      { id: 'VD3', desc: 'Poda de árvore', etapa_espacador: 'revisao' },
      { id: 'VD4', desc: 'Instalação de espaçador', etapa_espacador: 'revisao' },
    ];
    const vaos = { VD3: [{ qtd_espacadores: 6 }], VD4: [{ qtd_espacadores: 2 }] };
    const linhas = linhasPlanilhaInstalacoes(lista, vaos);
    expect(linhas[0]).toMatchObject({ 'ID': 'VD3', 'Tipo de serviço': 'Poda de árvore', 'Quantidade': 6 });
    expect(linhas[1]).toMatchObject({ 'ID': 'VD4', 'Tipo de serviço': 'Espaçador', 'Quantidade': 2 });
    expect(Object.keys(linhas[0]).slice(0, 5)).toEqual(['ID', 'Localidade', 'Trafo', 'Tipo de serviço', 'Quantidade']);
    expect(linhas[0]).not.toHaveProperty('Espaçadores');
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
    expect(contarPorEtapa(lista)).toEqual({ instalacao: 1, revisao: 1, aguardando_nsmp: 2, aguardando_nsmc: 0, sf: 0, pago: 0, todas: 4 });
    expect(contarPorEtapa([{ etapa_espacador: 'sf' }, { etapa_espacador: 'sf' }, { etapa_espacador: 'pago' }]))
      .toMatchObject({ sf: 2, pago: 1, todas: 3 });
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
  it('só aceita imagem', () => {
    expect(validarArquivo({ type: 'image/jpeg' })).toBeNull();
    expect(validarArquivo({ type: 'application/pdf' })).toMatch(/imagens/);
  });
  it('monta o caminho com extensão segura', () => {
    expect(caminhoArquivo('VD0001', 3, 'antes', 'IMG_1.JPG', '17-0')).toBe('espacadores/VD0001/vao-3/antes-17-0.jpg');
    expect(caminhoArquivo('VD0001', 3, 'depois', 'semextensao', '17-1')).toBe('espacadores/VD0001/vao-3/depois-17-1.jpg');
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

describe('resumoEspacadoresPainel', () => {
  it('conta vãos a instalar, concluídos e trafos — cada serviço de espaçador é 1 vão', () => {
    const esp = (id, status, equip) => ({ id, status, equip, desc: 'Instalar espaçador' });
    const lista = [
      esp('1', 'cadastrado', '57179-3-75'),
      esp('2', 'cadastrado', '57179-3-75'),
      esp('3', 'pendente', '57179-1-15'), // mesmo trafo 57179, outro sufixo
      esp('4', 'pendente', '4196-3-112'),
      esp('5', 'concluido', '998051-3-45'),
      esp('6', 'reprovado', '13069-3-75'), // fora da conta
      esp('7', 'cancelado', '13069-3-75'), // fora da conta
      { id: '8', status: 'cadastrado', equip: '111-1-1', desc: 'Troca de placa' }, // não é espaçador
      { id: '9', status: 'concluido', equip: '222', desc: 'Instalação', etapa_espacador: 'pago' },
    ];
    expect(resumoEspacadoresPainel(lista)).toEqual({
      aInstalar: 4, cadastrados: 2, pendentes: 2, outros: 0, concluidos: 2, trafosAInstalar: 2,
    });
  });

  it('poda de árvore fica fora da conta, mesmo no fluxo com etapa preenchida', () => {
    const esp = { id: '1', status: 'cadastrado', equip: '100-1-1', desc: 'Instalar espaçador' };
    const poda = (id, status, extra = {}) => ({ id, status, equip: '200-1-1', desc: 'Poda de árvore', ...extra });
    const lista = [
      esp,
      poda('2', 'cadastrado'),
      poda('3', 'pendente', { etapa_espacador: 'instalacao' }),
      poda('4', 'concluido', { etapa_espacador: 'pago' }),
    ];
    expect(resumoEspacadoresPainel(lista)).toEqual({
      aInstalar: 1, cadastrados: 1, pendentes: 0, outros: 0, concluidos: 0, trafosAInstalar: 1,
    });
  });

  it('lista vazia', () => {
    expect(resumoEspacadoresPainel([])).toEqual({
      aInstalar: 0, cadastrados: 0, pendentes: 0, outros: 0, concluidos: 0, trafosAInstalar: 0,
    });
  });
});

describe('resumoEspacadoresPorGrupo', () => {
  it('resume os vãos de cada grupo e deixa de fora grupos sem vão na conta', () => {
    const esp = (local, status, equip) => ({ local, status, equip, desc: 'Instalar espaçador' });
    const lista = [
      esp('MANTENA', 'cadastrado', '100-1-1'),
      esp('MANTENA', 'pendente', '100-3-2'),
      esp('MANTENA', 'concluido', '200-1-1'),
      esp('TIPITI', 'pendente', '300-1-1'),
      esp('COROACI', 'cancelado', '400-1-1'), // só cancelado: grupo some
      { local: 'TIPITI', status: 'cadastrado', equip: '500', desc: 'Troca de placa' }, // não é espaçador
    ];
    const porLocal = Object.fromEntries(resumoEspacadoresPorGrupo(lista, s => s.local).map(g => [g.chave, g]));
    expect(Object.keys(porLocal).sort()).toEqual(['MANTENA', 'TIPITI']);
    expect(porLocal.MANTENA).toEqual({
      chave: 'MANTENA', aInstalar: 2, cadastrados: 1, pendentes: 1, outros: 0, concluidos: 1, trafosAInstalar: 1,
    });
    expect(porLocal.TIPITI.aInstalar).toBe(1);
  });

  it('poda não entra na conta, nem faz o grupo aparecer', () => {
    const lista = [
      { local: 'MANTENA', status: 'cadastrado', equip: '100-1-1', desc: 'Instalar espaçador' },
      { local: 'MANTENA', status: 'pendente', equip: '100-3-2', desc: 'Poda de árvore', etapa_espacador: 'instalacao' },
      { local: 'COROACI', status: 'concluido', equip: '400-1-1', desc: 'Poda de árvore', etapa_espacador: 'pago' },
    ];
    const grupos = resumoEspacadoresPorGrupo(lista, s => s.local);
    expect(grupos.map(g => g.chave)).toEqual(['MANTENA']);
    expect(grupos[0]).toMatchObject({ aInstalar: 1, cadastrados: 1, pendentes: 0, concluidos: 0 });
  });
});

describe('lerValorNota', () => {
  it.each([
    ['1.234,56', 1234.56], ['1234,56', 1234.56], ['1234.56', 1234.56], ['1234', 1234], ['R$ 1.234,56', 1234.56],
    ['  R$  1.234,56 ', 1234.56], ['1.234', 1234], ['1.234.567', 1234567], ['10,5', 10.5], ['0,01', 0.01], ['1234.5', 1234.5],
    [1234.56, 1234.56], [1234.5, 1234.5], [7, 7],
  ])('lê %s', (entrada, esperado) => {
    expect(lerValorNota(entrada)).toBe(esperado);
  });
  it.each([
    '0', '0,00', '-5', 'abc', '', '   ', null, undefined, '1,234', '1.234,567', '12,3,4', '1e3', 'R$', '10000000000', '9999999999,999',
    0, -1, NaN, Infinity, 1.234,
  ])('recusa %s', (entrada) => {
    expect(lerValorNota(entrada)).toBeNull();
  });
  it('aceita o maior valor abaixo do limite', () => {
    expect(lerValorNota('9999999999,99')).toBe(9999999999.99);
  });
});

describe('formatarMoeda', () => {
  it('formata em reais e devolve vazio sem valor', () => {
    expect(formatarMoeda(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
    expect(formatarMoeda('1234.50').replace(/\s/g, ' ')).toBe('R$ 1.234,50');
    expect(formatarMoeda(0).replace(/\s/g, ' ')).toBe('R$ 0,00');
    for (const v of [null, undefined, '', '  ', 'abc']) expect(formatarMoeda(v)).toBe('');
  });
});

describe('formatarDataDia', () => {
  it('corta o texto, sem passar por Date (nenhum desvio de fuso)', () => {
    expect(formatarDataDia('2026-11-05')).toBe('05/11/2026');
    expect(formatarDataDia('2026-01-01')).toBe('01/01/2026');
    expect(formatarDataDia('2026-12-31')).toBe('31/12/2026');
    expect(formatarDataDia('2026-11-05T00:00:00+00:00')).toBe('05/11/2026');
  });
  it('vazio vira vazio', () => {
    for (const v of ['', null, undefined, '  ']) expect(formatarDataDia(v)).toBe('');
  });
});

describe('lerValorNota: ponto fora do lugar', () => {
  it('recusa o que parece erro de digitação em vez de adivinhar', () => {
    expect(lerValorNota('1.50,00')).toBeNull();
    expect(lerValorNota('12.34,56')).toBeNull();
    expect(lerValorNota('1,2,3')).toBeNull();
  });

  it('continua aceitando milhar correto', () => {
    expect(lerValorNota('1.234,56')).toBe(1234.56);
    expect(lerValorNota('1.234.567,8')).toBe(1234567.8);
    expect(lerValorNota('150,00')).toBe(150);
  });
});
