import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { aplicarTransicao } from '../../lib/espacadoresApi';

const rotulo = { display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: '600' };
const campo = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', background: '#fff' };
const erroTexto = { fontSize: '12px', color: '#dc2626', marginTop: '4px', fontWeight: '600' };

// Etapa Apropriação: o fechamento informa só o nº da apropriação; o serviço vira Pago.
const InformarApropriacaoModal = ({ servico, onClose }) => {
  const { user } = useAuth();
  // Serviço devolvido ao SalesForce guardou o valor anterior
  const [apropriacao, setApropriacao] = useState(servico.apropriacao || '');
  const [salvando, setSalvando] = useState(false);
  const [mostrarErro, setMostrarErro] = useState(false); // true depois da 1ª tentativa de salvar com falta

  const erro = apropriacao.trim() ? null : 'Informe o número da apropriação.';

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape' && !salvando) onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [salvando, onClose]);

  const salvar = async (e) => {
    e.preventDefault();
    if (salvando) return;
    if (erro) { setMostrarErro(true); return; }
    setSalvando(true);
    try {
      await aplicarTransicao(servico, 'apropriacao', { user, apropriacao });
      onClose();
    } catch (err) {
      alert(err.message);
      setSalvando(false);
    }
  };

  return (
    <div onClick={() => { if (!salvando) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' }}>
      <form onSubmit={salvar} noValidate onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '14px', width: 'min(460px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', padding: '22px 24px', boxSizing: 'border-box', boxShadow: '0 24px 60px rgba(15,37,68,0.25)' }}>
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f2544' }}>Informar apropriação</div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', marginBottom: '18px' }}>
          {servico.id} · Trafo <b>{servico.equip || '—'}</b> · NSPR <b>{servico.nsmc || '—'}</b>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={rotulo} htmlFor="apropriacao-numero">Nº da apropriação</label>
          <input id="apropriacao-numero" type="text" autoFocus value={apropriacao} onChange={e => setApropriacao(e.target.value)}
            style={{ ...campo, borderColor: mostrarErro && erro ? '#dc2626' : '#cbd5e1' }} />
          {mostrarErro && erro && <div style={erroTexto}>{erro}</div>}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} disabled={salvando}
            style={{ padding: '11px 18px', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: salvando ? 'not-allowed' : 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando}
            style={{ padding: '11px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: salvando ? 'wait' : 'pointer', opacity: salvando ? 0.7 : 1 }}>
            {salvando ? 'Salvando…' : 'Informar apropriação'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InformarApropriacaoModal;
