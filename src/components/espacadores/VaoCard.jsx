import { pendenciasInstalacao, qtdValida } from '../../lib/espacadores';
import CampoFoto from './CampoFoto';

const titulo = { fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.5px', marginBottom: '6px', textTransform: 'uppercase' };
const inputEquipe = { width: '160px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
const inputQtd = { width: '100px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
const botaoSalvar = { padding: '8px 14px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' };
const selo = (cor, bg, borda) => ({ background: bg, color: cor, border: `1px solid ${borda}`, fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' });

// O vão único da instalação. modo: 'edicao' (despachante, ou quem fecha corrigindo) ou 'leitura'.
// vao pode ser null quando o envio caiu antes de criar a linha; no modo edição os campos aparecem vazios.
// O que está digitado (rascunho) fica no modal, que bloqueia enviar/aprovar enquanto houver alteração sem salvar.
// onSalvarDados ausente: o modal salva tudo junto no rodapé.
const VaoCard = ({ vao, modo, rascunho, alteracoes, onRascunho, enviando = {}, mostrarErros = false, onTrocarFoto, onSalvarDados, onAmpliar }) => {
  const { coordAntes, coordDepois, qtd, equipe } = rascunho;

  const edicao = modo === 'edicao';
  const pendencias = pendenciasInstalacao(vao);
  const destacarFalta = edicao && mostrarErros;

  const temAlteracao = Object.keys(alteracoes.campos).length > 0;

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f2544' }}>Vão</span>
        {edicao && (pendencias.length === 0
          ? <span style={selo('#15803d', '#f0fdf4', '#bbf7d0')}>✓ Completo</span>
          : <span style={selo('#92400e', '#fffbeb', '#fde68a')}>Falta: {pendencias.join(', ')}</span>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <CampoFoto rotulo="Foto do antes" url={vao?.fotos_antes?.[0]} coord={edicao ? coordAntes : vao?.coord_antes}
          onCoord={v => onRascunho('coordAntes', v)} onArquivo={f => onTrocarFoto('antes', f)} editavel={edicao} enviando={enviando.antes} mostrarErros={destacarFalta} onAmpliar={onAmpliar} />
        <CampoFoto rotulo="Foto do depois" url={vao?.fotos_depois?.[0]} coord={edicao ? coordDepois : vao?.coord_depois}
          onCoord={v => onRascunho('coordDepois', v)} onArquivo={f => onTrocarFoto('depois', f)} editavel={edicao} enviando={enviando.depois} mostrarErros={destacarFalta} onAmpliar={onAmpliar} />
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={titulo}>Espaçadores instalados</div>
          {edicao ? (
            <input type="number" min="1" step="1" value={qtd} onChange={e => onRascunho('qtd', e.target.value)}
              style={{ ...inputQtd, borderColor: !qtdValida(qtd) && (qtd !== '' || destacarFalta) ? '#dc2626' : '#cbd5e1' }} />
          ) : (
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544' }}>{vao?.qtd_espacadores ?? '—'}</div>
          )}
        </div>

        <div>
          <div style={titulo}>Equipe</div>
          {edicao ? (
            <input type="text" value={equipe} placeholder="Nº da equipe" onChange={e => onRascunho('equipe', e.target.value)}
              style={{ ...inputEquipe, borderColor: destacarFalta && !String(equipe ?? '').trim() ? '#dc2626' : '#cbd5e1' }} />
          ) : (
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544' }}>{vao?.equipe || '—'}</div>
          )}
        </div>

        {edicao && onSalvarDados && (
          <button onClick={onSalvarDados} disabled={!temAlteracao}
            style={{ ...botaoSalvar, opacity: temAlteracao ? 1 : 0.5, cursor: temAlteracao ? 'pointer' : 'not-allowed' }}>
            Salvar alterações
          </button>
        )}
      </div>
    </div>
  );
};

export default VaoCard;
