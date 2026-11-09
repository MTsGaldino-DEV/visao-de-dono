import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { aplicarTransicao, excluirInstalacao, apagarInstalacaoDefinitivo } from '../../lib/espacadoresApi';
import {
  ETAPAS, filtrarPorBusca, filtrarPorEtapa, contarPorEtapa, formatarData, permissoesFluxo, podeApagarInstalacao,
  linhasPlanilhaInstalacoes, formatarDataDia, formatarMoeda, TIPOS_SERVICO, tipoServicoDe,
} from '../../lib/espacadores';
import {
  colunasVisiveis, valorColuna, filtrarPorColunas, valoresDaColuna, ordenarPorColuna,
} from '../../lib/listaInstalacoes';
import { useFluxoEspacadores } from './useFluxoEspacadores';
import NovaInstalacaoModal from './NovaInstalacaoModal';
import InstalacaoModal from './InstalacaoModal';
import InformarSalesforceModal from './InformarSalesforceModal';
import EtapaBadge from './EtapaBadge';
import FiltroColunaInstalacoes from './FiltroColunaInstalacoes';

// Tela única do fluxo novo de espaçadores: instalação, revisão, NSMP, NSPR, SF (SalesForce) e pago.
// As ações de cada linha dependem da etapa do serviço e do perfil (permissoesFluxo).
// A lista é uma grade estilo Excel: cabeçalho fixo, filtro por coluna e ordenação.

