import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import DetalheModal from './DetalheModal';
import * as XLSX from 'xlsx';


const STATUS_CONFIG = {
  cadastrado: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Cadastrado' },
  enviado: { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe', label: 'Enviado CEMIG' },
  pendente: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Pendente' },
  concluido: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Concluído' },
  cancelado: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Cancelado' },
  reprovado: { bg: '#fff1f2', color: '#dc2626', border: '#fecdd3', label: 'Reprovado' },
};

// STATUS_ORDER sem 'cancelado' para o popup StatusDono
const STATUS_ORDER = ['cadastrado', 'enviado', 'pendente', 'concluido', 'cancelado', 'reprovado'];
const STATUS_ORDER_SEM_CANCEL = ['cadastrado', 'enviado', 'pendente', 'concluido'];

const NEXT_STATUS = {
  cadastrado: { next: 'enviado', msg: 'Enviado à CEMIG', label: 'Enviar', color: '#7c3aed' },
  enviado: { next: 'pendente', msg: 'Número CEMIG recebido', label: 'Nº CEMIG', color: '#c2410c' },
  pendente: { next: 'concluido', msg: 'Serviço concluído', label: 'Concluir', color: '#15803d' },
};

// ── Localidades ───────────────────────────────────────────────────────────────
export const POSTOS = {
  'Posto 1 — Pedro': [
    'Frei Inocêncio', 'Alpercata', 'Alvarenga', 'Capitão Andrade', 'Engenheiro Caldas',
    'Fernandes Tourinho', 'Governador Valadares', 'Itanhomi', 'Jampruca', 'Jataí',
    'Mathias Lobato', 'São Geraldo do Tumiritinga', 'Sobrália', 'Tarumirim', 'Tumiritinga',
  ],
  'Posto 2 — Elton': [
    'Coluna', 'São Geraldo da Piedade', 'Água Boa', 'José Raydan', 'Paulistas',
    'Cantagalo', 'Peçanha', 'São João Evangelista', 'São José do Jacuri',
    'Santa Efigênia de Minas', 'Gonzaga', 'Santa Maria do Suaçuí', 'Frei Lago Negro',
    'São Pedro do Suaçuí', 'São Sebastião do Maranhão', 'Sardoá',
  ],
  'Posto 3 — Vinicius': [
    'Cuparaque', 'Conselheiro Pena', 'Resplendor', 'Aimorés', 'Goiabeira',
    'Itueta', 'Santa Rita do Itueto', 'São Geraldo do Baixio', 'Galileia',
  ],
  'Posto 4 — Victor': [
    'Itabirinha de Mantena', 'Divino das Laranjeiras', 'Central de Minas', 'Mendes Pimentel',
    'Nova Belém', 'São Félix de Minas', 'Tipiti', 'Mantena', 'São João do Manteninha',
    'Marilac', 'Coroaci', 'Virgolândia', 'Nacip Raydan', 'São José da Safira',
  ],
};

export const TODAS_LOCALIDADES = Object.entries(POSTOS).flatMap(([posto, locs]) =>
  locs.map(loc => ({ loc, posto }))
).sort((a, b) => a.loc.localeCompare(b.loc, 'pt-BR'));

export const POSTO_COLORS = {
  'Posto 1 — Pedro': '#1d4ed8',
  'Posto 2 — Elton': '#7c3aed',
  'Posto 3 — Vinicius': '#0369a1',
  'Posto 4 — Victor': '#15803d',
};

const normStr = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const PAGE_SIZE = 50;

const fmtDt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const idNum = (id) => parseInt((id || '').replace(/\D/g, '') || '0', 10);

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

// ── Select pesquisável de localidade ─────────────────────────────────────────
export const LocalidadeSelect = ({ value, onChange }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const resultados = query.trim()
    ? TODAS_LOCALIDADES.filter(({ loc }) => normStr(loc).includes(normStr(query)))
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
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setQuery('');
      }
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
      <div
        style={{
          display: 'flex', alignItems: 'center',
          border: `1px solid ${open ? '#3b82f6' : value ? '#a5b4fc' : '#e2e8f0'}`,
          borderRadius: '8px', background: open ? '#fff' : '#f8fafc',
          boxShadow: open ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
          transition: 'all 0.15s', cursor: 'text', overflow: 'hidden',
        }}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
          style={{ flexShrink: 0, marginLeft: '11px' }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef} type="text"
          placeholder={value ? '' : 'Pesquisar localidade...'}
          value={open ? query : ''}
          onChange={e => { setQuery(e.target.value); setHighlighted(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1, padding: '8px', border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: '#1e293b', fontFamily: "'Segoe UI', system-ui, sans-serif" }}
        />
        {value && !open && (
          <div style={{ position: 'absolute', left: '34px', right: '60px', fontSize: '12px', color: '#1e293b', pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
        {value && (
          <button onClick={e => { e.stopPropagation(); limpar(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 10px', color: '#94a3b8', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>
            ×
          </button>
        )}
      </div>

      {open && (
        <div ref={listRef} style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '240px', overflowY: 'auto',
        }}>
          {grupos.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
              Nenhuma localidade encontrada
            </div>
          ) : grupos.map(({ posto, itens }) => {
            const color = POSTO_COLORS[posto] || '#64748b';
            return (
              <div key={posto}>
                <div style={{ padding: '6px 12px 4px', fontSize: '9px', fontWeight: '800', color, background: `${color}08`, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: `1px solid ${color}15` }}>
                  {posto}
                </div>
                {itens.map(({ loc }) => {
                  const idx = flat.findIndex(f => f.loc === loc);
                  const isH = idx === highlighted;
                  return (
                    <button key={loc} data-highlighted={isH}
                      onClick={() => selecionar(loc)}
                      onMouseEnter={() => setHighlighted(idx)}
                      style={{
                        width: '100%', padding: '8px 16px', border: 'none',
                        background: isH ? `${color}10` : loc === value ? '#f0fdf4' : '#fff',
                        cursor: 'pointer', textAlign: 'left', fontSize: '12px',
                        color: loc === value ? '#15803d' : '#334155',
                        fontWeight: loc === value ? '600' : '400',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                      {loc}
                      {loc === value && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12" />
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

// ── Popup confirmação de status ───────────────────────────────────────────────
const ConfirmPopup = ({ servico, novoStatus, onConfirm, onCancel }) => {
  const cfg = STATUS_CONFIG[novoStatus] || {};
  const precisaNum = novoStatus === 'pendente';
  const [num, setNum] = useState(servico.numServ || '');

  const handleConfirm = () => {
    if (precisaNum && !num.trim()) return;
    onConfirm(precisaNum ? num.trim() : null);
  };

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
            : <>Alterar o status de <strong style={{ color: '#0f2544' }}>{servico.id}</strong> para:</>
          }
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', fontSize: '11px', padding: '4px 12px',
          borderRadius: '20px', fontWeight: '600', background: cfg.bg, color: cfg.color,
          border: `1px solid ${cfg.border}`, marginBottom: precisaNum ? '14px' : '22px',
        }}>{cfg.label}</div>

        {precisaNum && (
          <div style={{ marginBottom: '22px' }}>
            <input
              autoFocus type="text" value={num}
              onChange={e => setNum(e.target.value)}
              placeholder="Ex: 240850456"
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
              style={{
                ...inputStyle, padding: '10px 13px', fontSize: '14px',
                border: num.trim() ? '1px solid #3b82f6' : '1px solid #fca5a5',
                boxShadow: num.trim() ? '0 0 0 3px rgba(59,130,246,0.1)' : '0 0 0 3px rgba(239,68,68,0.08)',
              }}
            />
            {!num.trim() && (
              <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
                Campo obrigatório para avançar o status.
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={BTN_CANCEL}>Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={precisaNum && !num.trim()}
            style={{ ...BTN_PRIMARY, opacity: precisaNum && !num.trim() ? 0.5 : 1, cursor: precisaNum && !num.trim() ? 'not-allowed' : 'pointer' }}
          >
            {precisaNum ? 'Salvar e avançar' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Popup Nº CEMIG standalone ─────────────────────────────────────────────────
const NumServPopup = ({ servico, onConfirm, onCancel }) => {
  const [num, setNum] = useState(servico.numServ || '');
  return (
    <div style={POPUP_OVERLAY}>
      <div style={POPUP_BOX}>
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544', marginBottom: '6px' }}>Nº do serviço CEMIG</div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
          Editar número registrado para <strong style={{ color: '#0f2544' }}>{servico.id}</strong>.
        </div>
        <input
          autoFocus type="text" value={num}
          onChange={e => setNum(e.target.value)}
          placeholder="Ex: 240850456"
          onKeyDown={e => { if (e.key === 'Enter' && num.trim()) onConfirm(num.trim()); }}
          style={{
            ...inputStyle, padding: '10px 13px', fontSize: '14px',
            border: '1px solid #3b82f6', boxShadow: '0 0 0 3px rgba(59,130,246,0.1)',
            marginBottom: '22px',
          }}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={BTN_CANCEL}>Cancelar</button>
          <button onClick={() => num.trim() && onConfirm(num.trim())} style={BTN_PRIMARY}>Salvar</button>
        </div>
      </div>
    </div>
  );
};

// ── Popup reprovação com motivo obrigatório ──────────────────────────────────
const ReprovadoPopup = ({ servico, onConfirm, onCancel }) => {
  const [motivo, setMotivo] = useState('');

  return (
    <div style={POPUP_OVERLAY}>
      <div style={POPUP_BOX}>
        <style>{`@keyframes popIn{from{transform:scale(0.93);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0, background: '#fff1f2', border: '1px solid #fecdd3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544' }}>Reprovar serviço</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{servico.id}</div>
          </div>
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px', lineHeight: '1.6' }}>
          Informe o motivo da reprovação. Esta observação ficará registrada no histórico.
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            Motivo da reprovação <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            autoFocus value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Ex: Serviço não executado pela equipe da CEMIG, acesso bloqueado..."
            rows={4}
            style={{ ...inputStyle, padding: '10px 12px', fontSize: '13px', resize: 'vertical', lineHeight: '1.6', border: motivo.trim() ? '1px solid #fca5a5' : '1px solid #fecdd3', boxShadow: motivo.trim() ? '0 0 0 3px rgba(220,38,38,0.08)' : '0 0 0 3px rgba(220,38,38,0.04)' }}
          />
          {!motivo.trim() && (
            <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>Informe um motivo para reprovar o serviço.</div>
          )}
        </div>
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '10px 12px', marginBottom: '20px', fontSize: '12px', color: '#dc2626', lineHeight: '1.5' }}>
          ⚠️ O status será alterado para <strong>Reprovado</strong>. Esta ação é definitiva e equivale ao encerramento do serviço.
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={BTN_CANCEL}>Voltar</button>
          <button onClick={() => motivo.trim() && onConfirm(motivo.trim())} disabled={!motivo.trim()}
            style={{ ...BTN_PRIMARY, background: motivo.trim() ? 'linear-gradient(135deg, #991b1b, #dc2626)' : '#94a3b8', opacity: motivo.trim() ? 1 : 0.6, cursor: motivo.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
            Confirmar reprovação
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Popup cancelamento com observação obrigatória ─────────────────────────────
const CancelPopup = ({ servico, onConfirm, onCancel }) => {
  const [obs, setObs] = useState('');

  return (
    <div style={POPUP_OVERLAY}>
      <div style={POPUP_BOX}>
        <style>{`@keyframes popIn{from{transform:scale(0.93);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544' }}>Cancelar serviço</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{servico.id}</div>
          </div>
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px', lineHeight: '1.6' }}>
          Informe o motivo do cancelamento. Esta observação ficará registrada no histórico.
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            Motivo do cancelamento <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            autoFocus value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Ex: Serviço duplicado, cliente desistiu, erro de cadastro..."
            rows={4}
            style={{ ...inputStyle, padding: '10px 12px', fontSize: '13px', resize: 'vertical', lineHeight: '1.6', border: obs.trim() ? '1px solid #f87171' : '1px solid #fca5a5', boxShadow: obs.trim() ? '0 0 0 3px rgba(239,68,68,0.08)' : '0 0 0 3px rgba(239,68,68,0.04)' }}
          />
          {!obs.trim() && (
            <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>Informe um motivo para registrar o cancelamento.</div>
          )}
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', marginBottom: '20px', fontSize: '12px', color: '#b91c1c', lineHeight: '1.5' }}>
          ⚠️ O status será alterado para <strong>Cancelado</strong>. O serviço continuará visível com estilo riscado.
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={BTN_CANCEL}>Voltar</button>
          <button onClick={() => obs.trim() && onConfirm(obs.trim())} disabled={!obs.trim()}
            style={{ ...BTN_PRIMARY, background: obs.trim() ? 'linear-gradient(135deg, #991b1b, #b91c1c)' : '#94a3b8', opacity: obs.trim() ? 1 : 0.6, cursor: obs.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            Confirmar cancelamento
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Gera mensagem NSIS ────────────────────────────────────────────────────────
const gerarMensagemNSIS = (s) => {
  const equip = s.equip || '—';
  const local = s.local || '—';
  const coordFormatado = (s.coord || '').trim() || '—';
  const campoBairro = s.bairro || (equip !== '—' ? `VD-Placa ${equip}` : '—');
  const descBase = (s.desc || `Substituir placa ilegível do equipamento ${equip}`).trimEnd();
  const servicoExec = coordFormatado !== '—'
    ? `${descBase} nas coordenadas ${coordFormatado}`
    : descBase;
  return `Gentileza, gerar serviço:\n\nEquipamento: ${equip}\nCoordenadas: ${coordFormatado}\nLocalidade: ${local}\n\nServiço a ser executado:\n${servicoExec}\n\nObservação:\ndúvidas ligar para Matheus ENGELMIG 31 99914-8716`;
};

// ── Popup mensagem CEMIG ──────────────────────────────────────────────────────
const MensagemCemigPopup = ({ servico, onClose }) => {
  const [texto, setTexto] = useState(() => gerarMensagemNSIS(servico));
  const [copiado, setCopiado] = useState(false);
  const editado = texto !== gerarMensagemNSIS(servico);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = texto; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopiado(true); setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div style={POPUP_OVERLAY}>
      <div style={{ ...POPUP_BOX, maxWidth: '540px' }}>
        <style>{`@keyframes popIn{from{transform:scale(0.93);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0, background: 'linear-gradient(135deg, #7c3aed22, #7c3aed11)', border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544' }}>Mensagem para CEMIG</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Status atualizado — edite se necessário e copie</div>
          </div>
          {servico.foto && (
            <a href={servico.foto} target="_blank" rel="noopener noreferrer" title="Abrir foto do serviço"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: '600', flexShrink: 0, background: 'linear-gradient(135deg, #0f172a, #1d4ed8)', color: '#fff' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
              Ver foto
            </a>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            Enviado CEMIG — {servico.id}
          </div>
          {editado && (
            <button onClick={() => setTexto(gerarMensagemNSIS(servico))}
              style={{ fontSize: '11px', color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
              </svg>
              Restaurar original
            </button>
          )}
        </div>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Mensagem {editado ? '(editada)' : 'pronta'}
          </div>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={14}
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: editado ? '1px solid #a78bfa' : '1px solid #e2e8f0', borderRadius: '10px', background: editado ? '#faf5ff' : '#f8fafc', fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '12px', color: '#1e293b', lineHeight: '1.75', resize: 'vertical', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={BTN_CANCEL}>Fechar</button>
          <button onClick={copiar}
            style={{ ...BTN_PRIMARY, background: copiado ? 'linear-gradient(135deg, #15803d, #16a34a)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.2s' }}>
            {copiado
              ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>Copiado!</>
              : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>Copiar mensagem</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Popup status Dono — SEM a opção "Cancelado" ───────────────────────────────
const StatusDonoPopup = ({ servico, onConfirm, onCancel }) => {
  const [novoStatus, setNovoStatus] = useState(servico.status === 'cancelado' ? 'cadastrado' : servico.status);
  return (
    <div style={POPUP_OVERLAY}>
      <div style={POPUP_BOX}>
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544', marginBottom: '6px' }}>Alterar status — Dono</div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
          Novo status para <strong style={{ color: '#0f2544' }}>{servico.id}</strong>:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '22px' }}>
          {STATUS_ORDER_SEM_CANCEL.map(s => {
            const cfg = STATUS_CONFIG[s];
            const ativo = novoStatus === s;
            return (
              <button key={s} onClick={() => setNovoStatus(s)} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px',
                borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
                border: ativo ? `2px solid ${cfg.color}` : '1px solid #e2e8f0',
                background: ativo ? cfg.bg : '#f8fafc', transition: 'all 0.1s',
              }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0, border: ativo ? `4px solid ${cfg.color}` : '2px solid #cbd5e1', transition: 'all 0.1s' }} />
                <span style={{ fontSize: '13px', fontWeight: ativo ? '600' : '400', color: ativo ? cfg.color : '#334155' }}>{cfg.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={BTN_CANCEL}>Cancelar</button>
          <button onClick={() => onConfirm(novoStatus)} disabled={novoStatus === servico.status}
            style={{ ...BTN_PRIMARY, background: novoStatus === servico.status ? '#94a3b8' : BTN_PRIMARY.background, cursor: novoStatus === servico.status ? 'not-allowed' : 'pointer' }}>
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── MultiSelect ───────────────────────────────────────────────────────────────
const MultiSelect = ({ label, options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  const displayLabel = selected.length === 0
    ? 'Todos'
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
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: '180px', overflow: 'hidden',
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

// ── Exportar CSV ──────────────────────────────────────────────────────────────
const exportarExcel = (dados) => {
  const colunas = ['ID', 'Data', 'Localidade', 'Descrição', 'Tipo', 'Equipamento', 'Status', 'Nº Serviço', 'Atribuído para', 'Técnico Origem', 'Coordenada', 'Observação', 'Obs. Cancelamento', 'Placa Montada'];
  const esc = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const linhas = [
    colunas.join(';'),
    ...dados.map(s => [
      esc(s.id), esc(fmtDt(s.data)), esc(s.local), esc(s.desc), esc(s.tipo), esc(s.equip),
      esc(STATUS_CONFIG[s.status]?.label || s.status), esc(s.numServ),
      esc(s.atribuido_para ? `${s.atribuido_para.nome} (${s.atribuido_para.matricula})` : ''),
      esc(s.orig), esc(s.coord),
      esc(s.obs), esc(s.obsCancelamento), esc(s.placaMontada ? 'Sim' : 'Não'),
    ].join(';'))
  ];
  const bom = '\uFEFF';
  const csv = bom + linhas.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `servicos_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
  a.click(); URL.revokeObjectURL(url);
};

// ── Novo Popup de importação (XLSX) ───────────────────────────────────────────
const ImportPopup = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [etapa, setEtapa] = useState('selecao'); // 'selecao', 'previa', 'importando', 'concluido'
  const [linhas, setLinhas] = useState([]);
  const [estatisticas, setEstatisticas] = useState({ validos: 0, erros: 0, total: 0 });
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [resultado, setResultado] = useState({ validos: 0, ignorados: 0, inicio: '', fim: '' });
  const [fileName, setFileName] = useState('');
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const { data: lastRecord } = await supabase
          .from('servicos')
          .select('id')
          .order('dtCadastro', { ascending: false })
          .limit(1);

        let currentIdNum = 0;
        if (lastRecord && lastRecord.length > 0 && lastRecord[0].id) {
          currentIdNum = parseInt(lastRecord[0].id.replace('VD', ''), 10) || 0;
        }

        const validTypes = ['NSIS', 'NSMP', 'RC02', 'INBE', 'NSCP'];
        let validosCount = 0;
        let errosCount = 0;

        const coordsNaPlanilha = Array.from(new Set(json.map(r => String(r['COORDENADA'] || '').trim()).filter(Boolean)));
        let existentesMap = new Set();
        if (coordsNaPlanilha.length > 0) {
          const inChunks = [];
          for (let i = 0; i < coordsNaPlanilha.length; i += 100) {
            inChunks.push(coordsNaPlanilha.slice(i, i + 100));
          }
          for (const chunk of inChunks) {
            const { data: dbExistentes } = await supabase.from('servicos').select('coord').in('coord', chunk);
            if (dbExistentes) {
              dbExistentes.forEach(e => existentesMap.add(e.coord));
            }
          }
        }

        let coordenadasNoArquivo = new Set();

        const processadas = json.map((row, index) => {
          const numLinha = index + 2;
          const errors = [];
          const avisos = [];

          const rawData = String(row['Data'] || '').trim();
          let parsedData = new Date().toISOString();
          if (!rawData) {
            avisos.push('DATA vazia — utilizando data atual.');
          } else {
            if (!isNaN(Number(rawData)) && Number(rawData) > 20000) {
              const excelDate = new Date(Math.round((Number(rawData) - 25569) * 86400 * 1000));
              parsedData = excelDate.toISOString();
            } else {
              const d = new Date(rawData);
              if (isNaN(d.getTime())) {
                avisos.push(`DATA inválida ("${rawData}") — utilizando data atual.`);
              } else {
                parsedData = d.toISOString();
              }
            }
          }

          const local = String(row['LOCALIDADE'] || '').trim();
          if (!local) errors.push('LOCALIDADE está vazia');

          const desc = String(row['DESCRIÇÃO'] || '').trim();
          if (!desc) errors.push('DESCRIÇÃO está vazia');

          const coord = String(row['COORDENADA'] || '').trim();
          if (!coord) {
            errors.push('COORDENADA está vazia');
          } else {
            if (existentesMap.has(coord) || coordenadasNoArquivo.has(coord)) {
              errors.push('Duplicidade: já existe um serviço com esta mesma Coordenada.');
            }
            coordenadasNoArquivo.add(coord);
          }

          const equip = String(row['TRANSFORMADOR'] || '').trim();
          if (!equip) errors.push('TRANSFORMADOR está vazio');

          const tipoRaw = String(row['TIPO'] || '').trim().toUpperCase();
          let tipo = tipoRaw;
          if (!tipoRaw) {
            errors.push('TIPO está vazio');
          } else if (!validTypes.includes(tipoRaw)) {
            errors.push(`TIPO inválido: "${tipoRaw}" (valores aceitos: NSIS, NSMP, RC02, INBE, NSCP)`);
          }

          const hasError = errors.length > 0;
          if (hasError) {
            errosCount++;
          } else {
            validosCount++;
            currentIdNum++;
          }

          const idGerado = hasError ? null : `VD${String(currentIdNum).padStart(4, '0')}`;

          return {
            linha: numLinha,
            isValido: !hasError,
            erros: errors,
            avisos: avisos,
            parsed: {
              data: parsedData,
              local,
              desc,
              coord,
              foto: String(row['FOTO'] || '').trim() || null,
              equip,
              tipo,
              numServ: String(row['N°Serviço'] || '').trim() || null,
              orig: String(row['Técnico Origem'] || '').trim() || null,
              id: idGerado
            }
          };
        });

        setLinhas(processadas);
        setEstatisticas({ validos: validosCount, erros: errosCount, total: processadas.length });
        setEtapa('previa');
      } catch (err) {
        alert('Erro ao processar arquivo: ' + err.message);
        setEtapa('selecao');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const iniciarImportacao = async () => {
    setEtapa('importando');
    const validos = linhas.filter(l => l.isValido);
    setProgresso({ atual: 0, total: validos.length });

    if (validos.length === 0) return;

    const inicioId = validos[0].parsed.id;
    const fimId = validos[validos.length - 1].parsed.id;

    for (let i = 0; i < validos.length; i += 50) {
      const loteBatch = validos.slice(i, i + 50).map(l => {
        const p = l.parsed;
        return {
          id: p.id,
          data: p.data,
          local: p.local,
          desc: p.desc,
          coord: p.coord,
          foto: p.foto,
          equip: p.equip,
          tipo: p.tipo,
          numServ: p.numServ,
          orig: p.orig,
          status: 'cadastrado',
          autor: user.label,
          dtCadastro: new Date().toISOString(),
          hist: [{ who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: 'Serviço importado via planilha' }]
        };
      });

      await supabase.from('servicos').insert(loteBatch);
      setProgresso(prev => ({ ...prev, atual: prev.atual + loteBatch.length }));
    }

    setResultado({
      validos: validos.length,
      ignorados: estatisticas.erros,
      inicio: inicioId,
      fim: fimId
    });

    if (onSuccess) onSuccess();
    setEtapa('concluido');
  };

  if (etapa === 'selecao') {
    return (
      <div style={POPUP_OVERLAY}>
        <div style={{ ...POPUP_BOX, maxWidth: '560px' }}>
          <style>{`@keyframes popIn{from{transform:scale(0.93);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544' }}>Importar Planilha (.xlsx)</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Selecione o arquivo Excel com os serviços</div>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', border: '2px dashed #bbf7d0', borderRadius: '10px', cursor: 'pointer', background: '#f0fdf4', marginBottom: '14px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <span style={{ fontSize: '13px', color: fileName ? '#15803d' : '#64748b', fontWeight: fileName ? '600' : '400' }}>
              {fileName || 'Clique para selecionar arquivo .xlsx'}
            </span>
            <input type="file" accept=".xlsx" onChange={handleFile} style={{ display: 'none' }} />
          </label>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={BTN_CANCEL}>Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  if (etapa === 'importando' || etapa === 'concluido') {
    return (
      <div style={POPUP_OVERLAY}>
        <div style={{ ...POPUP_BOX, maxWidth: '400px' }}>
          {etapa === 'importando' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f2544', marginBottom: '12px' }}>Importando serviços...</div>
              <div style={{ background: '#e2e8f0', borderRadius: '8px', height: '12px', overflow: 'hidden', marginBottom: '10px' }}>
                <div style={{ background: '#0f2544', height: '100%', width: `${(progresso.atual / Math.max(progresso.total, 1)) * 100}%`, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>{progresso.atual} / {progresso.total} importados</div>
              <div style={{ fontSize: '11px', color: '#ef4444' }}>Não feche esta janela</div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#15803d' }}>Importação concluída!</div>
                </div>
              </div>
              <div style={{ fontSize: '14px', color: '#334155', marginBottom: '6px' }}><strong>{resultado.validos}</strong> serviços importados</div>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}><strong>{resultado.ignorados}</strong> registros ignorados (erros)</div>
              {resultado.validos > 0 && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#0f2544', marginBottom: '20px' }}>
                  IDs criados: <strong>{resultado.inicio}</strong> até <strong>{resultado.fim}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={BTN_PRIMARY}>Fechar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ETAPA: PREVIA
  const linhasExibidas = mostrarTodos ? linhas : linhas.slice(0, 10);
  const errosGerais = linhas.filter(l => !l.isValido);

  return (
    <div style={POPUP_OVERLAY}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '90vw', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', animation: 'popIn 0.2s ease' }}>

        {/* HEADER DO MODAL */}
        <div style={{ background: '#0f2544', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700' }}>Prévia de Importação</div>
            <div style={{ fontSize: '13px', color: '#93c5fd' }}>{estatisticas.total} serviços encontrados na planilha</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7, padding: '4px' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.7}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* CORPO COM SCROLL */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc' }}>

          {/* RESUMO NO TOPO */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div style={{ flex: 1, background: '#fff', borderRadius: '8px', padding: '16px', borderLeft: '4px solid #15803d', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#15803d' }}>{estatisticas.validos}</div>
              <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Válidos</div>
            </div>
            <div style={{ flex: 1, background: '#fff', borderRadius: '8px', padding: '16px', borderLeft: '4px solid #b91c1c', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#b91c1c' }}>{estatisticas.erros}</div>
              <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Com erro</div>
            </div>
            <div style={{ flex: 1, background: '#fff', borderRadius: '8px', padding: '16px', borderLeft: '4px solid #1d4ed8', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#1d4ed8' }}>{estatisticas.total}</div>
              <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Total</div>
            </div>
          </div>

          {/* PRÉVIA DOS DADOS */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f2544', marginBottom: '12px' }}>Detalhes dos registros</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {linhasExibidas.map((l, i) => (
                <div key={i} style={{ background: l.isValido ? '#fff' : '#fef2f2', border: `1px solid ${l.isValido ? '#e2e8f0' : '#fecaca'}`, borderLeft: `4px solid ${l.isValido ? '#15803d' : '#b91c1c'}`, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ padding: '10px 16px', background: l.isValido ? '#f8fafc' : '#fee2e2', borderBottom: `1px solid ${l.isValido ? '#e2e8f0' : '#fecaca'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f2544' }}>📋 Serviço {l.linha - 1} de {estatisticas.total} (Linha {l.linha})</div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: l.isValido ? '#15803d' : '#b91c1c' }}>{l.isValido ? '✓ Válido' : '✗ Erro'}</div>
                  </div>
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 24px', fontSize: '13px' }}>
                      <div style={{ color: '#64748b', fontWeight: '600' }}>Data</div><div>{l.parsed.data ? new Date(l.parsed.data).toLocaleString('pt-BR') : '(vazio)'}</div>
                      <div style={{ color: '#64748b', fontWeight: '600' }}>Localidade</div><div>{l.parsed.local || '(vazio)'}</div>
                      <div style={{ color: '#64748b', fontWeight: '600' }}>Descrição</div><div>{l.parsed.desc || '(vazio)'}</div>
                      <div style={{ color: '#64748b', fontWeight: '600' }}>Coordenada</div><div>{l.parsed.coord || '(vazio)'}</div>
                      <div style={{ color: '#64748b', fontWeight: '600' }}>Foto</div><div>{l.parsed.foto || '(vazio)'}</div>
                      <div style={{ color: '#64748b', fontWeight: '600' }}>Transformador</div><div>{l.parsed.equip || '(vazio)'}</div>
                      <div style={{ color: '#64748b', fontWeight: '600' }}>Tipo</div><div>{l.parsed.tipo || '(vazio)'}</div>
                      <div style={{ color: '#64748b', fontWeight: '600' }}>Nº Serviço</div><div>{l.parsed.numServ || '(vazio)'}</div>
                      <div style={{ color: '#64748b', fontWeight: '600' }}>Técnico Orig.</div><div>{l.parsed.orig || '(vazio)'}</div>
                      <div style={{ color: '#64748b', fontWeight: '600' }}>ID gerado</div><div><strong style={{ color: '#0f2544' }}>{l.parsed.id || '—'}</strong></div>
                    </div>
                    {(!l.isValido || l.avisos.length > 0) && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${l.isValido ? '#e2e8f0' : '#fecaca'}` }}>
                        {l.erros.length > 0 && (
                          <div style={{ color: '#b91c1c', fontSize: '13px' }}>
                            <div style={{ fontWeight: '700', marginBottom: '4px' }}>⚠️ Erros:</div>
                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                              {l.erros.map((err, idx) => <li key={idx}>{err}</li>)}
                            </ul>
                          </div>
                        )}
                        {l.avisos.length > 0 && (
                          <div style={{ color: '#92400e', fontSize: '13px', marginTop: l.erros.length > 0 ? '8px' : '0' }}>
                            <div style={{ fontWeight: '700', marginBottom: '4px' }}>ℹ️ Avisos:</div>
                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                              {l.avisos.map((aviso, idx) => <li key={idx}>{aviso}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!mostrarTodos && linhas.length > 10 && (
              <button onClick={() => setMostrarTodos(true)} style={{ marginTop: '16px', padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                Ver todos os {linhas.length} registros
              </button>
            )}
          </div>

          {/* SEÇÃO DE ERROS GERAIS */}
          {errosGerais.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#b91c1c', marginBottom: '12px' }}>
                ⚠️ {errosGerais.length} registros com problema serão ignorados:
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#b91c1c', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {errosGerais.map((eg, i) => (
                  <li key={i}>
                    <strong>Linha {eg.linha}:</strong> {eg.erros.join(' / ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* RODAPÉ DO MODAL */}
        <div style={{ padding: '16px 24px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', flexShrink: 0 }}>
          <button onClick={onClose} style={BTN_CANCEL}>Cancelar</button>
          <button onClick={iniciarImportacao} disabled={estatisticas.validos === 0} style={{ ...BTN_PRIMARY, background: estatisticas.validos === 0 ? '#94a3b8' : '#0f2544', opacity: estatisticas.validos === 0 ? 0.6 : 1, cursor: estatisticas.validos === 0 ? 'not-allowed' : 'pointer' }}>
            Importar {estatisticas.validos} válidos →
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Distância (Haversine) ─────────────────────────────────────────────────────
const calcularDistancia = (coord1, coord2) => {
  if (!coord1 || !coord2) return Infinity;

  // Aceita vários formatos: "-18.517, -41.936" | "-18.517;-41.936" | "-18.517 -41.936"
  // Também vírgula como decimal no lugar do ponto: "-18,517;-41,936"
  const parseCoord = (raw) => {
    if (!raw) return null;
    // Normaliza: troca vírgula decimal por ponto SOMENTE quando usada dentro de números
    // Primeiro detecta o separador de lat/lon
    let str = String(raw).trim();

    // Tenta separar por ponto-e-vírgula primeiro
    let parts = str.split(';');
    if (parts.length !== 2) {
      // Tenta separar por vírgula: "-18.517, -41.936"
      // Precisa ter exatamente 2 partes após split por vírgula
      const byComma = str.split(',');
      if (byComma.length === 2) {
        parts = byComma;
      } else if (byComma.length === 4) {
        // Formato com vírgula decimal: "-18,517,-41,936" → partes = ["-18","517","-41","936"]
        // Reagrupa: "-18.517" e "-41.936"
        parts = [byComma[0] + '.' + byComma[1], byComma[2] + '.' + byComma[3]];
      } else {
        // Tenta separar por espaço
        const bySpace = str.trim().split(/\s+/);
        if (bySpace.length === 2) parts = bySpace;
        else return null;
      }
    }

    // Substitui vírgula decimal por ponto em cada parte
    const lat = parseFloat(parts[0].trim().replace(',', '.'));
    const lon = parseFloat(parts[1].trim().replace(',', '.'));
    if (isNaN(lat) || isNaN(lon)) return null;
    return { lat, lon };
  };

  const p1 = parseCoord(coord1);
  const p2 = parseCoord(coord2);
  if (!p1 || !p2) return Infinity;

  const R = 6371; // km
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLon = (p2.lon - p1.lon) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ── Componente principal ──────────────────────────────────────────────────────
const ServicosTable = () => {
  const { user } = useAuth();
  const isDono = user?.role === 'dono';

  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [tipoFilter, setTipoFilter] = useState([]);
  const [localidadeFilter, setLocalidadeFilter] = useState('');
  const [postoFilter, setPostoFilter] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [placaFilter, setPlacaFilter] = useState('todos');
  const [enviadoSupFilter, setEnviadoSupFilter] = useState('todos');
  const [sortCol, setSortCol] = useState('id');
  const [sortDir, setSortDir] = useState('desc');
  // ── Filtro por proximidade
  const [servicoReferencia, setServicoReferencia] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [importPopupOpen, setImportPopupOpen] = useState(false);
  // ── [NOVO] Despacho ──
  const [selecionados, setSelecionados] = useState(new Set());
  const [tecnicos, setTecnicos] = useState([]);
  const [despacharOpen, setDespacharOpen] = useState(false);
  const [despacharLoading, setDespacharLoading] = useState(false);

  const [confirmPending, setConfirmPending] = useState(null);
  const [numServPending, setNumServPending] = useState(null);
  const [statusDonoPending, setStatusDonoPending] = useState(null);
  const [mensagemCemigServico, setMensagemCemigServico] = useState(null);
  const [cancelPending, setCancelPending] = useState(null);
  const [reprovadoPending, setReprovadoPending] = useState(null);
  const [alterarLocalPending, setAlterarLocalPending] = useState(null);
  const [concluirMenu, setConcluirMenu] = useState(null);

  useEffect(() => {
    const handleScrollOrClick = (e) => {
      if (!concluirMenu) return;
      const isClickInside = e.target.closest('#concluir-floating-menu');
      const isTrigger = e.target.closest('.btn-concluir-trigger');
      if (e.type === 'scroll' || (!isClickInside && !isTrigger)) {
        setConcluirMenu(null);
      }
    };
    window.addEventListener('scroll', handleScrollOrClick, true);
    window.addEventListener('mousedown', handleScrollOrClick);
    return () => {
      window.removeEventListener('scroll', handleScrollOrClick, true);
      window.removeEventListener('mousedown', handleScrollOrClick);
    };
  }, [concluirMenu]);

  useEffect(() => {
    const carregar = async () => {
      const { data } = await supabase.from('servicos').select('*');
      if (data) setServices(data.map(d => ({ ...d, _docId: d.id })));
    };
    carregar();
    const channel = supabase.channel('servicos_table')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, carregar)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    const fetchTecnicos = async () => {
      if (isDono || user?.role === 'despachante') {
        const { data } = await supabase.from('usuarios').select('*').eq('role', 'tecnico').eq('ativo', true);
        if (data) setTecnicos(data.sort((a, b) => a.nome.localeCompare(b.nome)));
      }
    };
    fetchTecnicos();
  }, [isDono, user]);

  useEffect(() => { setCurrentPage(1); }, [busca, statusFilter, tipoFilter, localidadeFilter, postoFilter, dataInicio, dataFim, placaFilter, enviadoSupFilter, sortCol, sortDir]);

  useEffect(() => {
    let lista = [...services];

    if (busca.trim()) {
      const raw = busca.trim();
      const temVirgula = /[,;]/.test(raw);
      if (temVirgula) {
        const termos = raw.split(/[,;\n]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
        lista = lista.filter(s => termos.some(t => (s.numServ || '').toLowerCase().includes(t) || (s.id || '').toLowerCase() === t));
      } else {
        const terms = raw.toLowerCase().split(/\s+/);
        lista = lista.filter(s => {
          const haystack = [s.id, s.numServ, s.local, s.desc, s.equip, s.orig, s.tipo, s.obs, s.obsCancelamento].join(' ').toLowerCase();
          return terms.every(t => haystack.includes(t));
        });
      }
    }

    if (localidadeFilter) lista = lista.filter(s => normStr(s.local || '') === normStr(localidadeFilter));
    if (postoFilter.length > 0) {
      const locsDosPostos = postoFilter.flatMap(p => POSTOS[p] || []).map(l => normStr(l));
      lista = lista.filter(s => locsDosPostos.includes(normStr(s.local || '')));
    }
    if (dataInicio) {
      const ini = new Date(dataInicio + 'T00:00:00');
      lista = lista.filter(s => { const dt = s.data ? new Date(s.data) : null; return dt && dt >= ini; });
    }
    if (dataFim) {
      const fim = new Date(dataFim + 'T23:59:59');
      lista = lista.filter(s => { const dt = s.data ? new Date(s.data) : null; return dt && dt <= fim; });
    }
    if (statusFilter.length > 0) {
      lista = lista.filter(s => statusFilter.includes(s.status));
    } else {
      lista = lista.filter(s => s.status !== 'cancelado' && s.status !== 'reprovado');
    }
    if (tipoFilter.length > 0) lista = lista.filter(s => tipoFilter.includes(s.tipo));

    // Filtro placa montada
    if (placaFilter === 'montada') lista = lista.filter(s => s.placaMontada === true);
    if (placaFilter === 'nao_montada') lista = lista.filter(s => !s.placaMontada);

    // Filtro placa enviada ao supervisor
    if (enviadoSupFilter === 'sim') lista = lista.filter(s => s.enviadoSupervisor === true);
    if (enviadoSupFilter === 'nao') lista = lista.filter(s => s.placaMontada && !s.enviadoSupervisor);

    if (servicoReferencia) {
      lista.forEach(s => {
        s._distancia = calcularDistancia(servicoReferencia.coord, s.coord);
      });
      lista.sort((a, b) => a._distancia - b._distancia);
    } else {
      lista.sort((a, b) => {
        let va, vb;
        if (sortCol === 'id') { va = idNum(a.id); vb = idNum(b.id); }
        else if (sortCol === 'dtCadastro' || sortCol === 'data') {
          va = a[sortCol]?.seconds ?? (a[sortCol] ? new Date(a[sortCol]).getTime() / 1000 : 0);
          vb = b[sortCol]?.seconds ?? (b[sortCol] ? new Date(b[sortCol]).getTime() / 1000 : 0);
        } else if (sortCol === 'status') { va = STATUS_ORDER.indexOf(a.status); vb = STATUS_ORDER.indexOf(b.status); }
        else { va = (a[sortCol] || '').toString().toLowerCase(); vb = (b[sortCol] || '').toString().toLowerCase(); }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredServices(lista);
  }, [services, busca, statusFilter, tipoFilter, localidadeFilter, postoFilter, dataInicio, dataFim, placaFilter, enviadoSupFilter, sortCol, sortDir, servicoReferencia]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const pageServices = filteredServices.slice(pageStart, pageEnd);

  const visiblePages = (() => {
    const pages = [];
    for (let i = Math.max(1, safePage - 3); i <= Math.min(totalPages, safePage + 3); i++) pages.push(i);
    return pages;
  })();

  // ── Ações Firebase ────────────────────────────────────────────────────────
  const atualizarStatus = async (docId, novoStatus, mensagem, extra = {}) => {
    try {
      const atual = services.find(s => s._docId === docId);
      await supabase.from('servicos').update({
        status: novoStatus, ...extra,
        hist: [...(atual?.hist || []), { who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: mensagem }]
      }).eq('id', docId);
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
    await supabase.from('servicos').update({
      numServ: num,
      hist: [...(s.hist || []), { who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: `Nº CEMIG registrado: ${num}` }]
    }).eq('id', s._docId);
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
    await atualizarStatus(s._docId, 'cancelado', `Cancelado — Motivo: ${motivo}`, { obsCancelamento: motivo });
    setCancelPending(null);
  };

  const confirmarReprovado = async (motivo) => {
    const s = reprovadoPending;
    await atualizarStatus(s._docId, 'reprovado', `Serviço reprovado: ${motivo}`, { motivoReprovacao: motivo });
    setReprovadoPending(null);
  };

  const confirmarLocalidade = async (novaLocal) => {
    const s = alterarLocalPending;
    try {
      await supabase.from('servicos').update({
        local: novaLocal,
        hist: [...(s.hist || []), { who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: `Localidade alterada de "${s.local}" para "${novaLocal}"` }]
      }).eq('id', s._docId);
    } catch { alert('Erro ao atualizar localidade.'); }
    setAlterarLocalPending(null);
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.25, marginLeft: '3px', fontSize: '9px' }}>↕</span>;
    return <span style={{ marginLeft: '3px', fontSize: '9px', color: '#1d4ed8' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const thBase = {
    textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: '700',
    padding: '10px 12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc',
    whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase', userSelect: 'none',
  };
  const thClick = (col) => ({ ...thBase, cursor: col ? 'pointer' : 'default' });
  const td = {
    padding: '10px 12px', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle',
    fontSize: '12px', color: '#334155', whiteSpace: 'nowrap',
    overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px',
  };

  const statusOptions = STATUS_ORDER.map(s => ({ value: s, label: STATUS_CONFIG[s].label, badge: STATUS_CONFIG[s] }));
  const tipoOptions = ['NSIS', 'NSMP', 'RC02', 'INBE', 'NSCP'].map(t => ({ value: t, label: t }));
  const postoOptions = Object.keys(POSTOS).map(p => ({ value: p, label: p.split('—')[1]?.trim() || p }));

  // Contagens para o filtro de placa
  const totalPlacas = filteredServices.filter(s => {
    const n = (s.desc || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return n.includes('PLACA');
  });
  const qtdMontadas = services.filter(s => s.placaMontada === true && s.status !== 'cancelado').length;
  const qtdNaoMontadas = services.filter(s => !s.placaMontada && s.status !== 'cancelado').length;

  const temFiltroAtivo = statusFilter.length > 0 || tipoFilter.length > 0 || busca || localidadeFilter || postoFilter.length > 0 || dataInicio || dataFim || placaFilter !== 'todos' || enviadoSupFilter !== 'todos';

  // Há serviços com placa montada no conjunto filtrado? (para exibir filtro de supervisor)
  const temPlacaMontadaFiltrada = filteredServices.some(s => s.placaMontada === true);

  const toggleSelection = (id) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selecionados.size === pageServices.length && pageServices.length > 0) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(pageServices.map(s => s._docId)));
    }
  };

  const despacharSelecionados = async (tecnico) => {
    if (selecionados.size === 0) return;
    setDespacharLoading(true);
    try {
      const ids = Array.from(selecionados);
      const updates = ids.map(id => {
        const atual = services.find(s => s._docId === id);
        return supabase.from('servicos').update({
          atribuido_para: {
            uid: tecnico.uid,
            nome: tecnico.nome,
            matricula: tecnico.matricula,
            equipe: tecnico.equipe
          },
          dtAtribuicao: new Date().toISOString(),
          hist: [...(atual?.hist || []), { who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: `Atribuído para o técnico ${tecnico.nome}` }]
        }).eq('id', id);
      });
      await Promise.all(updates);
      setSelecionados(new Set());
      setDespacharOpen(false);
    } catch {
      alert('Erro ao despachar.');
    } finally {
      setDespacharLoading(false);
    }
  };

  return (
    <div>
      {/* Popups */}
      {importPopupOpen && <ImportPopup onClose={() => setImportPopupOpen(false)} onSuccess={() => setImportPopupOpen(false)} />}
      {confirmPending && <ConfirmPopup servico={confirmPending.servico} novoStatus={confirmPending.novoStatus} onConfirm={confirmarStatus} onCancel={() => setConfirmPending(null)} />}
      {numServPending && <NumServPopup servico={numServPending} onConfirm={confirmarNumServ} onCancel={() => setNumServPending(null)} />}
      {statusDonoPending && <StatusDonoPopup servico={statusDonoPending} onConfirm={confirmarStatusDono} onCancel={() => setStatusDonoPending(null)} />}
      {mensagemCemigServico && <MensagemCemigPopup servico={mensagemCemigServico} onClose={() => setMensagemCemigServico(null)} />}
      {cancelPending && <CancelPopup servico={cancelPending} onConfirm={confirmarCancelamento} onCancel={() => setCancelPending(null)} />}
      {reprovadoPending && <ReprovadoPopup servico={reprovadoPending} onConfirm={confirmarReprovado} onCancel={() => setReprovadoPending(null)} />}

      {/* ── Banner de Proximidade ── */}
      {servicoReferencia && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#15803d' }}>Exibindo serviços ordenados por proximidade</div>
              <div style={{ fontSize: '12px', color: '#166534', marginTop: '2px' }}>Referência: <strong>{servicoReferencia.id}</strong> (Coordenadas: {servicoReferencia.coord})</div>
            </div>
          </div>
          <button onClick={() => setServicoReferencia(null)} style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', color: '#15803d', cursor: 'pointer' }}>
            Limpar Filtro
          </button>
        </div>
      )}

      {/* ── Filtros ── */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '14px 16px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Filtros</div>

        {/* Linha 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', alignItems: 'end', marginBottom: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Busca — palavra-chave ou nº serviços (vírgula)</label>
            <div style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="ID, localidade, descrição, equipamento..."
                value={busca} onChange={e => setBusca(e.target.value)} style={{ ...inputStyle, paddingLeft: '30px' }} />
            </div>
            {/[,;]/.test(busca) && busca.trim() && (() => {
              const termos = busca.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
              return termos.length > 0 ? (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {termos.map(t => <span key={t} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '20px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: '600' }}>{t}</span>)}
                </div>
              ) : null;
            })()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Status</label>
            <MultiSelect options={statusOptions} selected={statusFilter} onChange={setStatusFilter} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Tipo</label>
            <MultiSelect options={tipoOptions} selected={tipoFilter} onChange={setTipoFilter} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Posto</label>
            <MultiSelect options={postoOptions} selected={postoFilter} onChange={(val) => { setPostoFilter(val); setLocalidadeFilter(''); }} />
          </div>
        </div>

        {/* Linha 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', alignItems: 'end', marginBottom: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Localidade
              {postoFilter.length > 0 && <span style={{ marginLeft: '6px', color: '#7c3aed', fontWeight: '700' }}>({postoFilter.map(p => p.split('—')[0].trim()).join(', ')})</span>}
            </label>
            <LocalidadeSelect value={localidadeFilter} onChange={setLocalidadeFilter} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>De</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Até</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Linha 3 — Filtros de placa */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {/* Filtro placa montada */}
          <div>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Placa montada
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { key: 'todos', label: 'Todos' },
                { key: 'montada', label: 'Montada', cor: '#15803d' },
                { key: 'nao_montada', label: 'Não montada', cor: '#c2410c' },
              ].map(({ key, label, cor }) => {
                const ativo = placaFilter === key;
                const corBase = cor || '#475569';
                return (
                  <button key={key} onClick={() => setPlacaFilter(key)} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '5px 14px', borderRadius: '7px', cursor: 'pointer', fontFamily: 'inherit',
                    border: ativo ? `2px solid ${corBase}` : '1px solid #e2e8f0',
                    background: ativo ? `${corBase}10` : '#f8fafc',
                    color: ativo ? corBase : '#64748b',
                    fontSize: '11px', fontWeight: ativo ? '700' : '500',
                    transition: 'all 0.12s',
                  }}>
                    {key === 'montada' && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><polyline points="9 12 11 14 15 10" />
                      </svg>
                    )}
                    {key === 'nao_montada' && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                    )}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtro placa enviada ao supervisor — exibido somente se há placas montadas no conjunto */}
          {temPlacaMontadaFiltrada && (
            <div>
              <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Placa enviada ao supervisor
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { key: 'todos', label: 'Todos' },
                  { key: 'sim', label: 'Sim', cor: '#7c3aed' },
                  { key: 'nao', label: 'Não', cor: '#c2410c' },
                ].map(({ key, label, cor }) => {
                  const ativo = enviadoSupFilter === key;
                  const corBase = cor || '#475569';
                  return (
                    <button key={key} onClick={() => setEnviadoSupFilter(key)} style={{
                      padding: '5px 14px', borderRadius: '7px', cursor: 'pointer', fontFamily: 'inherit',
                      border: ativo ? `2px solid ${corBase}` : '1px solid #e2e8f0',
                      background: ativo ? `${corBase}10` : '#f8fafc',
                      color: ativo ? corBase : '#64748b',
                      fontSize: '11px', fontWeight: ativo ? '700' : '500',
                      transition: 'all 0.12s',
                    }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabela ── */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f2544' }}>Lista de Serviços</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {temFiltroAtivo && (
              <button onClick={() => { setStatusFilter([]); setTipoFilter([]); setBusca(''); setLocalidadeFilter(''); setPostoFilter([]); setDataInicio(''); setDataFim(''); setPlacaFilter('todos'); setEnviadoSupFilter('todos'); }}
                style={{ fontSize: '11px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                Limpar filtros
              </button>
            )}
            <button onClick={() => setImportPopupOpen(true)} title="Importar dados de arquivo CSV/Excel"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', fontFamily: 'inherit', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.borderColor = '#93c5fd'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Importar
            </button>
            <button onClick={() => exportarExcel(filteredServices)} title={`Exportar ${filteredServices.length} registros`}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', fontFamily: 'inherit', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.borderColor = '#86efac'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar Excel
            </button>
            <div style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', borderRadius: '20px', padding: '3px 10px', fontWeight: '500' }}>
              {filteredServices.length} {filteredServices.length === 1 ? 'registro' : 'registros'}
            </div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <colgroup>
            <col style={{ width: '38px' }} />
            <col style={{ width: '44px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '80px' }} />
            <col style={{ width: '130px' }} />
            <col style={{ width: '140px' }} />
            <col style={{ width: '200px' }} />
            <col style={{ width: '72px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '140px' }} />
            <col style={{ width: '150px' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selecionados.size > 0 && selecionados.size === pageServices.length}
                  onChange={toggleAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={thBase}>Ações</th>
              <th style={{ ...thBase, textAlign: 'center' }} title="Placa: verde = montada · roxo = enviada ao supervisor">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </svg>
                  <span style={{ fontSize: '8px', letterSpacing: '0.03em' }}>PLACA</span>
                </div>
              </th>
              <th style={thClick('id')} onClick={() => toggleSort('id')}>ID <SortIcon col="id" /></th>
              <th style={thClick('data')} onClick={() => toggleSort('data')}>Data <SortIcon col="data" /></th>
              <th style={thClick('local')} onClick={() => toggleSort('local')}>Localidade <SortIcon col="local" /></th>
              <th style={thClick('desc')} onClick={() => toggleSort('desc')}>Descrição <SortIcon col="desc" /></th>
              <th style={thClick('tipo')} onClick={() => toggleSort('tipo')}>Tipo <SortIcon col="tipo" /></th>
              <th style={thClick('equip')} onClick={() => toggleSort('equip')}>Equipamento <SortIcon col="equip" /></th>
              <th style={thClick('status')} onClick={() => toggleSort('status')}>Status <SortIcon col="status" /></th>
              <th style={thClick('numServ')} onClick={() => toggleSort('numServ')}>Nº Serviço <SortIcon col="numServ" /></th>
              <th style={thBase}>Atribuído para</th>
            </tr>
          </thead>
          <tbody>
            {pageServices.map((s, i) => {
              const nextInfo = NEXT_STATUS[s.status];
              const placaMontada = s.placaMontada === true;
              const enviadoSup = s.enviadoSupervisor === true;
              const globalIdx = pageStart + i;

              // Aparência do checkbox de placa:
              // · Não montada  → quadrado vazio cinza
              // · Montada, não enviada → quadrado verde com check
              // · Montada + enviada ao supervisor → quadrado roxo com check
              const placaColor = !placaMontada ? '#cbd5e1' : enviadoSup ? '#7c3aed' : '#15803d';
              const placaBg = !placaMontada ? 'transparent' : enviadoSup ? '#faf5ff' : '#f0fdf4';
              const placaBorder = !placaMontada ? '#cbd5e1' : enviadoSup ? '#ddd6fe' : '#bbf7d0';
              const placaTip = !placaMontada ? 'Placa não montada' : enviadoSup ? 'Placa montada · Enviada ao supervisor' : 'Placa montada';

              return (
                <tr key={s._docId} style={{
                  opacity: (s.status === 'cancelado' || s.status === 'reprovado') ? 0.5 : 1,
                  textDecoration: (s.status === 'cancelado' || s.status === 'reprovado') ? 'line-through' : 'none',
                  background: globalIdx % 2 === 0 ? '#fff' : '#fafbfc', transition: 'background 0.1s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0f7ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = globalIdx % 2 === 0 ? '#fff' : '#fafbfc'; }}
                  onClick={() => { if (concluirMenu) setConcluirMenu(null); }}
                >
                  {/* Seleção */}
                  <td style={{ ...td, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selecionados.has(s._docId)}
                      onChange={(e) => { e.stopPropagation(); toggleSelection(s._docId); }}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>

                  {/* ── Ações consolidadas em um único td ── */}
                  <td style={{ ...td, padding: '6px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>

                      {/* Ver detalhes */}
                      <button onClick={() => { setSelectedService(s); setModalOpen(true); }} title="Ver detalhes"
                        style={{ width: '28px', height: '28px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#e0f2fe'; e.currentTarget.style.borderColor = '#7dd3fc'; e.currentTarget.style.color = '#0369a1'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>

                      {/* Mais próximos */}
                      <button onClick={() => setServicoReferencia(s)} title="Buscar mais próximos a este"
                        style={{ width: '28px', height: '28px', border: servicoReferencia?._docId === s._docId ? '1.5px solid #15803d' : '1px solid #bbf7d0', borderRadius: '6px', background: servicoReferencia?._docId === s._docId ? '#dcfce7' : '#f0fdf4', color: '#15803d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.borderColor = '#86efac'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = servicoReferencia?._docId === s._docId ? '#dcfce7' : '#f0fdf4'; e.currentTarget.style.borderColor = servicoReferencia?._docId === s._docId ? '#15803d' : '#bbf7d0'; }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                      </button>

                      {/* Alterar status (Dono) */}
                      {isDono && (
                        <button onClick={() => setStatusDonoPending(s)} title="Alterar status (Dono)"
                          style={{ width: '28px', height: '28px', border: '1px solid #fde68a', borderRadius: '6px', background: '#fffbeb', color: '#92400e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.borderColor = '#fbbf24'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fffbeb'; e.currentTarget.style.borderColor = '#fde68a'; }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}

                      {/* Cancelar */}
                      {isDono && s.status !== 'cancelado' && (
                        <button onClick={() => setCancelPending(s)} title="Cancelar serviço"
                          style={{ width: '28px', height: '28px', border: '1px solid #fecaca', borderRadius: '6px', background: '#fef2f2', color: '#b91c1c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>

                  {/* ── [NOVO] Checkbox de placa — verde = montada, roxo = enviada ao supervisor ── */}
                  <td style={{ ...td, textAlign: 'center', padding: '10px 6px' }}>
                    <span title={placaTip} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '5px', border: `1.5px solid ${placaBorder}`, background: placaBg, transition: 'all 0.15s', flexShrink: 0 }}>
                      {placaMontada && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={placaColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  </td>

                  <td style={td}><span style={{ fontWeight: '700', color: '#0f2544' }}>{s.id}</span></td>
                  <td style={{ ...td, color: '#64748b' }}>{fmtDt(s.data)}</td>
                  <td style={td}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.local}>
                      {s.local}
                    </div>
                    {servicoReferencia && s._distancia !== undefined && (
                      <div style={{ fontSize: '10px', color: '#15803d', fontWeight: '600', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path></svg>
                        {s._distancia === Infinity ? 'Sem coord.' : s._distancia === 0 ? 'Ref.' : `${s._distancia.toFixed(2)} km`}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.desc}>
                      {s.desc}
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', letterSpacing: '0.04em' }}>
                      {s.tipo}
                    </span>
                  </td>
                  <td style={{ ...td, color: '#64748b' }}>{s.equip || '—'}</td>
                  <td style={td}><Badge status={s.status} /></td>

                  {/* Nº serviço */}
                  <td style={td}>
                    <button onClick={() => setNumServPending(s)} title="Editar Nº do serviço"
                      style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', color: s.numServ ? '#0f2544' : '#94a3b8', fontSize: '12px', fontFamily: 'inherit', fontWeight: s.numServ ? '600' : '400', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#1d4ed8'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = s.numServ ? '#0f2544' : '#94a3b8'; }}>
                      {s.numServ || '—'}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </td>

                  {/* Atribuído para */}
                  <td style={td}>
                    {s.atribuido_para ? (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#1d4ed8', fontWeight: '600', fontSize: '11px' }}>
                          {s.atribuido_para.nome} — {s.atribuido_para.matricula}
                        </span>
                        {s.atribuido_para.equipe && <span style={{ color: '#94a3b8', fontSize: '10px' }}>{s.atribuido_para.equipe}</span>}
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' }}>Não atribuído</span>
                    )}
                  </td>

                  {/* Ação de avanço */}
                  <td style={{ ...td, position: 'relative' }}>
                    {nextInfo && s.status !== 'cancelado' && s.status !== 'reprovado' && (
                      nextInfo.next === 'concluido' ? (
                        <div style={{ display: 'inline-block' }}>
                          <button
                            className="btn-concluir-trigger"
                            onClick={(e) => {
                              if (concluirMenu?.id === s._docId) {
                                setConcluirMenu(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setConcluirMenu({ id: s._docId, x: rect.left, y: rect.bottom + 4, step: 'opcoes', servico: s, nextInfo });
                              }
                            }}
                            style={{ fontSize: '11px', padding: '4px 10px', border: `1px solid ${nextInfo.color}22`, borderRadius: '6px', background: `${nextInfo.color}0d`, color: nextInfo.color, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: '500', fontFamily: 'inherit', transition: 'all 0.1s', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onMouseEnter={e => { e.currentTarget.style.background = `${nextInfo.color}1a`; e.currentTarget.style.borderColor = `${nextInfo.color}44`; }}
                            onMouseLeave={e => { e.currentTarget.style.background = `${nextInfo.color}0d`; e.currentTarget.style.borderColor = `${nextInfo.color}22`; }}>
                            {nextInfo.label}
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: concluirMenu?.id === s._docId ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9" /></svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmPending({ servico: s, novoStatus: nextInfo.next, mensagem: nextInfo.msg })}
                          style={{ fontSize: '11px', padding: '4px 10px', border: `1px solid ${nextInfo.color}22`, borderRadius: '6px', background: `${nextInfo.color}0d`, color: nextInfo.color, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: '500', fontFamily: 'inherit', transition: 'all 0.1s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = `${nextInfo.color}1a`; e.currentTarget.style.borderColor = `${nextInfo.color}44`; }}
                          onMouseLeave={e => { e.currentTarget.style.background = `${nextInfo.color}0d`; e.currentTarget.style.borderColor = `${nextInfo.color}22`; }}>
                          {nextInfo.label}
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredServices.length === 0 && (
              <tr>
                <td colSpan={14} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '13px' }}>
                  Nenhum serviço encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Paginação */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc', borderRadius: '0 0 12px 12px' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Exibindo <strong style={{ color: '#0f2544' }}>{pageStart + 1}–{Math.min(pageEnd, filteredServices.length)}</strong> de <strong style={{ color: '#0f2544' }}>{filteredServices.length}</strong> registros
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                style={{ width: '30px', height: '30px', border: '1px solid #e2e8f0', borderRadius: '7px', background: safePage === 1 ? '#f8fafc' : '#fff', color: safePage === 1 ? '#cbd5e1' : '#475569', cursor: safePage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              {visiblePages[0] > 1 && (
                <>
                  <button onClick={() => setCurrentPage(1)} style={{ minWidth: '30px', height: '30px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', fontWeight: '500', padding: '0 6px' }}>1</button>
                  {visiblePages[0] > 2 && <span style={{ color: '#94a3b8', fontSize: '12px', padding: '0 2px' }}>…</span>}
                </>
              )}
              {visiblePages.map(p => (
                <button key={p} onClick={() => setCurrentPage(p)}
                  style={{ minWidth: '30px', height: '30px', borderRadius: '7px', fontFamily: 'inherit', fontSize: '12px', padding: '0 6px', cursor: 'pointer', fontWeight: p === safePage ? '700' : '500', border: p === safePage ? '2px solid #1d4ed8' : '1px solid #e2e8f0', background: p === safePage ? '#eff6ff' : '#fff', color: p === safePage ? '#1d4ed8' : '#475569' }}>
                  {p}
                </button>
              ))}
              {visiblePages[visiblePages.length - 1] < totalPages && (
                <>
                  {visiblePages[visiblePages.length - 1] < totalPages - 1 && <span style={{ color: '#94a3b8', fontSize: '12px', padding: '0 2px' }}>…</span>}
                  <button onClick={() => setCurrentPage(totalPages)} style={{ minWidth: '30px', height: '30px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', fontWeight: '500', padding: '0 6px' }}>{totalPages}</button>
                </>
              )}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                style={{ width: '30px', height: '30px', border: '1px solid #e2e8f0', borderRadius: '7px', background: safePage === totalPages ? '#f8fafc' : '#fff', color: safePage === totalPages ? '#cbd5e1' : '#475569', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <DetalheModal
        service={selectedService}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        isDono={isDono}
      />

      {concluirMenu && (
        <div id="concluir-floating-menu" style={{
          position: 'fixed',
          top: concluirMenu.y,
          left: concluirMenu.x,
          zIndex: 9999,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          minWidth: '180px',
          overflow: 'hidden',
          animation: 'popIn 0.15s ease'
        }}>
          {concluirMenu.step === 'opcoes' ? (
            <>
              <button
                onClick={() => {
                  setConcluirMenu(null);
                  setConfirmPending({ servico: concluirMenu.servico, novoStatus: 'concluido', mensagem: 'Serviço concluído' });
                }}
                style={{ width: '100%', padding: '10px 14px', border: 'none', borderBottom: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit', fontSize: '12px', color: '#15803d', fontWeight: '600', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                Executado
              </button>
              <button
                onClick={() => {
                  setConcluirMenu(prev => ({ ...prev, step: 'motivo', motivo: '' }));
                }}
                style={{ width: '100%', padding: '10px 14px', border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit', fontSize: '12px', color: '#dc2626', fontWeight: '600', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
                Reprovado
              </button>
            </>
          ) : (
            <div style={{ padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
                Motivo da reprovação
              </div>
              <textarea
                autoFocus
                value={concluirMenu.motivo || ''}
                onChange={e => setConcluirMenu(prev => ({ ...prev, motivo: e.target.value }))}
                placeholder="Descreva o motivo..."
                rows={3}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', resize: 'vertical', outline: 'none', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setConcluirMenu(null)} style={{ flex: 1, padding: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px', color: '#64748b', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
                <button
                  onClick={() => {
                    if (!concluirMenu.motivo?.trim()) return;
                    atualizarStatus(concluirMenu.id, 'reprovado', `Serviço reprovado: ${concluirMenu.motivo.trim()}`, { motivoReprovacao: concluirMenu.motivo.trim() });
                    setConcluirMenu(null);
                  }}
                  disabled={!concluirMenu.motivo?.trim()}
                  style={{ flex: 1, padding: '6px', background: concluirMenu.motivo?.trim() ? '#dc2626' : '#fca5a5', border: 'none', borderRadius: '6px', fontSize: '11px', color: '#fff', cursor: concluirMenu.motivo?.trim() ? 'pointer' : 'not-allowed', fontWeight: '600' }}>
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barra Flutuante de Despacho */}
      {selecionados.size > 0 && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 400,
          background: '#0f2544', color: '#fff', padding: '12px 24px', borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(15,37,68,0.3)', display: 'flex', alignItems: 'center', gap: '20px',
          animation: 'popIn 0.2s ease', border: '1px solid #1e3a8a'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600' }}>
            {selecionados.size} serviço(s) selecionado(s)
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDespacharOpen(!despacharOpen)}
              disabled={despacharLoading}
              style={{
                background: '#1d4ed8', border: 'none', padding: '8px 16px', borderRadius: '8px',
                color: '#fff', fontWeight: '600', fontSize: '13px', cursor: despacharLoading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit',
                opacity: despacharLoading ? 0.7 : 1
              }}
            >
              {despacharLoading ? (
                <span>Aguarde...</span>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M22 2L11 13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Despachar
                </>
              )}
            </button>

            {despacharOpen && !despacharLoading && (
              <div style={{
                position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px',
                background: '#fff', borderRadius: '12px', padding: '8px', minWidth: '240px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0',
                color: '#334155', maxHeight: '300px', overflowY: 'auto'
              }}>
                <div style={{ padding: '8px', fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Selecionar Técnico
                </div>
                {tecnicos.length === 0 ? (
                  <div style={{ padding: '8px', fontSize: '13px', color: '#64748b' }}>Nenhum técnico disponível</div>
                ) : (
                  tecnicos.map(t => (
                    <button key={t.id} onClick={() => despacharSelecionados(t)} style={{
                      width: '100%', padding: '10px 12px', border: 'none', background: 'transparent',
                      textAlign: 'left', cursor: 'pointer', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'inherit'
                    }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f2544' }}>
                        {t.nome} — {t.matricula}
                      </div>
                      {t.equipe && (
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{t.equipe}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicosTable;
