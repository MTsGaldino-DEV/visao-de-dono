import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const norm = (s) => (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const TIPOS_EVENTO = {
  CADASTRADO: { id: 'cadastrado', label: 'Cadastrado', cor: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', keys: ['cadastrad'] },
  ENVIADO: { id: 'enviado', label: 'Enviado', cor: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe', keys: ['enviado à cemig'] },
  NUM_CEMIG: { id: 'num_cemig', label: 'Nº CEMIG', cor: '#c2410c', bg: '#fff7ed', border: '#fed7aa', keys: ['número cemig', 'numero cemig'] },
  CONCLUIDO: { id: 'concluido', label: 'Concluído', cor: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', keys: ['concluíd', 'concluid'] },
  REPROVADO: { id: 'reprovado', label: 'Reprovado', cor: '#dc2626', bg: '#fff1f2', border: '#fecdd3', keys: ['reprovad'] },
  CANCELADO: { id: 'cancelado', label: 'Cancelado', cor: '#b91c1c', bg: '#fef2f2', border: '#fecaca', keys: ['cancelad'] },
  OUTROS: { id: 'outros', label: 'Outros', cor: '#475569', bg: '#f8fafc', border: '#e2e8f0', keys: [] }
};

const getTipoEvento = (msg) => {
  const m = (msg || '').toLowerCase();
  for (const t of Object.values(TIPOS_EVENTO)) {
    if (t.id === 'outros') continue;
    if (t.keys.some(k => m.includes(k))) return t;
  }
  return TIPOS_EVENTO.OUTROS;
};

const fmtDt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const inputStyle = { padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', background: '#fff', color: '#1e293b', outline: 'none', fontFamily: "'Segoe UI', system-ui, sans-serif", width: '100%', boxSizing: 'border-box' };
const labelUp = { fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '5px', display: 'block' };
const PAGE_SIZE = 50;

const LogsTab = () => {
  const [logs, setLogs] = useState([]);
  const [filtros, setFiltros] = useState({
    dataInicio: '', dataFim: '', usuario: '', servicoId: '', tipos: []
  });
  const [page, setPage] = useState(1);

  useEffect(() => {
    const carregar = async () => {
      const { data } = await supabase.from('servicos').select('*');
      if (data) {
        const allLogs = [];
        data.forEach(s => {
          if (s.hist && Array.isArray(s.hist)) {
            s.hist.forEach(h => {
              allLogs.push({
                _docId: s.id,
                servicoId: s.id,
                numServ: s.numServ,
                local: s.local,
                ...h,
              });
            });
          }
        });
        allLogs.sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));
        setLogs(allLogs);
      }
    };
    carregar();
    const channel = supabase.channel('servicos_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, carregar)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleChangeFiltro = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
    setPage(1);
  };

  const toggleTipo = (id) => {
    setFiltros(prev => {
      const ts = prev.tipos.includes(id) ? prev.tipos.filter(t => t !== id) : [...prev.tipos, id];
      return { ...prev, tipos: ts };
    });
    setPage(1);
  };

  let filtered = logs;
  if (filtros.dataInicio) filtered = filtered.filter(l => (l.when || '').slice(0, 10) >= filtros.dataInicio);
  if (filtros.dataFim) filtered = filtered.filter(l => (l.when || '').slice(0, 10) <= filtros.dataFim);
  if (filtros.usuario) filtered = filtered.filter(l => norm(l.who).includes(norm(filtros.usuario)));
  if (filtros.servicoId) filtered = filtered.filter(l => norm(l.servicoId).includes(norm(filtros.servicoId)));
  if (filtros.tipos.length > 0) {
    filtered = filtered.filter(l => filtros.tipos.includes(getTipoEvento(l.msg).id));
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedLogs = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Header & Filtros ── */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f2544' }}>Timeline de Eventos</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Histórico global de todas as ações no sistema</div>
          </div>
          <div style={{ fontSize: '11px', fontWeight: '700', padding: '4px 12px', borderRadius: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
            {filtered.length} eventos encontrados
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelUp}>Data Início</label>
              <input type="date" value={filtros.dataInicio} onChange={e => handleChangeFiltro('dataInicio', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelUp}>Data Fim</label>
              <input type="date" value={filtros.dataFim} onChange={e => handleChangeFiltro('dataFim', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelUp}>Usuário</label>
              <input type="text" placeholder="Nome do usuário..." value={filtros.usuario} onChange={e => handleChangeFiltro('usuario', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelUp}>ID do Serviço</label>
              <input type="text" placeholder="Ex: VD0042" value={filtros.servicoId} onChange={e => handleChangeFiltro('servicoId', e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelUp}>Tipos de Evento</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.values(TIPOS_EVENTO).map(t => {
                const ativo = filtros.tipos.includes(t.id);
                return (
                  <button key={t.id} onClick={() => toggleTipo(t.id)} style={{
                    padding: '4px 10px', borderRadius: '20px', border: `1px solid ${ativo ? t.cor : '#e2e8f0'}`,
                    background: ativo ? t.bg : '#fff', color: ativo ? t.cor : '#64748b',
                    fontSize: '11px', fontWeight: ativo ? '700' : '500', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {t.label}
                  </button>
                );
              })}
              {filtros.tipos.length > 0 && (
                <button onClick={() => handleChangeFiltro('tipos', [])} style={{
                  padding: '4px 10px', borderRadius: '20px', border: 'none', background: 'none', color: '#94a3b8',
                  fontSize: '11px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit',
                }}>Limpar seleção</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '24px' }}>
        {pagedLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>Nenhum evento encontrado.</div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Linha vertical central */}
            <div style={{ position: 'absolute', left: '23px', top: '0', bottom: '0', width: '2px', background: '#f1f5f9', zIndex: 0 }} />

            {pagedLogs.map((l, i) => {
              const tipo = getTipoEvento(l.msg);
              return (
                <div key={`${l._docId}-${i}`} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1, marginBottom: i === pagedLogs.length - 1 ? 0 : '24px' }}>
                  {/* Ícone */}
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%', background: tipo.bg, border: `2px solid ${tipo.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontSize: '14px', fontWeight: '800', color: tipo.cor, boxShadow: '0 0 0 4px #fff'
                  }}>
                    {(l.who || '?').charAt(0).toUpperCase()}
                  </div>

                  {/* Conteúdo */}
                  <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-5px', top: '19px', width: '8px', height: '8px', background: '#f8fafc', borderLeft: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', transform: 'rotate(45deg)' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544' }}>{l.who}</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{l.matricula}</span>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>{fmtDt(l.when)}</span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5', marginBottom: '10px' }}>
                      {l.msg}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                        {l.servicoId}
                      </span>
                      {l.numServ && (
                        <span style={{ fontSize: '10px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                          Nº {l.numServ}
                        </span>
                      )}
                      {l.local && (
                        <span style={{ fontSize: '10px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                          📍 {l.local}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: '#475569', cursor: safePage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Anterior</button>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
            Página {safePage} de {totalPages}
          </div>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: '#475569', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Próxima</button>
        </div>
      )}
    </div>
  );
};

export default LogsTab;