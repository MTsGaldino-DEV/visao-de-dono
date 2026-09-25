import { useState } from 'react';
import { resumoVaos, filtrarPorBusca, formatarData } from '../../lib/espacadores';
import { useFluxoEspacadores } from './useFluxoEspacadores';
import NovaInstalacaoModal from './NovaInstalacaoModal';
import InstalacaoModal from './InstalacaoModal';

const th = { padding: '12px 16px', fontWeight: '600' };
const td = { padding: '12px 16px' };

const InstalacoesSection = () => {
  const { servicos, vaosPorServico, carregando } = useFluxoEspacadores('espacadores_instalacoes');
  const [busca, setBusca] = useState('');
  const [novaAberta, setNovaAberta] = useState(false);
  const [abertoId, setAbertoId] = useState(null);

  // Reprovados primeiro, depois os mais recentes
  const lista = filtrarPorBusca(servicos.filter(s => s.etapa_espacador === 'instalacao'), busca)
    .sort((a, b) => (!!b.motivo_reprovacao_fechamento - !!a.motivo_reprovacao_fechamento)
      || String(b.dt_etapa || '').localeCompare(String(a.dt_etapa || '')));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setNovaAberta(true)} style={{ padding: '10px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
          + Nova instalação
        </button>
        <input type="text" placeholder="Buscar por ID, trafo ou localidade..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', flex: '1 1 260px', maxWidth: '400px' }} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
            <tr>
              <th style={th}>ID / Localidade</th>
              <th style={th}>Trafo</th>
              <th style={th}>Vãos</th>
              <th style={th}>Situação</th>
              <th style={th}>Desde</th>
              <th style={{ ...th, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Carregando…</td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Nenhuma instalação em andamento.</td></tr>
            ) : lista.map(s => {
              const { total, completos } = resumoVaos(vaosPorServico[s.id] || []);
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}>
                    <div style={{ fontWeight: '600', color: '#0f2544' }}>{s.id}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.local || '—'}</div>
                  </td>
                  <td style={{ ...td, color: '#334155' }}>{s.equip || '—'}</td>
                  <td style={td}>
                    <span style={{ fontWeight: '700', color: total > 0 && completos === total ? '#15803d' : '#475569' }}>{completos}/{total}</span>
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}> completos</span>
                  </td>
                  <td style={td}>
                    {s.motivo_reprovacao_fechamento ? (
                      <div>
                        <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>Reprovado</span>
                        <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '4px', maxWidth: '260px' }}>{s.motivo_reprovacao_fechamento}</div>
                      </div>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Em preenchimento</span>
                    )}
                  </td>
                  <td style={{ ...td, color: '#64748b', fontSize: '12px' }}>{formatarData(s.dt_etapa)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => setAbertoId(s.id)} style={{ padding: '6px 14px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                      Abrir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {novaAberta && (
        <NovaInstalacaoModal onClose={() => setNovaAberta(false)} onAbrir={(id) => { setNovaAberta(false); setAbertoId(id); }} />
      )}
      {abertoId && (
        <InstalacaoModal servicoId={abertoId} modo="edicao" onClose={() => setAbertoId(null)} />
      )}
    </div>
  );
};

export default InstalacoesSection;
