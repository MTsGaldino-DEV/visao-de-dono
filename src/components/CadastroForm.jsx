import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/firebase';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';

// ── Localidades por posto ────────────────────────────────────────────────────
const POSTOS = {
  'Posto 1 — Pedro': [
    'Frei Inocêncio','Alpercata','Alvarenga','Capitão Andrade','Engenheiro Caldas',
    'Fernandes Tourinho','Governador Valadares','Itanhomi','Jampruca','Jataí',
    'Mathias Lobato','São Geraldo do Tumiritinga','Sobrália','Tarumirim','Tumiritinga',
  ],
  'Posto 2 — Elton': [
    'Coluna','São Geraldo da Piedade','Água Boa','José Raydan','Paulistas',
    'Cantagalo','Peçanha','São João Evangelista','São José do Jacuri',
    'Santa Efigênia de Minas','Gonzaga','Santa Maria do Suaçuí','Frei Lago Negro',
    'São Pedro do Suaçuí','São Sebastião do Maranhão','Sardoá',
  ],
  'Posto 3 — Vinicius': [
    'Cuparaque','Conselheiro Pena','Resplendor','Aimorés','Goiabeira',
    'Itueta','Santa Rita do Itueto','São Geraldo do Baixio','Galileia',
  ],
  'Posto 4 — Victor': [
    'Itabirinha de Mantena','Divino das Laranjeiras','Central de Minas','Mendes Pimentel',
    'Nova Belém','São Félix de Minas','Tipiti','Mantena','São João do Manteninha',
    'Marilac','Coroaci','Virgolândia','Nacip Raydan','São José da Safira',
  ],
};

// Lista plana com referência ao posto
const TODAS_LOCALIDADES = Object.entries(POSTOS).flatMap(([posto, locs]) =>
  locs.map(loc => ({ loc, posto }))
).sort((a, b) => a.loc.localeCompare(b.loc, 'pt-BR'));

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const POSTO_COLORS = {
  'Posto 1 — Pedro':    '#1d4ed8',
  'Posto 2 — Elton':    '#7c3aed',
  'Posto 3 — Vinicius': '#0369a1',
  'Posto 4 — Victor':   '#15803d',
};

