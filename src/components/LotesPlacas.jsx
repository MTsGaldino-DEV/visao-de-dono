import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────
const norm = (s) =>
  (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const fmtDt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('pt-BR') +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
};

// ── Status do lote ────────────────────────────────────────────────────────────
const LOTE_STATUS = {
  montado: {
    label: 'Montado',
    bg: '#eff6ff',
    color: '#1d4ed8',
    border: '#bfdbfe',
    next: 'enviado',
    nextLabel: 'Marcar como Enviado',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    ),
  },
  enviado: {
    label: 'Enviado',
    bg: '#faf5ff',
    color: '#7c3aed',
    border: '#ddd6fe',
    next: 'entregue',
    nextLabel: 'Marcar como Entregue',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    ),
  },
  entregue: {
    label: 'Entregue',
    bg: '#f0fdf4',
    color: '#15803d',
    border: '#bbf7d0',
    next: null,
    nextLabel: null,
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
};

// ── Estilos base ──────────────────────────────────────────────────────────────
const card = {
  background: '#fff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '12px',
  background: '#fff',
  color: '#1e293b',
  outline: 'none',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  boxSizing: 'border-box',
};

const th = {
  textAlign: 'left',
  fontSize: '10px',
  color: '#94a3b8',
  fontWeight: '700',
  padding: '9px 12px',
  borderBottom: '1px solid #f1f5f9',
  background: '#f8fafc',
  whiteSpace: 'nowrap',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const td = {
  padding: '10px 12px',
  borderBottom: '1px solid #f8fafc',
  verticalAlign: 'middle',
  fontSize: '12px',
  color: '#334155',
  whiteSpace: 'nowrap',
};

const labelUp = {
  fontSize: '10px',
  fontWeight: '700',
  color: '#94a3b8',
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  marginBottom: '5px',
  display: 'block',
};

// ── Badge de status ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = LOTE_STATUS[status] || LOTE_STATUS.montado;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '10px',
        fontWeight: '700',
        padding: '3px 10px',
        borderRadius: '20px',
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
};

