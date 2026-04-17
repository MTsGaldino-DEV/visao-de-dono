import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/firebase';
import { collection, onSnapshot, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

// ── Mapeamento posto → localidades ──────────────────────────────────────────
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

// Normaliza string para comparação (ignora acentos/case)
const norm = (s) => (s || '').toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const postoDeLocalidade = (local) => {
  const localNorm = norm(local);
  for (const [posto, locs] of Object.entries(POSTOS)) {
    if (locs.some(l => norm(l) === localNorm || localNorm.includes(norm(l)) || norm(l).includes(localNorm))) {
      return posto;
    }
  }
  return null;
};

// ── Dígitos do nº de equipamento ────────────────────────────────────────────
// Ex: "13867" → [1,3,8,6,7] → conta quantos de cada dígito 0-9 são usados
const digitosDeEquip = (equip) => {
  const digits = (equip || '').replace(/\D/g, '').split('').map(Number);
  const count = Array(10).fill(0);
  digits.forEach(d => count[d]++);
  return count; // count[d] = quantas vezes o dígito d aparece nesse equipamento
};

// ── Estilos base ─────────────────────────────────────────────────────────────
const card = {
  background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const inputStyle = {
  width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px',
  fontSize: '12px', background: '#fff', color: '#1e293b', outline: 'none',
  fontFamily: "'Segoe UI', system-ui, sans-serif", boxSizing: 'border-box',
};

const labelUp = {
  fontSize: '10px', fontWeight: '700', color: '#94a3b8',
  letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '5px', display: 'block',
};

const th = {
  textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: '700',
  padding: '9px 12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc',
  whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase',
};

const td = {
  padding: '10px 12px', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle',
  fontSize: '12px', color: '#334155', whiteSpace: 'nowrap',
};

// ── Componente principal ─────────────────────────────────────────────────────
const PlacasTab = () => {
  const { user } = useAuth();

  const [servicos, setServicos]       = useState([]);
  const [estoque, setEstoque]         = useState(Array(10).fill(0)); // qtd em estoque por dígito
  const [postoFilter, setPostoFilter] = useState('');
  const [editandoEstoque, setEditandoEstoque] = useState(false);
  const [estoqueTemp, setEstoqueTemp] = useState(Array(10).fill(0));
  const [savingEstoque, setSavingEstoque] = useState(false);

  // Carrega serviços
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'servicos'), (snap) => {
      setServicos(snap.docs.map(d => ({ ...d.data(), _docId: d.id })));
    });
    return () => unsub();
  }, []);

  // Carrega estoque do Firestore (documento único: estoque/digitos)
  useEffect(() => {
    const carregarEstoque = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'estoque'));
        if (snap.exists()) {
          setEstoque(snap.data().digitos || Array(10).fill(0));
        }
      } catch (e) { /* ignora se ainda não existe */ }
    };
    carregarEstoque();
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

  // Serviços pendentes de montagem: status !== cancelado && !== concluido && placaMontada !== true
  const pendentesMontagem = servicos.filter(s =>
    s.status !== 'cancelado' &&
    !s.placaMontada
  );

  // Aplicar filtro de posto
  const filtrados = postoFilter
    ? pendentesMontagem.filter(s => postoDeLocalidade(s.local) === postoFilter)
    : pendentesMontagem;

  // Marcar como montada
  const marcarMontada = async (s) => {
    try {
      // Subtrai dígitos do equipamento do estoque
      const digitosUsados = digitosDeEquip(s.equip);
      const novoEstoque = [...estoque];
      let ok = true;
      for (let d = 0; d <= 9; d++) {
        novoEstoque[d] = Math.max(0, novoEstoque[d] - digitosUsados[d]);
      }

      await updateDoc(doc(db, 'servicos', s._docId), {
        placaMontada: true,
        hist: [...(s.hist || []), {
          who: user.label, matricula: user.matricula,
          when: new Date().toISOString(), msg: 'Placa montada.',
        }],
      });
      // Atualiza estoque
      await setDoc(doc(db, 'config', 'estoque'), { digitos: novoEstoque });
      setEstoque(novoEstoque);
    } catch { alert('Erro ao marcar placa como montada.'); }
  };

  // Desmarcar montada (reversão)
  const desmarcarMontada = async (s) => {
    if (!window.confirm(`Reverter a montagem da placa do serviço ${s.id}?`)) return;
    try {
      const digitosUsados = digitosDeEquip(s.equip);
      const novoEstoque = [...estoque];
      for (let d = 0; d <= 9; d++) {
        novoEstoque[d] = novoEstoque[d] + digitosUsados[d];
      }
      await updateDoc(doc(db, 'servicos', s._docId), {
        placaMontada: false,
        hist: [...(s.hist || []), {
          who: user.label, matricula: user.matricula,
          when: new Date().toISOString(), msg: 'Montagem da placa revertida.',
        }],
      });
      await setDoc(doc(db, 'config', 'estoque'), { digitos: novoEstoque });
      setEstoque(novoEstoque);
    } catch { alert('Erro ao reverter montagem.'); }
  };

  // Calcula quantos dígitos serão necessários para montar todas as placas pendentes filtradas
  const digitosNecessarios = Array(10).fill(0);
  filtrados.forEach(s => {
    const d = digitosDeEquip(s.equip);
    for (let i = 0; i <= 9; i++) digitosNecessarios[i] += d[i];
  });

  // Verifica se tem estoque suficiente para montar um serviço
  const temEstoque = (s) => {
    const d = digitosDeEquip(s.equip);
    for (let i = 0; i <= 9; i++) {
      if (d[i] > estoque[i]) return false;
    }
    return true;
  };

  const totalPendentes = pendentesMontagem.length;
  const totalMontadas  = servicos.filter(s => s.placaMontada).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Cards de resumo ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { label: 'Pendentes de montagem', value: totalPendentes, color: '#c2410c', bg: '#fff7ed' },
          { label: 'Placas montadas',       value: totalMontadas,  color: '#15803d', bg: '#f0fdf4' },
          { label: 'Total de serviços',     value: servicos.filter(s => s.status !== 'cancelado').length, color: '#0f2544', bg: '#f0f4ff' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ ...card, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color, lineHeight: 1.2 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Estoque de dígitos ── */}
      <div style={{ ...card, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544' }}>Estoque de dígitos</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Quantidade de cada dígito disponível para montagem das placas
            </div>
          </div>
          {!editandoEstoque ? (
            <button onClick={() => { setEstoqueTemp([...estoque]); setEditandoEstoque(true); }} style={{
              fontSize: '12px', padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: '7px',
              background: '#f8fafc', color: '#475569', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '500',
            }}>
              Editar estoque
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditandoEstoque(false)} style={{
                fontSize: '12px', padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: '7px',
                background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancelar</button>
              <button onClick={salvarEstoque} disabled={savingEstoque} style={{
                fontSize: '12px', padding: '6px 14px', border: 'none', borderRadius: '7px',
                background: 'linear-gradient(135deg, #0f2544, #1d4ed8)', color: '#fff',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600',
              }}>{savingEstoque ? 'Salvando...' : 'Salvar'}</button>
            </div>
          )}
        </div>

        {/* Grid de dígitos 0-9 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '8px' }}>
          {Array.from({ length: 10 }, (_, d) => {
            const qtd = editandoEstoque ? estoqueTemp[d] : estoque[d];
            const necessario = digitosNecessarios[d];
            const falta = Math.max(0, necessario - estoque[d]);
            const semEstoque = !editandoEstoque && estoque[d] === 0;
            const baixoEstoque = !editandoEstoque && estoque[d] > 0 && estoque[d] < necessario;

            return (
              <div key={d} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                padding: '10px 6px', borderRadius: '10px',
                border: semEstoque ? '1px solid #fecaca' : baixoEstoque ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                background: semEstoque ? '#fef2f2' : baixoEstoque ? '#fff7ed' : '#f8fafc',
              }}>
                {/* Dígito */}
                <div style={{
                  fontSize: '20px', fontWeight: '800', lineHeight: 1,
                  color: semEstoque ? '#b91c1c' : baixoEstoque ? '#c2410c' : '#0f2544',
                  fontVariantNumeric: 'tabular-nums',
                }}>{d}</div>

                {/* Quantidade */}
                {editandoEstoque ? (
                  <input
                    type="number" min="0" max="9999"
                    value={estoqueTemp[d]}
                    onChange={e => {
                      const v = parseInt(e.target.value) || 0;
                      setEstoqueTemp(prev => { const n = [...prev]; n[d] = v; return n; });
                    }}
                    style={{
                      width: '100%', padding: '4px 6px', border: '1px solid #3b82f6',
                      borderRadius: '6px', fontSize: '13px', fontWeight: '700', textAlign: 'center',
                      color: '#0f2544', outline: 'none', background: '#fff',
                      boxShadow: '0 0 0 2px rgba(59,130,246,0.15)', fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <div style={{
                    fontSize: '15px', fontWeight: '700',
                    color: semEstoque ? '#b91c1c' : baixoEstoque ? '#c2410c' : '#1d4ed8',
                  }}>{qtd}</div>
                )}

                {/* Necessário nas pendentes */}
                {!editandoEstoque && necessario > 0 && (
                  <div style={{ fontSize: '9px', color: falta > 0 ? '#b91c1c' : '#15803d', fontWeight: '600', textAlign: 'center', lineHeight: 1.3 }}>
                    {falta > 0 ? `faltam ${falta}` : `ok (${necessario})`}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legenda */}
        {!editandoEstoque && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '10px', color: '#94a3b8' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#fef2f2', border: '1px solid #fecaca', display: 'inline-block' }} />
              Sem estoque
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#fff7ed', border: '1px solid #fed7aa', display: 'inline-block' }} />
              Estoque insuficiente para pendentes
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'inline-block' }} />
              Ok
            </span>
            <span style={{ color: '#64748b' }}>· Número abaixo = qtd necessária nas pendentes atuais</span>
          </div>
        )}
      </div>

      {/* ── Lista de pendentes ── */}
      <div style={card}>
        {/* Header com filtro */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544' }}>Pendentes de montagem</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Clique em "Montar" para registrar a montagem e atualizar o estoque
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Filtro de posto */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '220px' }}>
              <label style={labelUp}>Filtrar por posto/supervisor</label>
              <select value={postoFilter} onChange={e => setPostoFilter(e.target.value)} style={inputStyle}>
                <option value="">Todos os postos</option>
                {Object.keys(POSTOS).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', borderRadius: '20px', padding: '3px 10px', fontWeight: '500', whiteSpace: 'nowrap', marginTop: '14px' }}>
              {filtrados.length} {filtrados.length === 1 ? 'serviço' : 'serviços'}
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
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '13px' }}>
                    Nenhuma placa pendente de montagem.
                  </td>
                </tr>
              )}
              {filtrados.map((s, i) => {
                const posto = postoDeLocalidade(s.local);
                const digUsados = digitosDeEquip(s.equip);
                const haEstoque = temEstoque(s);
                const digStr = (s.equip || '').replace(/\D/g, '');

                const statusCfg = {
                  cadastrado: { label: 'Cadastrado', color: '#1d4ed8' },
                  enviado:    { label: 'Enviado',    color: '#7c3aed' },
                  pendente:   { label: 'Pendente',   color: '#c2410c' },
                  concluido:  { label: 'Concluído',  color: '#15803d' },
                }[s.status] || { label: s.status, color: '#475569' };

                return (
                  <tr key={s._docId} style={{
                    background: i % 2 === 0 ? '#fff' : '#fafbfc', transition: 'background 0.1s',
                  }}
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

                    {/* Dígitos do equipamento */}
                    <td style={td}>
                      {digStr ? (
                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                          {digStr.split('').map((d, idx) => {
                            const semEst = estoque[parseInt(d)] === 0;
                            return (
                              <span key={idx} style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '18px', height: '18px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                                background: semEst ? '#fef2f2' : '#eff6ff',
                                color: semEst ? '#b91c1c' : '#1d4ed8',
                                border: `1px solid ${semEst ? '#fecaca' : '#bfdbfe'}`,
                              }}>
                                {d}
                              </span>
                            );
                          })}
                        </div>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>

                    {/* Status */}
                    <td style={td}>
                      <span style={{
                        fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px',
                        background: `${statusCfg.color}12`, color: statusCfg.color,
                        border: `1px solid ${statusCfg.color}30`,
                      }}>
                        {statusCfg.label}
                      </span>
                    </td>

                    {/* Estoque suficiente? */}
                    <td style={td}>
                      {s.equip ? (
                        haEstoque ? (
                          <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Suficiente
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            Insuficiente
                          </span>
                        )
                      ) : <span style={{ color: '#94a3b8', fontSize: '11px' }}>Sem equip.</span>}
                    </td>

                    {/* Ação montar */}
                    <td style={td}>
                      <button
                        onClick={() => marcarMontada(s)}
                        style={{
                          fontSize: '11px', padding: '5px 12px',
                          border: '1px solid #bbf7d0', borderRadius: '6px',
                          background: '#f0fdf4', color: '#15803d',
                          cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.borderColor = '#86efac'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
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

      {/* ── Placas já montadas ── */}
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
                  <th style={{ ...th, width: '110px' }}>Equipamento</th>
                  <th style={th}>Descrição</th>
                  <th style={{ ...th, width: '90px' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {servicos.filter(s => s.placaMontada).map((s, i) => (
                  <tr key={s._docId} style={{
                    background: i % 2 === 0 ? '#fff' : '#fafbfc', opacity: 0.8,
                  }}>
                    <td style={td}><span style={{ fontWeight: '700', color: '#0f2544' }}>{s.id}</span></td>
                    <td style={td}>{s.local || '—'}</td>
                    <td style={{ ...td, fontWeight: '600' }}>{s.equip || '—'}</td>
                    <td style={{ ...td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.desc}</td>
                    <td style={td}>
                      <button onClick={() => desmarcarMontada(s)} style={{
                        fontSize: '11px', padding: '5px 12px',
                        border: '1px solid #fecaca', borderRadius: '6px',
                        background: '#fef2f2', color: '#b91c1c',
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: '500',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; }}
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