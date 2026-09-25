import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { buscarServicosPorTrafo, criarServicoEspacador, iniciarInstalacao } from '../../lib/espacadoresApi';
import { bloqueioNovaInstalacao } from '../../lib/espacadores';
import { TODAS_LOCALIDADES } from '../ServicosTable';
import EtapaBadge from './EtapaBadge';

const input = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', background: '#fff' };
const rotulo = { display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: '600' };

const NovaInstalacaoModal = ({ onClose, onAbrir }) => {
  const { user } = useAuth();
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState(null); // null = ainda não buscou
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState({ equip: '', local: '', coord: '' });

  const buscar = async () => {
    if (!texto.trim()) return;
    setBuscando(true);
    try {
      const r = await buscarServicosPorTrafo(texto);
      setResultados(r);
      if (!r.some(s => !bloqueioNovaInstalacao(s))) setNovo({ equip: texto.trim(), local: '', coord: '' });
    } catch (e) {
      alert('Erro na busca: ' + e.message);
    } finally {
      setBuscando(false);
    }
  };

  const utilizaveis = (resultados || []).filter(s => !bloqueioNovaInstalacao(s));

  const usar = async (servico) => {
    if (servico.etapa_espacador) { onAbrir(servico.id); return; }
    setSalvando(true);
    try {
      await iniciarInstalacao(servico, user);
      onAbrir(servico.id);
    } catch (e) {
      alert(e.message);
      setSalvando(false);
    }
  };

  const cadastrar = async () => {
    if (!novo.equip.trim() || !novo.local.trim() || !novo.coord.trim()) {
      alert('Preencha trafo, localidade e coordenada.');
      return;
    }
    setSalvando(true);
    try {
      const criado = await criarServicoEspacador(novo, user);
      await iniciarInstalacao(criado, user);
      onAbrir(criado.id);
    } catch (e) {
      alert('Erro ao cadastrar: ' + e.message);
      setSalvando(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.65)', zIndex: 1000, backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1001, background: '#fff', borderRadius: '16px', width: '92%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(15,37,68,0.25)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ fontSize: '17px', fontWeight: '800', color: '#0f2544' }}>Nova instalação</div>
          <button onClick={onClose} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={rotulo}>Trafo</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input autoFocus value={texto} placeholder="Ex.: 763-3-45"
                onChange={e => { setTexto(e.target.value); setResultados(null); }}
                onKeyDown={e => { if (e.key === 'Enter') buscar(); }}
                style={input} />
              <button onClick={buscar} disabled={buscando || !texto.trim()} style={{ padding: '10px 18px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {buscando ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
          </div>

          {resultados && utilizaveis.length > 1 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: '8px', padding: '10px 12px', fontSize: '12px' }}>
              Há mais de um serviço para este trafo — considere resolver na aba Duplicidade.
            </div>
          )}

          {resultados && resultados.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {resultados.map(s => {
                const bloqueio = bloqueioNovaInstalacao(s);
                return (
                  <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', opacity: bloqueio ? 0.7 : 1 }}>
                    <div style={{ fontSize: '13px', color: '#475569' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <b style={{ color: '#0f2544' }}>{s.id}</b>
                        <EtapaBadge etapa={s.etapa_espacador} />
                      </div>
                      <div><span style={{ color: '#94a3b8' }}>Trafo:</span> {s.equip} <span style={{ color: '#cbd5e1' }}>·</span> {s.local || '—'}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Status: {s.status}</div>
                      {bloqueio && <div style={{ fontSize: '12px', color: '#92400e', marginTop: '4px' }}>{bloqueio}</div>}
                    </div>
                    {!bloqueio && (
                      <button onClick={() => usar(s)} disabled={salvando} style={{ padding: '8px 14px', background: s.etapa_espacador ? '#f8fafc' : '#1d4ed8', color: s.etapa_espacador ? '#0f2544' : '#fff', border: s.etapa_espacador ? '1px solid #e2e8f0' : 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {s.etapa_espacador ? 'Abrir instalação' : 'Usar este serviço'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {resultados && utilizaveis.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
              <div style={{ fontSize: '13px', color: '#475569' }}>
                {resultados.length === 0
                  ? 'Nenhum serviço de espaçador ativo para este trafo. Cadastre um novo:'
                  : 'Nenhum dos serviços acima pode receber a instalação. Cadastre um novo:'}
              </div>
              <div>
                <label style={rotulo}>Trafo</label>
                <input value={novo.equip} onChange={e => setNovo(n => ({ ...n, equip: e.target.value }))} style={input} />
              </div>
              <div>
                <label style={rotulo}>Localidade</label>
                <select value={novo.local} onChange={e => setNovo(n => ({ ...n, local: e.target.value }))} style={input}>
                  <option value="">Selecione…</option>
                  {TODAS_LOCALIDADES.map(l => <option key={l.loc} value={l.loc}>{l.loc}</option>)}
                </select>
              </div>
              <div>
                <label style={rotulo}>Coordenada</label>
                <input value={novo.coord} placeholder="-18.844040 -41.957216" onChange={e => setNovo(n => ({ ...n, coord: e.target.value }))} style={input} />
              </div>
              <button onClick={cadastrar} disabled={salvando} style={{ padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                {salvando ? 'Cadastrando…' : 'Cadastrar e continuar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NovaInstalacaoModal;
