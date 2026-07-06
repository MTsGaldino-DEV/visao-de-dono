import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Modal de Revisão ────────────────────────────────────────────────────────
const RevisaoModal = ({ levantamento, onClose, onAprovar, onReprovar }) => {
  const [motivoReprovacao, setMotivoReprovacao] = useState('');
  const [mostrarReprovacao, setMostrarReprovacao] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!levantamento) return null;

  const dataHora = new Date(levantamento.criado_em).toLocaleString('pt-BR');
  const fotos = levantamento.fotos || [];

  const InfoRow = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #f1f5f9', gap: '12px' }}>
      <span style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: '500', textAlign: 'right' }}>{value}</span>
    </div>
  );

  const handleAprovarClick = async () => {
    setIsSubmitting(true);
    await onAprovar(levantamento);
    setIsSubmitting(false);
  };

  const handleReprovarClick = async () => {
    if (!motivoReprovacao.trim()) { alert('Informe o motivo da reprovação.'); return; }
    setIsSubmitting(true);
    await onReprovar(levantamento, motivoReprovacao.trim());
    setIsSubmitting(false);
  };

  return (
    <>
      {/* Overlay principal */}
      <div
        onClick={!isSubmitting ? onClose : undefined}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.65)', zIndex: 1000, backdropFilter: 'blur(3px)' }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 1001, background: '#fff', borderRadius: '16px', width: '90%', maxWidth: '680px',
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(15,37,68,0.25)'
      }}>
        {/* Cabeçalho */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Revisão de Levantamento</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f2544' }}>{levantamento.id.split('-')[0].toUpperCase()}</div>
          </div>
          <button onClick={!isSubmitting ? onClose : undefined} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '18px', cursor: isSubmitting ? 'not-allowed' : 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Corpo scrollável */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

          {/* Fotos */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Fotos do levantamento</div>
            {fotos.length > 0 ? (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {fotos.map((url, i) => (
                  <div key={i} style={{ width: '120px' }}>
                    <div
                      onClick={() => setFotoAmpliada(url)}
                      style={{ borderRadius: '10px', overflow: 'hidden', cursor: 'zoom-in', border: '1px solid #e2e8f0', aspectRatio: '1/1', background: '#f1f5f9', position: 'relative' }}
                    >
                      <img src={url} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ borderRadius: '10px', border: '1px dashed #cbd5e1', padding: '20px', background: '#f8fafc', color: '#94a3b8', fontSize: '12px', textAlign: 'center' }}>
                Nenhuma foto anexada
              </div>
            )}
          </div>

          {/* Informações */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Detalhes do levantamento</div>
            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '4px 14px', border: '1px solid #e2e8f0' }}>
              <InfoRow label="Data/Hora" value={dataHora} />
              <InfoRow label="Tipo" value={levantamento.tipo} />
              <InfoRow label="Localidade" value={levantamento.local} />
              <InfoRow label="Equipamento" value={levantamento.equip || '—'} />
              <InfoRow label="Técnico Origem" value={levantamento.tecnico_origem} />
              <InfoRow label="Matrícula Autor" value={levantamento.matricula_autor} />
            </div>
          </div>

          {/* Textos */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Descrição</div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', fontSize: '13px', color: '#1e293b', lineHeight: '1.5' }}>
              {levantamento.descricao}
            </div>
          </div>

          {levantamento.observacao && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Observação</div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px', fontSize: '13px', color: '#78350f', lineHeight: '1.5' }}>
                {levantamento.observacao}
              </div>
            </div>
          )}

          {levantamento.recurso_necessario && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Recurso Necessário</div>
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '14px', fontSize: '13px', color: '#075985', lineHeight: '1.5' }}>
                {levantamento.recurso_necessario}
              </div>
            </div>
          )}

        </div>

        {/* Rodapé de ações */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          {levantamento.status === 'pendente' && (
            mostrarReprovacao ? (
              <div>
                <textarea
                  autoFocus
                  placeholder="Descreva o motivo da reprovação..."
                  value={motivoReprovacao}
                  onChange={e => setMotivoReprovacao(e.target.value)}
                  disabled={isSubmitting}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #fca5a5', fontSize: '13px', marginBottom: '10px', resize: 'vertical', minHeight: '72px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => { setMostrarReprovacao(false); setMotivoReprovacao(''); }}
                    disabled={isSubmitting}
                    style={{ padding: '10px 20px', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: '600' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleReprovarClick}
                    disabled={isSubmitting}
                    style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
                  >
                    {isSubmitting ? 'Processando...' : '✗ Confirmar Reprovação'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setMostrarReprovacao(true)}
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                >
                  ✗ Reprovar
                </button>
                <button
                  onClick={handleAprovarClick}
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
                >
                  {isSubmitting ? 'Processando...' : '✓ Aprovar e Gerar OS'}
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Foto ampliada */}
      {fotoAmpliada && (
        <div
          onClick={() => setFotoAmpliada(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', cursor: 'zoom-out' }}
        >
          <img src={fotoAmpliada} alt="Ampliada" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
          <button
            onClick={() => setFotoAmpliada(null)}
            style={{ position: 'absolute', top: '20px', right: '24px', background: 'none', border: 'none', color: '#fff', fontSize: '36px', cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
};

// ─── LevantamentosTab Principal ──────────────────────────────────────────────
const LevantamentosTab = () => {
  const { user } = useAuth();
  const [levantamentos, setLevantamentos] = useState([]);
  const [activeSection, setActiveSection] = useState(1);
  const [loading, setLoading] = useState(true);

  // Modal de revisão
  const [modalLevantamento, setModalLevantamento] = useState(null);

  const pendentes = levantamentos.filter(l => l.status === 'pendente');
  const aprovados = levantamentos.filter(l => l.status === 'aprovado');
  const reprovados = levantamentos.filter(l => l.status === 'reprovado');

  useEffect(() => {
    fetchLevantamentos();

    const channel = supabase.channel('levantamentos_web')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'levantamentos' }, () => {
        fetchLevantamentos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLevantamentos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('levantamentos')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) console.error('Erro ao buscar levantamentos:', error);
    else setLevantamentos(data || []);
    setLoading(false);
  };

  // ── Aprovar ───────────────────────────────────────────────────────────────
  const handleAprovar = async (levantamento) => {
    try {
      // 1. Buscar dados reais do técnico que fez o levantamento
      const { data: tecnico, error: erroTecnico } = await supabase
        .from('usuarios')
        .select('uid, nome, matricula, equipe')  // ← adicionado uid
        .eq('matricula', levantamento.matricula_autor)
        .single();

      if (erroTecnico || !tecnico) throw new Error('Técnico não encontrado na base de usuários.');

      // 2. Gerar novo ID
      const { count } = await supabase
        .from('servicos')
        .select('id', { count: 'exact', head: true });
      const novoIdGerado = `VD${String((count || 0) + 1).padStart(4, '0')}`;

      // 3. Inserir em servicos com atribuição correta
      const { error: errorInsert } = await supabase.from('servicos').insert({
        id: novoIdGerado,
        local: levantamento.local,
        tipo: levantamento.tipo,
        desc: levantamento.descricao,
        equip: levantamento.equip || null,
        status: 'cadastrado',
        obs: levantamento.observacao || null,
        orig: levantamento.tecnico_origem,
        data: new Date().toISOString(),
        dtCadastro: new Date().toISOString(),
        autor: user.label,
        matriculaAutor: user.matricula,
        atribuido_para: {
          uid: tecnico.uid,           // ← adicionado uid
          matricula: tecnico.matricula,
          nome: tecnico.nome,
          equipe: tecnico.equipe,
        },
        dt_atribuicao: new Date().toISOString(),
        hist: [
          {
            who: user.label,
            matricula: user.matricula,
            when: new Date().toISOString(),
            msg: 'Serviço gerado a partir de levantamento de campo aprovado.',
          }
        ],
      });

      if (errorInsert) throw errorInsert;

      // 4. Atualizar levantamento
      const { error: errorUpdate } = await supabase.from('levantamentos').update({
        status: 'aprovado',
        aprovado_por: { nome: user.label, matricula: user.matricula },
        dt_aprovacao: new Date().toISOString(),
        servico_gerado_id: novoIdGerado,
      }).eq('id', levantamento.id);

      if (errorUpdate) throw errorUpdate;

      setModalLevantamento(null);
    } catch (error) {
      alert('Erro ao aprovar levantamento: ' + error.message);
    }
  };

  // ── Reprovar ──────────────────────────────────────────────────────────────
  const handleReprovar = async (levantamento, motivo) => {
    try {
      const { error } = await supabase.from('levantamentos').update({
        status: 'reprovado',
        motivo_reprovacao: motivo,
        aprovado_por: { nome: user.label, matricula: user.matricula },
        dt_aprovacao: new Date().toISOString(),
      }).eq('id', levantamento.id);

      if (error) throw error;
      setModalLevantamento(null);
    } catch (error) {
      alert('Erro ao reprovar: ' + error.message);
    }
  };

  const tabs = [
    { id: 1, label: `Aguardando Aprovação`, count: pendentes.length },
    { id: 2, label: `Aprovados`, count: aprovados.length },
    { id: 3, label: `Reprovados`, count: reprovados.length },
  ];

  const EmptyState = ({ text }) => (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: '12px', fontSize: '13px' }}>
      {text}
    </div>
  );

  const trunc = (str, len) => str?.length > len ? str.substring(0, len) + '...' : str;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Navegação */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            style={{
              padding: '8px 16px',
              background: activeSection === tab.id ? '#0f2544' : '#fff',
              color: activeSection === tab.id ? '#fff' : '#64748b',
              border: '1px solid',
              borderColor: activeSection === tab.id ? '#0f2544' : '#e2e8f0',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                background: activeSection === tab.id ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                color: activeSection === tab.id ? '#fff' : '#64748b',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '700',
                padding: '1px 7px',
                minWidth: '20px',
                textAlign: 'center'
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>Carregando levantamentos...</div>
      ) : (
        <>
          {/* ── SEÇÃO 1: Aguardando Aprovação ── */}
          {activeSection === 1 && (
            <div>
              {pendentes.length === 0 ? (
                <EmptyState text="Nenhum levantamento aguardando aprovação." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pendentes.map(l => (
                    <div
                      key={l.id}
                      style={{ display: 'flex', flexWrap: 'wrap', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', alignItems: 'center', justifyContent: 'space-between', gap: '20px', transition: 'box-shadow 0.15s' }}
                    >
                      {/* Info Principal */}
                      <div style={{ flex: '1 1 250px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f2544' }}>{l.id.split('-')[0].toUpperCase()}</span>
                          <span style={{ background: '#f8fafc', color: '#475569', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>{l.tipo}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#0f2544', fontWeight: '600', marginBottom: '2px' }}>{l.local}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                          {trunc(l.descricao, 80)}
                        </div>
                      </div>

                      {/* Detalhes da Execução */}
                      <div style={{ flex: '1 1 200px', fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div><span style={{ color: '#94a3b8' }}>Técnico:</span> <span style={{ color: '#1d4ed8', fontWeight: '600' }}>{l.tecnico_origem}</span></div>
                        <div><span style={{ color: '#94a3b8' }}>Matrícula:</span> <span style={{ fontWeight: '500' }}>{l.matricula_autor}</span></div>
                        <div><span style={{ color: '#94a3b8' }}>Data:</span> <span style={{ fontWeight: '500' }}>{new Date(l.criado_em).toLocaleString('pt-BR')}</span></div>
                      </div>

                      {/* Miniaturas das fotos */}
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        {l.fotos && l.fotos.length > 0 ? (
                          l.fotos.slice(0, 3).map((fotoUrl, idx) => (
                            <img key={idx} src={fotoUrl} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} alt="Foto" />
                          ))
                        ) : (
                          <div style={{ width: '60px', height: '60px', borderRadius: '8px', border: '1px dashed #cbd5e1', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>Sem fotos</div>
                        )}
                      </div>

                      {/* Botão revisar */}
                      <div style={{ flexShrink: 0 }}>
                        <button
                          onClick={() => setModalLevantamento(l)}
                          style={{ padding: '10px 24px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          Revisar <span>→</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SEÇÃO 2: Aprovados ── */}
          {activeSection === 2 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Levantamento</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Técnico / Local</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Serviço Gerado</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Aprovado por</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Data Aprovação</th>
                  </tr>
                </thead>
                <tbody>
                  {aprovados.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Nenhum levantamento aprovado.</td>
                    </tr>
                  ) : aprovados.map(l => {
                    const dataAprov = l.dt_aprovacao ? new Date(l.dt_aprovacao).toLocaleString('pt-BR') : '—';
                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: '600', color: '#0f2544' }}>{l.id.split('-')[0].toUpperCase()}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{l.tipo}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#334155' }}>
                          <div>{l.tecnico_origem}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{l.local}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ color: '#15803d', fontWeight: '700', background: '#f0fdf4', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '12px' }}>
                            {l.servico_gerado_id}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                            {l.aprovado_por?.nome || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>{dataAprov}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── SEÇÃO 3: Reprovados ── */}
          {activeSection === 3 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Levantamento</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Técnico / Local</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Motivo</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Reprovado por</th>
                  </tr>
                </thead>
                <tbody>
                  {reprovados.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Nenhum levantamento reprovado.</td>
                    </tr>
                  ) : reprovados.map(l => {
                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: '600', color: '#0f2544' }}>{l.id.split('-')[0].toUpperCase()}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{l.tipo}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#334155' }}>
                          <div>{l.tecnico_origem}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{l.local}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '6px 10px', borderRadius: '6px', color: '#991b1b', fontSize: '12px', maxWidth: '300px' }}>
                            {l.motivo_reprovacao}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: '12px', color: '#475569' }}>{l.aprovado_por?.nome || '—'}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{l.dt_aprovacao ? new Date(l.dt_aprovacao).toLocaleString('pt-BR') : ''}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal de revisão */}
      {modalLevantamento && (
        <RevisaoModal
          levantamento={modalLevantamento}
          onClose={() => setModalLevantamento(null)}
          onAprovar={handleAprovar}
          onReprovar={handleReprovar}
        />
      )}
    </div>
  );
};

export default LevantamentosTab;
