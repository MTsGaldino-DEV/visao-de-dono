import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

// ── Constantes de domínio ────────────────────────────────────────────────────
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

const STATUS_CONFIG = {
  cadastrado: { label: 'Cadastrado',    color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  enviado:    { label: 'Enviado CEMIG', color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe' },
  pendente:   { label: 'Pendente',      color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  concluido:  { label: 'Concluído',     color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  cancelado:  { label: 'Cancelado',     color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
};

const STATUS_ORDER = ['cadastrado', 'enviado', 'pendente', 'concluido', 'cancelado'];

const POSTO_CFG = {
  'Posto 1 — Pedro':    { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', track: '#dbeafe' },
  'Posto 2 — Elton':    { color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe', track: '#ede9fe' },
  'Posto 3 — Vinicius': { color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd', track: '#e0f2fe' },
  'Posto 4 — Victor':   { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', track: '#dcfce7' },
  'Não mapeado':        { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', track: '#f1f5f9' },
};

const TIPOS = ['NSIS', 'NSMP', 'RC02', 'INBE'];

const norm = (s) => (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const postoDeLocalidade = (local) => {
  const localNorm = norm(local);
  for (const [posto, locs] of Object.entries(POSTOS)) {
    if (locs.some(l => norm(l) === localNorm || localNorm.includes(norm(l)) || norm(l).includes(localNorm)))
      return posto;
  }
  return 'Não mapeado';
};

// ── Utilitários de data ──────────────────────────────────────────────────────
const parseData = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const semanaStr = (d) => {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() - dt.getDay()); // domingo da semana
  return dt.toISOString().slice(0, 10);
};

const fmtSemana = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
};

// ── Componentes UI ────────────────────────────────────────────────────────────
const card = {
  background: '#fff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

// Mini barra horizontal
const MiniBar = ({ value, max, color, track = '#f1f5f9', height = 6 }) => (
  <div style={{ flex: 1, height, borderRadius: 3, background: track, overflow: 'hidden' }}>
    <div style={{
      height: '100%', borderRadius: 3, background: color,
      width: max > 0 ? `${Math.min(100, Math.round((value / max) * 100))}%` : '0%',
      transition: 'width 0.5s ease',
    }} />
  </div>
);

// Ring (donut SVG puro)
const Ring = ({ pct, color, size = 80, stroke = 14 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ * 0.25}
        strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  );
};

// Sparkline SVG
const Sparkline = ({ data, color, height = 40, width = 120 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = 0;
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x},${y}`;
  });
  const area = `M${pts[0]} ` + pts.slice(1).map(p => `L${p}`).join(' ') + ` L${width-2},${height} L2,${height} Z`;
  const line = `M${pts[0]} ` + pts.slice(1).map(p => `L${p}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <path d={area} fill={color} fillOpacity="0.08" stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// Trend arrow
const Trend = ({ delta }) => {
  if (delta === 0) return <span style={{ fontSize: 10, color: '#94a3b8' }}>—</span>;
  const up = delta > 0;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: up ? '#15803d' : '#b91c1c', display: 'flex', alignItems: 'center', gap: 2 }}>
      {up ? '↑' : '↓'} {Math.abs(delta)}
    </span>
  );
};

// Badge status
const Badge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' };
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
const PainelTab = () => {
  const [servicos, setServicos] = useState([]);
  const [periodoTendencia, setPeriodoTendencia] = useState(8); // semanas

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'servicos'), (snap) => {
      setServicos(snap.docs.map(d => ({ ...d.data(), _docId: d.id })));
    });
    return () => unsub();
  }, []);

  // ── Derivações base ────────────────────────────────────────────────────────
  const ativos     = servicos.filter(s => s.status !== 'cancelado');
  const cancelados = servicos.filter(s => s.status === 'cancelado');

  const totalAtivos     = ativos.length;
  const totalConcluidos = ativos.filter(s => s.status === 'concluido').length;
  const totalEnviados   = ativos.filter(s => s.status === 'enviado').length;
  const totalPendentes  = ativos.filter(s => s.status === 'pendente').length;
  const totalCadastrados= ativos.filter(s => s.status === 'cadastrado').length;
  const pctGeral        = totalAtivos > 0 ? Math.round((totalConcluidos / totalAtivos) * 100) : 0;

  const totalPlacas    = ativos.filter(s => norm(s.desc).includes('PLACA')).length;
  const placasMontadas = ativos.filter(s => s.placaMontada).length;
  const pctPlacas      = totalPlacas > 0 ? Math.round((placasMontadas / totalPlacas) * 100) : 0;

  // ── Dados por posto ────────────────────────────────────────────────────────
  const dadosPosto = Object.keys(POSTOS).map(posto => {
    const ps = ativos.filter(s => postoDeLocalidade(s.local) === posto);
    const concluidos = ps.filter(s => s.status === 'concluido').length;
    const placasP = ps.filter(s => norm(s.desc).includes('PLACA')).length;
    const montadasP = ps.filter(s => s.placaMontada).length;
    const porStatus = {};
    STATUS_ORDER.forEach(st => { porStatus[st] = ps.filter(s => s.status === st).length; });
    return {
      posto,
      total: ps.length,
      concluidos,
      pct: ps.length > 0 ? Math.round((concluidos / ps.length) * 100) : 0,
      placasTotal: placasP,
      placasMontadas: montadasP,
      porStatus,
    };
  });

  const maxTotal = Math.max(...dadosPosto.map(d => d.total), 1);

  // ── Dados por tipo ─────────────────────────────────────────────────────────
  const dadosTipo = TIPOS.map(tipo => {
    const ps = ativos.filter(s => s.tipo === tipo);
    const concluidos = ps.filter(s => s.status === 'concluido').length;
    return { tipo, total: ps.length, concluidos, pct: ps.length > 0 ? Math.round((concluidos / ps.length) * 100) : 0 };
  }).filter(d => d.total > 0);

  // ── Tendência semanal ──────────────────────────────────────────────────────
  const agora = new Date();
  const semanas = Array.from({ length: periodoTendencia }, (_, i) => {
    const d = new Date(agora);
    d.setDate(d.getDate() - (periodoTendencia - 1 - i) * 7);
    return semanaStr(d);
  });

  // Cadastros por semana (usando dtCadastro)
  const cadastrosPorSemana = semanas.map(sem => {
    return servicos.filter(s => {
      const dt = s.dtCadastro?.toDate ? s.dtCadastro.toDate() : parseData(s.dtCadastro);
      if (!dt) return false;
      return semanaStr(dt) === sem;
    }).length;
  });

  // Conclusões por semana (última entrada de hist com status concluido)
  const conclusoesPorSemana = semanas.map(sem => {
    return ativos.filter(s => {
      if (s.status !== 'concluido') return false;
      const hist = s.hist || [];
      const ultimo = [...hist].reverse().find(h => h.msg?.toLowerCase().includes('conclu'));
      if (!ultimo) return false;
      const dt = parseData(ultimo.when);
      return dt && semanaStr(dt) === sem;
    }).length;
  });

  // Delta semana atual vs semana anterior
  const deltaCadastros  = cadastrosPorSemana[periodoTendencia-1] - (cadastrosPorSemana[periodoTendencia-2] || 0);
  const deltaConclusoes = conclusoesPorSemana[periodoTendencia-1] - (conclusoesPorSemana[periodoTendencia-2] || 0);

  // ── Alertas ────────────────────────────────────────────────────────────────
  const DIAS_ALERTA = 14; // serviço sem atualização há mais de X dias
  const agora_ms = agora.getTime();

  const alertas = ativos
    .filter(s => s.status !== 'concluido')
    .map(s => {
      const hist = s.hist || [];
      const ultima = hist.length > 0 ? parseData(hist[hist.length - 1].when) : null;
      const dtCad  = s.dtCadastro?.toDate ? s.dtCadastro.toDate() : parseData(s.dtCadastro);
      const ref    = ultima || dtCad;
      const diasSem = ref ? Math.floor((agora_ms - ref.getTime()) / 86400000) : null;
      return { ...s, diasSem };
    })
    .filter(s => s.diasSem !== null && s.diasSem >= DIAS_ALERTA)
    .sort((a, b) => (b.diasSem || 0) - (a.diasSem || 0))
    .slice(0, 8);

  // ── Localidades destaque ───────────────────────────────────────────────────
  const locMap = {};
  ativos.forEach(s => {
    const loc = s.local || 'Desconhecida';
    if (!locMap[loc]) locMap[loc] = { total: 0, concluido: 0, posto: postoDeLocalidade(s.local) };
    locMap[loc].total++;
    if (s.status === 'concluido') locMap[loc].concluido++;
  });
  const topLocs = Object.entries(locMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ══ LINHA 1: KPIs principais ═══════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>

        {/* Progresso geral — maior destaque */}
        <div style={{ ...card, padding: '18px 20px', gridColumn: '1', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Ring pct={pctGeral} color="#0f2544" size={72} stroke={10} />
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
            }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#0f2544', lineHeight: 1 }}>{pctGeral}%</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Progresso geral</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f2544', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{totalConcluidos}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>de {totalAtivos} ativos</div>
          </div>
        </div>

        {/* Cadastrado */}
        <div style={{ ...card, padding: '18px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>Cadastrados</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1d4ed8', lineHeight: 1, marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>{totalCadastrados}</div>
          <Sparkline data={cadastrosPorSemana} color="#1d4ed8" width={100} height={28} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>esta semana</span>
            <Trend delta={deltaCadastros} />
          </div>
        </div>

        {/* Enviado CEMIG */}
        <div style={{ ...card, padding: '18px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>Enviados CEMIG</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#7c3aed', lineHeight: 1, marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>{totalEnviados}</div>
          <div style={{ height: 6, borderRadius: 3, background: '#ede9fe', overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', borderRadius: 3, background: '#7c3aed', width: totalAtivos > 0 ? `${Math.round((totalEnviados/totalAtivos)*100)}%` : '0%', transition: 'width 0.5s' }} />
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>{totalAtivos > 0 ? Math.round((totalEnviados/totalAtivos)*100) : 0}% do total ativo</div>
        </div>

        {/* Pendentes */}
        <div style={{ ...card, padding: '18px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>Pendentes</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#c2410c', lineHeight: 1, marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>{totalPendentes}</div>
          <div style={{ height: 6, borderRadius: 3, background: '#fff7ed', overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', borderRadius: 3, background: '#c2410c', width: totalAtivos > 0 ? `${Math.round((totalPendentes/totalAtivos)*100)}%` : '0%', transition: 'width 0.5s' }} />
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>{totalAtivos > 0 ? Math.round((totalPendentes/totalAtivos)*100) : 0}% do total ativo</div>
        </div>

        {/* Placas */}
        <div style={{ ...card, padding: '18px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>Placas montadas</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#15803d', lineHeight: 1, marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>{placasMontadas}</div>
          <div style={{ height: 6, borderRadius: 3, background: '#f0fdf4', overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', borderRadius: 3, background: '#15803d', width: `${pctPlacas}%`, transition: 'width 0.5s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: '#15803d', fontWeight: 600 }}>✓ {pctPlacas}%</span>
            <span style={{ color: '#94a3b8' }}>{totalPlacas - placasMontadas} pend.</span>
          </div>
        </div>
      </div>

      {/* ══ LINHA 2: Tendência + Alertas ══════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Gráfico de tendência */}
        <div style={{ ...card, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f2544' }}>Tendência semanal</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>Cadastros vs conclusões por semana</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[4, 8, 12].map(n => (
                <button key={n} onClick={() => setPeriodoTendencia(n)} style={{
                  fontSize: 10, padding: '3px 9px', border: `1px solid ${periodoTendencia === n ? '#0f2544' : '#e2e8f0'}`,
                  borderRadius: 6, background: periodoTendencia === n ? '#0f2544' : '#fff',
                  color: periodoTendencia === n ? '#fff' : '#64748b',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.1s',
                }}>{n}s</button>
              ))}
            </div>
          </div>

          {/* Gráfico de barras agrupadas */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
            {semanas.map((sem, i) => {
              const cad = cadastrosPorSemana[i];
              const conc = conclusoesPorSemana[i];
              const maxVal = Math.max(...cadastrosPorSemana, ...conclusoesPorSemana, 1);
              const hCad  = Math.max(2, Math.round((cad  / maxVal) * 100));
              const hConc = Math.max(2, Math.round((conc / maxVal) * 100));
              const isLast = i === semanas.length - 1;
              return (
                <div key={sem} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 100 }}>
                    <div style={{
                      flex: 1, height: `${hCad}%`, borderRadius: '2px 2px 0 0',
                      background: isLast ? '#1d4ed8' : '#bfdbfe',
                      transition: 'height 0.4s ease', minHeight: 2,
                    }} title={`Cadastros: ${cad}`} />
                    <div style={{
                      flex: 1, height: `${hConc}%`, borderRadius: '2px 2px 0 0',
                      background: isLast ? '#15803d' : '#bbf7d0',
                      transition: 'height 0.4s ease', minHeight: 2,
                    }} title={`Conclusões: ${conc}`} />
                  </div>
                  <div style={{ fontSize: 9, color: isLast ? '#0f2544' : '#94a3b8', fontWeight: isLast ? 700 : 400, whiteSpace: 'nowrap' }}>
                    {fmtSemana(sem)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legenda */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#64748b' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#1d4ed8' }} />
              <span>Cadastros <Trend delta={deltaCadastros} /></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#64748b' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#15803d' }} />
              <span>Conclusões <Trend delta={deltaConclusoes} /></span>
            </div>
          </div>
        </div>

        {/* Alertas — serviços travados */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c2410c', boxShadow: '0 0 0 3px #fff7ed' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f2544' }}>Alertas</span>
                {alertas.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                    {alertas.length}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>Sem movimentação há +{DIAS_ALERTA} dias</div>
            </div>
          </div>

          <div style={{ maxHeight: 210, overflowY: 'auto' }}>
            {alertas.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>✓</div>
                Nenhum serviço travado. Tudo em dia!
              </div>
            ) : alertas.map((s, i) => {
              const postoCfg = POSTO_CFG[postoDeLocalidade(s.local)] || POSTO_CFG['Não mapeado'];
              const urgente = (s.diasSem || 0) >= 30;
              return (
                <div key={s._docId} style={{
                  padding: '10px 20px',
                  borderBottom: i < alertas.length - 1 ? '1px solid #f8fafc' : 'none',
                  background: urgente ? '#fffbeb' : '#fff',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, minWidth: 40, padding: '3px 6px', borderRadius: 6,
                    background: urgente ? '#fef3c7' : '#f1f5f9',
                    color: urgente ? '#92400e' : '#64748b',
                    textAlign: 'center', flexShrink: 0,
                  }}>{s.diasSem}d</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0f2544' }}>{s.id}</span>
                      <Badge status={s.status} />
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.local} · {s.desc?.slice(0, 45)}{s.desc?.length > 45 ? '…' : ''}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                    background: postoCfg.bg, color: postoCfg.color, border: `1px solid ${postoCfg.border}`,
                  }}>{postoDeLocalidade(s.local).split('—')[0].trim()}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ LINHA 3: Performance por posto ════════════════════════════════════ */}
      <div style={{ ...card, padding: '18px 20px' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f2544' }}>Performance por posto</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>Progresso, volume e breakdown de status por supervisão</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {dadosPosto.map(({ posto, total, concluidos, pct, placasTotal, placasMontadas, porStatus }) => {
            const cfg = POSTO_CFG[posto] || POSTO_CFG['Não mapeado'];
            const supervisor = posto.includes('—') ? posto.split('—')[1].trim() : '';
            const postoNome  = posto.includes('—') ? posto.split('—')[0].trim() : posto;
            const pctPlacaP  = placasTotal > 0 ? Math.round((placasMontadas / placasTotal) * 100) : null;

            return (
              <div key={posto} style={{
                border: `1px solid ${cfg.border}`,
                background: cfg.bg, borderRadius: 10, padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {/* Cabeçalho */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{postoNome}</div>
                    {supervisor && <div style={{ fontSize: 11, color: cfg.color, opacity: 0.7, marginTop: 1 }}>{supervisor}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{pct}%</div>
                    <div style={{ fontSize: 10, color: cfg.color, opacity: 0.7 }}>concluído</div>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div style={{ height: 6, borderRadius: 3, background: cfg.track || '#f1f5f9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: cfg.color, width: `${pct}%`, transition: 'width 0.5s' }} />
                </div>

                {/* Métricas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                  <div>
                    <div style={{ color: cfg.color, opacity: 0.6, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Total</div>
                    <div style={{ fontWeight: 700, color: cfg.color }}>{total} serv.</div>
                  </div>
                  <div>
                    <div style={{ color: cfg.color, opacity: 0.6, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Concluídos</div>
                    <div style={{ fontWeight: 700, color: cfg.color }}>✓ {concluidos}</div>
                  </div>
                  {pctPlacaP !== null && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ color: cfg.color, opacity: 0.6, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>
                        Placas — {placasMontadas}/{placasTotal} ({pctPlacaP}%)
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: cfg.track || '#f1f5f9', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: cfg.color, width: `${pctPlacaP}%`, opacity: 0.6 }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Mini badges de status */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {STATUS_ORDER.filter(st => (porStatus[st] || 0) > 0).map(st => {
                    const scfg = STATUS_CONFIG[st];
                    return (
                      <span key={st} style={{
                        fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 700,
                        background: '#fff', color: scfg.color, border: `1px solid ${scfg.border}`,
                      }}>
                        {scfg.label.split(' ')[0]} {porStatus[st]}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ LINHA 4: Por tipo + Top localidades ═══════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Por tipo */}
        <div style={{ ...card, padding: '18px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f2544', marginBottom: 2 }}>Por tipo de serviço</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Volume e taxa de conclusão</div>

          {dadosTipo.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12 }}>Sem dados.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {dadosTipo.map(({ tipo, total, concluidos, pct }) => {
                const maxT = Math.max(...dadosTipo.map(d => d.total), 1);
                return (
                  <div key={tipo}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                          background: '#0f2544', color: '#fff', letterSpacing: '0.06em',
                        }}>{tipo}</span>
                        <span style={{ fontSize: 12, color: '#64748b' }}>{total} serviços</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>✓ {concluidos}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0f2544', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </div>
                    {/* Barra dupla: volume (cinza) + conclusão (azul) */}
                    <div style={{ position: 'relative', height: 8, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 4, background: '#e2e8f0', width: `${Math.round((total/maxT)*100)}%` }} />
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 4, background: '#1d4ed8', width: `${pct * (total/maxT)}%`, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top localidades */}
        <div style={{ ...card, padding: '18px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f2544', marginBottom: 2 }}>Top localidades</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Por volume de serviços ativos</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topLocs.map(([loc, d], i) => {
              const pctLoc = d.total > 0 ? Math.round((d.concluido / d.total) * 100) : 0;
              const cfg = POSTO_CFG[d.posto] || POSTO_CFG['Não mapeado'];
              const maxLoc = topLocs[0][1].total;
              return (
                <div key={loc}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', minWidth: 14 }}>#{i+1}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{loc}</span>
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 20, fontWeight: 700,
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                      }}>{d.posto.split('—')[0].trim()}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                      <span style={{ fontWeight: 700, color: '#0f2544' }}>{d.total}</span>
                      <span style={{ color: '#15803d', fontWeight: 600 }}>✓ {pctLoc}%</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <MiniBar value={d.total} max={maxLoc} color={cfg.color} track={cfg.track || '#f1f5f9'} height={5} />
                    <MiniBar value={d.concluido} max={d.total} color="#15803d" track="#f0fdf4" height={5} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ LINHA 5: Funil de status + Cancelados ═════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>

        {/* Funil de status */}
        <div style={{ ...card, padding: '18px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f2544', marginBottom: 2 }}>Funil de status</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Volume de serviços em cada etapa do fluxo</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STATUS_ORDER.filter(s => s !== 'cancelado').map(st => {
              const cfg = STATUS_CONFIG[st];
              const count = ativos.filter(s => s.status === st).length;
              const pctSt = totalAtivos > 0 ? Math.round((count / totalAtivos) * 100) : 0;
              return (
                <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 100, fontSize: 11, fontWeight: 600, color: cfg.color, flexShrink: 0 }}>{cfg.label}</div>
                  <div style={{ flex: 1, height: 18, borderRadius: 4, background: '#f8fafc', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 4,
                      background: cfg.bg, border: `1px solid ${cfg.border}`,
                      width: `${pctSt}%`, transition: 'width 0.5s',
                    }} />
                    <div style={{ position: 'absolute', left: 8, top: 0, height: '100%', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{count} serv. — {pctSt}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cancelados + totais gerais */}
        <div style={{ ...card, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f2544', marginBottom: 12 }}>Visão geral</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Total cadastrado', value: servicos.length, color: '#0f2544' },
                { label: 'Ativos',           value: totalAtivos,     color: '#1d4ed8' },
                { label: 'Cancelados',        value: cancelados.length, color: '#b91c1c' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Taxa global</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Ring pct={pctGeral} color="#0f2544" size={56} stroke={8} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f2544', lineHeight: 1 }}>{pctGeral}%</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>do projeto concluído</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default PainelTab;