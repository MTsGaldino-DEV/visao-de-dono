import { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

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
  cadastrado: { label: 'Cadastrado', color: '#1d4ed8', bg: '#eff6ff' },
  enviado:    { label: 'Enviado CEMIG', color: '#7c3aed', bg: '#faf5ff' },
  pendente:   { label: 'Pendente', color: '#c2410c', bg: '#fff7ed' },
  concluido:  { label: 'Concluído', color: '#15803d', bg: '#f0fdf4' },
  cancelado:  { label: 'Cancelado', color: '#b91c1c', bg: '#fef2f2' },
};

const STATUS_ORDER = ['cadastrado', 'enviado', 'pendente', 'concluido', 'cancelado'];

const norm = (s) => (s || '').toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const postoDeLocalidade = (local) => {
  const localNorm = norm(local);
  for (const [posto, locs] of Object.entries(POSTOS)) {
    if (locs.some(l => norm(l) === localNorm || localNorm.includes(norm(l)) || norm(l).includes(localNorm))) {
      return posto;
    }
  }
  return 'Não mapeado';
};

const POSTO_COLORS = {
  'Posto 1 — Pedro':   { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  'Posto 2 — Elton':   { color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe' },
  'Posto 3 — Vinicius':{ color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
  'Posto 4 — Victor':  { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  'Não mapeado':       { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

// Barra horizontal simples
const Bar = ({ value, max, color, bg }) => (
  <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: '#f1f5f9', overflow: 'hidden' }}>
    <div style={{
      height: '100%', borderRadius: '4px',
      background: color,
      width: max > 0 ? `${Math.round((value / max) * 100)}%` : '0%',
      transition: 'width 0.4s ease',
    }} />
  </div>
);

const card = {
  background: '#fff', borderRadius: '12px',
  border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const SectionTitle = ({ children }) => (
  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544', marginBottom: '2px' }}>{children}</div>
);
const SectionSub = ({ children }) => (
  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '14px' }}>{children}</div>
);

const PainelTab = () => {
  const [servicos, setServicos] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'servicos'), (snap) => {
      setServicos(snap.docs.map(d => ({ ...d.data(), _docId: d.id })));
    });
    return () => unsub();
  }, []);

  const ativos = servicos.filter(s => s.status !== 'cancelado');

  // ── Métricas globais ────────────────────────────────────────────────────────
  const totalAtivos     = ativos.length;
  const totalConcluidos = ativos.filter(s => s.status === 'concluido').length;
  const totalPlacas     = servicos.filter(s => norm(s.desc).includes('PLACA') && s.status !== 'cancelado').length;
  const placasMontadas  = servicos.filter(s => s.placaMontada).length;
  const pctConcluido    = totalAtivos > 0 ? Math.round((totalConcluidos / totalAtivos) * 100) : 0;
  const pctPlacas       = totalPlacas > 0 ? Math.round((placasMontadas / totalPlacas) * 100) : 0;

  // ── Dados por posto ─────────────────────────────────────────────────────────
  const todoPostos = [...Object.keys(POSTOS), 'Não mapeado'];

  const dadosPosto = todoPostos.map(posto => {
    const servsPosto = ativos.filter(s => postoDeLocalidade(s.local) === posto);
    const placasPosto = servsPosto.filter(s => norm(s.desc).includes('PLACA'));
    const montadasPosto = placasPosto.filter(s => s.placaMontada);
    const porStatus = {};
    STATUS_ORDER.forEach(st => {
      porStatus[st] = servsPosto.filter(s => s.status === st).length;
    });
    // Por localidade
    const locMap = {};
    servsPosto.forEach(s => {
      const loc = s.local || 'Desconhecida';
      if (!locMap[loc]) locMap[loc] = { total: 0, concluido: 0, placas: 0, montadas: 0 };
      locMap[loc].total++;
      if (s.status === 'concluido') locMap[loc].concluido++;
      if (norm(s.desc).includes('PLACA')) locMap[loc].placas++;
      if (s.placaMontada) locMap[loc].montadas++;
    });
    return {
      posto,
      total: servsPosto.length,
      concluidos: porStatus['concluido'] || 0,
      placasTotal: placasPosto.length,
      placasMontadas: montadasPosto.length,
      porStatus,
      porLocalidade: Object.entries(locMap).sort((a, b) => b[1].total - a[1].total),
    };
  }).filter(d => d.total > 0 || d.posto !== 'Não mapeado');

  const maxTotal = Math.max(...dadosPosto.map(d => d.total), 1);

  // ── Por tipo ────────────────────────────────────────────────────────────────
  const tipos = ['NSIS','NSMP','RC02','INBE'];
  const dadosTipo = tipos.map(t => ({
    tipo: t,
    total: ativos.filter(s => s.tipo === t).length,
    concluido: ativos.filter(s => s.tipo === t && s.status === 'concluido').length,
  })).filter(d => d.total > 0);
  const maxTipo = Math.max(...dadosTipo.map(d => d.total), 1);

  // ── Expandir/colapsar localidades ──────────────────────────────────────────
  const [expandido, setExpandido] = useState({});
  const toggleExpand = (posto) => setExpandido(prev => ({ ...prev, [posto]: !prev[posto] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Métricas globais ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Serviços ativos',    value: totalAtivos,     sub: `${pctConcluido}% concluídos`,     color: '#0f2544' },
          { label: 'Concluídos',         value: totalConcluidos, sub: `de ${totalAtivos} ativos`,         color: '#15803d' },
          { label: 'Placas pendentes',   value: totalPlacas - placasMontadas, sub: `${placasMontadas} montadas`,   color: '#c2410c' },
          { label: 'Placas montadas',    value: placasMontadas,  sub: `${pctPlacas}% do total`,           color: '#7c3aed' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ ...card, padding: '16px 20px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '30px', fontWeight: '800', color, lineHeight: 1, marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Serviços por posto ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Coluna esquerda: barras por posto */}
        <div style={{ ...card, padding: '20px' }}>
          <SectionTitle>Serviços por posto</SectionTitle>
          <SectionSub>Total de serviços ativos em cada supervisão</SectionSub>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {dadosPosto.map(({ posto, total, concluidos, porStatus }) => {
              const cfg = POSTO_COLORS[posto] || POSTO_COLORS['Não mapeado'];
              const supervisor = posto.includes('—') ? posto.split('—')[1].trim() : '';
              const postoNome  = posto.includes('—') ? posto.split('—')[0].trim() : posto;
              return (
                <div key={posto}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px',
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                        whiteSpace: 'nowrap',
                      }}>{postoNome}</div>
                      {supervisor && <span style={{ fontSize: '11px', color: '#94a3b8' }}>{supervisor}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f2544' }}>{total}</span>
                      <span style={{ fontSize: '10px', color: '#15803d', fontWeight: '600' }}>✓ {concluidos}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bar value={total} max={maxTotal} color={cfg.color} />
                    <span style={{ fontSize: '10px', color: '#94a3b8', minWidth: '32px', textAlign: 'right' }}>
                      {maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0}%
                    </span>
                  </div>
                  {/* Mini breakdown de status */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {STATUS_ORDER.filter(st => (porStatus[st] || 0) > 0).map(st => {
                      const scfg = STATUS_CONFIG[st];
                      return (
                        <span key={st} style={{
                          fontSize: '10px', padding: '1px 7px', borderRadius: '20px',
                          background: scfg.bg, color: scfg.color, fontWeight: '600',
                        }}>
                          {scfg.label} {porStatus[st]}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna direita: placas por posto */}
        <div style={{ ...card, padding: '20px' }}>
          <SectionTitle>Placas por posto</SectionTitle>
          <SectionSub>Montadas vs total de serviços com placa</SectionSub>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {dadosPosto.filter(d => d.placasTotal > 0).length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '13px' }}>
                Nenhum serviço de placa registrado ainda.
              </div>
            )}
            {dadosPosto.filter(d => d.placasTotal > 0).map(({ posto, placasTotal, placasMontadas: montadas }) => {
              const cfg = POSTO_COLORS[posto] || POSTO_COLORS['Não mapeado'];
              const pct = placasTotal > 0 ? Math.round((montadas / placasTotal) * 100) : 0;
              const postoNome  = posto.includes('—') ? posto.split('—')[0].trim() : posto;
              const supervisor = posto.includes('—') ? posto.split('—')[1].trim() : '';
              return (
                <div key={posto}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px',
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                      }}>{postoNome}</div>
                      {supervisor && <span style={{ fontSize: '11px', color: '#94a3b8' }}>{supervisor}</span>}
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                      {montadas} / {placasTotal} — {pct}%
                    </span>
                  </div>
                  {/* Barra de progresso dupla: montadas em verde, pendentes em laranja */}
                  <div style={{ height: '10px', borderRadius: '5px', background: '#f1f5f9', overflow: 'hidden', display: 'flex' }}>
                    <div style={{
                      height: '100%', background: '#15803d',
                      width: `${pct}%`, transition: 'width 0.4s ease',
                    }} />
                    <div style={{
                      height: '100%', background: '#fed7aa',
                      width: `${100 - pct}%`, transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px' }}>
                    <span style={{ color: '#15803d', fontWeight: '600' }}>✓ {montadas} montadas</span>
                    <span style={{ color: '#c2410c', fontWeight: '600' }}>{placasTotal - montadas} pendentes</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Serviços por tipo ── */}
      <div style={{ ...card, padding: '20px' }}>
        <SectionTitle>Serviços por tipo</SectionTitle>
        <SectionSub>Distribuição dos tipos de serviço ativos</SectionSub>
        {dadosTipo.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>Nenhum serviço ativo.</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {dadosTipo.map(({ tipo, total, concluido }) => {
            const pct = total > 0 ? Math.round((concluido / total) * 100) : 0;
            return (
              <div key={tipo} style={{
                padding: '14px 16px', borderRadius: '10px',
                border: '1px solid #e2e8f0', background: '#f8fafc',
                display: 'flex', flexDirection: 'column', gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: '800', padding: '2px 8px',
                    borderRadius: '4px', background: '#0f2544', color: '#fff', letterSpacing: '0.06em',
                  }}>{tipo}</span>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f2544', fontVariantNumeric: 'tabular-nums' }}>{total}</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#1d4ed8', width: `${pct}%`, borderRadius: '3px', transition: 'width 0.4s' }} />
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#15803d', fontWeight: '600' }}>✓ {concluido}</span>
                  <span>{pct}% concluído</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Detalhe por localidade ── */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <SectionTitle>Detalhe por localidade</SectionTitle>
          <SectionSub>Clique em um posto para expandir as localidades</SectionSub>
        </div>
        {dadosPosto.map(({ posto, total, concluidos, placasTotal, placasMontadas: montadas, porLocalidade }) => {
          const cfg = POSTO_COLORS[posto] || POSTO_COLORS['Não mapeado'];
          const exp = expandido[posto];
          const postoNome  = posto.includes('—') ? posto.split('—')[0].trim() : posto;
          const supervisor = posto.includes('—') ? posto.split('—')[1].trim() : '';
          return (
            <div key={posto} style={{ borderBottom: '1px solid #f1f5f9' }}>
              {/* Linha do posto — clicável */}
              <button onClick={() => toggleExpand(posto)} style={{
                width: '100%', padding: '12px 20px', background: exp ? '#f8fafc' : '#fff',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', fontFamily: 'inherit', transition: 'background 0.1s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
                onMouseLeave={e => e.currentTarget.style.background = exp ? '#f8fafc' : '#fff'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"
                    style={{ transform: exp ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  <div style={{
                    fontSize: '10px', fontWeight: '700', padding: '2px 10px', borderRadius: '20px',
                    background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                  }}>{postoNome}</div>
                  {supervisor && <span style={{ fontSize: '12px', color: '#64748b' }}>{supervisor}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '12px', color: '#64748b' }}>
                  <span><strong style={{ color: '#0f2544' }}>{total}</strong> serviços</span>
                  <span style={{ color: '#15803d' }}><strong>✓ {concluidos}</strong> concluídos</span>
                  {placasTotal > 0 && (
                    <span style={{ color: '#7c3aed' }}><strong>{montadas}/{placasTotal}</strong> placas</span>
                  )}
                </div>
              </button>

              {/* Localidades expandidas */}
              {exp && (
                <div style={{ borderTop: '1px solid #f1f5f9' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Localidade','Serviços','Concluídos','Placas','Montadas','% Concluído'].map(h => (
                          <th key={h} style={{
                            textAlign: h === 'Localidade' ? 'left' : 'center',
                            padding: '8px 16px', fontSize: '10px', color: '#94a3b8',
                            fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase',
                            borderBottom: '1px solid #f1f5f9',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {porLocalidade.map(([loc, d], i) => {
                        const pctLoc = d.total > 0 ? Math.round((d.concluido / d.total) * 100) : 0;
                        return (
                          <tr key={loc} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                            <td style={{ padding: '9px 16px', fontWeight: '500', color: '#334155' }}>{loc}</td>
                            <td style={{ padding: '9px 16px', textAlign: 'center', fontWeight: '700', color: '#0f2544' }}>{d.total}</td>
                            <td style={{ padding: '9px 16px', textAlign: 'center', color: '#15803d', fontWeight: '600' }}>{d.concluido}</td>
                            <td style={{ padding: '9px 16px', textAlign: 'center', color: '#7c3aed', fontWeight: '600' }}>{d.placas || '—'}</td>
                            <td style={{ padding: '9px 16px', textAlign: 'center', color: '#0369a1', fontWeight: '600' }}>{d.montadas || '—'}</td>
                            <td style={{ padding: '9px 16px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                <div style={{ width: '48px', height: '5px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', background: pctLoc === 100 ? '#15803d' : '#1d4ed8', width: `${pctLoc}%` }} />
                                </div>
                                <span style={{ fontSize: '11px', color: pctLoc === 100 ? '#15803d' : '#64748b', fontWeight: '600' }}>{pctLoc}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default PainelTab;