// ── Modal de criação / visualização de lote ───────────────────────────────────
const LoteModal = ({ isOpen, onClose, lote, servicos, user, onSaved }) => {
  const [nome, setNome] = useState('');
  const [obs, setObs] = useState('');
  const [busca, setBusca] = useState('');
  const [placasSelecionadas, setPlacasSelecionadas] = useState([]); // array de _docIds
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avancoStatus, setAvancoStatus] = useState(false);
  const inputRef = useRef(null);

  const isEdit = !!lote;

  useEffect(() => {
    if (isOpen) {
      if (lote) {
        setNome(lote.nome || '');
        setObs(lote.obs || '');
        setPlacasSelecionadas(lote.placas || []);
      } else {
        setNome('');
        setObs('');
        setPlacasSelecionadas([]);
      }
      setBusca('');
      setSaved(false);
    }
  }, [isOpen, lote]);

  if (!isOpen) return null;

  // Placas montadas disponíveis (não canceladas, com desc PLACA, placaMontada e sem lote atribuído ou atribuído a este lote)
  const placasMontadas = servicos.filter(
    (s) =>
      s.status !== 'cancelado' &&
      norm(s.desc).includes('PLACA') &&
      s.placaMontada &&
      (!s.loteId || s.loteId === lote?.id)
  );

  // Resultados de busca — por equip, id ou numServ
  const termoBusca = busca.trim();
  const resultadosBusca =
    termoBusca.length >= 2
      ? placasMontadas.filter((s) => {
          const hay = [s.id, s.equip, s.numServ, s.local]
            .join(' ')
            .toLowerCase();
          return hay.includes(termoBusca.toLowerCase());
        })
      : [];

  const adicionarPlaca = (s) => {
    if (!placasSelecionadas.includes(s._docId)) {
      setPlacasSelecionadas((prev) => [...prev, s._docId]);
    }
    setBusca('');
    inputRef.current?.focus();
  };

  const removerPlaca = (docId) =>
    setPlacasSelecionadas((prev) => prev.filter((id) => id !== docId));

  const placasNoLote = placasSelecionadas.map((id) =>
    servicos.find((s) => s._docId === id)
  ).filter(Boolean);

  const salvar = async () => {
    if (!nome.trim()) { alert('Informe um nome para o lote.'); return; }
    setSaving(true);
    try {
      let novoId = lote?.id;
      if (!isEdit) {
        const { data: lastLotes } = await supabase.from('lotes').select('id').order('id', { ascending: false }).limit(1);
        let next = 1;
        if (lastLotes && lastLotes.length > 0) {
          const last = lastLotes[0].id;
          if (last && last.startsWith('LT')) {
            next = parseInt(last.replace('LT', ''), 10) + 1;
          }
        }
        novoId = `LT${String(next).padStart(4, '0')}`;
      }

      const payload = {
        id: novoId,
        nome: nome.trim(),
        obs: obs.trim(),
        placas: placasSelecionadas,
        status: lote?.status || 'montado',
        criadoEm: lote?.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        criadoPor: lote?.criadoPor || user.label,
        matriculaCriador: lote?.matriculaCriador || user.matricula,
        hist: [
          ...(lote?.hist || []),
          {
            who: user.label,
            matricula: user.matricula,
            when: new Date().toISOString(),
            msg: isEdit ? 'Lote atualizado.' : `Lote criado com ID ${novoId}.`,
          },
        ],
      };
      
      let docRefId;
      if (isEdit) {
        docRefId = lote._docId;
        await supabase.from('lotes').update(payload).eq('id', docRefId);
      } else {
        const { data: newRow } = await supabase.from('lotes').insert([payload]).select().single();
        if (newRow) docRefId = newRow.id;
      }

      // Atualizar servicos (loteId)
      const placasOriginais = lote?.placas || [];
      const removidas = placasOriginais.filter(id => !placasSelecionadas.includes(id));
      const adicionadas = placasSelecionadas.filter(id => !placasOriginais.includes(id));

      await Promise.all([
        ...removidas.map(docId => {
          const s = servicos.find(x => x._docId === docId);
          return supabase.from('servicos').update({
            loteId: null, // limpa a referência
            hist: [...(s?.hist || []), { who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: `Removido do lote ${novoId}.` }]
          }).eq('id', docId);
        }),
        ...adicionadas.map(docId => {
          const s = servicos.find(x => x._docId === docId);
          return supabase.from('servicos').update({
            loteId: novoId,
            hist: [...(s?.hist || []), { who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: `Adicionado ao lote ${novoId}.` }]
          }).eq('id', docId);
        })
      ]);

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onSaved?.();
        onClose();
      }, 1200);
    } catch (e) {
      alert('Erro ao salvar lote: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const avancarStatus = async () => {
    if (!lote) return;
    const cfg = LOTE_STATUS[lote.status];
    if (!cfg?.next) return;
    const novoStatus = cfg.next;
    setAvancoStatus(true);
    try {
      const hist = [
        ...(lote.hist || []),
        {
          who: user.label,
          matricula: user.matricula,
          when: new Date().toISOString(),
          msg: `Status do lote alterado para "${LOTE_STATUS[novoStatus].label}".`,
        },
      ];
      await supabase.from('lotes').update({
        status: novoStatus,
        atualizadoEm: new Date().toISOString(),
        hist,
        ...(novoStatus === 'enviado' ? { enviadoEm: new Date().toISOString() } : {}),
        ...(novoStatus === 'entregue' ? { entregueEm: new Date().toISOString() } : {}),
      }).eq('id', lote._docId);
      // Envio ao supervisor marca lote + cada serviço
      if (novoStatus === 'enviado') {
        await Promise.all(
          (lote.placas || []).map((docId) =>
            supabase.from('servicos').update({
              enviadoSupervisor: true,
              hist: [
                ...(servicos.find((s) => s._docId === docId)?.hist || []),
                {
                  who: user.label,
                  matricula: user.matricula,
                  when: new Date().toISOString(),
                  msg: `Placa marcada como enviada ao supervisor via lote ${lote.id}.`,
                },
              ],
            }).eq('id', docId)
          )
        );
      }
      onSaved?.();
      onClose();
    } catch (e) {
      alert('Erro ao avançar status: ' + e.message);
    } finally {
      setAvancoStatus(false);
    }
  };

  const cfgStatus = lote ? LOTE_STATUS[lote.status] : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,37,68,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          width: '700px',
          maxWidth: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(15,37,68,0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            background: '#fff',
            borderRadius: '14px 14px 0 0',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #0f2544, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f2544' }}>
                {isEdit ? `Lote: ${lote.nome}` : 'Novo lote de placas'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                {isEdit
                  ? `Criado por ${lote.criadoPor} em ${fmtDt(lote.criadoEm)}`
                  : 'Agrupe placas montadas para envio ao supervisor'}
              </div>
            </div>
            {isEdit && <StatusBadge status={lote.status} />}
          </div>
          <button
            onClick={onClose}
            style={{
              width: '30px',
              height: '30px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              background: '#f8fafc',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              padding: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Dados do lote */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', padding: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
              Identificação do lote
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelUp}>Nome do lote *</label>
                <input
                  type="text"
                  placeholder="Ex: Lote GV – Jun/2025 – Pedro"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  style={inputStyle}
                  disabled={isEdit && lote.status === 'entregue'}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelUp}>Observações</label>
                <input
                  type="text"
                  placeholder="Notas sobre este lote..."
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  style={inputStyle}
                  disabled={isEdit && lote.status === 'entregue'}
                />
              </div>
            </div>
          </div>

          {/* Busca e adição de placas */}
          {(!isEdit || lote.status !== 'entregue') && (
            <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', padding: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
                Adicionar placas ao lote
              </div>
              <div style={{ position: 'relative' }}>
                <svg
                  width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                >
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Buscar por equipamento, ID, nº serviço ou localidade..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: '30px' }}
                />
              </div>

              {/* Resultados da busca */}
              {resultadosBusca.length > 0 && (
                <div
                  style={{
                    marginTop: '8px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  {resultadosBusca.slice(0, 20).map((s) => {
                    const jaAdicionado = placasSelecionadas.includes(s._docId);
                    return (
                      <button
                        key={s._docId}
                        onClick={() => !jaAdicionado && adicionarPlaca(s)}
                        disabled={jaAdicionado}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          border: 'none',
                          borderBottom: '1px solid #f1f5f9',
                          background: jaAdicionado ? '#f0fdf4' : '#fff',
                          cursor: jaAdicionado ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontFamily: 'inherit',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => { if (!jaAdicionado) e.currentTarget.style.background = '#f0f7ff'; }}
                        onMouseLeave={(e) => { if (!jaAdicionado) e.currentTarget.style.background = '#fff'; }}
                      >
                        <div
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: jaAdicionado ? '#15803d' : '#1d4ed8',
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f2544' }}>{s.id}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', margin: '0 6px' }}>·</span>
                          <span style={{ fontSize: '12px', color: '#475569' }}>{s.equip || '—'}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8', margin: '0 6px' }}>·</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{s.local}</span>
                        </div>
                        {jaAdicionado ? (
                          <span style={{ fontSize: '10px', color: '#15803d', fontWeight: '600' }}>✓ Adicionado</span>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {termoBusca.length >= 2 && resultadosBusca.length === 0 && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8', padding: '10px 0', textAlign: 'center' }}>
                  Nenhuma placa montada encontrada para "{termoBusca}".
                </div>
              )}
            </div>
          )}

          {/* Placas no lote */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', padding: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Placas neste lote
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  padding: '2px 10px',
                  borderRadius: '20px',
                }}
              >
                {placasNoLote.length} {placasNoLote.length === 1 ? 'placa' : 'placas'}
              </div>
            </div>

            {placasNoLote.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '12px' }}>
                Nenhuma placa adicionada ainda. Use a busca acima.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={th}>ID</th>
                      <th style={th}>Equipamento</th>
                      <th style={th}>Localidade</th>
                      <th style={th}>Nº Serviço</th>
                      <th style={th}>Status nota</th>
                      {(!isEdit || lote.status !== 'entregue') && <th style={th}>Ação</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {placasNoLote.map((s, i) => (
                      <tr
                        key={s._docId}
                        style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}
                      >
                        <td style={td}>
                          <span style={{ fontWeight: '700', color: '#0f2544' }}>{s.id}</span>
                        </td>
                        <td style={{ ...td, fontWeight: '600' }}>{s.equip || '—'}</td>
                        <td style={td}>{s.local || '—'}</td>
                        <td style={td}>{s.numServ || '—'}</td>
                        <td style={td}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: '600',
                              padding: '2px 8px',
                              borderRadius: '20px',
                              background: '#f1f5f9',
                              color: '#475569',
                            }}
                          >
                            {s.status}
                          </span>
                        </td>
                        {(!isEdit || lote.status !== 'entregue') && (
                          <td style={td}>
                            <button
                              onClick={() => removerPlaca(s._docId)}
                              style={{
                                fontSize: '11px',
                                padding: '3px 10px',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                background: '#fef2f2',
                                color: '#b91c1c',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = '#fef2f2')}
                            >
                              Remover
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Histórico (só edição) */}
          {isEdit && (lote.hist || []).length > 0 && (
            <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', padding: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
                Histórico
              </div>
              {[...(lote.hist || [])].reverse().map((h, i, arr) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    paddingBottom: i < arr.length - 1 ? '10px' : 0,
                    marginBottom: i < arr.length - 1 ? '10px' : 0,
                    borderBottom: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      flexShrink: 0,
                      background: '#e0f2fe',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: '700',
                      color: '#0369a1',
                    }}
                  >
                    {(h.who || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline', marginBottom: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>{h.who}</span>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>{fmtDt(h.when)}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{h.msg}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ações */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div>
              {/* Avançar status — só em edição e status não final */}
              {isEdit && cfgStatus?.next && (
                <button
                  onClick={avancarStatus}
                  disabled={avancoStatus}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    border: `1px solid ${LOTE_STATUS[cfgStatus.next].border}`,
                    borderRadius: '8px',
                    background: LOTE_STATUS[cfgStatus.next].bg,
                    color: LOTE_STATUS[cfgStatus.next].color,
                    cursor: avancoStatus ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: '700',
                    fontFamily: 'inherit',
                  }}
                >
                  {LOTE_STATUS[cfgStatus.next].icon}
                  {avancoStatus ? 'Aguarde...' : cfgStatus.nextLabel}
                  {cfgStatus.next === 'entregue' && (
                    <span style={{ fontSize: '10px', opacity: 0.8 }}>
                      (marca todas as placas como enviadas)
                    </span>
                  )}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: '#fff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
              >
                Fechar
              </button>
              {/* Só salvar se não entregue */}
              {(!isEdit || lote.status !== 'entregue') && (
                <button
                  onClick={salvar}
                  disabled={saving}
                  style={{
                    padding: '8px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    background: saved
                      ? 'linear-gradient(135deg, #15803d, #16a34a)'
                      : saving
                      ? '#94a3b8'
                      : 'linear-gradient(135deg, #0f2544, #1d4ed8)',
                    color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'background 0.2s',
                  }}
                >
                  {saved ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Salvo!
                    </>
                  ) : saving ? (
                    'Salvando...'
                  ) : isEdit ? (
                    'Salvar alterações'
                  ) : (
                    'Criar lote'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Componente principal de lotes ─────────────────────────────────────────────
const LotesPlacas = ({ servicos }) => {
  const { user } = useAuth();
  const [lotes, setLotes] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [loteEditando, setLoteEditando] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    const carregar = async () => {
      const { data } = await supabase.from('lotes').select('*').order('criadoEm', { ascending: false });
      if (data) setLotes(data.map((d) => ({ ...d, _docId: d.id })));
    };
    carregar();
    const channel = supabase.channel('lotes_placas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lotes' }, carregar)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const abrirNovoLote = () => {
    setLoteEditando(null);
    setModalAberto(true);
  };

  const abrirLote = (lote) => {
    setLoteEditando(lote);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setLoteEditando(null);
  };

  // Filtros
  const lotesFiltrados = lotes.filter((l) => {
    if (filtroStatus && l.status !== filtroStatus) return false;
    if (busca.trim()) {
      const hay = [l.nome, l.obs, l.criadoPor].join(' ').toLowerCase();
      if (!hay.includes(busca.toLowerCase())) {
        // Também busca por equipamento dentro das placas
        const placasDoLote = (l.placas || [])
          .map((id) => servicos.find((s) => s._docId === id))
          .filter(Boolean);
        const hayPlacas = placasDoLote
          .map((s) => [s.id, s.equip, s.numServ, s.local].join(' '))
          .join(' ')
          .toLowerCase();
        if (!hayPlacas.includes(busca.toLowerCase())) return false;
      }
    }
    return true;
  });

  const contadores = {
    montado:  lotes.filter((l) => l.status === 'montado').length,
    enviado:  lotes.filter((l) => l.status === 'enviado').length,
    entregue: lotes.filter((l) => l.status === 'entregue').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header da seção */}
      <div style={{ ...card, padding: '14px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '14px',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544' }}>
              Lotes de envio ao supervisor
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Agrupe placas montadas, controle o envio e confirme a entrega
            </div>
          </div>
          <button
            onClick={abrirNovoLote}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0f2544, #1d4ed8)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(29,78,216,0.3)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Novo lote
          </button>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Busca */}
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar lote ou equipamento..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '30px', fontSize: '12px' }}
            />
          </div>

          {/* Filtros de status */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { key: '', label: 'Todos', count: lotes.length },
              { key: 'montado',  label: 'Montado',  count: contadores.montado  },
              { key: 'enviado',  label: 'Enviado',  count: contadores.enviado  },
              { key: 'entregue', label: 'Entregue', count: contadores.entregue },
            ].map(({ key, label, count }) => {
              const ativo = filtroStatus === key;
              const cfg = key ? LOTE_STATUS[key] : null;
              return (
                <button
                  key={key}
                  onClick={() => setFiltroStatus(key)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    border: ativo
                      ? `2px solid ${cfg?.color || '#0f2544'}`
                      : '1px solid #e2e8f0',
                    background: ativo ? (cfg?.bg || '#f0f4ff') : '#f8fafc',
                    color: ativo ? (cfg?.color || '#0f2544') : '#64748b',
                    fontSize: '11px',
                    fontWeight: ativo ? '700' : '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.12s',
                  }}
                >
                  {label}
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '1px 6px',
                      borderRadius: '20px',
                      background: ativo ? `${cfg?.color || '#0f2544'}20` : '#e2e8f0',
                      color: ativo ? (cfg?.color || '#0f2544') : '#475569',
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabela de lotes */}
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={th}>Lote</th>
                <th style={th}>Status</th>
                <th style={{ ...th, width: '80px' }}>Placas</th>
                <th style={th}>Criado por</th>
                <th style={th}>Criado em</th>
                <th style={th}>Enviado em</th>
                <th style={th}>Entregue em</th>
                <th style={{ ...th, width: '80px' }}>Ver</th>
              </tr>
            </thead>
            <tbody>
              {lotesFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: 'center', padding: '56px', color: '#94a3b8', fontSize: '13px' }}
                  >
                    {lotes.length === 0
                      ? 'Nenhum lote criado ainda. Clique em "Novo lote" para começar.'
                      : 'Nenhum lote encontrado com esses filtros.'}
                  </td>
                </tr>
              )}
              {lotesFiltrados.map((lote, i) => (
                <tr
                  key={lote._docId}
                  style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafbfc')}
                >
                  <td style={td}>
                    <div style={{ fontWeight: '700', color: '#0f2544' }}>
                      {lote.id && <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', marginRight: '8px', border: '1px solid #e2e8f0' }}>{lote.id}</span>}
                      {lote.nome}
                    </div>
                    {lote.obs && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{lote.obs}</div>
                    )}
                  </td>
                  <td style={td}>
                    <StatusBadge status={lote.status} />
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '28px',
                        height: '22px',
                        borderRadius: '6px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontWeight: '700',
                        fontSize: '12px',
                        border: '1px solid #bfdbfe',
                        padding: '0 6px',
                      }}
                    >
                      {(lote.placas || []).length}
                    </span>
                  </td>
                  <td style={td}>{lote.criadoPor || '—'}</td>
                  <td style={{ ...td, color: '#64748b' }}>{fmtDt(lote.criadoEm)}</td>
                  <td style={{ ...td, color: '#64748b' }}>{lote.enviadoEm ? fmtDt(lote.enviadoEm) : <span style={{ color: '#e2e8f0' }}>—</span>}</td>
                  <td style={{ ...td, color: '#64748b' }}>
                    {lote.entregueEm ? (
                      <span style={{ color: '#15803d', fontWeight: '600' }}>{fmtDt(lote.entregueEm)}</span>
                    ) : (
                      <span style={{ color: '#e2e8f0' }}>—</span>
                    )}
                  </td>
                  <td style={td}>
                    <button
                      onClick={() => abrirLote(lote)}
                      title="Ver detalhes do lote"
                      style={{
                        width: '30px',
                        height: '30px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '7px',
                        background: '#f8fafc',
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.color = '#1d4ed8'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <LoteModal
        isOpen={modalAberto}
        onClose={fecharModal}
        lote={loteEditando}
        servicos={servicos}
        user={user}
        onSaved={() => {}}
      />
    </div>
  );
};

export default LotesPlacas;