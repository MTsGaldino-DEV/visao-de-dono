import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { resumoVaos, filtrarPorBusca, formatarData } from '../lib/espacadores';
import { aplicarTransicao } from '../lib/espacadoresApi';
import { useFluxoEspacadores } from './espacadores/useFluxoEspacadores';
import InstalacaoModal from './espacadores/InstalacaoModal';

const SECOES = [
  { etapa: 'revisao', label: 'Revisão', vazio: 'Nenhuma instalação aguardando revisão.' },
  { etapa: 'aguardando_nsmp', label: 'Aguardando NSMP', vazio: 'Nenhuma instalação aguardando NSMP.', acao: 'nsmp', placeholder: 'Nº NSMP' },
  { etapa: 'aguardando_nsmc', label: 'Aguardando NSMC', vazio: 'Nenhuma instalação aguardando NSMC.', acao: 'nsmc', placeholder: 'Nº NSMC' },
  { etapa: 'pago', label: 'Pagos', vazio: 'Nenhuma instalação paga ainda.' },
];

const th = { padding: '12px 16px', fontWeight: '600' };
const td = { padding: '12px 16px' };
const botaoSec = { padding: '6px 14px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' };

const FechamentoTab = () => {
  const { user } = useAuth();
  const { servicos, vaosPorServico, carregando } = useFluxoEspacadores('fechamento_espacadores');
  const [ativa, setAtiva] = useState('revisao');
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(null); // { id, modo }
  const [editandoId, setEditandoId] = useState(null);
  const [numero, setNumero] = useState('');
  const [salvando, setSalvando] = useState(false);

  const secao = SECOES.find(s => s.etapa === ativa);
  const contagem = (etapa) => servicos.filter(s => s.etapa_espacador === etapa).length;
  const lista = filtrarPorBusca(servicos.filter(s => s.etapa_espacador === ativa), busca)
    .sort((a, b) => String(a.dt_etapa || '').localeCompare(String(b.dt_etapa || ''))); // mais antigo primeiro

  const cancelarEdicao = () => { setEditandoId(null); setNumero(''); };

  const salvarNumero = async (servico) => {
    if (salvando) return;
    setSalvando(true);
    try {
      await aplicarTransicao(servico, secao.acao, { user, numero });
      cancelarEdicao();
    } catch (e) {
      alert(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', flexWrap: 'wrap' }}>
        {SECOES.map(s => {
          const ativo = ativa === s.etapa;
          const n = contagem(s.etapa);
          return (
            <button key={s.etapa} onClick={() => { setAtiva(s.etapa); cancelarEdicao(); }}
              style={{ padding: '8px 16px', background: ativo ? '#0f2544' : '#fff', color: ativo ? '#fff' : '#64748b', border: '1px solid', borderColor: ativo ? '#0f2544' : '#e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {s.label}
              {n > 0 && <span style={{ background: ativo ? 'rgba(255,255,255,0.25)' : '#f1f5f9', color: ativo ? '#fff' : '#64748b', borderRadius: '20px', fontSize: '11px', fontWeight: '700', padding: '1px 7px' }}>{n}</span>}
            </button>
          );
        })}
      </div>

      <input type="text" placeholder="Buscar por ID, trafo ou localidade..." value={busca} onChange={e => setBusca(e.target.value)}
        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', maxWidth: '400px' }} />

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
            <tr>
              <th style={th}>ID / Localidade</th>
              <th style={th}>Trafo</th>
              <th style={th}>Vãos</th>
              {(ativa === 'aguardando_nsmc' || ativa === 'pago') && <th style={th}>NSMP</th>}
              {ativa === 'pago' && <th style={th}>NSMC</th>}
              <th style={th}>Desde</th>
              <th style={{ ...th, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Carregando…</td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>{secao.vazio}</td></tr>
            ) : lista.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={td}>
                  <div style={{ fontWeight: '600', color: '#0f2544' }}>{s.id}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.local || '—'}</div>
                </td>
                <td style={{ ...td, color: '#334155' }}>{s.equip || '—'}</td>
                <td style={{ ...td, fontWeight: '700', color: '#475569' }}>{resumoVaos(vaosPorServico[s.id] || []).total}</td>
                {(ativa === 'aguardando_nsmc' || ativa === 'pago') && <td style={{ ...td, fontWeight: '700', color: '#7c3aed' }}>{s.numServ || '—'}</td>}
                {ativa === 'pago' && <td style={{ ...td, fontWeight: '700', color: '#15803d' }}>{s.nsmc || '—'}</td>}
                <td style={{ ...td, color: '#64748b', fontSize: '12px' }}>{formatarData(s.dt_etapa)}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {secao.acao && editandoId === s.id ? (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <input autoFocus type="text" placeholder={secao.placeholder} value={numero} onChange={e => setNumero(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') salvarNumero(s); if (e.key === 'Escape') cancelarEdicao(); }}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', width: '130px', outline: 'none' }} />
                      <button onClick={() => salvarNumero(s)} disabled={salvando} style={{ padding: '6px 12px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: salvando ? 'wait' : 'pointer' }}>
                        {salvando ? 'Salvando…' : 'Salvar'}
                      </button>
                      <button onClick={cancelarEdicao} style={{ padding: '6px 10px', background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {ativa === 'revisao' ? (
                        <button onClick={() => setModal({ id: s.id, modo: 'revisao' })} style={{ padding: '6px 14px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                          Revisar →
                        </button>
                      ) : (
                        <button onClick={() => setModal({ id: s.id, modo: 'leitura' })} style={botaoSec}>Ver detalhes</button>
                      )}
                      {secao.acao && (
                        <button onClick={() => { setEditandoId(s.id); setNumero(''); }} style={{ padding: '6px 14px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                          Informar {secao.acao.toUpperCase()}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && <InstalacaoModal servicoId={modal.id} modo={modal.modo} onClose={() => setModal(null)} />}
    </div>
  );
};

export default FechamentoTab;
