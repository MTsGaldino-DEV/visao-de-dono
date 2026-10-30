import { useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { buscarServicosPorTrafo, registrarInstalacao } from '../../lib/espacadoresApi';
import { bloqueioNovaInstalacao, sugerirVinculo, validarCoordenadaVao, qtdValida } from '../../lib/espacadores';
import { TODAS_LOCALIDADES } from '../ServicosTable';
import CampoFoto from './CampoFoto';

const input = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', background: '#fff' };
const rotulo = { display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: '600' };
const linkBotao = { background: 'none', border: 'none', color: '#1d4ed8', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0, textDecoration: 'underline' };

const metros = (d) => `${Math.round(d)} m`;

// Uma instalação = um vão. O vínculo vai para o serviço do trafo mais perto da coordenada do antes.
const NovaInstalacaoModal = ({ onClose, onConcluir, onErroParcial }) => {
  const { user } = useAuth();
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState(null); // null = ainda não buscou
  const [buscando, setBuscando] = useState(false);
  const [fotoAntes, setFotoAntes] = useState(null);
  const [fotoDepois, setFotoDepois] = useState(null);
  const [coordAntes, setCoordAntes] = useState('');
  const [coordDepois, setCoordDepois] = useState('');
  const [qtd, setQtd] = useState('');
  const [equipe, setEquipe] = useState('');
  const [escolhaManual, setEscolhaManual] = useState(null); // { tipo: 'servico', servico } | { tipo: 'novo' }
  const [mostrarLista, setMostrarLista] = useState(false);
  const [local, setLocal] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mostrarErros, setMostrarErros] = useState(false); // true depois da 1ª tentativa de enviar; acende os campos que faltam
  const travaEnvio = useRef(false); // o estado só muda no próximo render; a trava barra o duplo clique

  const buscar = async () => {
    if (!texto.trim()) return;
    setBuscando(true);
    try {
      setResultados(await buscarServicosPorTrafo(texto));
      setEscolhaManual(null);
      setMostrarLista(false);
    } catch (e) {
      alert('Erro na busca: ' + e.message);
    } finally {
      setBuscando(false);
    }
  };

  const lista = resultados || [];
  const candidatos = lista.filter(s => !s.etapa_espacador && !bloqueioNovaInstalacao(s));
  const jaInstalados = lista.filter(s => s.etapa_espacador);
  const bloqueados = lista.filter(s => !s.etapa_espacador && bloqueioNovaInstalacao(s));
  const antesValida = validarCoordenadaVao(coordAntes).ok;
  const vinculo = useMemo(() => sugerirVinculo(candidatos, antesValida ? coordAntes : ''), [resultados, coordAntes]); // eslint-disable-line react-hooks/exhaustive-deps

  let escolha = escolhaManual;
  if (!escolha && resultados) {
    if (candidatos.length === 0) escolha = { tipo: 'novo' };
    else if (vinculo.sugerido) escolha = { tipo: 'servico', servico: vinculo.sugerido };
  }
  const distanciaEscolhida = escolha?.tipo === 'servico'
    ? vinculo.ordenados.find(c => c.id === escolha.servico.id)?.distancia
    : null;

  const faltando = [];
  if (!resultados) faltando.push('buscar o trafo');
  else if (!escolha) faltando.push('escolher o serviço');
  else if (escolha.tipo === 'novo' && !local) faltando.push('localidade');
  if (!fotoAntes) faltando.push('foto do antes');
  if (!antesValida) faltando.push('coordenada do antes');
  if (!fotoDepois) faltando.push('foto do depois');
  if (!validarCoordenadaVao(coordDepois).ok) faltando.push('coordenada do depois');
  if (!qtdValida(qtd)) faltando.push('quantidade');
  if (!equipe.trim()) faltando.push('equipe');
  const pronto = faltando.length === 0 && !enviando;

  const escolher = (e) => { setEscolhaManual(e); setMostrarLista(false); };

  const enviar = async () => {
    if (travaEnvio.current) return;
    if (!pronto) { setMostrarErros(true); return; }
    travaEnvio.current = true;
    setEnviando(true);
    try {
      const id = await registrarInstalacao({
        servico: escolha.tipo === 'servico' ? escolha.servico : null,
        novo: escolha.tipo === 'novo' ? { equip: texto.trim(), local } : null,
        fotoAntes, fotoDepois, coordAntes, coordDepois, qtd, equipe,
      }, user);
      onConcluir(id);
    } catch (e) {
      alert(e.message);
      if (e.servicoId) { onErroParcial(e.servicoId); return; }
      travaEnvio.current = false;
      setEnviando(false);
      buscar();
    }
  };

  const avisoSemVinculo = () => {
    const comDistancia = vinculo.ordenados.find(c => c.distancia != null);
    if (!antesValida) return 'Digite a coordenada do antes para achar o serviço mais próximo';
    if (!comDistancia) return 'Nenhum serviço deste trafo tem coordenada';
    return `O serviço mais próximo está a ${metros(comDistancia.distancia)}`;
  };

  return (
    <>
      <div onClick={enviando ? undefined : onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.65)', zIndex: 1000, backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1001, background: '#fff', borderRadius: '16px', width: '94%', maxWidth: '720px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(15,37,68,0.25)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ fontSize: '17px', fontWeight: '800', color: '#0f2544' }}>Nova instalação</div>
          <button onClick={onClose} disabled={enviando} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={rotulo}>Número do trafo</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input autoFocus value={texto} placeholder="Ex.: 763-3-45" disabled={enviando}
                onChange={e => { setTexto(e.target.value); setResultados(null); setEscolhaManual(null); }}
                onKeyDown={e => { if (e.key === 'Enter') buscar(); }}
                style={{ ...input, borderColor: mostrarErros && !resultados ? '#dc2626' : '#cbd5e1' }} />
              <button onClick={buscar} disabled={buscando || enviando || !texto.trim()} style={{ padding: '10px 18px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {buscando ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <CampoFoto rotulo="Foto do antes" arquivo={fotoAntes} onArquivo={setFotoAntes} coord={coordAntes} onCoord={setCoordAntes} editavel={!enviando} mostrarErros={mostrarErros} />
            <CampoFoto rotulo="Foto do depois" arquivo={fotoDepois} onArquivo={setFotoDepois} coord={coordDepois} onCoord={setCoordDepois} editavel={!enviando} mostrarErros={mostrarErros} />
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <label style={rotulo}>Espaçadores instalados neste vão</label>
              <input type="number" min="1" step="1" value={qtd} disabled={enviando} onChange={e => setQtd(e.target.value)}
                style={{ ...input, width: '120px', borderColor: !qtdValida(qtd) && (qtd !== '' || mostrarErros) ? '#dc2626' : '#cbd5e1' }} />
            </div>
            <div>
              <label style={rotulo}>Equipe</label>
              <input type="text" value={equipe} placeholder="Nº da equipe" disabled={enviando} onChange={e => setEquipe(e.target.value)}
                style={{ ...input, width: '180px', borderColor: mostrarErros && !equipe.trim() ? '#dc2626' : '#cbd5e1' }} />
            </div>
          </div>

          {resultados && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
              {escolha?.tipo === 'servico' && (
                <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#1e3a8a' }}>
                  <b>Serviço vinculado: {escolha.servico.id}</b>
                  {distanciaEscolhida != null ? ` (${metros(distanciaEscolhida)})` : ' (sem coordenada)'}
                  <span style={{ color: '#475569' }}> · {escolha.servico.equip} · {escolha.servico.local || '—'}</span>{' '}
                  {!mostrarLista && <button onClick={() => setMostrarLista(true)} style={linkBotao}>trocar</button>}
                </div>
              )}
              {escolha?.tipo === 'novo' && (
                <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#166534', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <b>Criar serviço novo</b> para o trafo {texto.trim()}, com a coordenada do antes.{' '}
                    {candidatos.length > 0 && !mostrarLista && <button onClick={() => setMostrarLista(true)} style={linkBotao}>trocar</button>}
                  </div>
                  <div>
                    <label style={rotulo}>Localidade</label>
                    <select value={local} onChange={e => setLocal(e.target.value)} disabled={enviando}
                      style={{ ...input, borderColor: mostrarErros && !local ? '#dc2626' : '#cbd5e1' }}>
                      <option value="">Selecione…</option>
                      {TODAS_LOCALIDADES.map(l => <option key={l.loc} value={l.loc}>{l.loc}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {!escolha && (
                <div style={{ background: '#fffbeb', border: `1px solid ${mostrarErros ? '#dc2626' : '#fde68a'}`, color: '#92400e', borderRadius: '8px', padding: '10px 12px', fontSize: '13px' }}>
                  {avisoSemVinculo()}. Escolha um serviço abaixo ou crie um novo.
                </div>
              )}

              {(mostrarLista || !escolha) && candidatos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {vinculo.ordenados.map(c => (
                    <button key={c.id} onClick={() => escolher({ tipo: 'servico', servico: c })} disabled={enviando}
                      style={{ textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#475569', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                      <span><b style={{ color: '#0f2544' }}>{c.id}</b> · {c.equip} · {c.local || '—'}</span>
                      <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{c.distancia != null ? metros(c.distancia) : 'sem coordenada'}</span>
                    </button>
                  ))}
                  <button onClick={() => escolher({ tipo: 'novo' })} disabled={enviando}
                    style={{ border: '1px dashed #86efac', borderRadius: '8px', padding: '10px 12px', background: '#f0fdf4', color: '#166534', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                    + Criar serviço novo
                  </button>
                </div>
              )}

              {jaInstalados.length > 0 && (
                <div style={{ fontSize: '12px', color: '#64748b' }}>Já instalados neste trafo: {jaInstalados.map(s => s.id).join(', ')}</div>
              )}
              {bloqueados.map(s => (
                <div key={s.id} style={{ fontSize: '12px', color: '#92400e' }}><b>{s.id}</b>: {bloqueioNovaInstalacao(s)}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: mostrarErros && faltando.length ? '#dc2626' : '#64748b', fontWeight: mostrarErros && faltando.length ? '700' : '400', flex: 1 }}>
            {faltando.length ? `Falta: ${faltando.join(', ')}.` : 'Tudo pronto para o fechamento.'}
          </span>
          <button onClick={enviar} disabled={enviando}
            style={{ padding: '12px 22px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: enviando ? 'wait' : 'pointer', opacity: enviando ? 0.7 : 1 }}>
            {enviando ? 'Enviando…' : 'Enviar para fechamento →'}
          </button>
        </div>
      </div>
    </>
  );
};

export default NovaInstalacaoModal;
