import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import DetalheModal from './DetalheModal';

// ============================================================
// CONFIGURAÇÃO DE STATUS
// ============================================================
const STATUS_CONFIG = {
  cadastrado: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Cadastrado' },
  enviado:    { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe', label: 'Enviado CEMIG' },
  pendente:   { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Pendente' },
  concluido:  { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Concluído' },
  cancelado:  { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Cancelado' },
};

const STATUS_ORDER = ['cadastrado', 'enviado', 'pendente', 'concluido', 'cancelado'];

const NEXT_STATUS = {
  cadastrado: { next: 'enviado',   msg: 'Enviado à CEMIG',      label: 'Enviar',   color: '#7c3aed' },
  enviado:    { next: 'pendente',  msg: 'Número CEMIG recebido', label: 'Nº CEMIG', color: '#c2410c' },
  pendente:   { next: 'concluido', msg: 'Serviço concluído',     label: 'Concluir', color: '#15803d' },
};

// ============================================================
// LOCALIDADES E POSTOS (mesmo do CadastroForm)
// ============================================================
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

const TODAS_LOCALIDADES = Object.entries(POSTOS).flatMap(([posto, locs]) =>
  locs.map(loc => ({ loc, posto }))
).sort((a, b) => a.loc.localeCompare(b.loc, 'pt-BR'));

const POSTO_COLORS = {
  'Posto 1 — Pedro':    '#1d4ed8',
  'Posto 2 — Elton':    '#7c3aed',
  'Posto 3 — Vinicius': '#0369a1',
  'Posto 4 — Victor':   '#15803d',
};

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const PER_PAGE = 100;

// ============================================================
// HELPERS
// ============================================================
const fmtDt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const idNum = (id) => parseInt((id || '').replace(/\D/g, '') || '0', 10);

// ============================================================
// ESTILOS BASE
// ============================================================
const inputStyle = {
  width: '100%', padding: '7px 10px',
  border: '1px solid #e2e8f0', borderRadius: '8px',
  fontSize: '12px', background: '#fff', color: '#1e293b',
  outline: 'none', fontFamily: "'Segoe UI', system-ui, sans-serif",
  boxSizing: 'border-box',
};

const POPUP_OVERLAY = {
  position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.45)',
  backdropFilter: 'blur(3px)', zIndex: 400,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
};
const POPUP_BOX = {
  background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0',
  padding: '28px 32px', maxWidth: '380px', width: '100%',
  boxShadow: '0 20px 60px rgba(15,37,68,0.18)', animation: 'popIn 0.18s ease',
};
const BTN_CANCEL = {
  padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '8px',
  background: '#fff', color: '#475569', cursor: 'pointer',
  fontSize: '13px', fontWeight: '500', fontFamily: 'inherit',
};
const BTN_PRIMARY = {
  padding: '8px 20px', border: 'none', borderRadius: '8px',
  background: 'linear-gradient(135deg, #0f2544, #1d4ed8)',
  color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit',
};

// ============================================================
// BADGE DE STATUS
// ============================================================
const Badge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', label: status };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: '10px', padding: '3px 9px',
      borderRadius: '20px', fontWeight: '600', letterSpacing: '0.03em',
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
};

// ============================================================
// DROPDOWN DE LOCALIDADE (mesmo estilo do CadastroForm)
// ============================================================
const LocalidadeSelect = ({ value, onChange }) => {
  const [query, setQuery]           = useState('');
  const [open, setOpen]             = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const inputRef     = useRef(null);
  const listRef      = useRef(null);

  const resultados = query.trim()
    ? TODAS_LOCALIDADES.filter(({ loc }) => norm(loc).includes(norm(query)))
    : TODAS_LOCALIDADES;

  const grupos = Object.keys(POSTOS).reduce((acc, posto) => {
    const itens = resultados.filter(r => r.posto === posto);
    if (itens.length) acc.push({ posto, itens });
    return acc;
  }, []);

  const flat = resultados;

  const selecionar = (loc) => { onChange(loc); setQuery(''); setOpen(false); setHighlighted(0); };
  const limpar = () => { onChange(''); setQuery(''); inputRef.current?.focus(); };

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        border: `1px solid ${open ? '#3b82f6' : '#e2e8f0'}`,
        borderRadius: '8px', background: open ? '#fff' : '#f8fafc',
        boxShadow: open ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
        transition: 'all 0.15s', cursor: 'text', overflow: 'hidden',
      }} onClick={() => { setOpen(true); inputRef.current?.focus(); }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
          style={{ flexShrink: 0, marginLeft: '11px' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input ref={inputRef} type="text" placeholder={value ? '' : 'Pesquisar localidade...'}
          value={open ? query : ''} onChange={e => { setQuery(e.target.value); setHighlighted(0); setOpen(true); }}
          onFocus={() => setOpen(true)} onKeyDown={handleKeyDown}
          style={{ flex: 1, padding: '8px 8px', border: 'none', outline: 'none', fontSize: '13px', background: 'transparent', color: '#1e293b', fontFamily: 'inherit' }}
        />
        {value && !open && (
          <div style={{ position: 'absolute', left: '34px', right: '60px', fontSize: '13px', color: '#1e293b', pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value}
          </div>
        )}
        {value && !open && (() => {
          const entry = TODAS_LOCALIDADES.find(l => l.loc === value);
          const color = entry ? POSTO_COLORS[entry.posto] : '#64748b';
          const postoNome = entry ? entry.posto.split('—')[0].trim() : '';
          return (
            <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: `${color}15`, color, border: `1px solid ${color}30`, flexShrink: 0, marginRight: '6px', whiteSpace: 'nowrap' }}>
              {postoNome}
            </span>
          );
        })()}
        {value ? (
          <button onClick={e => { e.stopPropagation(); limpar(); }} style={{ padding: '0 10px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>×</button>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"
            style={{ marginRight: '10px', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </div>
      {open && (
        <div ref={listRef} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', maxHeight: '260px', overflowY: 'auto' }}>
          {grupos.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>Nenhuma localidade encontrada.</div>}
          {grupos.map(({ posto, itens }) => {
            const color = POSTO_COLORS[posto];
            const [postoNome, supervisor] = posto.split('—').map(s => s.trim());
            return (
              <div key={posto}>
                <div style={{ padding: '7px 12px 5px', fontSize: '10px', fontWeight: '700', color, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', borderTop: '1px solid #f1f5f9', background: `${color}08`, position: 'sticky', top: 0 }}>
                  <span>{postoNome}</span>
                  <span style={{ fontWeight: '400', color: '#94a3b8', textTransform: 'none', letterSpacing: 0 }}>— {supervisor}</span>
                </div>
                {itens.map(({ loc }) => {
                  const flatIdx = flat.findIndex(f => f.loc === loc);
                  const isHigh = flatIdx === highlighted;
                  const isSel  = loc === value;
                  return (
                    <button key={loc} data-highlighted={isHigh}
                      onMouseDown={e => { e.preventDefault(); selecionar(loc); }}
                      onMouseEnter={() => setHighlighted(flatIdx)}
                      style={{ width: '100%', padding: '8px 14px 8px 20px', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', background: isSel ? `${color}10` : isHigh ? '#f0f7ff' : '#fff', color: isSel ? color : '#334155', fontWeight: isSel ? '600' : '400', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {loc}
                      {isSel && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
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

// ============================================================
// MULTI SELECT DROPDOWN (Status e Tipo)
// ============================================================
const MultiSelect = ({ options, selected, onChange, placeholder = 'Todos' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val) => onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);

  const displayLabel = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label || selected[0]
      : `${selected.length} selecionados`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', background: selected.length > 0 ? '#eff6ff' : '#fff',
        border: selected.length > 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
        color: selected.length > 0 ? '#1d4ed8' : '#1e293b', fontWeight: selected.length > 0 ? '600' : '400',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ flexShrink: 0, marginLeft: '6px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: '190px', overflow: 'hidden' }}>
          {selected.length > 0 && (
            <button onClick={() => onChange([])} style={{ width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit', textAlign: 'left', fontWeight: '600' }}>
              Limpar seleção
            </button>
          )}
          {options.map(({ value, label, badge }) => {
            const sel = selected.includes(value);
            return (
              <button key={value} onClick={() => toggle(value)} style={{ width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f8fafc', background: sel ? '#f0f7ff' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0, border: sel ? '4px solid #1d4ed8' : '1.5px solid #cbd5e1', background: sel ? '#1d4ed8' : '#fff', transition: 'all 0.1s' }} />
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

// ============================================================
// POPUP GENÉRICO DE CONFIRMAÇÃO DE STATUS
// ============================================================
const ConfirmPopup = ({ servico, novoStatus, onConfirm, onCancel }) => {
  const cfg = STATUS_CONFIG[novoStatus] || {};
  const precisaNum = novoStatus === 'pendente';
  const [num, setNum] = useState(servico.numServ || '');
  const handleConfirm = () => { if (precisaNum && !num.trim()) return; onConfirm(precisaNum ? num.trim() : null); };
  return (
    <div style={POPUP_OVERLAY}>
      <div style={POPUP_BOX}>
        <style>{`@keyframes popIn{from{transform:scale(0.93);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544', marginBottom: '6px' }}>
          {precisaNum ? 'Nº do serviço CEMIG' : 'Confirmar alteração'}
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px', lineHeight: '1.6' }}>
          {precisaNum
            ? <>Informe o número retornado pela CEMIG para <strong style={{ color: '#0f2544' }}>{servico.id}</strong>.</>
            : <>Alterar o status de <strong style={{ color: '#0f2544' }}>{servico.id}</strong> para:</>}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: '11px', padding: '4px 12px', borderRadius: '20px', fontWeight: '600', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, marginBottom: precisaNum ? '14px' : '22px' }}>{cfg.label}</div>
        {precisaNum && (
          <div style={{ marginBottom: '22px' }}>
            <input autoFocus type="text" value={num} onChange={e => setNum(e.target.value)} placeholder="Ex: 240850456"
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
              style={{ ...inputStyle, padding: '10px 13px', fontSize: '14px', border: num.trim() ? '1px solid #3b82f6' : '1px solid #fca5a5' }}
            />
            {!num.trim() && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>Campo obrigatório.</div>}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={BTN_CANCEL}>Cancelar</button>
          <button onClick={handleConfirm} disabled={precisaNum && !num.trim()} style={{ ...BTN_PRIMARY, opacity: precisaNum && !num.trim() ? 0.5 : 1 }}>
            {precisaNum ? 'Salvar e avançar' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// POPUP CANCELAMENTO COM MOTIVO OBRIGATÓRIO
// ============================================================
const CancelPopup = ({ servico, onConfirm, onCancel }) => {
  const [motivo, setMotivo] = useState('');
  return (
    <div style={POPUP_OVERLAY}>
      <div style={POPUP_BOX}>
        <style>{`@keyframes popIn{from{transform:scale(0.93);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544' }}>Cancelar serviço</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Serviço: <strong>{servico.id}</strong></div>
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
            Motivo do cancelamento <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            autoFocus rows={3} value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Descreva o motivo pelo qual este serviço está sendo cancelado..."
            style={{ ...inputStyle, padding: '10px 12px', fontSize: '13px', resize: 'vertical', minHeight: '80px', border: motivo.trim() ? '1px solid #e2e8f0' : '1px solid #fca5a5', background: motivo.trim() ? '#fff' : '#fff5f5' }}
          />
          {!motivo.trim() && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>Informe o motivo antes de confirmar.</div>}
        </div>
        <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '600' }}>⚠️ Esta ação não pode ser desfeita facilmente. O serviço será ocultado da lista principal.</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={BTN_CANCEL}>Voltar</button>
          <button onClick={() => motivo.trim() && onConfirm(motivo.trim())} disabled={!motivo.trim()}
            style={{ ...BTN_PRIMARY, background: motivo.trim() ? 'linear-gradient(135deg, #991b1b, #b91c1c)' : '#94a3b8', opacity: motivo.trim() ? 1 : 0.6, cursor: motivo.trim() ? 'pointer' : 'not-allowed' }}>
            Confirmar cancelamento
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// POPUP EDIÇÃO DE Nº CEMIG
// ============================================================
const NumServPopup = ({ servico, onConfirm, onCancel }) => {
  const [num, setNum] = useState(servico.numServ || '');
  return (
    <div style={POPUP_OVERLAY}>
      <div style={POPUP_BOX}>
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544', marginBottom: '6px' }}>Nº do serviço CEMIG</div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
          Editar número para <strong style={{ color: '#0f2544' }}>{servico.id}</strong>.
        </div>
        <input autoFocus type="text" value={num} onChange={e => setNum(e.target.value)} placeholder="Ex: 240850456"
          onKeyDown={e => { if (e.key === 'Enter' && num.trim()) onConfirm(num.trim()); }}
          style={{ ...inputStyle, padding: '10px 13px', fontSize: '14px', border: '1px solid #3b82f6', boxShadow: '0 0 0 3px rgba(59,130,246,0.1)', marginBottom: '22px' }}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={BTN_CANCEL}>Cancelar</button>
          <button onClick={() => num.trim() && onConfirm(num.trim())} style={BTN_PRIMARY}>Salvar</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// POPUP MENSAGEM CEMIG
// ============================================================
const gerarMensagemNSIS = (s) => {
  const equip = s.equip || '—';
  const local = s.local || '—';
  const coordFormatado = (s.coord || '').trim() || '—';
  const campoBairro = s.bairro || (equip !== '—' ? `VD-Placa ${equip}` : '—');
  const descBase = (s.desc || `Substituir placa ilegível do equipamento ${equip}`).trimEnd();
  const servicoExec = coordFormatado !== '—' ? `${descBase} nas coordenadas ${coordFormatado}` : descBase;
  return `Gentileza, gerar NSIS:\n\nCampo Bairro: ${campoBairro}\nEquipamento: ${equip}\nReferências: chave ${equip}\nCoordenadas: ${coordFormatado}\nLocalidade: ${local}\n\nServiço a ser executado:\n${servicoExec}\n\nObservação:\ndúvidas ligar para Matheus ENGELMIG 31 99914-8716`;
};

const MensagemCemigPopup = ({ servico, onClose }) => {
  const [texto, setTexto] = useState(() => gerarMensagemNSIS(servico));
  const [copiado, setCopiado] = useState(false);
  const editado = texto !== gerarMensagemNSIS(servico);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); } catch {
      const ta = document.createElement('textarea'); ta.value = texto; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopiado(true); setTimeout(() => setCopiado(false), 2500);
  };
  return (
    <div style={POPUP_OVERLAY}>
      <div style={{ ...POPUP_BOX, maxWidth: '540px' }}>
        <style>{`@keyframes popIn{from{transform:scale(0.93);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#faf5ff', border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544' }}>Mensagem para CEMIG</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Edite se necessário e copie</div>
          </div>
          {servico.foto && <a href={servico.foto} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: '600', background: 'linear-gradient(135deg, #0f172a, #1d4ed8)', color: '#fff' }}>Ver foto</a>}
        </div>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={14}
          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: editado ? '1px solid #a78bfa' : '1px solid #e2e8f0', borderRadius: '10px', background: editado ? '#faf5ff' : '#f8fafc', fontFamily: 'inherit', fontSize: '12px', color: '#1e293b', lineHeight: '1.75', resize: 'vertical', outline: 'none', marginBottom: '16px' }}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={BTN_CANCEL}>Fechar</button>
          <button onClick={copiar} style={{ ...BTN_PRIMARY, background: copiado ? 'linear-gradient(135deg, #15803d, #16a34a)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {copiado ? '✓ Copiado!' : 'Copiar mensagem'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// POPUP STATUS DONO
// ============================================================
const StatusDonoPopup = ({ servico, onConfirm, onCancel }) => {
  const [novoStatus, setNovoStatus] = useState(servico.status);
  return (
    <div style={POPUP_OVERLAY}>
      <div style={POPUP_BOX}>
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544', marginBottom: '6px' }}>Alterar status — Dono</div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Novo status para <strong style={{ color: '#0f2544' }}>{servico.id}</strong>:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '22px' }}>
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CONFIG[s];
            const ativo = novoStatus === s;
            return (
              <button key={s} onClick={() => setNovoStatus(s)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', border: ativo ? `2px solid ${cfg.color}` : '1px solid #e2e8f0', background: ativo ? cfg.bg : '#f8fafc' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0, border: ativo ? `4px solid ${cfg.color}` : '2px solid #cbd5e1' }} />
                <span style={{ fontSize: '13px', fontWeight: ativo ? '600' : '400', color: ativo ? cfg.color : '#334155' }}>{cfg.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={BTN_CANCEL}>Cancelar</button>
          <button onClick={() => onConfirm(novoStatus)} disabled={novoStatus === servico.status} style={{ ...BTN_PRIMARY, opacity: novoStatus === servico.status ? 0.5 : 1 }}>Aplicar</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// POPUP IMPORTAÇÃO EXCEL
// ============================================================
const ImportPopup = ({ onConfirm, onCancel, services }) => {
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState([]);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const processarArquivo = (file) => {
    setErro(''); setPreview([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!rows.length) { setErro('Planilha vazia.'); return; }
        setPreview(rows.slice(0, 5));
        setArquivo(rows);
      } catch { setErro('Erro ao ler o arquivo. Certifique-se de que é um .xlsx válido.'); }
    };
    reader.readAsBinaryString(file);
  };

  const importar = async () => {
    if (!arquivo) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'servicos'));
      let nextNum = snap.size + 1;
      for (const row of arquivo) {
        await addDoc(collection(db, 'servicos'), {
          id: row['ID'] || `VD${String(nextNum++).padStart(4, '0')}`,
          data: row['Data'] || '',
          local: row['Localidade'] || '',
          desc: row['Descrição'] || '',
          tipo: row['Tipo'] || '',
          equip: row['Equipamento'] || '',
          coord: row['Coordenada'] || '',
          foto: row['Foto'] || '',
          orig: row['Técnico'] || '',
          obs: row['Observações'] || '',
          numServ: row['Nº Serviço'] || '',
          status: row['Status'] || 'cadastrado',
          autor: row['Cadastrado por'] || 'Importação',
          matriculaAutor: row['Matrícula'] || '',
          dtCadastro: serverTimestamp(),
          hist: [{ who: 'Importação', matricula: '', when: new Date().toISOString(), msg: 'Serviço importado via Excel.' }]
        });
      }
      onConfirm(arquivo.length);
    } catch { setErro('Erro ao importar. Tente novamente.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={POPUP_OVERLAY}>
      <div style={{ ...POPUP_BOX, maxWidth: '560px' }}>
        <style>{`@keyframes popIn{from{transform:scale(0.93);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544', marginBottom: '6px' }}>Importar dados — Excel</div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: '1.6' }}>
          O arquivo deve ter as colunas: <strong>ID, Data, Localidade, Descrição, Tipo, Equipamento, Nº Serviço, Status, Técnico, Cadastrado por</strong>
        </div>
        <div style={{ border: '2px dashed #e2e8f0', borderRadius: '10px', padding: '24px', textAlign: 'center', marginBottom: '16px', background: '#f8fafc' }}>
          <input type="file" accept=".xlsx,.xls" id="import-file" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && processarArquivo(e.target.files[0])}
          />
          <label htmlFor="import-file" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Clique para selecionar o arquivo .xlsx</span>
          </label>
        </div>
        {erro && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '12px', marginBottom: '12px' }}>{erro}</div>}
        {preview.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>PRÉVIA ({arquivo.length} linhas)</div>
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr>{Object.keys(preview[0]).slice(0,5).map(k => <th key={k} style={{ padding: '6px 8px', background: '#f8fafc', textAlign: 'left', color: '#64748b', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>{k}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>{Object.values(row).slice(0,5).map((v, j) => <td key={j} style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{String(v).slice(0,30)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={BTN_CANCEL}>Cancelar</button>
          <button onClick={importar} disabled={!arquivo || loading} style={{ ...BTN_PRIMARY, opacity: arquivo && !loading ? 1 : 0.5, cursor: arquivo && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {loading ? 'Importando...' : `Importar ${arquivo ? arquivo.length : 0} registros`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
const ServicosTable = () => {
  const { user } = useAuth();
  const isDono = user?.role === 'dono';

  const [services, setServices]             = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [selectedService, setSelectedService]   = useState(null);
  const [modalOpen, setModalOpen]           = useState(false);
  const [page, setPage]                     = useState(0); // página atual (0-indexed)

  // Filtros
  const [busca, setBusca]             = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [tipoFilter, setTipoFilter]   = useState([]);
  const [postoFilter, setPostoFilter] = useState([]);
  const [localFilter, setLocalFilter] = useState('');

  // Ordenação
  const [sortCol, setSortCol] = useState('id');
  const [sortDir, setSortDir] = useState('desc');

  // Popups
  const [confirmPending, setConfirmPending]           = useState(null);
  const [numServPending, setNumServPending]           = useState(null);
  const [statusDonoPending, setStatusDonoPending]     = useState(null);
  const [cancelPending, setCancelPending]             = useState(null);
  const [mensagemCemigServico, setMensagemCemigServico] = useState(null);
  const [importOpen, setImportOpen]                   = useState(false);
  const [importSuccess, setImportSuccess]             = useState('');

  // Carrega dados em tempo real do Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'servicos'), (snap) => {
      setServices(snap.docs.map(d => ({ ...d.data(), _docId: d.id })));
    });
    return () => unsub();
  }, []);

  // Aplica filtros e ordenação sempre que algo mudar
  useEffect(() => {
    let lista = [...services];

    // Busca global em todos os campos
    if (busca.trim()) {
      const raw = busca.trim();
      const temVirgula = /[,;]/.test(raw);
      if (temVirgula) {
        const termos = raw.split(/[,;\n]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
        lista = lista.filter(s => termos.some(t => (s.numServ || '').toLowerCase().includes(t) || (s.id || '').toLowerCase() === t));
      } else {
        const terms = raw.toLowerCase().split(/\s+/);
        lista = lista.filter(s => {
          const haystack = [s.id, s.numServ, s.local, s.desc, s.equip, s.orig, s.tipo, s.obs].join(' ').toLowerCase();
          return terms.every(t => haystack.includes(t));
        });
      }
    }

    // Filtro de status (oculta cancelados por padrão)
    if (statusFilter.length > 0) {
      lista = lista.filter(s => statusFilter.includes(s.status));
    } else {
      lista = lista.filter(s => s.status !== 'cancelado');
    }

    // Filtro de tipo
    if (tipoFilter.length > 0) lista = lista.filter(s => tipoFilter.includes(s.tipo));

    // Filtro de posto
    if (postoFilter.length > 0) {
      const locsDoPosto = postoFilter.flatMap(p => POSTOS[p] || []);
      lista = lista.filter(s => locsDoPosto.includes(s.local));
    }

    // Filtro de localidade específica
    if (localFilter) lista = lista.filter(s => s.local === localFilter);

    // Ordenação
    lista.sort((a, b) => {
      let va, vb;
      if (sortCol === 'id') { va = idNum(a.id); vb = idNum(b.id); }
      else if (sortCol === 'dtCadastro' || sortCol === 'data') {
        va = a[sortCol]?.seconds ?? (a[sortCol] ? new Date(a[sortCol]).getTime() / 1000 : 0);
        vb = b[sortCol]?.seconds ?? (b[sortCol] ? new Date(b[sortCol]).getTime() / 1000 : 0);
      } else if (sortCol === 'status') {
        va = STATUS_ORDER.indexOf(a.status); vb = STATUS_ORDER.indexOf(b.status);
      } else {
        va = (a[sortCol] || '').toString().toLowerCase();
        vb = (b[sortCol] || '').toString().toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredServices(lista);
    setPage(0); // volta para a primeira página ao filtrar
  }, [services, busca, statusFilter, tipoFilter, postoFilter, localFilter, sortCol, sortDir]);

  // ── Paginação ──────────────────────────────────────────────
  const totalPages   = Math.max(1, Math.ceil(filteredServices.length / PER_PAGE));
  const pageData     = filteredServices.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // ── Atualizar status no Firebase ───────────────────────────
  const atualizarStatus = async (docId, novoStatus, mensagem, extra = {}) => {
    try {
      const atual = services.find(s => s._docId === docId);
      await updateDoc(doc(db, 'servicos', docId), {
        status: novoStatus, ...extra,
        hist: [...(atual?.hist || []), { who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: mensagem }]
      });
    } catch { alert('Erro ao atualizar.'); }
  };

  const confirmarStatus = async (numServ) => {
    const { servico, novoStatus, mensagem } = confirmPending;
    const extra = numServ ? { numServ } : {};
    await atualizarStatus(servico._docId, novoStatus, mensagem, extra);
    if (novoStatus === 'enviado') setMensagemCemigServico(servico);
    setConfirmPending(null);
  };

  const confirmarNumServ = async (num) => {
    const s = numServPending;
    await updateDoc(doc(db, 'servicos', s._docId), {
      numServ: num,
      hist: [...(s.hist || []), { who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: `Nº CEMIG registrado: ${num}` }]
    });
    setNumServPending(null);
  };

  const confirmarStatusDono = async (novoStatus) => {
    const s = statusDonoPending;
    await atualizarStatus(s._docId, novoStatus, `Status alterado para "${STATUS_CONFIG[novoStatus]?.label}" pelo Dono.`);
    setStatusDonoPending(null);
    if (novoStatus === 'enviado') setMensagemCemigServico(s);
  };

  const confirmarCancelamento = async (motivo) => {
    const s = cancelPending;
    await atualizarStatus(s._docId, 'cancelado', `Serviço cancelado. Motivo: ${motivo}`);
    setCancelPending(null);
  };

  // ── Exportar Excel ─────────────────────────────────────────
  const exportarExcel = () => {
    const dados = filteredServices.map(s => ({
      'ID':            s.id,
      'Data':          s.data,
      'Localidade':    s.local,
      'Descrição':     s.desc,
      'Tipo':          s.tipo,
      'Equipamento':   s.equip,
      'Coordenada':    s.coord,
      'Foto':          s.foto,
      'Técnico':       s.orig,
      'Observações':   s.obs,
      'Status':        STATUS_CONFIG[s.status]?.label || s.status,
      'Nº Serviço':    s.numServ,
      'Cadastrado por': s.autor,
      'Matrícula':     s.matriculaAutor,
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Serviços');
    XLSX.writeFile(wb, `visao_de_dono_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Render helpers ─────────────────────────────────────────
  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.25, marginLeft: '3px', fontSize: '9px' }}>↕</span>;
    return <span style={{ marginLeft: '3px', fontSize: '9px', color: '#1d4ed8' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const thBase = { textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: '700', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase', userSelect: 'none' };
  const thClick = (col) => ({ ...thBase, cursor: col ? 'pointer' : 'default' });
  const td = { padding: '10px 12px', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle', fontSize: '12px', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' };

  const statusOptions = STATUS_ORDER.map(s => ({ value: s, label: STATUS_CONFIG[s].label, badge: STATUS_CONFIG[s] }));
  const tipoOptions   = ['NSIS','NSMP','RC02','INBE'].map(t => ({ value: t, label: t }));
  const postoOptions  = Object.keys(POSTOS).map(p => ({ value: p, label: p }));

  // Localidades disponíveis baseadas no posto filtrado (ou todas)
  const locDisponivies = postoFilter.length > 0
    ? postoFilter.flatMap(p => (POSTOS[p] || []).map(loc => ({ value: loc, label: loc })))
    : TODAS_LOCALIDADES.map(({ loc }) => ({ value: loc, label: loc }));

  return (
    <div>
      <style>{`@keyframes popIn{from{transform:scale(0.93);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

      {/* Popups */}
      {confirmPending       && <ConfirmPopup    servico={confirmPending.servico}    novoStatus={confirmPending.novoStatus} onConfirm={confirmarStatus}    onCancel={() => setConfirmPending(null)} />}
      {numServPending       && <NumServPopup    servico={numServPending}             onConfirm={confirmarNumServ}           onCancel={() => setNumServPending(null)} />}
      {statusDonoPending    && <StatusDonoPopup servico={statusDonoPending}          onConfirm={confirmarStatusDono}        onCancel={() => setStatusDonoPending(null)} />}
      {cancelPending        && <CancelPopup     servico={cancelPending}              onConfirm={confirmarCancelamento}      onCancel={() => setCancelPending(null)} />}
      {mensagemCemigServico && <MensagemCemigPopup servico={mensagemCemigServico}   onClose={() => setMensagemCemigServico(null)} />}
      {importOpen           && <ImportPopup services={services} onCancel={() => setImportOpen(false)} onConfirm={(n) => { setImportOpen(false); setImportSuccess(`${n} registros importados com sucesso!`); setTimeout(() => setImportSuccess(''), 4000); }} />}

      {/* Toast importação */}
      {importSuccess && (
        <div style={{ position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)', background: '#0f2544', color: '#fff', padding: '14px 28px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', zIndex: 9999, minWidth: '280px', textAlign: 'center' }}>
          ✓ {importSuccess}
        </div>
      )}

      {/* ── FILTROS ── */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '14px 16px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Filtros</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '10px', alignItems: 'end', marginBottom: '10px' }}>
          {/* Busca */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Busca — palavra-chave ou nº serviços (vírgula)</label>
            <div style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="ID, localidade, descrição, equipamento..." value={busca} onChange={e => setBusca(e.target.value)} style={{ ...inputStyle, paddingLeft: '30px' }} />
            </div>
          </div>
          {/* Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Status</label>
            <MultiSelect options={statusOptions} selected={statusFilter} onChange={setStatusFilter} />
          </div>
          {/* Tipo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Tipo</label>
            <MultiSelect options={tipoOptions} selected={tipoFilter} onChange={setTipoFilter} />
          </div>
          {/* Posto */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Posto</label>
            <MultiSelect options={postoOptions} selected={postoFilter} onChange={(v) => { setPostoFilter(v); setLocalFilter(''); }} placeholder="Todos os postos" />
          </div>
          {/* Localidade específica */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Localidade</label>
            <select value={localFilter} onChange={e => setLocalFilter(e.target.value)}
              style={{ ...inputStyle, background: localFilter ? '#eff6ff' : '#fff', color: localFilter ? '#1d4ed8' : '#1e293b', fontWeight: localFilter ? '600' : '400', border: localFilter ? '1px solid #bfdbfe' : '1px solid #e2e8f0' }}>
              <option value="">Todas</option>
              {locDisponivies.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── TABELA ── */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

        {/* Header da tabela */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f2544' }}>Lista de Serviços</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {(statusFilter.length > 0 || tipoFilter.length > 0 || postoFilter.length > 0 || localFilter || busca) && (
              <button onClick={() => { setStatusFilter([]); setTipoFilter([]); setPostoFilter([]); setLocalFilter(''); setBusca(''); }}
                style={{ fontSize: '11px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}>
                Limpar filtros
              </button>
            )}
            {/* Botão importar (só Dono) */}
            {isDono && (
              <button onClick={() => setImportOpen(true)} style={{ fontSize: '11px', padding: '5px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'inherit' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Importar
              </button>
            )}
            {/* Botão exportar */}
            <button onClick={exportarExcel} style={{ fontSize: '11px', padding: '5px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'inherit' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar Excel
            </button>
            <div style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', borderRadius: '20px', padding: '3px 10px', fontWeight: '500' }}>
              {filteredServices.length} {filteredServices.length === 1 ? 'registro' : 'registros'}
            </div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ ...thBase, width: '32px' }} />
              <th style={{ ...thBase, width: '32px' }} />
              <th style={{ ...thBase, width: '32px' }} />
              <th style={{ ...thClick('id'), width: '80px' }} onClick={() => toggleSort('id')}>ID <SortIcon col="id" /></th>
              <th style={{ ...thClick('data'), width: '150px' }} onClick={() => toggleSort('data')}>Data <SortIcon col="data" /></th>
              <th style={{ ...thClick('local'), width: '120px' }} onClick={() => toggleSort('local')}>Localidade <SortIcon col="local" /></th>
              <th style={thClick('desc')} onClick={() => toggleSort('desc')}>Descrição <SortIcon col="desc" /></th>
              <th style={{ ...thClick('tipo'), width: '65px' }} onClick={() => toggleSort('tipo')}>Tipo <SortIcon col="tipo" /></th>
              <th style={{ ...thClick('equip'), width: '110px' }} onClick={() => toggleSort('equip')}>Equipamento <SortIcon col="equip" /></th>
              <th style={{ ...thClick('status'), width: '145px' }} onClick={() => toggleSort('status')}>Status <SortIcon col="status" /></th>
              <th style={{ ...thClick('numServ'), width: '120px' }} onClick={() => toggleSort('numServ')}>Nº Serviço <SortIcon col="numServ" /></th>
              <th style={{ ...thBase, width: '120px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((s, i) => {
              const nextInfo = NEXT_STATUS[s.status];
              const placaMontada = s.placaMontada === true;
              return (
                <tr key={s._docId}
                  style={{ opacity: s.status === 'cancelado' ? 0.4 : 1, textDecoration: s.status === 'cancelado' ? 'line-through' : 'none', background: i % 2 === 0 ? '#fff' : '#fafbfc', transition: 'background 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0f7ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafbfc'; }}
                >
                  {/* Ver detalhes */}
                  <td style={td}>
                    <button onClick={() => { setSelectedService(s); setModalOpen(true); }} title="Ver detalhes"
                      style={{ width: '26px', height: '26px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e0f2fe'; e.currentTarget.style.color = '#0369a1'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  </td>

                  {/* Alterar status — Dono */}
                  <td style={td}>
                    {isDono && (
                      <button onClick={() => setStatusDonoPending(s)} title="Alterar status (Dono)"
                        style={{ width: '26px', height: '26px', border: '1px solid #fde68a', borderRadius: '6px', background: '#fffbeb', color: '#92400e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fef3c7'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fffbeb'; }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    )}
                  </td>

                  {/* Ícone placa */}
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span title={placaMontada ? 'Placa montada' : 'Placa não montada'} style={{ fontSize: '14px', opacity: placaMontada ? 1 : 0.2 }}>
                      {placaMontada
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 12 11 14 15 10"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>}
                    </span>
                  </td>

                  <td style={td}><span style={{ fontWeight: '700', color: '#0f2544' }}>{s.id}</span></td>
                  <td style={{ ...td, color: '#64748b' }}>{fmtDt(s.data)}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {s.local}
                      {(() => {
                        const entry = TODAS_LOCALIDADES.find(l => l.loc === s.local);
                        if (!entry) return null;
                        const color = POSTO_COLORS[entry.posto];
                        const postoNome = entry.posto.split('—')[0].trim().replace('Posto ', 'P');
                        return <span style={{ fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', background: `${color}15`, color, border: `1px solid ${color}25`, flexShrink: 0 }}>{postoNome}</span>;
                      })()}
                    </div>
                  </td>
                  <td style={{ ...td, maxWidth: '220px' }}>{s.desc}</td>
                  <td style={td}><span style={{ display: 'inline-block', fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', letterSpacing: '0.04em' }}>{s.tipo}</span></td>
                  <td style={{ ...td, color: '#64748b' }}>{s.equip || '—'}</td>
                  <td style={td}><Badge status={s.status} /></td>

                  {/* Nº serviço clicável */}
                  <td style={td}>
                    <button onClick={() => setNumServPending(s)} title="Editar Nº do serviço"
                      style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', color: s.numServ ? '#0f2544' : '#94a3b8', fontSize: '12px', fontFamily: 'inherit', fontWeight: s.numServ ? '600' : '400', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#1d4ed8'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = s.numServ ? '#0f2544' : '#94a3b8'; }}>
                      {s.numServ || '—'}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </td>

                  {/* Ações */}
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {nextInfo && s.status !== 'cancelado' && (
                        <button onClick={() => setConfirmPending({ servico: s, novoStatus: nextInfo.next, mensagem: nextInfo.msg })}
                          style={{ fontSize: '11px', padding: '4px 10px', border: `1px solid ${nextInfo.color}22`, borderRadius: '6px', background: `${nextInfo.color}0d`, color: nextInfo.color, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: '500', fontFamily: 'inherit' }}
                          onMouseEnter={e => { e.currentTarget.style.background = `${nextInfo.color}1a`; }}
                          onMouseLeave={e => { e.currentTarget.style.background = `${nextInfo.color}0d`; }}>
                          {nextInfo.label}
                        </button>
                      )}
                      {/* Cancelar — só Dono, só se não cancelado */}
                      {isDono && s.status !== 'cancelado' && (
                        <button onClick={() => setCancelPending(s)} title="Cancelar serviço"
                          style={{ width: '24px', height: '24px', border: '1px solid #fecaca', borderRadius: '6px', background: '#fef2f2', color: '#b91c1c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontWeight: '700', fontSize: '13px' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; }}>
                          ×
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {pageData.length === 0 && (
              <tr><td colSpan={12} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '13px' }}>Nenhum serviço encontrado.</td></tr>
            )}
          </tbody>
        </table>

        {/* ── PAGINAÇÃO ── */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Mostrando {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filteredServices.length)} de {filteredServices.length}
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button onClick={() => setPage(0)} disabled={page === 0}
                style={{ padding: '5px 9px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', color: page === 0 ? '#cbd5e1' : '#475569', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: '11px', fontFamily: 'inherit' }}>
                «
              </button>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{ padding: '5px 9px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', color: page === 0 ? '#cbd5e1' : '#475569', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: '11px', fontFamily: 'inherit' }}>
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i).filter(i => Math.abs(i - page) <= 2).map(i => (
                <button key={i} onClick={() => setPage(i)}
                  style={{ padding: '5px 10px', border: i === page ? '1px solid #1d4ed8' : '1px solid #e2e8f0', borderRadius: '6px', background: i === page ? '#1d4ed8' : '#fff', color: i === page ? '#fff' : '#475569', cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit', fontWeight: i === page ? '700' : '400' }}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                style={{ padding: '5px 9px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', color: page === totalPages - 1 ? '#cbd5e1' : '#475569', cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: '11px', fontFamily: 'inherit' }}>
                ›
              </button>
              <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1}
                style={{ padding: '5px 9px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', color: page === totalPages - 1 ? '#cbd5e1' : '#475569', cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: '11px', fontFamily: 'inherit' }}>
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de detalhes com LocalidadeSelect */}
      <DetalheModal
        service={selectedService}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        isDono={isDono}
        LocalidadeSelect={LocalidadeSelect}
      />
    </div>
  );
};

export default ServicosTable;