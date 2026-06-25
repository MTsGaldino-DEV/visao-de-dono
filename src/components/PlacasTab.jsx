import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

const POSTOS = {
  'Posto 1 — Pedro': [
    'FREI INOCENCIO', 'ALPERCATA', 'ALVARENGA', 'CAPITAO ANDRADE', 'ENGENHEIRO CALDAS',
    'FERNANDES TOURINHO', 'GOVERNADOR VALADARES', 'ITANHOMI', 'JAMPRUCA', 'JATAI',
    'MATHIAS LOBATO', 'SAO GERALDO TUMIRITINGA', 'SOBRALIA', 'TARUMIRIM', 'TUMIRITINGA',
  ],
  'Posto 2 — Elton': [
    'COLUNA', 'SAO GERALDO DA PIEDADE', 'AGUA BOA', 'JOSE RAYDAN', 'PAULISTAS',
    'CANTAGALO', 'PECANHA', 'SAO JOAO EVANGELISTA', 'SAO JOSE DO JACURI',
    'SANTA EFIGENIA DE MINAS', 'GONZAGA', 'SANTA MARIA DO SUACUI', 'FREI LAGO NEGRO',
    'SAO PEDRO DO SUACUI', 'SAO SEBASTIAO DO MARANHAO', 'SARDOA',
  ],
  'Posto 3 — Vinicius': [
    'CUPARAQUE', 'CONSELHEIRO PENA', 'RESPLENDOR', 'AIMORES', 'GOIABEIRA',
    'ITUETA', 'SANTA RITA DO ITUETO', 'SAO GERALDO DO BAIXIO', 'GALILEIA',
  ],
  'Posto 4 — Victor': [
    'ITABIRINHA DE MANTENA', 'DIVINO LARANJEIRAS', 'CENTRAL DE MINAS', 'MENDES PIMENTEL',
    'NOVA BELEM', 'SAO FELIX DE MINAS', 'TIPITI', 'MANTENA', 'SAO JOAO DO MANTENINHA',
    'MARILAC', 'COROACI', 'VIRGOLANDIA', 'NACIP RAYDAN', 'SAO JOSE DA SAFIRA',
  ],
};

