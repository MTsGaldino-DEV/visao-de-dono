import { describe, it, expect } from 'vitest';
import { dataConclusao } from './painel';

const h = (msg, when) => ({ who: 'Ana', msg, when });

describe('dataConclusao', () => {
  it('usa a última anotação que de fato conclui o serviço', () => {
    const hist = [
      h('Serviço cadastrado.', '2026-05-01T10:00:00Z'),
      h('Serviço concluído', '2026-05-10T10:00:00Z'),
      h('Serviço cancelado ao remover os serviços de placa do sistema', '2026-10-19T10:00:00Z'),
      h('Cancelamento desfeito: serviço de placa voltou ao status anterior', '2026-10-19T11:00:00Z'),
    ];
    expect(dataConclusao(hist)?.toISOString()).toBe('2026-05-10T10:00:00.000Z');
  });

  it('ignora anotações que só citam a palavra concluído', () => {
    const hist = [
      h('Serviço concluído', '2026-06-01T10:00:00Z'),
      h('Serviço descartado (cancelado) pela aba de concluídos', '2026-10-01T10:00:00Z'),
      h('Serviço restaurado (status "concluido"): teste', '2026-10-02T10:00:00Z'),
    ];
    expect(dataConclusao(hist)?.toISOString()).toBe('2026-06-01T10:00:00.000Z');
  });

  it('aceita a conclusão manual pelo Dono e o envio ao fechamento do fluxo de espaçadores', () => {
    expect(dataConclusao([h('Status alterado para "Concluído" pelo Dono.', '2026-07-01T10:00:00Z')])?.toISOString())
      .toBe('2026-07-01T10:00:00.000Z');
    expect(dataConclusao([h('Instalação enviada para o fechamento', '2026-08-01T10:00:00Z')])?.toISOString())
      .toBe('2026-08-01T10:00:00.000Z');
  });

  it('sem anotação de conclusão ou com data inválida devolve null', () => {
    expect(dataConclusao([h('Serviço cadastrado.', '2026-05-01T10:00:00Z')])).toBeNull();
    expect(dataConclusao([h('Serviço concluído', 'xx')])).toBeNull();
    expect(dataConclusao(null)).toBeNull();
  });
});
