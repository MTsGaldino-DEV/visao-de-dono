import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import DetalheModal from './DetalheModal';

const STATUS_CONFIG = {
  cadastrado: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Cadastrado' },
  enviado:    { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe', label: 'Enviado CEMIG' },
  pendente:   { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Pendente' },
  concluido:  { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Concluído' },
  cancelado:  { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Cancelado' },
};

// Fluxo sem montagem_pendente — isso vai para a aba Placas
const STATUS_ORDER = ['cadastrado', 'enviado', 'pendente', 'concluido', 'cancelado'];

const NEXT_STATUS = {
  cadastrado: { next: 'enviado',  msg: 'Enviado à CEMIG',       label: 'Enviar',   color: '#7c3aed' },
  enviado:    { next: 'pendente', msg: 'Número CEMIG recebido',  label: 'Nº CEMIG', color: '#c2410c' },
  pendente:   { next: 'concluido', msg: 'Serviço concluído',    label: 'Concluir', color: '#15803d' },
};

const fmtDt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Extrai número do ID para ordenação correta (VD0012 → 12)
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

// ── Popup confirmação de status (com campo Nº CEMIG quando aplicável) ────────
const ConfirmPopup = ({ servico, novoStatus, onConfirm, onCancel }) => {
  const cfg = STATUS_CONFIG[novoStatus] || {};
  // Se estiver avançando para "pendente" (ação "Nº CEMIG"), exibe campo para digitar o número
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

        {/* Badge do novo status */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', fontSize: '11px', padding: '4px 12px',
          borderRadius: '20px', fontWeight: '600', background: cfg.bg, color: cfg.color,
          border: `1px solid ${cfg.border}`, marginBottom: precisaNum ? '14px' : '22px',
        }}>{cfg.label}</div>

        {/* Campo Nº CEMIG — só aparece quando a ação é "Nº CEMIG" */}
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

// ── Popup Nº CEMIG standalone (edição avulsa pela célula da tabela) ──────────
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

// ── Popup status Dono ────────────────────────────────────────────────────────
const StatusDonoPopup = ({ servico, onConfirm, onCancel }) => {
  const [novoStatus, setNovoStatus] = useState(servico.status);
  return (
    <div style={POPUP_OVERLAY}>
      <div style={POPUP_BOX}>
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544', marginBottom: '6px' }}>Alterar status — Dono</div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
          Novo status para <strong style={{ color: '#0f2544' }}>{servico.id}</strong>:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '22px' }}>
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CONFIG[s];
            const ativo = novoStatus === s;
            return (
              <button key={s} onClick={() => setNovoStatus(s)} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px',
                borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
                border: ativo ? `2px solid ${cfg.color}` : '1px solid #e2e8f0',
                background: ativo ? cfg.bg : '#f8fafc', transition: 'all 0.1s',
              }}>
                <div style={{
                  width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
                  border: ativo ? `4px solid ${cfg.color}` : '2px solid #cbd5e1', transition: 'all 0.1s',
                }} />
                <span style={{ fontSize: '13px', fontWeight: ativo ? '600' : '400', color: ativo ? cfg.color : '#334155' }}>
                  {cfg.label}
                </span>
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

// ── Dropdown multi-select ────────────────────────────────────────────────────
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
          <polyline points="6 9 12 15 18 9"/>
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
            }}>
              Limpar seleção
            </button>
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
                  <span style={{
                    fontSize: '10px', padding: '2px 8px', borderRadius: '20px', fontWeight: '600',
                    background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                  }}>{label}</span>
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

import { useRef } from 'react';

// ── Componente principal ─────────────────────────────────────────────────────
const ServicosTable = () => {
  const { user } = useAuth();
  const isDono = user?.role === 'dono';

  const [services, setServices]               = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [modalOpen, setModalOpen]             = useState(false);
  const [busca, setBusca]                     = useState('');
  const [statusFilter, setStatusFilter]       = useState([]); // multi
  const [tipoFilter, setTipoFilter]           = useState([]); // multi
  const [sortCol, setSortCol]                 = useState('id');
  const [sortDir, setSortDir]                 = useState('desc'); // maior → menor por padrão

  const [confirmPending, setConfirmPending]       = useState(null);
  const [numServPending, setNumServPending]       = useState(null);
  const [statusDonoPending, setStatusDonoPending] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'servicos'), (snap) => {
      setServices(snap.docs.map(d => ({ ...d.data(), _docId: d.id })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let lista = [...services];

    // Busca: detecta se é lista de nº de serviço (vírgula/ponto-e-vírgula) ou palavra-chave geral
    if (busca.trim()) {
      const raw = busca.trim();
      const temVirgula = /[,;]/.test(raw);
      if (temVirgula) {
        // Modo lista: cada termo deve bater com numServ ou id exato
        const termos = raw.split(/[,;\n]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
        lista = lista.filter(s =>
          termos.some(t =>
            (s.numServ || '').toLowerCase().includes(t) ||
            (s.id || '').toLowerCase() === t
          )
        );
      } else {
        // Modo palavra-chave: busca em todos os campos
        const terms = raw.toLowerCase().split(/\s+/);
        lista = lista.filter(s => {
          const haystack = [s.id, s.numServ, s.local, s.desc, s.equip, s.orig, s.tipo, s.obs]
            .join(' ').toLowerCase();
          return terms.every(t => haystack.includes(t));
        });
      }
    }

    // Multi status
    if (statusFilter.length > 0) {
      lista = lista.filter(s => statusFilter.includes(s.status));
    } else {
      lista = lista.filter(s => s.status !== 'cancelado');
    }

    // Multi tipo
    if (tipoFilter.length > 0) {
      lista = lista.filter(s => tipoFilter.includes(s.tipo));
    }

    // Ordenação
    lista.sort((a, b) => {
      let va, vb;
      if (sortCol === 'id') {
        va = idNum(a.id); vb = idNum(b.id);
      } else if (sortCol === 'dtCadastro' || sortCol === 'data') {
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
  }, [services, busca, statusFilter, tipoFilter, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

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
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.25, marginLeft: '3px', fontSize: '9px' }}>↕</span>;
    return <span style={{ marginLeft: '3px', fontSize: '9px', color: '#1d4ed8' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const thBase = {
    textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: '700',
    padding: '10px 12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc',
    whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase',
    userSelect: 'none',
  };
  const thClick = (col) => ({ ...thBase, cursor: col ? 'pointer' : 'default' });

  const td = {
    padding: '10px 12px', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle',
    fontSize: '12px', color: '#334155', whiteSpace: 'nowrap',
    overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px',
  };

  const statusOptions = STATUS_ORDER.map(s => ({
    value: s, label: STATUS_CONFIG[s].label,
    badge: STATUS_CONFIG[s],
  }));
  const tipoOptions = ['NSIS','NSMP','RC02','INBE'].map(t => ({ value: t, label: t }));

  return (
    <div>
      {/* Popups */}
      {confirmPending    && <ConfirmPopup    servico={confirmPending.servico}    novoStatus={confirmPending.novoStatus} onConfirm={confirmarStatus}       onCancel={() => setConfirmPending(null)} />}
      {numServPending    && <NumServPopup    servico={numServPending}             onConfirm={confirmarNumServ}           onCancel={() => setNumServPending(null)} />}
      {statusDonoPending && <StatusDonoPopup servico={statusDonoPending}          onConfirm={confirmarStatusDono}        onCancel={() => setStatusDonoPending(null)} />}

      {/* Filtros */}
      <div style={{
        background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0',
        padding: '14px 16px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
          Filtros
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '10px', alignItems: 'end' }}>
          {/* Busca por palavra-chave ou múltiplos nº de serviço */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Busca — palavra-chave ou nº serviços (vírgula)</label>
            <div style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text"
                placeholder="ID, localidade, descrição, equipamento..."
                value={busca} onChange={e => setBusca(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '30px' }} />
            </div>
            {/* Badges quando modo lista */}
            {/[,;]/.test(busca) && busca.trim() && (() => {
              const termos = busca.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
              return termos.length > 0 ? (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {termos.map(t => (
                    <span key={t} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '20px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: '600' }}>
                      {t}
                    </span>
                  ))}
                </div>
              ) : null;
            })()}
          </div>

          {/* Multi status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Status</label>
            <MultiSelect options={statusOptions} selected={statusFilter} onChange={setStatusFilter} />
          </div>

          {/* Multi tipo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Tipo</label>
            <MultiSelect options={tipoOptions} selected={tipoFilter} onChange={setTipoFilter} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>De</label>
            <input type="date" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Até</label>
            <input type="date" style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div style={{
        overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f2544' }}>Lista de Serviços</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {(statusFilter.length > 0 || tipoFilter.length > 0 || busca) && (
              <button onClick={() => { setStatusFilter([]); setTipoFilter([]); setBusca(''); }}
                style={{ fontSize: '11px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                Limpar filtros
              </button>
            )}
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
              {/* Ícone placa */}
              <th style={{ ...thBase, width: '32px' }} title="Placa montada" />
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
            {filteredServices.map((s, i) => {
              const nextInfo = NEXT_STATUS[s.status];
              const placaMontada = s.placaMontada === true;
              return (
                <tr key={s._docId} style={{
                  opacity: s.status === 'cancelado' ? 0.4 : 1,
                  textDecoration: s.status === 'cancelado' ? 'line-through' : 'none',
                  background: i % 2 === 0 ? '#fff' : '#fafbfc', transition: 'background 0.1s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0f7ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafbfc'; }}
                >
                  {/* Ver detalhes */}
                  <td style={td}>
                    <button onClick={() => { setSelectedService(s); setModalOpen(true); }} title="Ver detalhes"
                      style={{ width: '26px', height: '26px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e0f2fe'; e.currentTarget.style.borderColor = '#7dd3fc'; e.currentTarget.style.color = '#0369a1'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                  </td>

                  {/* Alterar status — Dono */}
                  <td style={td}>
                    {isDono && (
                      <button onClick={() => setStatusDonoPending(s)} title="Alterar status (Dono)"
                        style={{ width: '26px', height: '26px', border: '1px solid #fde68a', borderRadius: '6px', background: '#fffbeb', color: '#92400e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.borderColor = '#fbbf24'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fffbeb'; e.currentTarget.style.borderColor = '#fde68a'; }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    )}
                  </td>

                  {/* Ícone placa montada — preenchido pela aba Placas no futuro */}
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span title={placaMontada ? 'Placa montada' : 'Placa não montada'} style={{ fontSize: '14px', opacity: placaMontada ? 1 : 0.2 }}>
                      {placaMontada ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 12 11 14 15 10"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                        </svg>
                      )}
                    </span>
                  </td>

                  <td style={td}><span style={{ fontWeight: '700', color: '#0f2544' }}>{s.id}</span></td>
                  <td style={{ ...td, color: '#64748b' }}>{fmtDt(s.data)}</td>
                  <td style={td}>{s.local}</td>
                  <td style={{ ...td, maxWidth: '220px' }}>{s.desc}</td>
                  <td style={td}>
                    <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', letterSpacing: '0.04em' }}>
                      {s.tipo}
                    </span>
                  </td>
                  <td style={{ ...td, color: '#64748b' }}>{s.equip || '—'}</td>
                  <td style={td}><Badge status={s.status} /></td>

                  {/* Nº serviço clicável */}
                  <td style={td}>
                    <button onClick={() => setNumServPending(s)} title="Editar Nº do serviço"
                      style={{
                        background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer',
                        color: s.numServ ? '#0f2544' : '#94a3b8', fontSize: '12px', fontFamily: 'inherit',
                        fontWeight: s.numServ ? '600' : '400', borderRadius: '4px',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#1d4ed8'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = s.numServ ? '#0f2544' : '#94a3b8'; }}
                    >
                      {s.numServ || '—'}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </td>

                  {/* Ação de avanço */}
                  <td style={td}>
                    {nextInfo && s.status !== 'cancelado' && (
                      <button
                        onClick={() => setConfirmPending({ servico: s, novoStatus: nextInfo.next, mensagem: nextInfo.msg })}
                        style={{
                          fontSize: '11px', padding: '4px 10px', border: `1px solid ${nextInfo.color}22`,
                          borderRadius: '6px', background: `${nextInfo.color}0d`, color: nextInfo.color,
                          cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: '500', fontFamily: 'inherit', transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${nextInfo.color}1a`; e.currentTarget.style.borderColor = `${nextInfo.color}44`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${nextInfo.color}0d`; e.currentTarget.style.borderColor = `${nextInfo.color}22`; }}
                      >
                        {nextInfo.label}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredServices.length === 0 && (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '13px' }}>
                  Nenhum serviço encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DetalheModal service={selectedService} isOpen={modalOpen} onClose={() => setModalOpen(false)} isDono={isDono} />
    </div>
  );
};

export default ServicosTable;