const BORDA = '1px solid #e2e8f0';
const th = {
  position: 'sticky', top: 0, zIndex: 2, background: '#f8fafc', padding: '8px 6px', fontSize: '11px', fontWeight: '800',
  letterSpacing: '0.03em', textTransform: 'uppercase', color: '#64748b', whiteSpace: 'nowrap', borderRight: BORDA, borderBottom: BORDA,
};
const td = { padding: '7px 6px', borderBottom: BORDA, borderRight: BORDA, color: '#334155', verticalAlign: 'middle', whiteSpace: 'nowrap' };
// Ações congelada à direita em telas largas (no celular ela tomaria quase toda a largura)
const CSS_GRADE = `
.fi-linha { cursor: pointer; }
.fi-linha:hover > td { background-image: linear-gradient(rgba(15,37,68,0.05), rgba(15,37,68,0.05)); }
@media (min-width: 900px) {
  .fi-acoes { position: sticky; right: 0; z-index: 1; background: inherit; box-shadow: -1px 0 0 #e2e8f0; }
  .fi-acoes-cab { right: 0; z-index: 3 !important; box-shadow: -1px 0 0 #e2e8f0; }
}`;
const botao = { padding: '4px 10px', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' };
const botaoSec = { ...botao, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' };

const FILTROS = [
  ...Object.entries(ETAPAS).map(([etapa, e]) => ({ etapa, label: e.label })),
  { etapa: 'todas', label: 'Todas' },
];

const TEXTO_VAZIO = {
  instalacao: 'Nenhuma instalação em andamento.',
  todas: 'Nenhuma instalação no fluxo.',
};

// Número que o fechamento informa em cada etapa (na etapa SF ele informa data, valor e apropriação pelo modal)
const NUMERO_DA_ETAPA = {
  aguardando_nsmp: { acao: 'nsmp', label: 'NSMP', placeholder: 'Nº NSMP' },
  aguardando_nsmc: { acao: 'nsmc', label: 'NSPR', placeholder: 'Nº NSPR' },
};

const FILA_DO_FECHAMENTO = ['revisao', 'aguardando_nsmp', 'aguardando_nsmc', 'sf'];

// Baixa a lista da etapa que está na tela (com a busca aplicada)
const baixarExcel = (lista, vaosPorServico, filtro) => {
  const rotulo = filtro === 'todas' ? 'Todas' : ETAPAS[filtro].label;
  const planilha = XLSX.utils.json_to_sheet(linhasPlanilhaInstalacoes(lista, vaosPorServico));
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, rotulo.slice(0, 31));
  const nome = rotulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
  XLSX.writeFile(livro, `instalacoes_${nome}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
};

const ordenar = (lista, filtro) => {
  const porData = (a, b) => String(a.dt_etapa || '').localeCompare(String(b.dt_etapa || ''));
  // Fila do fechamento: mais antigo primeiro
  if (FILA_DO_FECHAMENTO.includes(filtro)) return lista.sort(porData);
  // Demais: reprovados primeiro, depois os mais recentes
  return lista.sort((a, b) => (!!b.motivo_reprovacao_fechamento - !!a.motivo_reprovacao_fechamento) || porData(b, a));
};

const FluxoInstalacoes = () => {
  const { user } = useAuth();
  const permissoes = permissoesFluxo(user?.role);
  const { servicos, vaosPorServico, carregando, erro } = useFluxoEspacadores('fluxo_instalacoes');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState(permissoes.filtroInicial);
  const [novaAberta, setNovaAberta] = useState(false);
  const [aberto, setAberto] = useState(null); // { id, modo }
  const [excluindoId, setExcluindoId] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [salesforceDe, setSalesforceDe] = useState(null); // serviço do modal "Informar SalesForce"
  const [numero, setNumero] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [filtrosColuna, setFiltrosColuna] = useState({}); // { colunaId: string[] }
  const [ordemColuna, setOrdemColuna] = useState(null); // { coluna, dir }

  const excluir = async (s) => {
    if (!window.confirm(`Excluir a instalação ${s.id}? O vão e as fotos serão apagados e o serviço volta para a lista de serviços em aberto.`)) return;
    setExcluindoId(s.id);
    try { await excluirInstalacao(s, user); } catch (e) { alert('Erro ao excluir: ' + e.message); }
    finally { setExcluindoId(null); }
  };

  const apagarDeVez = async (s) => {
    if (!window.confirm(`Apagar DE VEZ o serviço ${s.id} (trafo ${s.equip || '—'})? Os vãos somem junto e isso não tem volta.`)) return;
    setExcluindoId(s.id);
    try { await apagarInstalacaoDefinitivo(s); } catch (e) { alert('Erro ao apagar: ' + e.message); }
    finally { setExcluindoId(null); }
  };

  const cancelarEdicao = () => { setEditandoId(null); setNumero(''); };

  const salvarNumero = async (s) => {
    if (salvando) return;
    setSalvando(true);
    try {
      await aplicarTransicao(s, NUMERO_DA_ETAPA[s.etapa_espacador].acao, { user, numero });
      cancelarEdicao();
    } catch (e) {
      alert(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const trocarFiltro = (etapa) => { setFiltro(etapa); cancelarEdicao(); };

  const contagem = contarPorEtapa(servicos);
  const visiveis = colunasVisiveis(filtro);
  const idsVisiveis = visiveis.map(c => c.id).join(',');
  const base = useMemo(() => filtrarPorBusca(filtrarPorEtapa(servicos, filtro), busca), [servicos, filtro, busca]);
  // Valores de cada menu: respeitam os filtros das outras colunas, não o da própria (como no Excel)
  const valoresPorColuna = useMemo(() => {
    const ids = idsVisiveis.split(',');
    return Object.fromEntries(ids.map(id => [
      id,
      valoresDaColuna(filtrarPorColunas(base, filtrosColuna, vaosPorServico, { ignorar: id, visiveis: ids }), id, vaosPorServico),
    ]));
  }, [base, filtrosColuna, vaosPorServico, idsVisiveis]);
  const filtrada = filtrarPorColunas(base, filtrosColuna, vaosPorServico, { visiveis: visiveis.map(c => c.id) });
  const lista = ordemColuna && visiveis.some(c => c.id === ordemColuna.coluna)
    ? ordenarPorColuna(filtrada, ordemColuna, vaosPorServico)
    : ordenar([...filtrada], filtro);
  const colunasComFiltro = visiveis.filter(c => filtrosColuna[c.id]?.length);

  const definirFiltroColuna = (id, valores) => setFiltrosColuna(f => {
    const novo = { ...f };
    if (valores?.length) novo[id] = valores; else delete novo[id];
    return novo;
  });

  const modoAoAbrir = (s) => {
    if (s.etapa_espacador === 'instalacao' && permissoes.instalar) return 'edicao';
    if (s.etapa_espacador === 'revisao' && permissoes.fechar) return 'revisao';
    return 'leitura';
  };

  const abrirLinha = (s) => {
    // Texto selecionado: o usuário está copiando a célula, não abrindo a instalação
    if (window.getSelection()?.toString()) return;
    setAberto({ id: s.id, modo: modoAoAbrir(s) });
  };

  const acoes = (s) => (
    <>
      {acoesDaEtapa(s)}
      {podeApagarInstalacao(user) && (
        <button onClick={() => apagarDeVez(s)} disabled={excluindoId === s.id} style={{ ...botao, background: '#7f1d1d', color: '#fff', cursor: excluindoId === s.id ? 'not-allowed' : 'pointer' }}>
          {excluindoId === s.id ? 'Apagando…' : 'Apagar'}
        </button>
      )}
    </>
  );

  const acoesDaEtapa = (s) => {
    const etapa = s.etapa_espacador;
    const verDetalhes = <button onClick={() => setAberto({ id: s.id, modo: 'leitura' })} style={botaoSec}>Ver detalhes</button>;

    if (etapa === 'instalacao' && permissoes.instalar) {
      return (
        <>
          <button onClick={() => excluir(s)} disabled={excluindoId === s.id} style={{ ...botao, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', cursor: excluindoId === s.id ? 'not-allowed' : 'pointer' }}>
            {excluindoId === s.id ? 'Excluindo…' : 'Excluir'}
          </button>
          <button onClick={() => setAberto({ id: s.id, modo: 'edicao' })} style={{ ...botao, background: '#0f2544', color: '#fff' }}>Abrir</button>
        </>
      );
    }
    if (etapa === 'revisao' && permissoes.fechar) {
      return <button onClick={() => setAberto({ id: s.id, modo: 'revisao' })} style={{ ...botao, background: '#0f2544', color: '#fff' }}>Revisar →</button>;
    }
    if (etapa === 'sf' && permissoes.fechar) {
      return (
        <>
          {verDetalhes}
          <button onClick={() => setSalesforceDe(s)} style={{ ...botao, background: '#1d4ed8', color: '#fff' }}>Informar SalesForce</button>
        </>
      );
    }
    const numeroDaEtapa = NUMERO_DA_ETAPA[etapa];
    if (numeroDaEtapa && permissoes.fechar) {
      if (editandoId === s.id) {
        return (
          <>
            <input autoFocus type="text" placeholder={numeroDaEtapa.placeholder} value={numero} onChange={e => setNumero(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') salvarNumero(s); if (e.key === 'Escape') cancelarEdicao(); }}
              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', width: '130px', outline: 'none' }} />
            <button onClick={() => salvarNumero(s)} disabled={salvando} style={{ ...botao, background: '#0f2544', color: '#fff', cursor: salvando ? 'wait' : 'pointer' }}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            <button onClick={cancelarEdicao} style={{ ...botao, background: 'transparent', color: '#94a3b8' }}>✕</button>
          </>
        );
      }
      return (
        <>
          {verDetalhes}
          <button onClick={() => { setEditandoId(s.id); setNumero(''); }} style={{ ...botao, background: '#1d4ed8', color: '#fff' }}>
            Informar {numeroDaEtapa.label}
          </button>
        </>
      );
    }
    return verDetalhes;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {permissoes.instalar && (
          <button onClick={() => setNovaAberta(true)} style={{ padding: '10px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            + Novo serviço
          </button>
        )}
        <input type="text" placeholder="Buscar por ID, trafo ou localidade..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', flex: '1 1 260px', maxWidth: '400px' }} />
        <button onClick={() => baixarExcel(lista, vaosPorServico, filtro)} disabled={carregando || lista.length === 0}
          title={`Baixar ${lista.length} instalações de "${filtro === 'todas' ? 'Todas' : ETAPAS[filtro].label}"`}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: '13px', fontWeight: '700', cursor: carregando || lista.length === 0 ? 'not-allowed' : 'pointer', opacity: carregando || lista.length === 0 ? 0.5 : 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Baixar Excel
        </button>
      </div>

      {erro && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', padding: '12px 14px', fontSize: '13px' }}>
          <b>Não foi possível carregar as instalações:</b> {erro}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {FILTROS.map(f => {
          const ativo = filtro === f.etapa;
          const n = contagem[f.etapa];
          return (
            <button key={f.etapa} onClick={() => trocarFiltro(f.etapa)}
              style={{ padding: '8px 16px', background: ativo ? '#0f2544' : '#fff', color: ativo ? '#fff' : '#64748b', border: '1px solid', borderColor: ativo ? '#0f2544' : '#e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {f.label}
              {n > 0 && <span style={{ background: ativo ? 'rgba(255,255,255,0.25)' : '#f1f5f9', color: ativo ? '#fff' : '#64748b', borderRadius: '20px', fontSize: '11px', fontWeight: '700', padding: '1px 7px' }}>{n}</span>}
            </button>
          );
        })}
      </div>

      {colunasComFiltro.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
          <span style={{ fontWeight: '700' }}>Filtros:</span>
          {colunasComFiltro.map(c => (
            <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '100%', background: '#eff6ff', color: '#1d4ed8', borderRadius: '20px', padding: '3px 6px 3px 10px', fontWeight: '600' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '420px' }}>
                {c.rotulo}: {filtrosColuna[c.id].join(', ')}
              </span>
              <button type="button" aria-label={`Remover filtro ${c.rotulo}`} onClick={() => definirFiltroColuna(c.id, null)}
                style={{ border: 'none', background: 'transparent', color: '#1d4ed8', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}>×</button>
            </span>
          ))}
          <button type="button" onClick={() => setFiltrosColuna({})}
            style={{ border: 'none', background: 'transparent', color: '#1d4ed8', cursor: 'pointer', fontSize: '12px', fontWeight: '700', padding: '3px 6px' }}>
            Limpar todos
          </button>
        </div>
      )}

      <div style={{ background: '#fff', border: BORDA, borderRadius: '12px', overflow: 'hidden' }}>
        <style>{CSS_GRADE}</style>
        <div style={{ padding: '10px 16px', borderBottom: BORDA, fontSize: '12px', color: '#64748b' }}>
          <b>{lista.length}</b> {lista.length === 1 ? 'instalação' : 'instalações'}
        </div>
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 280px)', minHeight: '200px' }}>
          <table style={{ width: '100%', minWidth: '1080px', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr>
                {visiveis.map(c => (
                  <th key={c.id} title={c.rotulo} style={{ ...th, textAlign: c.numero ? 'right' : 'left' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {c.curto || c.rotulo}
                      {ordemColuna?.coluna === c.id && <span aria-label={ordemColuna.dir === 'asc' ? 'ordem crescente' : 'ordem decrescente'} style={{ color: '#1d4ed8' }}>{ordemColuna.dir === 'asc' ? '↑' : '↓'}</span>}
                      <FiltroColunaInstalacoes coluna={c} valores={valoresPorColuna[c.id] || []} selecionados={filtrosColuna[c.id]}
                        ordem={ordemColuna?.coluna === c.id ? ordemColuna.dir : null} ativo={!!filtrosColuna[c.id]?.length}
                        // Clicar de novo na ordem atual volta à ordem padrão da etapa
                        onOrdenar={dir => setOrdemColuna(o => (o?.coluna === c.id && o.dir === dir ? null : { coluna: c.id, dir }))}
                        onFiltrar={valores => definirFiltroColuna(c.id, valores)} />
                    </span>
                  </th>
                ))}
                <th className="fi-acoes-cab" style={{ ...th, textAlign: 'right', borderRight: 'none' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={visiveis.length + 1} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Carregando…</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={visiveis.length + 1} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                  {colunasComFiltro.length > 0 ? 'Nenhuma instalação com esses filtros.' : (TEXTO_VAZIO[filtro] || `Nenhuma instalação em "${ETAPAS[filtro].label}".`)}
                </td></tr>
              ) : lista.map(s => {
                const vao = vaosPorServico[s.id]?.[0];
                const reprovado = s.etapa_espacador === 'instalacao' && !!s.motivo_reprovacao_fechamento;
                const celula = (id) => {
                  switch (id) {
                    case 'id':
                      return (
                        <td key={id} style={td}>
                          <button type="button" aria-label={`Abrir instalação ${s.id}`}
                            onClick={e => { e.stopPropagation(); setAberto({ id: s.id, modo: modoAoAbrir(s) }); }}
                            style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', fontWeight: '700', color: '#0f2544', cursor: 'pointer', textAlign: 'left' }}>
                            {s.id}
                          </button>
                        </td>
                      );
                    case 'local': return <td key={id} style={td}>{s.local || '—'}</td>;
                    case 'equip': return <td key={id} style={td}>{s.equip || '—'}</td>;
                    case 'servico': return <td key={id} style={td}>{TIPOS_SERVICO[tipoServicoDe(s)].label}</td>;
                    case 'qtd': return <td key={id} style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: '700', color: '#475569' }}>{vao?.qtd_espacadores ?? '—'}</td>;
                    case 'situacao':
                      return (
                        <td key={id} style={td}>
                          {reprovado ? (
                            <div>
                              <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>Reprovado</span>
                              <div title={s.motivo_reprovacao_fechamento} style={{ fontSize: '12px', color: '#991b1b', marginTop: '4px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.motivo_reprovacao_fechamento}</div>
                            </div>
                          ) : (
                            <EtapaBadge etapa={s.etapa_espacador} />
                          )}
                        </td>
                      );
                    case 'nsmp': return <td key={id} style={{ ...td, fontWeight: '700', color: s.numServ ? '#7c3aed' : '#94a3b8' }}>{s.numServ || '—'}</td>;
                    case 'nspr': return <td key={id} style={{ ...td, fontWeight: '700', color: s.nsmc ? '#15803d' : '#94a3b8' }}>{s.nsmc || '—'}</td>;
                    case 'equipe': return <td key={id} style={td}>{vao?.equipe || '—'}</td>;
                    case 'desde': return <td key={id} title={formatarData(s.dt_etapa)} style={{ ...td, color: '#64748b' }}>{valorColuna('desde', s) || '—'}</td>;
                    case 'apropriacao': return <td key={id} style={{ ...td, fontWeight: '700', color: s.apropriacao ? '#1d4ed8' : '#94a3b8' }}>{s.apropriacao || '—'}</td>;
                    case 'lancamento_sf': return <td key={id} style={{ ...td, whiteSpace: 'nowrap', color: s.data_lancamento_sf ? '#334155' : '#94a3b8' }}>{formatarDataDia(s.data_lancamento_sf) || '—'}</td>;
                    case 'valor_nota': return <td key={id} style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: '700', color: formatarMoeda(s.valor_nota) ? '#15803d' : '#94a3b8' }}>{formatarMoeda(s.valor_nota) || '—'}</td>;
                    default: return null;
                  }
                };
                return (
                  <tr key={s.id} className="fi-linha" onClick={() => abrirLinha(s)} style={{ background: reprovado ? '#fef2f2' : '#fff' }}>
                    {visiveis.map(c => celula(c.id))}
                    <td className="fi-acoes" onClick={e => e.stopPropagation()} style={{ ...td, borderRight: 'none', textAlign: 'right', cursor: 'default' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>{acoes(s)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {novaAberta && (
        <NovaInstalacaoModal
          onClose={() => setNovaAberta(false)}
          onConcluir={() => { setNovaAberta(false); setFiltrosColuna({}); trocarFiltro('revisao'); }}
          onErroParcial={(id) => { setNovaAberta(false); setFiltrosColuna({}); trocarFiltro('instalacao'); setAberto({ id, modo: 'edicao' }); }}
        />
      )}
      {aberto && (
        <InstalacaoModal servicoId={aberto.id} modo={aberto.modo} onClose={() => setAberto(null)} />
      )}
      {salesforceDe && (
        <InformarSalesforceModal servico={salesforceDe} onClose={() => setSalesforceDe(null)} />
      )}
    </div>
  );
};

export default FluxoInstalacoes;