// ── Select pesquisável com agrupamento por posto ──────────────────────────────
const LocalidadeSelect = ({ value, onChange, focused, hasError, onFocus, onBlur }) => {
  const [query, setQuery]       = useState('');
  const [open, setOpen]         = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const inputRef     = useRef(null);
  const listRef      = useRef(null);

  // Filtra por query
  const resultados = query.trim()
    ? TODAS_LOCALIDADES.filter(({ loc }) => norm(loc).includes(norm(query)))
    : TODAS_LOCALIDADES;

  // Agrupa por posto mantendo ordem
  const grupos = Object.keys(POSTOS).reduce((acc, posto) => {
    const itens = resultados.filter(r => r.posto === posto);
    if (itens.length) acc.push({ posto, itens });
    return acc;
  }, []);

  // Lista plana para navegação por teclado
  const flat = resultados;

  const selecionar = (loc) => {
    onChange(loc);
    setQuery('');
    setOpen(false);
    setHighlighted(0);
  };

  const limpar = () => { onChange(''); setQuery(''); inputRef.current?.focus(); };

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll do item destacado
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('[data-highlighted="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { setHighlighted(h => Math.min(h + 1, flat.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setHighlighted(h => Math.max(h - 1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter' && flat[highlighted]) { selecionar(flat[highlighted].loc); e.preventDefault(); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  const borderColor = hasError  ? '#ef4444'
                    : focused   ? '#3b82f6'
                    : value     ? '#a5b4fc'
                    : '#e2e8f0';
  const boxShadow   = hasError  ? '0 0 0 3px rgba(239,68,68,0.1)'
                    : focused   ? '0 0 0 3px rgba(59,130,246,0.1)'
                    : 'none';

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Campo de exibição/pesquisa */}
      <div style={{
        display: 'flex', alignItems: 'center',
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        background: focused ? '#fff' : '#f8fafc',
        boxShadow,
        transition: 'all 0.15s',
        cursor: 'text',
        overflow: 'hidden',
      }} onClick={() => { setOpen(true); inputRef.current?.focus(); }}>

        {/* Ícone busca */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
          style={{ flexShrink: 0, marginLeft: '11px' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>

        <input
          ref={inputRef}
          type="text"
          placeholder={value ? '' : 'Digite para pesquisar localidade...'}
          value={open ? query : ''}
          onChange={e => { setQuery(e.target.value); setHighlighted(0); setOpen(true); }}
          onFocus={() => { setOpen(true); onFocus(); }}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1, padding: '9px 8px', border: 'none', outline: 'none',
            fontSize: '13px', background: 'transparent', color: '#1e293b',
            fontFamily: "'Segoe UI', system-ui, sans-serif",
          }}
        />

        {/* Valor selecionado (quando dropdown fechado) */}
        {value && !open && (
          <div style={{
            position: 'absolute', left: '34px', right: '60px',
            fontSize: '13px', color: '#1e293b', pointerEvents: 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {value}
          </div>
        )}

        {/* Badge do posto */}
        {value && !open && (() => {
          const entry = TODAS_LOCALIDADES.find(l => l.loc === value);
          const color = entry ? POSTO_COLORS[entry.posto] : '#64748b';
          const postoNome = entry ? entry.posto.split('—')[0].trim() : '';
          return (
            <span style={{
              fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
              background: `${color}15`, color, border: `1px solid ${color}30`,
              flexShrink: 0, marginRight: '6px', whiteSpace: 'nowrap',
            }}>{postoNome}</span>
          );
        })()}

        {/* Botão limpar / chevron */}
        {value ? (
          <button onClick={e => { e.stopPropagation(); limpar(); }} style={{
            padding: '0 10px', background: 'none', border: 'none', cursor: 'pointer',
            color: '#94a3b8', fontSize: '16px', lineHeight: 1, flexShrink: 0,
          }}>×</button>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"
            style={{ marginRight: '10px', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div ref={listRef} style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', maxHeight: '280px', overflowY: 'auto',
        }}>
          {grupos.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
              Nenhuma localidade encontrada para "{query}"
            </div>
          )}
          {grupos.map(({ posto, itens }) => {
            const color = POSTO_COLORS[posto];
            const postoNome  = posto.split('—')[0].trim();
            const supervisor = posto.split('—')[1]?.trim() || '';
            return (
              <div key={posto}>
                {/* Cabeçalho do grupo */}
                <div style={{
                  padding: '7px 12px 5px',
                  fontSize: '10px', fontWeight: '700',
                  color, letterSpacing: '0.06em', textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  borderTop: '1px solid #f1f5f9', background: `${color}08`,
                  position: 'sticky', top: 0,
                }}>
                  <span>{postoNome}</span>
                  <span style={{ fontWeight: '400', color: '#94a3b8', textTransform: 'none', letterSpacing: 0 }}>— {supervisor}</span>
                </div>
                {/* Itens */}
                {itens.map(({ loc }) => {
                  const flatIdx = flat.findIndex(f => f.loc === loc);
                  const isHigh  = flatIdx === highlighted;
                  const isSel   = loc === value;
                  return (
                    <button
                      key={loc}
                      data-highlighted={isHigh}
                      onMouseDown={e => { e.preventDefault(); selecionar(loc); }}
                      onMouseEnter={() => setHighlighted(flatIdx)}
                      style={{
                        width: '100%', padding: '8px 14px 8px 20px',
                        border: 'none', textAlign: 'left', cursor: 'pointer',
                        fontSize: '13px', fontFamily: 'inherit',
                        background: isSel ? `${color}10` : isHigh ? '#f0f7ff' : '#fff',
                        color: isSel ? color : '#334155',
                        fontWeight: isSel ? '600' : '400',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      {loc}
                      {isSel && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Estilos base ─────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
  fontSize: '13px', background: '#f8fafc', color: '#1e293b', boxSizing: 'border-box',
  outline: 'none', transition: 'border-color 0.15s, background 0.15s',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
};
const labelStyle = { fontSize: '11px', fontWeight: '600', color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px', display: 'block' };
const fieldStyle = { display: 'flex', flexDirection: 'column' };
const SectionLabel = ({ children }) => (
  <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
    {children}
    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
  </div>
);

const SuccessPopup = ({ onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.45)', backdropFilter: 'blur(3px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '36px 40px', textAlign: 'center', maxWidth: '340px', width: '100%', boxShadow: '0 20px 60px rgba(15,37,68,0.18)', animation: 'popIn 0.2s ease' }}>
      <style>{`@keyframes popIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
      <div style={{ width: '56px', height: '56px', background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f2544', marginBottom: '6px' }}>Serviço cadastrado!</div>
      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>O serviço foi registrado com sucesso e já aparece na lista.</div>
      <button onClick={onClose} style={{ padding: '9px 28px', border: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, #0f2544, #1d4ed8)', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>OK</button>
    </div>
  </div>
);

// ── Componente principal ─────────────────────────────────────────────────────
const CadastroForm = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    data: '', local: '', desc: '', tipo: '', equip: '', coord: '', foto: '', orig: '', obs: ''
  });
  const [loading, setLoading]       = useState(false);
  const [focused, setFocused]       = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors]         = useState({});

  const hoje = new Date();
  const maxDate = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}T23:59:59`;
  const minDate = '2025-01-01T00:00:00';

  const handleChange = (e) => {
    const { id, value } = e.target;
    const field = id.replace('f-', '');
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const inp = (id) => ({
    ...inputStyle,
    borderColor: errors[id]  ? '#ef4444'
                : focused === id ? '#3b82f6'
                : '#e2e8f0',
    background:  errors[id]  ? '#fff5f5'
                : focused === id ? '#fff'
                : '#f8fafc',
    boxShadow:   errors[id]  ? '0 0 0 3px rgba(239,68,68,0.1)'
                : focused === id ? '0 0 0 3px rgba(59,130,246,0.1)'
                : 'none',
  });

  const cadastrar = async () => {
    const campos = { data: formData.data, local: formData.local, desc: formData.desc, tipo: formData.tipo, equip: formData.equip, coord: formData.coord, foto: formData.foto, orig: formData.orig };
    const novosErros = Object.fromEntries(Object.entries(campos).filter(([, v]) => !v?.trim()));
    setErrors(novosErros);
    if (Object.keys(novosErros).length > 0) {
      alert('Preencha todos os campos obrigatórios antes de cadastrar.');
      return;
    }
    if (formData.data) {
      const dt = new Date(formData.data);
      if (dt > new Date()) { alert('A data não pode ser no futuro.'); return; }
      if (dt < new Date('2025-01-01')) { alert('A data não pode ser anterior a 01/01/2025.'); return; }
    }
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'servicos'));
      const novoId = `VD${String(snapshot.size + 1).padStart(4, '0')}`;
      await addDoc(collection(db, 'servicos'), {
        ...formData,
        id: novoId,
        status: 'cadastrado',
        numServ: '',
        autor: user.label,
        matriculaAutor: user.matricula,
        dtCadastro: serverTimestamp(),
        hist: [{ who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: 'Serviço cadastrado.' }]
      });
      setFormData({ data: '', local: '', desc: '', tipo: '', equip: '', coord: '', foto: '', orig: '', obs: '' });
      setShowSuccess(true);
    } catch { alert('Erro ao cadastrar o serviço.'); }
    finally { setLoading(false); }
  };

  // Posto da localidade selecionada
  const postoSelecionado = formData.local
    ? TODAS_LOCALIDADES.find(l => l.loc === formData.local)?.posto
    : null;

  return (
    <>
      {showSuccess && <SuccessPopup onClose={() => setShowSuccess(false)} />}

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px', background: 'linear-gradient(to right, #f8fafc, #fff)' }}>
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #0f2544, #1d4ed8)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f2544' }}>Novo Serviço Levantado</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>Preencha os campos para registrar o levantamento</div>
          </div>
        </div>

        <div style={{ padding: '20px' }}>
          <SectionLabel>Identificação</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Data do levantamento <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="datetime-local" step="1" id="f-data"
                min={minDate} max={maxDate}
                value={formData.data} onChange={handleChange}
                style={inp('data')} onFocus={() => setFocused('data')} onBlur={() => setFocused('')}
              />
            </div>

            {/* Localidade — select pesquisável */}
            <div style={fieldStyle}>
              <label style={labelStyle}>
                Localidade <span style={{ color: '#ef4444' }}>*</span>
                {postoSelecionado && (
                  <span style={{
                    marginLeft: '8px', fontSize: '10px', fontWeight: '700',
                    color: POSTO_COLORS[postoSelecionado],
                    background: `${POSTO_COLORS[postoSelecionado]}15`,
                    border: `1px solid ${POSTO_COLORS[postoSelecionado]}30`,
                    padding: '1px 6px', borderRadius: '4px',
                    textTransform: 'none', letterSpacing: 0,
                  }}>
                    {postoSelecionado.split('—')[0].trim()} · {postoSelecionado.split('—')[1]?.trim()}
                  </span>
                )}
              </label>
              <LocalidadeSelect
                value={formData.local}
                onChange={val => { setFormData(prev => ({ ...prev, local: val })); setErrors(prev => ({ ...prev, local: undefined })); }}
                focused={focused === 'local'}
                hasError={!!errors.local}
                onFocus={() => setFocused('local')}
                onBlur={() => setFocused('')}
              />
            </div>

            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Descrição da solicitação <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea id="f-desc" rows={3} placeholder="Descreva detalhadamente o serviço..."
                value={formData.desc} onChange={handleChange}
                style={{ ...inp('desc'), resize: 'vertical' }}
                onFocus={() => setFocused('desc')} onBlur={() => setFocused('')}
              />
            </div>
          </div>

          <SectionLabel>Técnico</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Tipo de serviço <span style={{ color: '#ef4444' }}>*</span></label>
              <select id="f-tipo" value={formData.tipo} onChange={handleChange}
                style={inp('tipo')} onFocus={() => setFocused('tipo')} onBlur={() => setFocused('')}>
                <option value="">Selecione...</option>
                <option value="NSIS">NSIS</option>
                <option value="NSMP">NSMP</option>
                <option value="RC02">RC02</option>
                <option value="INBE">INBE</option>
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Equipamento (nº da placa) <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" id="f-equip" placeholder="Ex: 13867"
                value={formData.equip} onChange={handleChange}
                style={inp('equip')} onFocus={() => setFocused('equip')} onBlur={() => setFocused('')}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Coordenada <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" id="f-coord" placeholder="-18.517, -41.936"
                value={formData.coord} onChange={handleChange}
                style={inp('coord')} onFocus={() => setFocused('coord')} onBlur={() => setFocused('')}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Técnico de origem <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" id="f-orig" placeholder="Nome do técnico"
                value={formData.orig} onChange={handleChange}
                style={inp('orig')} onFocus={() => setFocused('orig')} onBlur={() => setFocused('')}
              />
            </div>
          </div>

          <SectionLabel>Complemento</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Link da foto <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" id="f-foto" placeholder="https://..."
                value={formData.foto} onChange={handleChange}
                style={inp('foto')} onFocus={() => setFocused('foto')} onBlur={() => setFocused('')}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Observações</label>
              <input type="text" id="f-obs" placeholder="Observações adicionais"
                value={formData.obs} onChange={handleChange}
                style={inp('obs')} onFocus={() => setFocused('obs')} onBlur={() => setFocused('')}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              <span style={{ color: '#ef4444' }}>*</span> Campos obrigatórios
            </div>
            <button onClick={cadastrar} disabled={loading} style={{
              padding: '9px 22px', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '13px', border: 'none',
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0f2544, #1d4ed8)',
              color: '#fff', fontWeight: '600', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: '6px', opacity: loading ? 0.7 : 1,
            }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              {loading ? 'Cadastrando...' : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Cadastrar serviço
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CadastroForm;