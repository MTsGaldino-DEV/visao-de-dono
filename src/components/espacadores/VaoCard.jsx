import { pendenciasInstalacao, qtdValida } from '../../lib/espacadores';
import CampoFoto from './CampoFoto';

const titulo = { fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.5px', marginBottom: '6px', textTransform: 'uppercase' };
const botaoArquivo = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', background: '#f1f5f9', color: '#475569', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box' };
const inputQtd = { width: '100px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
const botaoSalvar = { padding: '8px 14px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' };
const selo = (cor, bg, borda) => ({ background: bg, color: cor, border: `1px solid ${borda}`, fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' });

// O vão único da instalação. modo: 'edicao' (despachante), 'revisao' (fechamento) ou 'leitura'.
// vao pode ser null quando o envio caiu antes de criar a linha; no modo edição os campos aparecem vazios.
// O que está digitado (rascunho) fica no modal, que bloqueia enviar/aprovar enquanto houver alteração sem salvar.
const VaoCard = ({ vao, modo, rascunho, alteracoes, onRascunho, enviando = {}, onTrocarFoto, onSalvarDados, onSalvarQtd, onAnexarCroqui, onAmpliar }) => {
  const { coordAntes, coordDepois, qtd } = rascunho;

  const edicao = modo === 'edicao';
  const revisao = modo === 'revisao';
  const pendencias = pendenciasInstalacao(vao);

  const temAlteracao = Object.keys(alteracoes.campos).length > 0;
  const qtdMudou = 'qtd_espacadores' in alteracoes.campos;

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f2544' }}>Vão</span>
        {edicao && (pendencias.length === 0
          ? <span style={selo('#15803d', '#f0fdf4', '#bbf7d0')}>✓ Completo</span>
          : <span style={selo('#92400e', '#fffbeb', '#fde68a')}>Falta: {pendencias.join(', ')}</span>)}
        {!edicao && (vao?.croqui_url
          ? <span style={selo('#15803d', '#f0fdf4', '#bbf7d0')}>✓ Croqui anexado</span>
          : <span style={selo('#92400e', '#fffbeb', '#fde68a')}>Sem croqui</span>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <CampoFoto rotulo="Foto do antes" url={vao?.fotos_antes?.[0]} coord={edicao ? coordAntes : vao?.coord_antes}
          onCoord={v => onRascunho('coordAntes', v)} onArquivo={f => onTrocarFoto('antes', f)} editavel={edicao} enviando={enviando.antes} onAmpliar={onAmpliar} />
        <CampoFoto rotulo="Foto do depois" url={vao?.fotos_depois?.[0]} coord={edicao ? coordDepois : vao?.coord_depois}
          onCoord={v => onRascunho('coordDepois', v)} onArquivo={f => onTrocarFoto('depois', f)} editavel={edicao} enviando={enviando.depois} onAmpliar={onAmpliar} />
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={titulo}>Espaçadores instalados</div>
          {edicao || revisao ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="number" min="1" step="1" value={qtd} onChange={e => onRascunho('qtd', e.target.value)}
                style={{ ...inputQtd, borderColor: qtd !== '' && !qtdValida(qtd) ? '#dc2626' : '#cbd5e1' }} />
              {revisao && (
                <button onClick={onSalvarQtd} disabled={!qtdMudou} style={{ ...botaoSalvar, opacity: qtdMudou ? 1 : 0.5, cursor: qtdMudou ? 'pointer' : 'not-allowed' }}>Salvar</button>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544' }}>{vao?.qtd_espacadores ?? '—'}</div>
          )}
        </div>

        {edicao && (
          <button onClick={onSalvarDados} disabled={!temAlteracao}
            style={{ ...botaoSalvar, opacity: temAlteracao ? 1 : 0.5, cursor: temAlteracao ? 'pointer' : 'not-allowed' }}>
            Salvar alterações
          </button>
        )}

        {!edicao && (
          <div>
            <div style={titulo}>Croqui (PDF)</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {vao?.croqui_url ? (
                <a href={vao.croqui_url} target="_blank" rel="noreferrer" style={{ padding: '8px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>
                  📄 Abrir croqui
                </a>
              ) : (
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Nenhum croqui</span>
              )}
              {revisao && vao && (
                <label style={{ ...botaoArquivo, opacity: enviando.croqui ? 0.6 : 1, cursor: enviando.croqui ? 'wait' : 'pointer' }}>
                  {enviando.croqui ? 'Enviando…' : vao.croqui_url ? 'Trocar' : '+ Anexar PDF'}
                  <input type="file" accept="application/pdf" disabled={enviando.croqui} style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files[0]; e.target.value = null; if (f) onAnexarCroqui(f); }} />
                </label>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VaoCard;
