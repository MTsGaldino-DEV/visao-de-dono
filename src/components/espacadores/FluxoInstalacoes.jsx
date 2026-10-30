import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { aplicarTransicao, excluirInstalacao, apagarInstalacaoDefinitivo } from '../../lib/espacadoresApi';
import {
  ETAPAS, filtrarPorBusca, filtrarPorEtapa, contarPorEtapa, formatarData, permissoesFluxo, podeApagarInstalacao,
  linhasPlanilhaInstalacoes,
} from '../../lib/espacadores';
import { useFluxoEspacadores } from './useFluxoEspacadores';
import NovaInstalacaoModal from './NovaInstalacaoModal';
import InstalacaoModal from './InstalacaoModal';
import EtapaBadge from './EtapaBadge';

// Tela única do fluxo novo de espaçadores: instalação, revisão, NSMP, NSPR e pago.
// As ações de cada linha dependem da etapa do serviço e do perfil (permissoesFluxo).

const th = { padding: '12px 16px', fontWeight: '600' };
const td = { padding: '12px 16px' };
const botao = { padding: '6px 14px', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' };
const botaoSec = { ...botao, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' };

const FILTROS = [
  ...Object.entries(ETAPAS).map(([etapa, e]) => ({ etapa, label: e.label })),
  { etapa: 'todas', label: 'Todas' },
];

const VAZIO = {
  instalacao: 'Nenhuma instalação em andamento.',
  todas: 'Nenhuma instalação no fluxo.',
};

// Número que o fechamento informa em cada etapa (a apropriação vem depois da NSPR, já no Pago)
const NUMERO_DA_ETAPA = {
  aguardando_nsmp: { acao: 'nsmp', label: 'NSMP', placeholder: 'Nº NSMP' },
  aguardando_nsmc: { acao: 'nsmc', label: 'NSPR', placeholder: 'Nº NSPR' },
  pago: { acao: 'apropriacao', label: 'apropriação', placeholder: 'Nº apropriação' },
};

const FILA_DO_FECHAMENTO = ['revisao', 'aguardando_nsmp', 'aguardando_nsmc'];

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
  const [numero, setNumero] = useState('');
  const [salvando, setSalvando] = useState(false);

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
  const mostraNumeros = ['aguardando_nsmc', 'pago', 'todas'].includes(filtro);
  const mostraApropriacao = ['pago', 'todas'].includes(filtro);
  const colunas = 7 + (mostraNumeros ? 2 : 0) + (mostraApropriacao ? 1 : 0);
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

  const lista = ordenar(filtrarPorBusca(filtrarPorEtapa(servicos, filtro), busca), filtro);

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
    const numeroDaEtapa = NUMERO_DA_ETAPA[etapa];
    const jaInformado = etapa === 'pago' && String(s.apropriacao || '').trim();
    if (numeroDaEtapa && permissoes.fechar && !jaInformado) {
      if (editandoId === s.id) {
        return (
          <>
            <input autoFocus type="text" placeholder={numeroDaEtapa.placeholder} value={numero} onChange={e => setNumero(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') salvarNumero(s); if (e.key === 'Escape') cancelarEdicao(); }}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', width: '130px', outline: 'none' }} />
            <button onClick={() => salvarNumero(s)} disabled={salvando} style={{ ...botao, background: '#0f2544', color: '#fff', cursor: salvando ? 'wait' : 'pointer' }}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            <button onClick={cancelarEdicao} style={{ ...botao, padding: '6px 10px', background: 'transparent', color: '#94a3b8' }}>✕</button>
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
            + Nova instalação
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

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
            <tr>
              <th style={th}>ID / Localidade</th>
              <th style={th}>Trafo</th>
              <th style={th}>Espaçadores</th>
              <th style={th}>Situação</th>
              {mostraNumeros && <th style={th}>NSMP</th>}
              {mostraNumeros && <th style={th}>NSPR</th>}
              <th style={th}>Equipe</th>
              <th style={th}>Desde</th>
              {mostraApropriacao && <th style={th}>Apropriação</th>}
              <th style={{ ...th, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={colunas} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Carregando…</td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan={colunas} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>{VAZIO[filtro] || `Nenhuma instalação em "${ETAPAS[filtro].label}".`}</td></tr>
            ) : lista.map(s => {
              const vao = vaosPorServico[s.id]?.[0];
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}>
                    <div style={{ fontWeight: '600', color: '#0f2544' }}>{s.id}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.local || '—'}</div>
                  </td>
                  <td style={{ ...td, color: '#334155' }}>{s.equip || '—'}</td>
                  <td style={{ ...td, fontWeight: '700', color: '#475569' }}>{vao?.qtd_espacadores ?? '—'}</td>
                  <td style={td}>
                    {s.etapa_espacador === 'instalacao' && s.motivo_reprovacao_fechamento ? (
                      <div>
                        <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>Reprovado</span>
                        <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '4px', maxWidth: '260px' }}>{s.motivo_reprovacao_fechamento}</div>
                      </div>
                    ) : (
                      <EtapaBadge etapa={s.etapa_espacador} />
                    )}
                  </td>
                  {mostraNumeros && <td style={{ ...td, fontWeight: '700', color: '#7c3aed' }}>{s.numServ || '—'}</td>}
                  {mostraNumeros && <td style={{ ...td, fontWeight: '700', color: '#15803d' }}>{s.nsmc || '—'}</td>}
                  <td style={{ ...td, color: '#334155' }}>{vao?.equipe || '—'}</td>
                  <td style={{ ...td, color: '#64748b', fontSize: '12px' }}>{formatarData(s.dt_etapa)}</td>
                  {mostraApropriacao && <td style={{ ...td, fontWeight: '700', color: '#1d4ed8' }}>{s.apropriacao || '—'}</td>}
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>{acoes(s)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {novaAberta && (
        <NovaInstalacaoModal
          onClose={() => setNovaAberta(false)}
          onConcluir={() => { setNovaAberta(false); trocarFiltro('revisao'); }}
          onErroParcial={(id) => { setNovaAberta(false); trocarFiltro('instalacao'); setAberto({ id, modo: 'edicao' }); }}
        />
      )}
      {aberto && (
        <InstalacaoModal servicoId={aberto.id} modo={aberto.modo} onClose={() => setAberto(null)} />
      )}
    </div>
  );
};

export default FluxoInstalacoes;
