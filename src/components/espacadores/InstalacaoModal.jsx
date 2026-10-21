import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  podeEnviarInstalacao, pendenciasInstalacao, podeAprovar, lerCoordenada, distanciaMetros, formatarData,
} from '../../lib/espacadores';
import {
  carregarServico, carregarVaos, salvarDadosVao, trocarFoto, corrigirQuantidade,
  anexarCroqui, aplicarTransicao, excluirInstalacao, assinarMudancas,
} from '../../lib/espacadoresApi';
import VaoCard from './VaoCard';
import EtapaBadge from './EtapaBadge';

const secao = { fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' };

const InstalacaoModal = ({ servicoId, modo = 'leitura', onClose }) => {
  const { user } = useAuth();
  const [servico, setServico] = useState(null);
  const [vaos, setVaos] = useState([]);
  const [enviando, setEnviando] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [mostrarReprovacao, setMostrarReprovacao] = useState(false);
  const [motivo, setMotivo] = useState('');

  const recarregar = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([carregarServico(servicoId), carregarVaos(servicoId)]);
      setServico(s);
      setVaos(v);
    } catch (e) {
      alert('Erro ao carregar a instalação: ' + e.message);
    }
  }, [servicoId]);

  useEffect(() => {
    recarregar();
    return assinarMudancas(`instalacao_${servicoId}`, recarregar);
  }, [servicoId, recarregar]);

  if (!servico) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        Carregando…
      </div>
    );
  }

  const editavel = modo === 'edicao' && servico.etapa_espacador === 'instalacao';
  const podeRevisar = modo === 'revisao' && servico.etapa_espacador === 'revisao';
  const vao = vaos[0] ?? null;
  const prontoParaEnviar = podeEnviarInstalacao(vao);
  const prontoParaAprovar = podeAprovar(vao);
  const coordLevantamento = lerCoordenada(servico.coord);
  const coordAntes = lerCoordenada(vao?.coord_antes);
  const distanciaLevantamento = coordLevantamento && coordAntes ? Math.round(distanciaMetros(coordLevantamento, coordAntes)) : null;

  const executar = async (fn) => {
    setOcupado(true);
    try { await fn(); } catch (e) { alert(e.message); }
    finally { setOcupado(false); recarregar(); }
  };

  const comEnvio = async (chave, fn) => {
    setEnviando(p => ({ ...p, [chave]: true }));
    try { await fn(); } catch (e) { alert('Erro ao enviar arquivo: ' + e.message); }
    finally { setEnviando(p => ({ ...p, [chave]: false })); recarregar(); }
  };

  const transicionar = async (acao, opcoes = {}) => {
    setOcupado(true);
    try {
      await aplicarTransicao(servico, acao, { user, ...opcoes });
      onClose();
    } catch (e) {
      alert(e.message);
      setOcupado(false);
      recarregar();
    }
  };

  const handleExcluir = async () => {
    if (!window.confirm(`Excluir a instalação ${servico.id}? O vão, as fotos e o croqui serão apagados e o serviço volta para a lista de serviços em aberto.`)) return;
    setOcupado(true);
    try {
      await excluirInstalacao(servico, user);
      onClose();
    } catch (e) {
      alert('Erro ao excluir: ' + e.message);
      setOcupado(false);
      recarregar();
    }
  };

  // Se o envio caiu antes de criar o vão, a primeira foto cria a linha
  const handleTrocarFoto = (tipo, file) => comEnvio(tipo, async () => {
    const alvo = vao || await salvarDadosVao(servico.id, null, {});
    await trocarFoto(alvo, tipo, file);
  });

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.65)', zIndex: 1000, backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1001, background: '#f8fafc', borderRadius: '16px', width: '94%', maxWidth: '960px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(15,37,68,0.25)' }}>

        {/* Cabeçalho */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Instalação de espaçadores</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '18px', fontWeight: '800', color: '#0f2544' }}>{servico.id}</span>
              <EtapaBadge etapa={servico.etapa_espacador} />
            </div>
            <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
              <span style={{ color: '#94a3b8' }}>Trafo:</span> <b>{servico.equip || '—'}</b>
              <span style={{ color: '#cbd5e1', margin: '0 8px' }}>·</span>
              <span style={{ color: '#94a3b8' }}>Local:</span> {servico.local || '—'}
              {servico.numServ && <><span style={{ color: '#cbd5e1', margin: '0 8px' }}>·</span><span style={{ color: '#94a3b8' }}>NSMP:</span> <b>{servico.numServ}</b></>}
              {servico.nsmc && <><span style={{ color: '#cbd5e1', margin: '0 8px' }}>·</span><span style={{ color: '#94a3b8' }}>NSMC:</span> <b>{servico.nsmc}</b></>}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              <span style={{ color: '#94a3b8' }}>Levantamento:</span> {servico.coord || '—'}
              {distanciaLevantamento != null && <span> · a {distanciaLevantamento} m do antes</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '18px', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>×</button>
        </div>

        {/* Corpo */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {servico.etapa_espacador === 'instalacao' && servico.motivo_reprovacao_fechamento && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', padding: '12px 14px', fontSize: '13px' }}>
              <b>Reprovado pelo fechamento:</b> {servico.motivo_reprovacao_fechamento}
            </div>
          )}

          <VaoCard
            key={`${vao?.id}|${vao?.coord_antes}|${vao?.coord_depois}|${vao?.qtd_espacadores}`}
            vao={vao}
            modo={editavel ? 'edicao' : podeRevisar ? 'revisao' : 'leitura'}
            enviando={enviando}
            onTrocarFoto={handleTrocarFoto}
            onSalvarDados={(campos) => executar(() => salvarDadosVao(servico.id, vao, campos))}
            onSalvarQtd={(qtd) => executar(() => corrigirQuantidade(servico, vao, qtd, user))}
            onAnexarCroqui={(file) => comEnvio('croqui', () => anexarCroqui(vao, file))}
            onAmpliar={setFotoAmpliada}
          />

          {servico.hist?.length > 0 && (
            <details style={{ marginTop: '8px' }}>
              <summary style={{ ...secao, cursor: 'pointer', marginBottom: 0 }}>Histórico ({servico.hist.length})</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                {[...servico.hist].reverse().map((h, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px' }}>
                    <div><b style={{ color: '#0f2544' }}>{h.who}</b> <span style={{ color: '#475569' }}>{h.msg}</span></div>
                    <div style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatarData(h.when)}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Rodapé */}
        {editavel && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={handleExcluir}
              disabled={ocupado}
              style={{ padding: '12px 18px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: ocupado ? 'not-allowed' : 'pointer' }}
            >
              Excluir instalação
            </button>
            <span style={{ fontSize: '12px', color: '#64748b', flex: 1, textAlign: 'right' }}>
              {prontoParaEnviar ? 'Tudo pronto para o fechamento.' : `Falta: ${pendenciasInstalacao(vao).join(', ')}.`}
            </span>
            <button
              onClick={() => transicionar('enviar')}
              disabled={ocupado || !prontoParaEnviar}
              style={{ padding: '12px 22px', background: prontoParaEnviar ? '#16a34a' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: ocupado || !prontoParaEnviar ? 'not-allowed' : 'pointer' }}
            >
              Enviar para fechamento →
            </button>
          </div>
        )}
        {podeRevisar && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
            {mostrarReprovacao ? (
              <div>
                <textarea autoFocus placeholder="Descreva o motivo da reprovação..." value={motivo} onChange={e => setMotivo(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #fca5a5', fontSize: '13px', marginBottom: '10px', resize: 'vertical', minHeight: '72px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setMostrarReprovacao(false); setMotivo(''); }} style={{ padding: '10px 20px', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
                  <button onClick={() => transicionar('reprovar', { motivo })} disabled={ocupado} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>✗ Confirmar reprovação</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {!prontoParaAprovar && <span style={{ fontSize: '12px', color: '#92400e', width: '100%', textAlign: 'right' }}>Anexe o croqui para aprovar</span>}
                <button onClick={() => setMostrarReprovacao(true)} disabled={ocupado} style={{ flex: 1, padding: '12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>✗ Reprovar</button>
                <button onClick={() => transicionar('aprovar')} disabled={ocupado || !prontoParaAprovar} style={{ flex: 1, padding: '12px', background: prontoParaAprovar ? '#16a34a' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: ocupado || !prontoParaAprovar ? 'not-allowed' : 'pointer' }}>✓ Aprovar</button>
              </div>
            )}
          </div>
        )}
      </div>

      {fotoAmpliada && (
        <div onClick={() => setFotoAmpliada(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', cursor: 'zoom-out' }}>
          <img src={fotoAmpliada} alt="Ampliada" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
        </div>
      )}
    </>
  );
};

export default InstalacaoModal;