const POSTO_COLORS = {
  'Posto 1 — Pedro': { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', stroke: '#3b82f6' },
  'Posto 2 — Elton': { color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe', stroke: '#a78bfa' },
  'Posto 3 — Vinicius': { color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd', stroke: '#38bdf8' },
  'Posto 4 — Victor': { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', stroke: '#4ade80' },
};

const STATUS_CONFIG = {
  cadastrado: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Cadastrado' },
  enviado: { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe', label: 'Enviado CEMIG' },
  pendente: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Pendente' },
  concluido: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Concluído' },
  cancelado: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Cancelado' },
};

const PAGE_SIZE = 50;

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
  digits.forEach(d => count[d === 9 ? 6 : d]++);
  return count;
};

// ── Exportar ──────────────────────────────────────────────────────────────────
const exportarXLSX = (dados, nomeAba, nomeArquivo) => {
  const linhas = dados.map(s => ({
    'ID': s.id || '—',
    'Nº Serviço': s.numServ || '—',
    'Localidade': s.local || '—',
    'Posto': postoDeLocalidade(s.local) || '—',
    'Equipamento': s.equip || '—',
    'Descrição': s.desc || '—',
    'Status': STATUS_CONFIG[s.status]?.label || s.status || '—',
    'Enviado Supervisor': s.enviadosupervisor ? 'Sim' : 'Não',
  }));
  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  const hoje = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${nomeArquivo}_${hoje}.xlsx`);
};

// ── BotaoExportar ─────────────────────────────────────────────────────────────
const BotaoExportar = ({ onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title="Exportar para Excel"
    style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '5px 9px', borderRadius: 7, border: '1px solid #e2e8f0',
      background: '#f8fafc', color: '#64748b', cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.15s', flexShrink: 0,
    }}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; e.currentTarget.style.color = '#15803d'; } }}
    onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
    Exportar
  </button>
);

// ── MultiSelect ───────────────────────────────────────────────────────────────
const MultiSelect = ({ options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);

  const displayLabel = selected.length === 0
    ? 'Todos'
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label || selected[0]
      : `${selected.length} selecionados`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '7px 10px', border: selected.length > 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
        borderRadius: '8px', fontSize: '12px', background: selected.length > 0 ? '#eff6ff' : '#fff',
        color: selected.length > 0 ? '#1d4ed8' : '#1e293b', fontWeight: selected.length > 0 ? '600' : '400',
        cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', boxSizing: 'border-box', outline: 'none',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ flexShrink: 0, marginLeft: '6px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: '190px', overflow: 'hidden',
        }}>
          {selected.length > 0 && (
            <button onClick={() => onChange([])} style={{
              width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: '11px',
              fontFamily: 'inherit', textAlign: 'left', fontWeight: '600',
            }}>Limpar seleção</button>
          )}
          {options.map(({ value, label, badge }) => {
            const sel = selected.includes(value);
            return (
              <button key={value} onClick={() => toggle(value)} style={{
                width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f8fafc',
                background: sel ? '#f0f7ff' : '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit',
              }}>
                <div style={{
                  width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                  border: sel ? '4px solid #1d4ed8' : '1.5px solid #cbd5e1',
                  background: sel ? '#1d4ed8' : '#fff', transition: 'all 0.1s',
                }} />
                {badge ? (
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', fontWeight: '600', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>{label}</span>
                ) : (
                  <span style={{ fontSize: '12px', color: '#334155' }}>{label}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Paginação ─────────────────────────────────────────────────────────────────
const Paginacao = ({ totalItems, currentPage, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, totalItems);

  const visiblePages = (() => {
    const pages = [];
    for (let i = Math.max(1, safePage - 3); i <= Math.min(totalPages, safePage + 3); i++) pages.push(i);
    return pages;
  })();

  if (totalPages <= 1) return null;

  const btnBase = {
    height: '30px', border: '1px solid #e2e8f0', borderRadius: '7px',
    background: '#fff', color: '#475569', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
  };

  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc', borderRadius: '0 0 12px 12px' }}>
      <div style={{ fontSize: '11px', color: '#64748b' }}>
        Exibindo <strong style={{ color: '#0f2544' }}>{pageStart + 1}–{pageEnd}</strong> de <strong style={{ color: '#0f2544' }}>{totalItems}</strong> registros
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button onClick={() => onPageChange(p => Math.max(1, p - 1))} disabled={safePage === 1}
          style={{ ...btnBase, width: '30px', color: safePage === 1 ? '#cbd5e1' : '#475569', cursor: safePage === 1 ? 'not-allowed' : 'pointer', background: safePage === 1 ? '#f8fafc' : '#fff' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>

        {visiblePages[0] > 1 && (
          <>
            <button onClick={() => onPageChange(1)} style={{ ...btnBase, minWidth: '30px', fontSize: '12px', fontWeight: '500', padding: '0 6px' }}>1</button>
            {visiblePages[0] > 2 && <span style={{ color: '#94a3b8', fontSize: '12px', padding: '0 2px' }}>…</span>}
          </>
        )}

        {visiblePages.map(p => (
          <button key={p} onClick={() => onPageChange(p)}
            style={{ ...btnBase, minWidth: '30px', padding: '0 6px', fontSize: '12px', fontWeight: p === safePage ? '700' : '500', border: p === safePage ? '2px solid #1d4ed8' : '1px solid #e2e8f0', background: p === safePage ? '#eff6ff' : '#fff', color: p === safePage ? '#1d4ed8' : '#475569' }}>
            {p}
          </button>
        ))}

        {visiblePages[visiblePages.length - 1] < totalPages && (
          <>
            {visiblePages[visiblePages.length - 1] < totalPages - 1 && <span style={{ color: '#94a3b8', fontSize: '12px', padding: '0 2px' }}>…</span>}
            <button onClick={() => onPageChange(totalPages)} style={{ ...btnBase, minWidth: '30px', fontSize: '12px', fontWeight: '500', padding: '0 6px' }}>{totalPages}</button>
          </>
        )}

        <button onClick={() => onPageChange(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
          style={{ ...btnBase, width: '30px', color: safePage === totalPages ? '#cbd5e1' : '#475569', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', background: safePage === totalPages ? '#f8fafc' : '#fff' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
    </div>
  );
};

// ── Gráfico circular ──────────────────────────────────────────────────────────
const DonutChart = ({ montadas, pendentes, postoAtivo }) => {
  const total = montadas + pendentes;
  if (total === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '12px' }}>Sem dados</div>
  );
  const R = 70, CX = 90, CY = 90, stroke = 28;
  const circ = 2 * Math.PI * R;
  const pctMontadas = montadas / total;
  const pendColor = postoAtivo ? (POSTO_COLORS[postoAtivo]?.stroke || '#f97316') : '#f97316';
  const gap = 0.012;
  const seg1 = pctMontadas * (1 - gap * 2);
  const seg2 = (1 - pctMontadas) * (1 - gap * 2);
  const arc = (pct, offset) => ({ strokeDasharray: `${pct * circ} ${circ}`, strokeDashoffset: -offset * circ });
  const pctLabel = Math.round((montadas / total) * 100);
  return (
    <div style={{ position: 'relative', width: '180px', height: '180px', margin: '0 auto' }}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {pendentes > 0 && <circle cx={CX} cy={CY} r={R} fill="none" stroke={pendColor} strokeWidth={stroke} strokeLinecap="butt" style={{ ...arc(seg2, pctMontadas + gap), transition: 'stroke-dasharray 0.5s ease' }} transform={`rotate(-90 ${CX} ${CY})`} />}
        {montadas > 0 && <circle cx={CX} cy={CY} r={R} fill="none" stroke="#15803d" strokeWidth={stroke} strokeLinecap="butt" style={{ ...arc(seg1, gap), transition: 'stroke-dasharray 0.5s ease' }} transform={`rotate(-90 ${CX} ${CY})`} />}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f2544', lineHeight: 1 }}>{pctLabel}%</div>
        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', marginTop: '2px' }}>montadas</div>
      </div>
    </div>
  );
};

// ── Estilos base ──────────────────────────────────────────────────────────────
const card = { background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', background: '#fff', color: '#1e293b', outline: 'none', fontFamily: "'Segoe UI', system-ui, sans-serif", boxSizing: 'border-box' };
const labelUp = { fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '5px', display: 'block' };
const th = { textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: '700', padding: '9px 12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase' };
const td = { padding: '10px 12px', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle', fontSize: '12px', color: '#334155', whiteSpace: 'nowrap' };

// ── Componente principal ──────────────────────────────────────────────────────
const PlacasTab = () => {
  const { user } = useAuth();

  const [servicos, setServicos] = useState([]);
  const [estoque, setEstoque] = useState(Array(10).fill(0));
  const [postoFilter, setPostoFilter] = useState('');
  const [dashPosto, setDashPosto] = useState('');
  const [editandoEstoque, setEditandoEstoque] = useState(false);
  const [estoqueTemp, setEstoqueTemp] = useState(Array(10).fill(0));
  const [savingEstoque, setSavingEstoque] = useState(false);
  const [buscaEquip, setBuscaEquip] = useState('');
  const [expandidoLoc, setExpandidoLoc] = useState({});

  // Paginação
  const [pagePendentes, setPagePendentes] = useState(1);
  const [pageMontadas, setPageMontadas] = useState(1);
  const [buscaMontadas, setBuscaMontadas] = useState('');

  useEffect(() => {
    const carregar = async () => {
      const { data } = await supabase.from('servicos').select('*');
      if (data) setServicos(data);
    };
    carregar();
    const channel = supabase.channel('servicos_placas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, carregar)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from('config').select('*').eq('id', 'estoque').single();
        if (data) setEstoque(data.digitos || Array(10).fill(0));
      } catch { }
    };
    load();
  }, []);

  // Reseta página ao mudar filtros
  useEffect(() => {
    setPagePendentes(1);
    setPageMontadas(1);
  }, [postoFilter, buscaEquip, buscaMontadas]);

  const salvarEstoque = async () => {
    setSavingEstoque(true);
    try {
      await supabase.from('config').upsert({ id: 'estoque', digitos: estoqueTemp });
      setEstoque(estoqueTemp);
      setEditandoEstoque(false);
    } catch { alert('Erro ao salvar estoque.'); }
    finally { setSavingEstoque(false); }
  };

  const todasPlacas = servicos.filter(s => s.status !== 'cancelado' && norm(s.desc).includes('PLACA'));
  const pendentesMontagem = todasPlacas.filter(s => !s.placamontada && s.status === 'pendente');
  const todasMontadas = todasPlacas.filter(s => s.placamontada);

  const equipTermos = buscaEquip.trim()
    ? buscaEquip.split(/[,;\n\s]+/).map(t => t.trim()).filter(Boolean)
    : [];

  // ── Filtros pendentes ─────────────────────────────────────────────────────
  const filtrados = pendentesMontagem.filter(s => {
    if (postoFilter && postoDeLocalidade(s.local) !== postoFilter) return false;
    if (equipTermos.length > 0) {
      const equip = norm(s.equip || '');
      const numServ = norm(s.numServ || '');
      return equipTermos.some(t => equip.includes(norm(t)) || numServ.includes(norm(t)));
    }
    return true;
  });

  const safePendentesPage = Math.min(pagePendentes, Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE)));
  const filtradosPage = filtrados.slice((safePendentesPage - 1) * PAGE_SIZE, safePendentesPage * PAGE_SIZE);

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const dashPlacas = dashPosto ? todasPlacas.filter(s => postoDeLocalidade(s.local) === dashPosto) : todasPlacas;
  const dashMontadas = dashPlacas.filter(s => s.placamontada).length;
  const dashPendentes = dashPlacas.length - dashMontadas;

  const dadosPosto = Object.keys(POSTOS).map(posto => {
    const ps = todasPlacas.filter(s => postoDeLocalidade(s.local) === posto);
    const mont = ps.filter(s => s.placamontada).length;
    const locMap = {};
    ps.forEach(s => {
      const loc = s.local || 'Desconhecida';
      if (!locMap[loc]) locMap[loc] = { total: 0, montadas: 0 };
      locMap[loc].total++;
      if (s.placamontada) locMap[loc].montadas++;
    });
    return { posto, total: ps.length, montadas: mont, pendentes: ps.length - mont, locMap };
  });

  const digitosNecessarios = Array(10).fill(0);
  filtrados.forEach(s => {
    const d = digitosDeEquip(s.equip);
    for (let i = 0; i <= 9; i++) { if (i === 9) continue; digitosNecessarios[i] += d[i]; }
  });

  const qtdEnviados = todasMontadas.filter(s => s.enviadosupervisor).length;
  const qtdNaoEnviados = todasMontadas.filter(s => !s.enviadosupervisor).length;

  // ── Filtros montadas ──────────────────────────────────────────────────────
  const equipMontadasTermos = buscaMontadas.trim()
    ? buscaMontadas.split(/[,;\n\s]+/).map(t => t.trim()).filter(Boolean)
    : [];

  const filtradosMontadas = todasMontadas.filter(s => {
    if (postoFilter && postoDeLocalidade(s.local) !== postoFilter) return false;
    if (equipMontadasTermos.length > 0) {
      const equip = norm(s.equip || '');
      const numServ = norm(s.numServ || '');
      return equipMontadasTermos.some(t => equip.includes(norm(t)) || numServ.includes(norm(t)));
    }
    return true;
  });

  const safeMontadasPage = Math.min(pageMontadas, Math.max(1, Math.ceil(filtradosMontadas.length / PAGE_SIZE)));
  const filtradosMontadasPage = filtradosMontadas.slice((safeMontadasPage - 1) * PAGE_SIZE, safeMontadasPage * PAGE_SIZE);

  // ── Ações Supabase ────────────────────────────────────────────────────────
  const marcarMontada = async (s) => {
    try {
      const novoEstoque = [...estoque];
      const d = digitosDeEquip(s.equip);
      for (let i = 0; i <= 9; i++) { if (i === 9) continue; novoEstoque[i] = Math.max(0, novoEstoque[i] - d[i]); }
      const { error } = await supabase.from('servicos').update({
        placamontada: true, enviadosupervisor: false,
        hist: [...(s.hist || []), { who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: 'Placa montada.' }],
      }).eq('id', s.id);
      if (error) {
        alert('Erro ao marcar placa como montada: ' + (error.message || JSON.stringify(error)));
        return;
      }
      await supabase.from('config').upsert({ id: 'estoque', digitos: novoEstoque });
      setEstoque(novoEstoque);
    } catch (e) { alert('Erro ao marcar placa como montada: ' + e.message); }
  };

  const reverterMontagem = async (s) => {
    try {
      const novoEstoque = [...estoque];
      const d = digitosDeEquip(s.equip);
      for (let i = 0; i <= 9; i++) {
        if (i === 9) continue;
        novoEstoque[i] += d[i];
      }
      await supabase.from('servicos').update({
        placamontada: false,
        hist: [...(s.hist || []), { who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: 'Montagem de placa revertida.' }],
      }).eq('id', s.id);
      await supabase.from('config').upsert({ id: 'estoque', digitos: novoEstoque });
      setEstoque(novoEstoque);
    } catch {
      alert('Erro ao reverter montagem.');
    }
  };

  const enviarAoSupervisor = async (s) => {
    try {
      await supabase.from('servicos').update({
        enviadosupervisor: true,
        hist: [...(s.hist || []), { who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: 'Placa enviada ao supervisor.' }],
      }).eq('id', s.id);
    } catch {
      alert('Erro ao enviar placa ao supervisor.');
    }
  };

  const temEstoque = (s) => {
    const d = digitosDeEquip(s.equip);
    for (let i = 0; i <= 9; i++) { if (i === 9) continue; if (d[i] > estoque[i]) return false; }
    return true;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Cards resumo ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Total de placas', value: todasPlacas.length, color: '#0f2544' },
          { label: 'Montadas', value: todasMontadas.length, color: '#15803d' },
          { label: 'Enviadas ao supervisor', value: qtdEnviados, color: '#7c3aed' },
          { label: 'Pendentes montagem', value: pendentesMontagem.length, color: '#c2410c' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...card, padding: '16px 20px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color, lineHeight: 1.1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Dashboard ── */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544' }}>Dashboard de placas</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Montadas vs pendentes por supervisão e localidade</div>
          </div>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <DonutChart montadas={dashMontadas} pendentes={dashPendentes} postoAtivo={dashPosto || null} />
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {dadosPosto.filter(d => d.total > 0 && (!dashPosto || d.posto === dashPosto)).map(({ posto, total, montadas, pendentes, locMap }) => {
              const cfg = POSTO_COLORS[posto];
              const pct = total > 0 ? Math.round((montadas / total) * 100) : 0;
              const exp = expandidoLoc[posto];
              const postoNome = posto.split('—')[0].trim();
              const supervisor = posto.split('—')[1]?.trim() || '';
              return (
                <div key={posto} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <button onClick={() => setExpandidoLoc(prev => ({ ...prev, [posto]: !prev[posto] }))}
                    style={{ width: '100%', padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" style={{ transform: exp ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 9px', borderRadius: '20px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>{postoNome}</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{supervisor}</span>
                    <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#f1f5f9', overflow: 'hidden', margin: '0 8px' }}>
                      <div style={{ height: '100%', background: '#15803d', width: `${pct}%`, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', flexShrink: 0 }}>
                      <span style={{ color: '#15803d', fontWeight: '700' }}>✓ {montadas}</span>
                      <span style={{ color: '#c2410c', fontWeight: '700' }}>{pendentes} pend.</span>
                      <span style={{ color: '#94a3b8' }}>{total} total · {pct}%</span>
                    </div>
                  </button>
                  {exp && (
                    <div style={{ paddingLeft: '20px', paddingBottom: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
                        {Object.entries(locMap).sort((a, b) => b[1].total - a[1].total).map(([loc, d]) => {
                          const pctLoc = d.total > 0 ? Math.round((d.montadas / d.total) * 100) : 0;
                          const tudo = pctLoc === 100;
                          const nada = pctLoc === 0;
                          return (
                            <div key={loc} style={{ padding: '8px 10px', borderRadius: '8px', border: tudo ? '1px solid #bbf7d0' : nada ? '1px solid #fecaca' : '1px solid #e2e8f0', background: tudo ? '#f0fdf4' : nada ? '#fef2f2' : '#f8fafc' }}>
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
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Nenhum serviço de placa encontrado.</div>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '8px' }}>
          {[0, 1, 2, 3, 4, 5, '6/9', 7, 8].map((d) => {
            const slot = d === '6/9' ? 6 : d;
            const qtd = editandoEstoque ? estoqueTemp[slot] : estoque[slot];
            const necessario = digitosNecessarios[slot];
            const falta = Math.max(0, necessario - estoque[slot]);
            const semEstoque = !editandoEstoque && estoque[slot] === 0;
            const baixo = !editandoEstoque && estoque[slot] > 0 && estoque[slot] < necessario;
            const isCombo = d === '6/9';
            return (
              <div key={String(d)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 6px', borderRadius: '10px', border: semEstoque ? '1px solid #fecaca' : baixo ? '1px solid #fed7aa' : isCombo ? '1px solid #ddd6fe' : '1px solid #e2e8f0', background: semEstoque ? '#fef2f2' : baixo ? '#fff7ed' : isCombo ? '#faf5ff' : '#f8fafc' }}>
                <div style={{ fontSize: isCombo ? '16px' : '20px', fontWeight: '800', color: semEstoque ? '#b91c1c' : baixo ? '#c2410c' : isCombo ? '#7c3aed' : '#0f2544', lineHeight: 1 }}>{isCombo ? '6/9' : d}</div>
                {isCombo && <div style={{ fontSize: '8px', color: '#7c3aed', fontWeight: '600', letterSpacing: '0.04em', marginTop: '-4px' }}>mesmo mat.</div>}
                {editandoEstoque ? (
                  <input type="number" min="0" max="9999" value={estoqueTemp[slot]}
                    onChange={e => { const v = parseInt(e.target.value) || 0; setEstoqueTemp(prev => { const n = [...prev]; n[slot] = v; return n; }); }}
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
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#fff7ed', border: '1px solid #fed7aa', display: 'inline-block' }} />Insuficiente</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'inline-block' }} />Ok</span>
          </div>
        )}
      </div>

      {/* ── Pendentes de montagem ── */}
      <div style={card}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544', marginBottom: '10px' }}>Pendentes de montagem</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', alignItems: 'end' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelUp}>Buscar por nº equipamento ou nº serviço (separe por vírgula)</label>
              <div style={{ position: 'relative' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input type="text" placeholder="Ex: 240539792, 240800668 — ou cole uma lista"
                  value={buscaEquip} onChange={e => setBuscaEquip(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: '30px' }} />
              </div>
              {equipTermos.length > 1 && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {equipTermos.map(t => (
                    <span key={t} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: '600' }}>{t}</span>
                  ))}
                  <button onClick={() => setBuscaEquip('')} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>limpar</button>
                </div>
              )}
            </div>
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
              {filtrados.length > 0 && (
                <BotaoExportar
                  onClick={() => exportarXLSX(filtrados, 'Pendentes Montagem', 'placas_pendentes')}
                />
              )}
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
                <th style={{ ...th, width: '90px' }}>Status nota</th>
                <th style={{ ...th, width: '100px' }}>Estoque</th>
                <th style={{ ...th, width: '90px' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtradosPage.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '13px' }}>
                  {equipTermos.length > 0 ? 'Nenhum serviço encontrado para os números informados.' : 'Nenhuma placa pendente de montagem.'}
                </td></tr>
              )}
              {filtradosPage.map((s, i) => {
                const posto = postoDeLocalidade(s.local);
                const haEstoque = temEstoque(s);
                const digStr = (s.equip || '').replace(/\D/g, '');
                const scfg = STATUS_CONFIG[s.status] || { label: s.status, color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' };
                return (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}
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
                            const slot = d === '9' ? 6 : parseInt(d);
                            const semEst = estoque[slot] === 0;
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
                      <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: scfg.bg, color: scfg.color, border: `1px solid ${scfg.border}` }}>
                        {scfg.label}
                      </span>
                    </td>
                    <td style={td}>
                      {s.equip ? (haEstoque
                        ? <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>Suficiente</span>
                        : <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>Insuficiente</span>
                      ) : <span style={{ color: '#94a3b8', fontSize: '11px' }}>Sem equip.</span>}
                    </td>
                    <td style={td}>
                      <button onClick={() => marcarMontada(s)}
                        style={{ fontSize: '11px', padding: '5px 12px', border: '1px solid #bbf7d0', borderRadius: '6px', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.borderColor = '#86efac'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                        Montar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Paginacao totalItems={filtrados.length} currentPage={safePendentesPage} onPageChange={setPagePendentes} />
      </div>

      {/* ── Placas montadas ── */}
      <div style={card}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544', marginBottom: '10px' }}>Placas montadas</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', alignItems: 'end' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelUp}>Buscar por nº equipamento ou nº serviço</label>
              <div style={{ position: 'relative' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input type="text" placeholder="Pesquisar..."
                  value={buscaMontadas} onChange={e => setBuscaMontadas(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: '30px' }} />
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', borderRadius: '20px', padding: '3px 10px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                {filtradosMontadas.length} {filtradosMontadas.length === 1 ? 'placa montada' : 'placas montadas'}
              </div>
              {filtradosMontadas.length > 0 && (
                <BotaoExportar
                  onClick={() => exportarXLSX(filtradosMontadas, 'Placas Montadas', 'placas_montadas')}
                />
              )}
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
                <th style={{ ...th, width: '90px' }}>Status nota</th>
                <th style={{ ...th, width: '90px', textAlign: 'center' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtradosMontadasPage.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '13px' }}>
                  {equipMontadasTermos.length > 0 ? 'Nenhuma placa montada encontrada para a busca.' : 'Nenhuma placa montada no momento.'}
                </td></tr>
              )}
              {filtradosMontadasPage.map((s, i) => {
                const posto = postoDeLocalidade(s.local);
                const digStr = (s.equip || '').replace(/\D/g, '');
                const scfg = STATUS_CONFIG[s.status] || { label: s.status, color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' };
                return (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}
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
                          {digStr.split('').map((d, idx) => (
                            <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                              {d}
                            </span>
                          ))}
                        </div>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: scfg.bg, color: scfg.color, border: `1px solid ${scfg.border}` }}>
                        {scfg.label}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        {!s.enviadosupervisor ? (
                          <button onClick={() => enviarAoSupervisor(s)}
                            style={{ fontSize: '11px', padding: '5px 12px', border: '1px solid #ddd6fe', borderRadius: '6px', background: '#faf5ff', color: '#7c3aed', cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f3e8ff'; e.currentTarget.style.borderColor = '#c084fc'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#faf5ff'; e.currentTarget.style.borderColor = '#ddd6fe'; }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="22 2 11 13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                            Enviar
                          </button>
                        ) : (
                          <span style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                            Enviada
                          </span>
                        )}
                        <button onClick={() => { if (window.confirm('Tem certeza que deseja reverter a montagem desta placa? O estoque será reposto.')) reverterMontagem(s); }}
                          style={{ fontSize: '11px', padding: '5px 12px', border: '1px solid #fecaca', borderRadius: '6px', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" /></svg>
                          Reverter
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Paginacao totalItems={filtradosMontadas.length} currentPage={safeMontadasPage} onPageChange={setPageMontadas} />
      </div>

    </div>
  );
};

export default PlacasTab;