import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 10;

const STATUS_LABELS = {
  cadastrado: { label: 'Cadastrado', bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  enviado: { label: 'Enviado', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  acionado: { label: 'Acionado', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  em_execucao: { label: 'Em execução', bg: '#fef9c3', color: '#854d0e', border: '#fde68a' },
  pendente: { label: 'Pendente', bg: '#fef9c3', color: '#854d0e', border: '#fde68a' },
  concluido: { label: 'Concluído', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
  reprovado: { label: 'Reprovado', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_LABELS[status] || { label: status || '—', bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' };
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
};

// Normaliza o equipamento: pega apenas o que está antes do primeiro traço (mesma regra do GerarServicosTab)
const extrairTransformador = (equip) => {
  const raw = (equip || '').trim();
  if (!raw) return null;
  return raw.includes('-') ? raw.split('-')[0].trim() : raw;
};

const DuplicidadeTab = () => {
  const { user } = useAuth();
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('pendentes'); // 'pendentes' | 'aceitas'
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchServicos();

    const channel = supabase.channel('servicos_duplicidade')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, (payload) => {
        if (payload.eventType === 'INSERT') setServicos(prev => [...prev, payload.new]);
        else if (payload.eventType === 'UPDATE') setServicos(prev => prev.map(s => s.id === payload.new.id ? payload.new : s));
        else if (payload.eventType === 'DELETE') setServicos(prev => prev.filter(s => s.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => { setPage(1); }, [view]);

  const fetchServicos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .not('equip', 'is', null);

    if (error) console.error('Erro ao buscar serviços:', error);
    else setServicos(data || []);
    setLoading(false);
  };

  // ── Agrupamento por transformador (exclui cancelados) ───────────────────────
  const grupos = {};
  servicos.filter(s => s.status !== 'cancelado').forEach(s => {
    const transformador = extrairTransformador(s.equip);
    if (!transformador) return;
    if (!grupos[transformador]) grupos[transformador] = [];
    grupos[transformador].push(s);
  });

  const todosGrupos = Object.entries(grupos).filter(([, lista]) => lista.length >= 2);
  const gruposPendentes = todosGrupos.filter(([, lista]) => !lista.every(s => s.duplicidadeaceita));
  const gruposAceitos = todosGrupos.filter(([, lista]) => lista.every(s => s.duplicidadeaceita));

  const gruposDaView = (view === 'pendentes' ? gruposPendentes : gruposAceitos)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const totalPages = Math.max(1, Math.ceil(gruposDaView.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const gruposPaginados = gruposDaView.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Ações ─────────────────────────────────────────────────────────────────
  const handleCancelar = async (servico) => {
    if (!window.confirm(`Deseja cancelar o serviço ${servico.id}?`)) return;

    const newHist = [...(servico.hist || []), {
      who: user?.label || 'Despachante',
      matricula: user?.matricula,
      when: new Date().toISOString(),
      msg: 'Serviço cancelado pela aba de Duplicidade'
    }];

    const { error } = await supabase.from('servicos').update({
      status: 'cancelado',
      hist: newHist
    }).eq('id', servico.id);

    if (error) alert('Erro ao cancelar serviço: ' + error.message);
  };

  const handleAceitarDuplicidade = async (lista) => {
    if (!window.confirm(`Confirmar que os ${lista.length} serviços deste transformador são realmente distintos?`)) return;

    const results = await Promise.all(lista.map(s => {
      const newHist = [...(s.hist || []), {
        who: user?.label || 'Despachante',
        matricula: user?.matricula,
        when: new Date().toISOString(),
        msg: 'Duplicidade aceita como válida'
      }];
      return supabase.from('servicos').update({
        duplicidadeaceita: true,
        hist: newHist
      }).eq('id', s.id);
    }));

    const falha = results.find(r => r.error);
    if (falha) alert('Erro ao aceitar duplicidade: ' + falha.error.message);
  };

  const handleReverter = async (lista) => {
    if (!window.confirm(`Voltar os ${lista.length} serviços deste transformador para a lista de pendentes?`)) return;

    const results = await Promise.all(lista.map(s => {
      const newHist = [...(s.hist || []), {
        who: user?.label || 'Despachante',
        matricula: user?.matricula,
        when: new Date().toISOString(),
        msg: 'Duplicidade revertida para pendente'
      }];
      return supabase.from('servicos').update({
        duplicidadeaceita: false,
        hist: newHist
      }).eq('id', s.id);
    }));

    const falha = results.find(r => r.error);
    if (falha) alert('Erro ao reverter duplicidade: ' + falha.error.message);
  };

  const EmptyState = ({ text }) => (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: '12px', fontSize: '13px' }}>
      {text}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f2544' }}>Duplicidade de Transformador</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
            Serviços diferentes instalados no mesmo transformador. Cancele o serviço incorreto ou aceite a duplicidade caso sejam realmente dois serviços distintos.
          </div>
        </div>
        <div style={{ fontSize: '11px', fontWeight: '700', padding: '4px 12px', borderRadius: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', whiteSpace: 'nowrap' }}>
          {gruposPendentes.length} transformadores com duplicidade pendente
        </div>
      </div>

      {/* ── Toggle Pendentes / Aceitas ── */}
      <div style={{ display: 'flex', gap: '2px', background: '#f8fafc', borderRadius: '8px', padding: '3px', width: 'fit-content' }}>
        {[
          { key: 'pendentes', label: 'Pendentes', count: gruposPendentes.length },
          { key: 'aceitas', label: 'Aceitas', count: gruposAceitos.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              padding: '6px 14px', background: view === key ? '#0f2544' : 'transparent', border: 'none',
              borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
              color: view === key ? '#ffffff' : '#64748b', fontWeight: view === key ? '700' : '500',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {label}
            <span style={{
              background: view === key ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              color: view === key ? '#fff' : '#64748b',
              borderRadius: '20px', fontSize: '10px', fontWeight: '700', padding: '1px 7px', minWidth: '18px', textAlign: 'center',
            }}>{count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>Carregando…</div>
      ) : gruposDaView.length === 0 ? (
        <EmptyState text={view === 'pendentes' ? 'Nenhuma duplicidade pendente.' : 'Nenhuma duplicidade aceita.'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {gruposPaginados.map(([transformador, lista]) => (
            <div key={transformador} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f2544' }}>Transformador {transformador}</span>
                  <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>
                    {lista.length} serviços
                  </span>
                </div>
                {view === 'pendentes' ? (
                  <button
                    onClick={() => handleAceitarDuplicidade(lista)}
                    style={{ padding: '8px 16px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    ✓ Aceitar duplicidade
                  </button>
                ) : (
                  <button
                    onClick={() => handleReverter(lista)}
                    style={{ padding: '8px 16px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    ↺ Reverter
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {lista.map(s => (
                  <div key={s.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 18px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544' }}>{s.id}</span>
                        <StatusBadge status={s.status} />
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569' }}>{s.desc || s.tipo || 'Sem descrição'}</div>
                    </div>
                    <div style={{ flex: '1 1 160px', fontSize: '12px', color: '#64748b' }}>
                      <span style={{ color: '#94a3b8' }}>Local:</span> {s.local || '—'} <br />
                      <span style={{ color: '#94a3b8' }}>Equip.:</span> {s.equip || '—'}
                    </div>
                    <button
                      onClick={() => handleCancelar(s)}
                      style={{ padding: '8px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', flexShrink: 0 }}
                    >
                      ✕ Cancelar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: '#475569', cursor: safePage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Anterior</button>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
            Página {safePage} de {totalPages}
          </div>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: '#475569', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Próxima</button>
        </div>
      )}
    </div>
  );
};

export default DuplicidadeTab;
