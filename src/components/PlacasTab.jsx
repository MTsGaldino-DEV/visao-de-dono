import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/firebase';
import { collection, onSnapshot, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

const POSTOS = {
  'Posto 1 — Pedro': [
    'FREI INOCENCIO','ALPERCATA','ALVARENGA','CAPITAO ANDRADE','ENGENHEIRO CALDAS',
    'FERNANDES TOURINHO','GOVERNADOR VALADARES','ITANHOMI','JAMPRUCA','JATAI',
    'MATHIAS LOBATO','SAO GERALDO TUMIRITINGA','SOBRALIA','TARUMIRIM','TUMIRITINGA',
  ],
  'Posto 2 — Elton': [
    'COLUNA','SAO GERALDO DA PIEDADE','AGUA BOA','JOSE RAYDAN','PAULISTAS',
    'CANTAGALO','PECANHA','SAO JOAO EVANGELISTA','SAO JOSE DO JACURI',
    'SANTA EFIGENIA DE MINAS','GONZAGA','SANTA MARIA DO SUACUI','FREI LAGO NEGRO',
    'SAO PEDRO DO SUACUI','SAO SEBASTIAO DO MARANHAO','SARDOA',
  ],
  'Posto 3 — Vinicius': [
    'CUPARAQUE','CONSELHEIRO PENA','RESPLENDOR','AIMORES','GOIABEIRA',
    'ITUETA','SANTA RITA DO ITUETO','SAO GERALDO DO BAIXIO','GALILEIA',
  ],
  'Posto 4 — Victor': [
    'ITABIRINHA DE MANTENA','DIVINO LARANJEIRAS','CENTRAL DE MINAS','MENDES PIMENTEL',
    'NOVA BELEM','SAO FELIX DE MINAS','TIPITI','MANTENA','SAO JOAO DO MANTENINHA',
    'MARILAC','COROACI','VIRGOLANDIA','NACIP RAYDAN','SAO JOSE DA SAFIRA',
  ],
};

const POSTO_COLORS = {
  'Posto 1 — Pedro':    { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', stroke: '#3b82f6' },
  'Posto 2 — Elton':    { color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe', stroke: '#a78bfa' },
  'Posto 3 — Vinicius': { color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd', stroke: '#38bdf8' },
  'Posto 4 — Victor':   { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', stroke: '#4ade80' },
  'Não mapeado':        { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', stroke: '#94a3b8' },
};

const norm = (s) => (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const postoDeLocalidade = (local) => {
  const localNorm = norm(local);
  for (const [posto, locs] of Object.entries(POSTOS)) {
    if (locs.some(l => norm(l) === localNorm || localNorm.includes(norm(l)) || norm(l).includes(localNorm)))
      return posto;
  }
  return null;
};

const digitosDeEquip = (equip) => {
  const digits = (equip || '').replace(/\D/g, '').split('').map(Number);
  const count = Array(10).fill(0);
  digits.forEach(d => count[d]++);
  return count;
};

// ── Gráfico circular SVG puro ────────────────────────────────────────────────
const DonutChart = ({ montadas, pendentes, postoAtivo }) => {
  const total = montadas + pendentes;
  if (total === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '12px' }}>
      Sem dados
    </div>
  );

  const R = 70, CX = 90, CY = 90, stroke = 28;
  const circ = 2 * Math.PI * R;

  // Segmentos: montadas (verde), pendentes (cor do posto ou laranja)
  const pctMontadas = montadas / total;
  const pendColor = postoAtivo ? (POSTO_COLORS[postoAtivo]?.stroke || '#f97316') : '#f97316';

  const gap = 0.012; // pequeno gap entre segmentos
  const seg1 = pctMontadas * (1 - gap * 2);
  const seg2 = (1 - pctMontadas) * (1 - gap * 2);

  const arc = (pct, offset) => ({
    strokeDasharray: `${pct * circ} ${circ}`,
    strokeDashoffset: -offset * circ,
  });

  const pctLabel = total > 0 ? Math.round((montadas / total) * 100) : 0;

  return (
    <div style={{ position: 'relative', width: '180px', height: '180px', margin: '0 auto' }}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        {/* Fundo */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {/* Pendentes */}
        {pendentes > 0 && (
          <circle cx={CX} cy={CY} r={R} fill="none"
            stroke={pendColor} strokeWidth={stroke} strokeLinecap="butt"
            style={{ ...arc(seg2, pctMontadas + gap), transition: 'stroke-dasharray 0.5s ease' }}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        )}
        {/* Montadas */}
        {montadas > 0 && (
          <circle cx={CX} cy={CY} r={R} fill="none"
            stroke="#15803d" strokeWidth={stroke} strokeLinecap="butt"
            style={{ ...arc(seg1, gap), transition: 'stroke-dasharray 0.5s ease' }}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        )}
      </svg>
      {/* Centro */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f2544', lineHeight: 1 }}>{pctLabel}%</div>
        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', marginTop: '2px' }}>montadas</div>
      </div>
    </div>
  );
};

// ── Estilos base ─────────────────────────────────────────────────────────────
const card = { background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', background: '#fff', color: '#1e293b', outline: 'none', fontFamily: "'Segoe UI', system-ui, sans-serif", boxSizing: 'border-box' };
const labelUp = { fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '5px', display: 'block' };
const th = { textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: '700', padding: '9px 12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase' };
const td = { padding: '10px 12px', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle', fontSize: '12px', color: '#334155', whiteSpace: 'nowrap' };

// ── Componente principal ─────────────────────────────────────────────────────
const PlacasTab = () => {
  const { user } = useAuth();

  const [servicos, setServicos]           = useState([]);
  const [estoque, setEstoque]             = useState(Array(10).fill(0));
  const [postoFilter, setPostoFilter]     = useState(''); // para lista
  const [dashPosto, setDashPosto]         = useState(''); // para dashboard
  const [editandoEstoque, setEditandoEstoque] = useState(false);
  const [estoqueTemp, setEstoqueTemp]     = useState(Array(10).fill(0));
  const [savingEstoque, setSavingEstoque] = useState(false);
  const [buscaEquip, setBuscaEquip]       = useState(''); // busca por equipamento(s)
  const [expandidoLoc, setExpandidoLoc]   = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'servicos'), (snap) => {
      setServicos(snap.docs.map(d => ({ ...d.data(), _docId: d.id })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'estoque'));
        if (snap.exists()) setEstoque(snap.data().digitos || Array(10).fill(0));
      } catch {}
    };
    load();
  }, []);

  const salvarEstoque = async () => {
    setSavingEstoque(true);
    try {
      await setDoc(doc(db, 'config', 'estoque'), { digitos: estoqueTemp });
      setEstoque(estoqueTemp);
      setEditandoEstoque(false);
    } catch { alert('Erro ao salvar estoque.'); }
    finally { setSavingEstoque(false); }
  };

  // Todos os serviços de placa (ativos)
  const todasPlacas = servicos.filter(s =>
    s.status !== 'cancelado' && norm(s.desc).includes('PLACA')
  );

  // Pendentes de montagem
  const pendentesMontagem = todasPlacas.filter(s => !s.placaMontada);

  // Parse da busca por equipamento: aceita vírgula, ponto-e-vírgula, espaço ou quebra de linha
  const equipTermos = buscaEquip.trim()
    ? buscaEquip.split(/[,;\n\s]+/).map(t => t.trim()).filter(Boolean)
    : [];

  // Filtros da lista de pendentes: posto + equipamento
  const filtrados = pendentesMontagem.filter(s => {
    if (postoFilter && postoDeLocalidade(s.local) !== postoFilter) return false;
    if (equipTermos.length > 0) {
      const equip = norm(s.equip || '');
      const numServ = norm(s.numServ || '');
      return equipTermos.some(t => equip.includes(norm(t)) || numServ.includes(norm(t)));
    }
    return true;
  });

  // Dashboard: dados filtrados pelo posto do dashboard
  const dashPlacas = dashPosto
    ? todasPlacas.filter(s => postoDeLocalidade(s.local) === dashPosto)
    : todasPlacas;
  const dashMontadas  = dashPlacas.filter(s => s.placaMontada).length;
  const dashPendentes = dashPlacas.length - dashMontadas;

  // Dados por posto para legenda/tabela do dashboard
  const dadosPosto = Object.keys(POSTOS).map(posto => {
    const ps = todasPlacas.filter(s => postoDeLocalidade(s.local) === posto);
    const mont = ps.filter(s => s.placaMontada).length;
    const locMap = {};
    ps.forEach(s => {
      const loc = s.local || 'Desconhecida';
      if (!locMap[loc]) locMap[loc] = { total: 0, montadas: 0 };
      locMap[loc].total++;
      if (s.placaMontada) locMap[loc].montadas++;
    });
    return { posto, total: ps.length, montadas: mont, pendentes: ps.length - mont, locMap };
  });

  const marcarMontada = async (s) => {
    try {
      const novoEstoque = [...estoque];
      const d = digitosDeEquip(s.equip);
      for (let i = 0; i <= 9; i++) novoEstoque[i] = Math.max(0, novoEstoque[i] - d[i]);
      await updateDoc(doc(db, 'servicos', s._docId), {
        placaMontada: true,
        hist: [...(s.hist || []), { who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: 'Placa montada.' }],
      });
      await setDoc(doc(db, 'config', 'estoque'), { digitos: novoEstoque });
      setEstoque(novoEstoque);
    } catch { alert('Erro ao marcar placa como montada.'); }
  };

  const desmarcarMontada = async (s) => {
    if (!window.confirm(`Reverter a montagem da placa do serviço ${s.id}?`)) return;
    try {
      const novoEstoque = [...estoque];
      const d = digitosDeEquip(s.equip);
      for (let i = 0; i <= 9; i++) novoEstoque[i] += d[i];
      await updateDoc(doc(db, 'servicos', s._docId), {
        placaMontada: false,
        hist: [...(s.hist || []), { who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: 'Montagem da placa revertida.' }],
      });
      await setDoc(doc(db, 'config', 'estoque'), { digitos: novoEstoque });
      setEstoque(novoEstoque);
    } catch { alert('Erro ao reverter montagem.'); }
  };

  const temEstoque = (s) => {
    const d = digitosDeEquip(s.equip);
    for (let i = 0; i <= 9; i++) { if (d[i] > estoque[i]) return false; }
    return true;
  };

  const digitosNecessarios = Array(10).fill(0);
  filtrados.forEach(s => {
    const d = digitosDeEquip(s.equip);
    for (let i = 0; i <= 9; i++) digitosNecessarios[i] += d[i];
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Cards de resumo (só placas) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { label: 'Total de placas', value: todasPlacas.length, color: '#0f2544' },
          { label: 'Montadas',        value: todasPlacas.filter(s => s.placaMontada).length, color: '#15803d' },
          { label: 'Pendentes',       value: pendentesMontagem.length, color: '#c2410c' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...card, padding: '16px 20px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color, lineHeight: 1.1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Dashboard: gráfico circular + tabela por posto/localidade ── */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544' }}>Dashboard de placas</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Montadas vs pendentes por supervisão e localidade</div>
          </div>
          {/* Filtro do dashboard */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['', ...Object.keys(POSTOS)].map(p => {
              const ativo = dashPosto === p;
              const cfg = p ? POSTO_COLORS[p] : null;
              return (
                <button key={p || 'todos'} onClick={() => setDashPosto(p)} style={{
                  fontSize: '11px', padding: '5px 12px', borderRadius: '20px', cursor: 'pointer',
                  border: ativo ? `2px solid ${cfg?.color || '#0f2544'}` : '1px solid #e2e8f0',
                  background: ativo ? (cfg?.bg || '#f0f4ff') : '#fff',
                  color: ativo ? (cfg?.color || '#0f2544') : '#64748b',
                  fontWeight: ativo ? '700' : '400', fontFamily: 'inherit', transition: 'all 0.12s',
                }}>
                  {p ? p.split('—')[0].trim() : 'Todos'}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px', alignItems: 'start' }}>

          {/* Gráfico */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <DonutChart montadas={dashMontadas} pendentes={dashPendentes} postoAtivo={dashPosto || null} />
            {/* Legenda do gráfico */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#15803d', flexShrink: 0 }} />
                <span style={{ color: '#334155' }}>Montadas</span>
                <span style={{ marginLeft: 'auto', fontWeight: '700', color: '#0f2544' }}>{dashMontadas}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: dashPosto ? (POSTO_COLORS[dashPosto]?.stroke || '#f97316') : '#f97316', flexShrink: 0 }} />
                <span style={{ color: '#334155' }}>Pendentes</span>
                <span style={{ marginLeft: 'auto', fontWeight: '700', color: '#0f2544' }}>{dashPendentes}</span>
              </div>
            </div>
          </div>

          {/* Tabela por posto e localidade */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {dadosPosto.filter(d => d.total > 0 && (!dashPosto || d.posto === dashPosto)).map(({ posto, total, montadas, pendentes, locMap }) => {
              const cfg = POSTO_COLORS[posto];
              const pct = total > 0 ? Math.round((montadas / total) * 100) : 0;
              const exp = expandidoLoc[posto];
              const postoNome  = posto.split('—')[0].trim();
              const supervisor = posto.split('—')[1]?.trim() || '';

              return (
                <div key={posto} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {/* Linha do posto */}
                  <button onClick={() => setExpandidoLoc(prev => ({ ...prev, [posto]: !prev[posto] }))}
                    style={{ width: '100%', padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"
                      style={{ transform: exp ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 9px', borderRadius: '20px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
                      {postoNome}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{supervisor}</span>
                    {/* Barra inline */}
                    <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#f1f5f9', overflow: 'hidden', margin: '0 8px' }}>
                      <div style={{ height: '100%', background: '#15803d', width: `${pct}%`, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', flexShrink: 0 }}>
                      <span style={{ color: '#15803d', fontWeight: '700' }}>✓ {montadas}</span>
                      <span style={{ color: '#c2410c', fontWeight: '700' }}>{pendentes} pend.</span>
                      <span style={{ color: '#94a3b8' }}>{total} total · {pct}%</span>
                    </div>
                  </button>

                  {/* Localidades expandidas */}
                  {exp && (
                    <div style={{ paddingLeft: '20px', paddingBottom: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
                        {Object.entries(locMap).sort((a, b) => b[1].total - a[1].total).map(([loc, d]) => {
                          const pctLoc = d.total > 0 ? Math.round((d.montadas / d.total) * 100) : 0;
                          const tudo = pctLoc === 100;
                          const nada = pctLoc === 0;
                          return (
                            <div key={loc} style={{
                              padding: '8px 10px', borderRadius: '8px',
                              border: tudo ? '1px solid #bbf7d0' : nada ? '1px solid #fecaca' : '1px solid #e2e8f0',
                              background: tudo ? '#f0fdf4' : nada ? '#fef2f2' : '#f8fafc',
                            }}>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>{loc}</div>
                              <div style={{ height: '4px', borderRadius: '2px', background: '#e2e8f0', overflow: 'hidden', marginBottom: '5px' }}>
                                <div style={{ height: '100%', background: tudo ? '#15803d' : '#1d4ed8', width: `${pctLoc}%` }} />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                                <span style={{ color: '#15803d', fontWeight: '600' }}>✓ {d.montadas}</span>
                                <span style={{ color: '#c2410c', fontWeight: '600' }}>{d.total - d.montadas} pend.</span>
                                <span style={{ color: '#94a3b8' }}>{pctLoc}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {dadosPosto.filter(d => d.total > 0 && (!dashPosto || d.posto === dashPosto)).length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Nenhum serviço de placa encontrado.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Estoque de dígitos ── */}
      <div style={{ ...card, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544' }}>Estoque de dígitos</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Quantidade disponível de cada dígito para montagem</div>
          </div>
          {!editandoEstoque ? (
            <button onClick={() => { setEstoqueTemp([...estoque]); setEditandoEstoque(true); }} style={{ fontSize: '12px', padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '500' }}>
              Editar estoque
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditandoEstoque(false)} style={{ fontSize: '12px', padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={salvarEstoque} disabled={savingEstoque} style={{ fontSize: '12px', padding: '6px 14px', border: 'none', borderRadius: '7px', background: 'linear-gradient(135deg, #0f2544, #1d4ed8)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}>
                {savingEstoque ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '8px' }}>
          {Array.from({ length: 10 }, (_, d) => {
            const qtd = editandoEstoque ? estoqueTemp[d] : estoque[d];
            const necessario = digitosNecessarios[d];
            const falta = Math.max(0, necessario - estoque[d]);
            const semEstoque = !editandoEstoque && estoque[d] === 0;
            const baixo = !editandoEstoque && estoque[d] > 0 && estoque[d] < necessario;
            return (
              <div key={d} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                padding: '10px 6px', borderRadius: '10px',
                border: semEstoque ? '1px solid #fecaca' : baixo ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                background: semEstoque ? '#fef2f2' : baixo ? '#fff7ed' : '#f8fafc',
              }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: semEstoque ? '#b91c1c' : baixo ? '#c2410c' : '#0f2544' }}>{d}</div>
                {editandoEstoque ? (
                  <input type="number" min="0" max="9999" value={estoqueTemp[d]}
                    onChange={e => { const v = parseInt(e.target.value) || 0; setEstoqueTemp(prev => { const n = [...prev]; n[d] = v; return n; }); }}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #3b82f6', borderRadius: '6px', fontSize: '13px', fontWeight: '700', textAlign: 'center', color: '#0f2544', outline: 'none', background: '#fff', fontFamily: 'inherit' }}
                  />
                ) : (
                  <div style={{ fontSize: '15px', fontWeight: '700', color: semEstoque ? '#b91c1c' : baixo ? '#c2410c' : '#1d4ed8' }}>{qtd}</div>
                )}
                {!editandoEstoque && necessario > 0 && (
                  <div style={{ fontSize: '9px', color: falta > 0 ? '#b91c1c' : '#15803d', fontWeight: '600', textAlign: 'center' }}>
                    {falta > 0 ? `faltam ${falta}` : `ok (${necessario})`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!editandoEstoque && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '10px', color: '#94a3b8' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#fef2f2', border: '1px solid #fecaca', display: 'inline-block' }} />Sem estoque</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#fff7ed', border: '1px solid #fed7aa', display: 'inline-block' }} />Insuficiente para pendentes</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'inline-block' }} />Ok</span>
          </div>
        )}
      </div>

      {/* ── Lista de pendentes ── */}
      <div style={card}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544', marginBottom: '10px' }}>Pendentes de montagem</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', alignItems: 'end' }}>
            {/* Busca por equipamento/nº serviço */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelUp}>Buscar por nº equipamento ou nº serviço (separe por vírgula)</label>
              <div style={{ position: 'relative' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text"
                  placeholder="Ex: 240539792, 240800668, 240855834 — ou cole uma lista"
                  value={buscaEquip} onChange={e => setBuscaEquip(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: '30px' }}
                />
              </div>
              {equipTermos.length > 1 && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {equipTermos.map(t => (
                    <span key={t} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: '600' }}>
                      {t}
                    </span>
                  ))}
                  <button onClick={() => setBuscaEquip('')} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                    limpar
                  </button>
                </div>
              )}
            </div>
            {/* Filtro posto */}
            <div>
              <label style={labelUp}>Posto / supervisor</label>
              <select value={postoFilter} onChange={e => setPostoFilter(e.target.value)} style={inputStyle}>
                <option value="">Todos os postos</option>
                {Object.keys(POSTOS).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              {(postoFilter || buscaEquip) && (
                <button onClick={() => { setPostoFilter(''); setBuscaEquip(''); }} style={{ fontSize: '11px', padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#fff', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  Limpar filtros
                </button>
              )}
              <div style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', borderRadius: '20px', padding: '3px 10px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                {filtrados.length} {filtrados.length === 1 ? 'serviço' : 'serviços'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: '80px' }}>ID</th>
                <th style={{ ...th, width: '120px' }}>Localidade</th>
                <th style={{ ...th, width: '100px' }}>Posto</th>
                <th style={th}>Descrição</th>
                <th style={{ ...th, width: '110px' }}>Equipamento</th>
                <th style={{ ...th, width: '110px' }}>Dígitos</th>
                <th style={{ ...th, width: '90px' }}>Status</th>
                <th style={{ ...th, width: '100px' }}>Estoque</th>
                <th style={{ ...th, width: '90px' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '13px' }}>
                  {equipTermos.length > 0 ? 'Nenhum serviço encontrado para os números informados.' : 'Nenhuma placa pendente de montagem.'}
                </td></tr>
              )}
              {filtrados.map((s, i) => {
                const posto = postoDeLocalidade(s.local);
                const haEstoque = temEstoque(s);
                const digStr = (s.equip || '').replace(/\D/g, '');
                const statusCfg = { cadastrado: { label: 'Cadastrado', color: '#1d4ed8' }, enviado: { label: 'Enviado', color: '#7c3aed' }, pendente: { label: 'Pendente', color: '#c2410c' }, concluido: { label: 'Concluído', color: '#15803d' } }[s.status] || { label: s.status, color: '#475569' };
                return (
                  <tr key={s._docId} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafbfc'}
                  >
                    <td style={td}><span style={{ fontWeight: '700', color: '#0f2544' }}>{s.id}</span></td>
                    <td style={td}>{s.local || '—'}</td>
                    <td style={{ ...td, fontSize: '11px', color: '#64748b' }}>
                      {posto ? posto.split('—')[0].trim() : <span style={{ color: '#ef4444' }}>Não mapeado</span>}
                    </td>
                    <td style={{ ...td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.desc}</td>
                    <td style={{ ...td, fontWeight: '600', letterSpacing: '0.05em' }}>{s.equip || '—'}</td>
                    <td style={td}>
                      {digStr ? (
                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                          {digStr.split('').map((d, idx) => {
                            const semEst = estoque[parseInt(d)] === 0;
                            return (
                              <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: semEst ? '#fef2f2' : '#eff6ff', color: semEst ? '#b91c1c' : '#1d4ed8', border: `1px solid ${semEst ? '#fecaca' : '#bfdbfe'}` }}>
                                {d}
                              </span>
                            );
                          })}
                        </div>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: `${statusCfg.color}12`, color: statusCfg.color, border: `1px solid ${statusCfg.color}30` }}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td style={td}>
                      {s.equip ? (haEstoque
                        ? <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Suficiente</span>
                        : <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Insuficiente</span>
                      ) : <span style={{ color: '#94a3b8', fontSize: '11px' }}>Sem equip.</span>}
                    </td>
                    <td style={td}>
                      <button onClick={() => marcarMontada(s)} style={{ fontSize: '11px', padding: '5px 12px', border: '1px solid #bbf7d0', borderRadius: '6px', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.borderColor = '#86efac'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Montar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Placas montadas ── */}
      {servicos.some(s => s.placaMontada) && (
        <div style={card}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544' }}>Placas montadas</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Clique em "Reverter" para desfazer a montagem e devolver os dígitos ao estoque</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: '80px' }}>ID</th>
                  <th style={{ ...th, width: '120px' }}>Localidade</th>
                  <th style={{ ...th, width: '100px' }}>Posto</th>
                  <th style={{ ...th, width: '110px' }}>Equipamento</th>
                  <th style={th}>Descrição</th>
                  <th style={{ ...th, width: '90px' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {servicos.filter(s => s.placaMontada).map((s, i) => (
                  <tr key={s._docId} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc', opacity: 0.85 }}>
                    <td style={td}><span style={{ fontWeight: '700', color: '#0f2544' }}>{s.id}</span></td>
                    <td style={td}>{s.local || '—'}</td>
                    <td style={{ ...td, fontSize: '11px', color: '#64748b' }}>
                      {postoDeLocalidade(s.local)?.split('—')[0].trim() || <span style={{ color: '#ef4444' }}>Não mapeado</span>}
                    </td>
                    <td style={{ ...td, fontWeight: '600' }}>{s.equip || '—'}</td>
                    <td style={{ ...td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.desc}</td>
                    <td style={td}>
                      <button onClick={() => desmarcarMontada(s)} style={{ fontSize: '11px', padding: '5px 12px', border: '1px solid #fecaca', borderRadius: '6px', background: '#fef2f2', color: '#b91c1c', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '500' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                      >
                        Reverter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlacasTab;