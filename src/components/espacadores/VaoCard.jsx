import { pendenciasVao } from '../../lib/espacadores';

const titulo = { fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.5px', marginBottom: '6px', textTransform: 'uppercase' };
const botaoArquivo = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', background: '#f1f5f9', color: '#475569', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box' };

const Fotos = ({ rotulo, tipo, urls, editavel, enviando, onAdicionar, onRemover, onAmpliar }) => (
  <div>
    <div style={titulo}>{rotulo} ({urls.length})</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {urls.map(url => (
        <div key={url} style={{ position: 'relative', width: '72px', height: '72px' }}>
          <img src={url} alt={rotulo} onClick={() => onAmpliar(url)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'zoom-in' }} />
          {editavel && (
            <button onClick={() => onRemover(tipo, url)} title="Remover foto" style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', border: 'none', background: '#dc2626', color: '#fff', fontSize: '13px', lineHeight: 1, cursor: 'pointer' }}>×</button>
          )}
        </div>
      ))}
      {editavel && (
        <label style={{ ...botaoArquivo, width: '72px', height: '72px', opacity: enviando ? 0.6 : 1, cursor: enviando ? 'wait' : 'pointer' }}>
          {enviando ? 'Enviando…' : '+ Foto'}
          <input type="file" accept="image/*" multiple disabled={enviando} style={{ display: 'none' }}
            onChange={e => { const files = [...e.target.files]; e.target.value = null; if (files.length) onAdicionar(tipo, files); }} />
        </label>
      )}
      {!editavel && urls.length === 0 && <span style={{ fontSize: '12px', color: '#94a3b8' }}>Sem fotos</span>}
    </div>
  </div>
);

const VaoCard = ({ vao, editavel, enviando = {}, onAnexarFotos, onRemoverFoto, onAnexarCroqui, onRemover, onAmpliar }) => {
  const pendencias = pendenciasVao(vao);
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f2544' }}>Vão {vao.numero}</span>
          {pendencias.length === 0 ? (
            <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>✓ Completo</span>
          ) : (
            <span style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>Falta: {pendencias.join(', ')}</span>
          )}
        </div>
        {editavel && (
          <button onClick={() => onRemover(vao)} style={{ padding: '6px 12px', background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            Remover vão
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <Fotos rotulo="Fotos antes" tipo="antes" urls={vao.fotos_antes || []} editavel={editavel} enviando={enviando.antes}
          onAdicionar={(t, f) => onAnexarFotos(vao, t, f)} onRemover={(t, u) => onRemoverFoto(vao, t, u)} onAmpliar={onAmpliar} />
        <Fotos rotulo="Fotos depois" tipo="depois" urls={vao.fotos_depois || []} editavel={editavel} enviando={enviando.depois}
          onAdicionar={(t, f) => onAnexarFotos(vao, t, f)} onRemover={(t, u) => onRemoverFoto(vao, t, u)} onAmpliar={onAmpliar} />
        <div>
          <div style={titulo}>Croqui (PDF)</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {vao.croqui_url ? (
              <a href={vao.croqui_url} target="_blank" rel="noreferrer" style={{ padding: '8px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>
                📄 Abrir croqui
              </a>
            ) : (
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Nenhum croqui</span>
            )}
            {editavel && (
              <label style={{ ...botaoArquivo, opacity: enviando.croqui ? 0.6 : 1, cursor: enviando.croqui ? 'wait' : 'pointer' }}>
                {enviando.croqui ? 'Enviando…' : vao.croqui_url ? 'Trocar' : '+ Anexar PDF'}
                <input type="file" accept="application/pdf" disabled={enviando.croqui} style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files[0]; e.target.value = null; if (f) onAnexarCroqui(vao, f); }} />
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaoCard;
