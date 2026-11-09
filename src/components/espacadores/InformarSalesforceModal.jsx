import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { aplicarTransicao } from '../../lib/espacadoresApi';
import { lerValorNota, formatarMoeda } from '../../lib/espacadores';

const rotulo = { display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: '600' };
const campo = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', background: '#fff' };
const erroTexto = { fontSize: '12px', color: '#dc2626', marginTop: '4px', fontWeight: '600' };

// Etapa SF: o fechamento informa data de lançamento, valor da nota e apropriação; o serviço vira Pago.
const InformarSalesforceModal = ({ servico, onClose }) => {
  const { user } = useAuth();
  const [data, setData] = useState('');
  const [valor, setValor] = useState('');
  const [apropriacao, setApropriacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mostrarErros, setMostrarErros] = useState(false); // true depois da 1ª tentativa de salvar com falta ou erro

  const valorLido = lerValorNota(valor);
  const erros = {
    data: data ? null : 'Informe a data de lançamento no SalesForce.',
    valor: !valor.trim() ? 'Informe o valor da nota.' : valorLido === null ? 'Informe um valor da nota válido (até 2 casas decimais).' : null,
    apropriacao: apropriacao.trim() ? null : 'Informe o número da apropriação.',
  };
  const temErro = !!(erros.data || erros.valor || erros.apropriacao);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape' && !salvando) onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [salvando, onClose]);

  const salvar = async (e) => {
    e.preventDefault();
    if (salvando) return;
    if (temErro) { setMostrarErros(true); return; }
    setSalvando(true);
    try {
      await aplicarTransicao(servico, 'salesforce', { user, dataLancamento: data, valorNota: valor, apropriacao });
      onClose();
    } catch (err) {
      alert(err.message);
      setSalvando(false);
    }
  };

  const estilo = (chave) => ({ ...campo, borderColor: mostrarErros && erros[chave] ? '#dc2626' : '#cbd5e1' });
  const mensagem = (chave) => (mostrarErros && erros[chave] ? <div style={erroTexto}>{erros[chave]}</div> : null);

  return (
    <div onClick={() => { if (!salvando) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' }}>
      <form onSubmit={salvar} noValidate onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '14px', width: 'min(460px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', padding: '22px 24px', boxSizing: 'border-box', boxShadow: '0 24px 60px rgba(15,37,68,0.25)' }}>
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f2544' }}>Informar SalesForce</div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', marginBottom: '18px' }}>
          {servico.id} · Trafo <b>{servico.equip || '—'}</b> · NSPR <b>{servico.nsmc || '—'}</b>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={rotulo} htmlFor="sf-data">Data de lançamento no SalesForce</label>
          <input id="sf-data" type="date" autoFocus value={data} onChange={e => setData(e.target.value)} style={estilo('data')} />
          {mensagem('data')}
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={rotulo} htmlFor="sf-valor">Valor da nota</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#64748b', pointerEvents: 'none' }}>R$</span>
            <input id="sf-valor" type="text" inputMode="decimal" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)}
              style={{ ...estilo('valor'), paddingLeft: '38px' }} />
          </div>
          {mensagem('valor')}
          {valorLido !== null && <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px', fontWeight: '600' }}>{formatarMoeda(valorLido)}</div>}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={rotulo} htmlFor="sf-apropriacao">Nº da apropriação</label>
          <input id="sf-apropriacao" type="text" value={apropriacao} onChange={e => setApropriacao(e.target.value)} style={estilo('apropriacao')} />
          {mensagem('apropriacao')}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} disabled={salvando}
            style={{ padding: '11px 18px', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: salvando ? 'not-allowed' : 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando}
            style={{ padding: '11px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: salvando ? 'wait' : 'pointer', opacity: salvando ? 0.7 : 1 }}>
            {salvando ? 'Salvando…' : 'Salvar e marcar como Pago'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InformarSalesforceModal;
