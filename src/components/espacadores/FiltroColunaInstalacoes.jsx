import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { selecaoDoMenu } from '../../lib/listaInstalacoes';

// Botão ▾ do cabeçalho com o menu do Excel: ordenar, pesquisar e marcar valores.
// O menu vai num portal (position: fixed) porque a tabela fica num contêiner com overflow e cortaria o menu.

const LARGURA = 256;
const MARGEM = 8;

const semAcento = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const CSS = `
.fci-item:hover { background: #f1f5f9; }
.fci-cancelar:hover { background: #f1f5f9; }
.fci-ok:hover:not(:disabled) { background: #1e40af; }
`;

const estiloItem = { display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px', border: 'none', background: 'transparent', borderRadius: '8px', fontSize: '12px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' };

const Menu = ({ botao, coluna, valores, selecionados, ordem, onOrdenar, onFiltrar, onFechar }) => {
  const caixa = useRef(null);
  const [pos, setPos] = useState(null);
  const [busca, setBusca] = useState('');
  // null = todos marcados (sem filtro)
  const [marcados, setMarcados] = useState(selecionados?.length ? new Set(selecionados) : null);
  // Seleção durante a pesquisa: null = todos os resultados marcados, como no Excel
  const [marcadosBusca, setMarcadosBusca] = useState(null);

  // Posiciona o menu perto do botão, sem passar das bordas da janela
  useLayoutEffect(() => {
    const posicionar = () => {
      if (!botao || !caixa.current) return;
      const r = botao.getBoundingClientRect();
      const largura = Math.min(LARGURA, window.innerWidth - 2 * MARGEM);
      const altura = Math.min(caixa.current.offsetHeight, window.innerHeight - 2 * MARGEM);
      const left = Math.max(MARGEM, Math.min(r.left, window.innerWidth - MARGEM - largura));
      let top = r.bottom + 4;
      if (top + altura > window.innerHeight - MARGEM) {
        const acima = r.top - 4 - altura;
        top = acima >= MARGEM ? acima : Math.max(MARGEM, window.innerHeight - MARGEM - altura);
      }
      setPos({ left, top, largura });
    };
    posicionar();
  }, [botao]);

  // Fecha ao clicar fora, com Escape, ao rolar a página e ao redimensionar
  useEffect(() => {
    const digitando = () => caixa.current?.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT' && document.activeElement.type === 'text';
    const aoClicar = (e) => {
      if (caixa.current?.contains(e.target) || botao?.contains(e.target)) return;
      onFechar();
    };
    const aoTecla = (e) => {
      if (e.key !== 'Escape') return;
      onFechar();
      botao?.focus();
    };
    const lugarInicial = botao?.getBoundingClientRect();
    const aoRolar = (e) => {
      if (caixa.current?.contains(e.target)) return;
      // O evento de uma rolagem que terminou antes do toque chega depois de abrir: o botão não saiu do lugar
      const r = botao?.getBoundingClientRect();
      if (r && r.left === lugarInicial.left && r.top === lugarInicial.top) return;
      // teclado virtual do celular rola a página ao focar a pesquisa
      if (digitando()) return;
      onFechar();
    };
    const larguraInicial = window.innerWidth;
    const aoRedimensionar = () => {
      // teclado virtual muda só a altura da janela
      if (digitando() && window.innerWidth === larguraInicial) return;
      onFechar();
    };
    document.addEventListener('mousedown', aoClicar);
    document.addEventListener('keydown', aoTecla);
    window.addEventListener('scroll', aoRolar, true);
    window.addEventListener('resize', aoRedimensionar);
    return () => {
      document.removeEventListener('mousedown', aoClicar);
      document.removeEventListener('keydown', aoTecla);
      window.removeEventListener('scroll', aoRolar, true);
      window.removeEventListener('resize', aoRedimensionar);
    };
  }, [botao, onFechar]);

  const termo = semAcento(busca.trim());
  const visiveis = termo ? valores.filter(x => semAcento(x.valor).includes(termo)) : valores;
  const selecaoAtual = termo ? marcadosBusca : marcados;
  const marcado = (v) => (selecaoAtual ? selecaoAtual.has(v) : true);
  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every(x => marcado(x.valor));

  const pesquisar = (texto) => { setBusca(texto); setMarcadosBusca(null); };

  const alternar = (v) => {
    const definir = termo ? setMarcadosBusca : setMarcados;
    definir(m => {
      const n = new Set(m ?? visiveis.map(x => x.valor));
      if (n.has(v)) n.delete(v); else n.add(v);
      return n;
    });
  };

  const alternarTudo = () => (termo ? setMarcadosBusca : setMarcados)(todosVisiveisMarcados ? new Set() : null);

  // Com pesquisa, o filtro é o que está marcado entre os resultados
  const escolhidos = visiveis.filter(x => marcado(x.valor)).map(x => x.valor);
  const semNada = valores.length > 0 && escolhidos.length === 0;

  const aplicar = () => {
    if (semNada) return;
    onFiltrar(selecaoDoMenu(valores.map(x => x.valor), escolhidos));
    onFechar();
  };

  const textoOrdem = coluna.numero ? ['Do menor para o maior', 'Do maior para o menor'] : ['Ordenar de A a Z', 'Ordenar de Z a A'];

  return createPortal(
    <div ref={caixa} role="dialog" aria-label={`Filtro de ${coluna.rotulo}`} onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', zIndex: 100, left: pos?.left ?? 0, top: pos?.top ?? 0, width: pos?.largura ?? LARGURA,
        visibility: pos ? 'visible' : 'hidden', maxHeight: `calc(100vh - ${2 * MARGEM}px)`, overflowY: 'auto', boxSizing: 'border-box',
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 20px 40px -8px rgba(15,23,42,0.35)',
        padding: '8px', fontSize: '12px', fontWeight: '500', color: '#0f172a', textAlign: 'left', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal',
      }}>
      <style>{CSS}</style>
      {['asc', 'desc'].map((dir, i) => (
        <button key={dir} type="button" className="fci-item" onClick={() => { onOrdenar(dir); onFechar(); }}
          style={{ ...estiloItem, color: ordem === dir ? '#1d4ed8' : '#0f172a', fontWeight: ordem === dir ? '700' : '600' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {dir === 'asc' ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
          </svg>
          {textoOrdem[i]}
        </button>
      ))}
      <div style={{ margin: '6px 0', borderTop: '1px solid #e2e8f0' }} />
      <input type="text" value={busca} onChange={e => pesquisar(e.target.value)} placeholder="Pesquisar" aria-label={`Pesquisar em ${coluna.rotulo}`}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aplicar(); } }}
        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: '500', outline: 'none', fontFamily: 'inherit', color: '#0f172a', background: '#fff' }} />
      <div style={{ marginTop: '6px', maxHeight: '224px', overflow: 'auto' }}>
        <label className="fci-item" style={{ ...estiloItem, cursor: 'pointer' }}>
          <input type="checkbox" checked={todosVisiveisMarcados} onChange={alternarTudo} />
          {termo ? '(Selecionar resultados)' : '(Selecionar tudo)'}
        </label>
        {visiveis.map(x => (
          <label key={x.valor} className="fci-item" style={{ ...estiloItem, cursor: 'pointer' }}>
            <input type="checkbox" checked={marcado(x.valor)} onChange={() => alternar(x.valor)} />
            <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.valor}>{x.valor}</span>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{x.n.toLocaleString('pt-BR')}</span>
          </label>
        ))}
        {visiveis.length === 0 && <p style={{ margin: 0, padding: '12px 8px', color: '#64748b' }}>Nenhum valor.</p>}
      </div>
      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
        <button type="button" className="fci-cancelar" onClick={onFechar}
          style={{ padding: '6px 12px', border: 'none', borderRadius: '8px', background: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancelar
        </button>
        <button type="button" className="fci-ok" onClick={aplicar} disabled={semNada}
          style={{ padding: '6px 12px', border: 'none', borderRadius: '8px', background: '#1d4ed8', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: semNada ? 'not-allowed' : 'pointer', opacity: semNada ? 0.5 : 1, fontFamily: 'inherit' }}>
          OK
        </button>
      </div>
    </div>,
    document.body,
  );
};

const FiltroColunaInstalacoes = ({ coluna, valores, selecionados, ordem, ativo, onOrdenar, onFiltrar }) => {
  const [aberto, setAberto] = useState(false);
  const [botao, setBotao] = useState(null);
  const fechar = useCallback(() => setAberto(false), []);

  return (
    <>
      <button ref={setBotao} type="button" aria-label={`Filtrar ${coluna.rotulo}`} aria-haspopup="dialog" aria-expanded={aberto}
        onClick={e => { e.stopPropagation(); setAberto(a => !a); }}
        style={{
          display: 'grid', placeItems: 'center', width: '16px', height: '16px', padding: 0, borderRadius: '4px', cursor: 'pointer',
          border: `1px solid ${ativo ? '#1d4ed8' : '#e2e8f0'}`, background: ativo ? '#1d4ed8' : '#fff', color: ativo ? '#fff' : '#64748b',
        }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {aberto && (
        <Menu botao={botao} coluna={coluna} valores={valores} selecionados={selecionados} ordem={ordem}
          onOrdenar={onOrdenar} onFiltrar={onFiltrar} onFechar={fechar} />
      )}
    </>
  );
};

export default FiltroColunaInstalacoes;
