import { useEffect, useMemo } from 'react';
import { validarCoordenadaVao, coordenadaComVirgula, MENSAGEM_COORDENADA } from '../../lib/espacadores';

const titulo = { fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.5px', marginBottom: '6px', textTransform: 'uppercase' };
const botaoArquivo = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', background: '#f1f5f9', color: '#475569', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box' };

// Uma foto (arquivo local ainda não enviado ou URL já salva) com a coordenada digitada logo abaixo.
// mostrarErros: true depois de uma tentativa de enviar — destaca em vermelho o que ainda falta.
const CampoFoto = ({ rotulo, arquivo = null, url = null, coord = '', onCoord, onArquivo, editavel = false, enviando = false, mostrarErros = false, onAmpliar }) => {
  const preview = useMemo(() => (arquivo ? URL.createObjectURL(arquivo) : null), [arquivo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const src = preview || url;
  const coordVazia = !coord?.trim();
  const validacao = validarCoordenadaVao(coord);
  const coordInvalidaDigitada = !coordVazia && !validacao.ok;
  const erroCoord = coordInvalidaDigitada || (mostrarErros && coordVazia);
  const faltaFoto = mostrarErros && editavel && !src;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={titulo}>{rotulo}</div>
      {src ? (
        <img src={src} alt={rotulo} onClick={() => onAmpliar?.(src)}
          style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: onAmpliar ? 'zoom-in' : 'default' }} />
      ) : (
        <div style={{ height: '160px', borderRadius: '8px', border: `1px dashed ${faltaFoto ? '#dc2626' : '#cbd5e1'}`, background: faltaFoto ? '#fef2f2' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: faltaFoto ? '#dc2626' : '#94a3b8' }}>
          {editavel ? 'Nenhuma foto selecionada' : 'Sem foto'}
        </div>
      )}
      {editavel && (
        <label style={{ ...botaoArquivo, opacity: enviando ? 0.6 : 1, cursor: enviando ? 'wait' : 'pointer' }}>
          {enviando ? 'Enviando…' : src ? 'Trocar foto' : '📷 Selecionar foto'}
          <input type="file" accept="image/*" disabled={enviando} style={{ display: 'none' }}
            onChange={e => { const f = e.target.files[0]; e.target.value = null; if (f) onArquivo(f); }} />
        </label>
      )}
      {editavel ? (
        <div>
          <input value={coord} placeholder="-18,844040 -41,957216" onChange={e => onCoord(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${erroCoord ? '#dc2626' : '#cbd5e1'}`, fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
          {erroCoord && <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>{coordVazia ? 'Coordenada obrigatória' : MENSAGEM_COORDENADA[validacao.motivo]}</div>}
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: '#475569' }}>
          <span style={{ color: '#94a3b8' }}>Coordenada:</span> {coordenadaComVirgula(coord) || coord || '—'}
        </div>
      )}
    </div>
  );
};

export default CampoFoto;
