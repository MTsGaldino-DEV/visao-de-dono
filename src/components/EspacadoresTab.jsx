import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ServicosTable from './ServicosTable';
import { useAuth } from '../context/AuthContext';

// ─── Modal de Aprovação ───────────────────────────────────────────────────────
const AprovacaoModal = ({ servico, onClose, onAprovar, onReprovar, readOnly, onVoltarStatus, onUploadFoto, onDescartarServico }) => {
  const [motivoReprovacao, setMotivoReprovacao] = useState('');
  const [mostrarReprovacao, setMostrarReprovacao] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  if (!servico) return null;

  const exec = servico.execucao || {};
  const tecnico = exec.tecnico?.nome || servico.atribuido_para?.nome || 'Não informado';
  const dataFim = exec.dtConclusao
    ? new Date(exec.dtConclusao).toLocaleString('pt-BR')
    : servico.execucao?.dataFim
      ? new Date(servico.execucao.dataFim).toLocaleString('pt-BR')
      : '—';
  const obs = exec.observacao || '—';
  const material = exec.material || '—';
  const quantidade = exec.quantidade != null ? exec.quantidade : '—';
  const gps = exec.gps || null;
  const arrAntes = servico.fotos_antes || [];
  const arrDepois = servico.fotos_depois || [];
  const oldAntes = exec.fotoAntes ? [exec.fotoAntes] : [];
  const oldDepois = exec.fotoDepois ? [exec.fotoDepois] : [];
  
  const finalAntes = arrAntes.length > 0 ? arrAntes : oldAntes;
  const finalDepois = arrDepois.length > 0 ? arrDepois : (servico.fotos_fechamento?.length > 0 ? servico.fotos_fechamento : oldDepois);

  const fotosParaRenderizar = [];
  if (finalAntes.length === 0) {
    fotosParaRenderizar.push({ url: null, label: 'ANTES' });
  } else if (finalAntes.length === 1) {
    fotosParaRenderizar.push({ url: finalAntes[0], label: 'ANTES' });
  } else {
    finalAntes.forEach((url, i) => fotosParaRenderizar.push({ url, label: `ANTES (${i+1}/${finalAntes.length})` }));
  }

  if (finalDepois.length === 0) {
    fotosParaRenderizar.push({ url: null, label: 'DEPOIS' });
  } else if (finalDepois.length === 1) {
    fotosParaRenderizar.push({ url: finalDepois[0], label: 'DEPOIS' });
  } else {
    finalDepois.forEach((url, i) => fotosParaRenderizar.push({ url, label: `DEPOIS (${i+1}/${finalDepois.length})` }));
  }

  const InfoRow = ({ label, value, href }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #f1f5f9', gap: '12px' }}>
      <span style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '500', textAlign: 'right', textDecoration: 'none' }}>{value}</a>
      ) : (
        <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: '500', textAlign: 'right' }}>{value}</span>
      )}
    </div>
  );

  return (
    <>
      {/* Overlay principal */}
      <div
        onClick={onClose}
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
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Revisão de serviço</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f2544' }}>{servico.id}</div>
          </div>
          <button onClick={onClose} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '18px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Corpo scrollável */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

          {/* Fotos */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Fotos do serviço</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {fotosParaRenderizar.map(({ url, label }) => (
                <div key={label}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '6px', letterSpacing: '0.5px' }}>{label}</div>
                  {url ? (
                    <div
                      onClick={() => setFotoAmpliada(url)}
                      style={{ borderRadius: '10px', overflow: 'hidden', cursor: 'zoom-in', border: '1px solid #e2e8f0', aspectRatio: '4/3', background: '#f1f5f9', position: 'relative' }}
                    >
                      <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.5))', padding: '16px 10px 8px', color: '#fff', fontSize: '11px', fontWeight: '600' }}>
                        🔍 Clique para ampliar
                      </div>
                    </div>
                  ) : (
                    <div style={{ borderRadius: '10px', border: '1px dashed #cbd5e1', aspectRatio: '4/3', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
                      Sem foto
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Informações do serviço */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Informações do serviço</div>
            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '4px 14px', border: '1px solid #e2e8f0' }}>
              <InfoRow label="ID da Nota / Serviço" value={servico.id} />
              <InfoRow label="Tipo" value={servico.tipo || '—'} />
              <InfoRow label="Descrição" value={servico.descricao || servico.nota || '—'} />
              <InfoRow label="Localidade" value={servico.local || '—'} />
              <InfoRow label="Equipamento" value={servico.equip || '—'} />
              <InfoRow label="Técnico" value={tecnico} />
              <InfoRow label="Data de conclusão" value={dataFim} />
              <InfoRow label="Material utilizado" value={material} />
              <InfoRow label="Quantidade" value={String(quantidade)} />
              {gps && (
                <InfoRow label="Localização GPS" value="Ver no mapa" href={`https://maps.google.com/?q=${gps.lat},${gps.lng}`} />
              )}
            </div>
          </div>

          {/* Observação */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Observação do técnico</div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px', fontSize: '13px', color: '#78350f', lineHeight: '1.5', fontStyle: obs === '—' ? 'italic' : 'normal' }}>
              {obs}
            </div>
          </div>

          {/* Histórico */}
          {servico.hist?.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Histórico</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[...servico.hist].reverse().map((h, i) => (
                  <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#0f2544', fontWeight: '600' }}>{h.who}</span>
                      {h.matricula && <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>#{h.matricula}</span>}
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>{h.msg}</div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(h.when).toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de ações */}
        {!readOnly ? (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            {mostrarReprovacao ? (
            <div>
              <textarea
                autoFocus
                placeholder="Descreva o motivo da reprovação..."
                value={motivoReprovacao}
                onChange={e => setMotivoReprovacao(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #fca5a5', fontSize: '13px', marginBottom: '10px', resize: 'vertical', minHeight: '72px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setMostrarReprovacao(false); setMotivoReprovacao(''); }}
                  style={{ padding: '10px 20px', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!motivoReprovacao.trim()) { alert('Informe o motivo.'); return; }
                    onReprovar(servico, motivoReprovacao.trim());
                  }}
                  style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  ✗ Confirmar Reprovação
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setMostrarReprovacao(true)}
                style={{ flex: 1, padding: '12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
              >
                ✗ Reprovar fotos
              </button>
              <button
                onClick={() => onAprovar(servico)}
                style={{ flex: 1, padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
              >
                ✓ Aprovar fotos
              </button>
            </div>
          )}
        </div>
        ) : servico.aprovacaoespacador === 'aprovado' && onVoltarStatus && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#475569', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'center' }}>
                📷 Adicionar Foto (Antes)
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  if (e.target.files[0]) onUploadFoto(servico, e.target.files[0], 'antes');
                  e.target.value = null;
                }} />
              </label>
              <label style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#475569', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'center' }}>
                📷 Adicionar Foto (Depois)
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  if (e.target.files[0]) onUploadFoto(servico, e.target.files[0], 'depois');
                  e.target.value = null;
                }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => onDescartarServico(servico)}
                style={{ flex: 1, padding: '10px', background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                🗑 Descartar Serviço
              </button>
              <button
                onClick={() => onVoltarStatus(servico)}
                style={{ flex: 2, padding: '10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                ⟲ Voltar para Revisão
              </button>
            </div>
          </div>
        )}
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

// ─── EspacadoresTab Principal ─────────────────────────────────────────────────
const EspacadoresTab = () => {
  const { user } = useAuth();
  const [servicos, setServicos] = useState([]);
  const [activeSection, setActiveSection] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal de aprovação
  const [modalServico, setModalServico] = useState(null);
  const [modalReadOnly, setModalReadOnly] = useState(false);

  // Busca histórico
  const [buscaHistorico, setBuscaHistorico] = useState('');

  // Gerar OS inline
  const [gerarOsId, setGerarOsId] = useState(null);
  const [numeroDigitado, setNumeroDigitado] = useState('');

  // ── Filtragem: apenas serviços finalizados pelo app (têm execucao preenchida)
  const finalizadoNoApp = (s) => s.status === 'concluido' && s.execucao != null;

  const aguardandoAprovacao = servicos.filter(s => finalizadoNoApp(s) && !s.aprovacaoespacador);
  let aguardandoOs = servicos.filter(s => finalizadoNoApp(s) && s.aprovacaoespacador === 'aprovado' && !s.numServ);
  let concluidos = servicos.filter(s => finalizadoNoApp(s) && s.aprovacaoespacador === 'aprovado');

  if (buscaHistorico.trim() && activeSection !== 1) {
    const term = buscaHistorico.toLowerCase();
    const filterFn = s => (s.id || '').toLowerCase().includes(term) || (s.local || '').toLowerCase().includes(term);
    if (activeSection === 2) aguardandoOs = aguardandoOs.filter(filterFn);
    if (activeSection === 3) concluidos = concluidos.filter(filterFn);
  }

  useEffect(() => {
    fetchServicos();

    const channel = supabase.channel('servicos_espacadores_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, (payload) => {
        if (payload.eventType === 'INSERT') setServicos(prev => [...prev, payload.new]);
        else if (payload.eventType === 'UPDATE') setServicos(prev => prev.map(s => s.id === payload.new.id ? payload.new : s));
        else if (payload.eventType === 'DELETE') setServicos(prev => prev.filter(s => s.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchServicos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .eq('status', 'concluido')
      .not('execucao', 'is', null); // Apenas finalizados pelo app

    if (error) console.error('Erro ao buscar serviços:', error);
    else setServicos(data || []);
    setLoading(false);
  };

  // ── Aprovar ───────────────────────────────────────────────────────────────
  const handleAprovar = async (servico) => {
    const newHist = [...(servico.hist || []), {
      who: user?.label || 'Despachante',
      matricula: user?.matricula,
      when: new Date().toISOString(),
      msg: 'Fotos aprovadas pelo despachante'
    }];

    const { error } = await supabase.from('servicos').update({
      aprovacaoespacador: 'aprovado',
      dtaprovacaoespacador: new Date().toISOString(),
      aprovadopor: { nome: user?.label, matricula: user?.matricula },
      hist: newHist
    }).eq('id', servico.id);

    if (error) alert('Erro ao aprovar: ' + error.message);
    else setModalServico(null);
  };

  // ── Reprovar ──────────────────────────────────────────────────────────────
  const handleReprovar = async (servico, motivo) => {
    const newHist = [...(servico.hist || []), {
      who: user?.label || 'Despachante',
      matricula: user?.matricula,
      when: new Date().toISOString(),
      msg: `Fotos reprovadas: ${motivo}`
    }];

    const { error } = await supabase.from('servicos').update({
      aprovacaoespacador: 'reprovado',
      motivoreprovacaoespacador: motivo,
      hist: newHist
    }).eq('id', servico.id);

    if (error) {
      alert('Erro ao reprovar: ' + error.message);
      return;
    }

    // ── TODO (Antigravity): Enviar notificação push ao técnico ────────────────
    // Verificar se o projeto já tem Expo Notifications ou Firebase FCM configurado.
    // O token do técnico provavelmente está em: servico.atribuido_para?.expoPushToken
    // ou na tabela 'usuarios' relacionada ao técnico do serviço.
    //
    // Exemplo com Expo Push:
    // await fetch('https://exp.host/--/api/v2/push/send', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     to: TOKEN_DO_TECNICO,
    //     title: 'Serviço reprovado',
    //     body: `O serviço ${servico.id} foi reprovado: ${motivo}`,
    //     data: { servicoId: servico.id },
    //   }),
    // });
    // ── FIM TODO ──────────────────────────────────────────────────────────────

    setModalServico(null);
  };
  // ── Voltar para Revisão ───────────────────────────────────────────────────
  const handleVoltarRevisao = async (servico) => {
    if (!window.confirm("Deseja voltar este serviço para revisão (Aguardando Aprovação)?")) return;
    
    const newHist = [...(servico.hist || []), {
      who: user?.label || 'Despachante',
      matricula: user?.matricula,
      when: new Date().toISOString(),
      msg: 'Voltou serviço para revisão'
    }];

    const { error } = await supabase.from('servicos').update({
      aprovacaoespacador: null,
      dtaprovacaoespacador: null,
      hist: newHist
    }).eq('id', servico.id);

    if (error) alert('Erro ao voltar status: ' + error.message);
    else {
      setModalServico(null);
      setModalReadOnly(false);
    }
  };

  // ── Descartar Serviço ─────────────────────────────────────────────────────
  const handleDescartarServico = async (servico) => {
    if (!window.confirm("Deseja realmente DESCARTAR este serviço? Ele será cancelado e removido desta lista.")) return;

    const newHist = [...(servico.hist || []), {
      who: user?.label || 'Despachante',
      matricula: user?.matricula,
      when: new Date().toISOString(),
      msg: 'Serviço descartado (cancelado) pela aba de concluídos'
    }];

    const { error } = await supabase.from('servicos').update({
      status: 'cancelado',
      hist: newHist
    }).eq('id', servico.id);

    if (error) alert('Erro ao descartar serviço: ' + error.message);
    else {
      setModalServico(null);
      setModalReadOnly(false);
    }
  };

  // ── Upload de Foto Manual ─────────────────────────────────────────────────
  const handleUploadFotoManual = async (servico, file, tipo) => {
    try {
      const path = `fechamentos/${servico.id}/${tipo}_manual_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('levantamentos')
        .upload(path, file);
      
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('levantamentos')
        .getPublicUrl(path);

      const url = publicData.publicUrl;
      const key = tipo === 'antes' ? 'fotos_antes' : 'fotos_depois';
      const arrFotos = servico[key] || [];

      const { error: dbError } = await supabase.from('servicos').update({
        [key]: [...arrFotos, url]
      }).eq('id', servico.id);

      if (dbError) throw dbError;

      alert(`Foto (${tipo}) adicionada com sucesso!`);
      // Atualiza o estado local para refletir na UI imediatamente
      setServicos(prev => prev.map(s => s.id === servico.id ? { ...s, [key]: [...arrFotos, url] } : s));
      setModalServico(prev => ({ ...prev, [key]: [...arrFotos, url] }));
    } catch (e) {
      alert('Erro ao enviar foto: ' + e.message);
    }
  };


  // ── Gerar OS ──────────────────────────────────────────────────────────────
  const handleGerarOsConfirm = async () => {
    if (!numeroDigitado.trim()) { alert('Informe o número da OS.'); return; }
    const servico = servicos.find(s => s.id === gerarOsId);
    if (!servico) return;

    const newHist = [...(servico.hist || []), {
      who: user?.label || 'Despachante',
      matricula: user?.matricula,
      when: new Date().toISOString(),
      msg: `OS gerada: ${numeroDigitado}`
    }];

    const { error } = await supabase.from('servicos').update({
      numServ: numeroDigitado,
      hist: newHist
    }).eq('id', servico.id);

    if (error) alert('Erro ao salvar OS: ' + error.message);
    else { setGerarOsId(null); setNumeroDigitado(''); }
  };

  const tabs = [
    { id: 0, label: `Lista de Serviços`, count: null },
    { id: 1, label: `Aguardando Aprovação`, count: aguardandoAprovacao.length },
    { id: 2, label: `Aguardando OS`, count: aguardandoOs.length },
    { id: 3, label: `Concluídos`, count: concluidos.length },
  ];

  const EmptyState = ({ text }) => (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: '12px', fontSize: '13px' }}>
      {text}
    </div>
  );

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
              {tab.count !== null && tab.count > 0 && (
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
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>Carregando serviços de espaçadores...</div>
      ) : (
        <>
          {/* ── SEÇÃO 0: Lista de Serviços (Geral) ── */}
          {activeSection === 0 && (
            <ServicosTable filterType="espacadores" />
          )}

          {/* ── SEÇÃO 1: Aguardando Aprovação ── */}
          {activeSection === 1 && (
            <div>
              {aguardandoAprovacao.length === 0 ? (
                <EmptyState text="Nenhum serviço aguardando aprovação." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {aguardandoAprovacao.map(s => {
                    const exec = s.execucao || {};
                    const tecnico = exec.tecnico?.nome || s.atribuido_para?.nome || 'Desconhecido';
                    const dataFim = exec.dtConclusao
                      ? new Date(exec.dtConclusao).toLocaleString('pt-BR')
                      : exec.dataFim ? new Date(exec.dataFim).toLocaleString('pt-BR') : '—';

                    return (
                      <div
                        key={s.id}
                        style={{ display: 'flex', flexWrap: 'wrap', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', alignItems: 'center', justifyContent: 'space-between', gap: '20px', transition: 'box-shadow 0.15s' }}
                      >
                        {/* Info Principal */}
                        <div style={{ flex: '1 1 250px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f2544' }}>{s.id}</span>
                            <span style={{ background: '#fef9c3', color: '#854d0e', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>Aguardando</span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#0f2544', fontWeight: '600', marginBottom: '2px' }}>{s.tipo || 'Sem tipo'}</div>
                          <div style={{ fontSize: '13px', color: '#475569' }}>
                            <span style={{ color: '#94a3b8' }}>Local:</span> {s.local || '—'} <br />
                            <span style={{ color: '#94a3b8' }}>Equip.:</span> {s.equip || '—'}
                          </div>
                        </div>

                        {/* Detalhes da Execução */}
                        <div style={{ flex: '1 1 200px', fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div><span style={{ color: '#94a3b8' }}>Técnico:</span> <span style={{ color: '#1d4ed8', fontWeight: '600' }}>{tecnico}</span></div>
                          <div><span style={{ color: '#94a3b8' }}>Concluído em:</span> <span style={{ fontWeight: '500' }}>{dataFim}</span></div>
                          {exec.material && <div><span style={{ color: '#94a3b8' }}>Material:</span> {exec.material} <span style={{ color: '#94a3b8', fontSize: '11px' }}>({exec.quantidade || 1} un)</span></div>}
                        </div>

                        {/* Miniaturas das fotos */}
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          {exec.fotoAntes ? (
                            <img src={exec.fotoAntes} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} alt="Antes" title="Antes" />
                          ) : (
                            <div style={{ width: '60px', height: '60px', borderRadius: '8px', border: '1px dashed #cbd5e1', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>Sem foto<br/>antes</div>
                          )}
                          {(() => {
                            const fotosFech = s.fotos_fechamento || exec.fotos_fechamento || [];
                            if (fotosFech.length === 0 && exec.fotoDepois) fotosFech.push(exec.fotoDepois);
                            
                            if (fotosFech.length > 0) {
                              return (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {fotosFech.slice(0, 2).map((f, i) => (
                                    <img key={i} src={f} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} alt="Depois" title="Depois" />
                                  ))}
                                  {fotosFech.length > 2 && (
                                    <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>
                                      +{fotosFech.length - 2}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <div style={{ width: '60px', height: '60px', borderRadius: '8px', border: '1px dashed #cbd5e1', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>Sem foto<br/>depois</div>
                            );
                          })()}
                        </div>

                        {/* Botão revisar */}
                        <div style={{ flexShrink: 0 }}>
                          <button
                            onClick={() => setModalServico(s)}
                            style={{ padding: '10px 24px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            Revisar <span>→</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── SEÇÃO 2: Aguardando OS ── */}
          {activeSection === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="text" 
                placeholder="Buscar por ID ou Localidade..." 
                value={buscaHistorico} 
                onChange={e => setBuscaHistorico(e.target.value)}
                style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', maxWidth: '400px' }}
              />
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>ID / Localidade</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Equipamento</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Aprovado por</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Data aprovação</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {aguardandoOs.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Nenhum serviço aguardando OS.</td>
                    </tr>
                  ) : aguardandoOs.map(s => {
                    const dataAprov = s.dtaprovacaoespacador ? new Date(s.dtaprovacaoespacador).toLocaleString('pt-BR') : '—';
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: '600', color: '#0f2544' }}>{s.id}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.local || '—'}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#334155' }}>{s.equip || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                            {s.aprovadopor?.nome || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>{dataAprov}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {gerarOsId === s.id ? (
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <input
                                type="text"
                                placeholder="Nº OS CEMIG"
                                value={numeroDigitado}
                                onChange={e => setNumeroDigitado(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleGerarOsConfirm(); if (e.key === 'Escape') { setGerarOsId(null); setNumeroDigitado(''); } }}
                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', width: '130px', outline: 'none' }}
                                autoFocus
                              />
                              <button onClick={handleGerarOsConfirm} style={{ padding: '6px 12px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Salvar</button>
                              <button onClick={() => { setGerarOsId(null); setNumeroDigitado(''); }} style={{ padding: '6px 10px', background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button onClick={() => { setModalServico(s); setModalReadOnly(true); }} style={{ padding: '6px 14px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                Ver detalhes
                              </button>
                              <button onClick={() => setGerarOsId(s.id)} style={{ padding: '6px 14px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                Gerar OS
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          )}

          {/* ── SEÇÃO 3: Concluídos ── */}
          {activeSection === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="text" 
                placeholder="Buscar por ID ou Localidade..." 
                value={buscaHistorico} 
                onChange={e => setBuscaHistorico(e.target.value)}
                style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', maxWidth: '400px' }}
              />
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>ID / Localidade</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Equipamento</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Nº OS</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Aprovado por</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Data aprovação</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {concluidos.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Nenhum serviço concluído.</td>
                    </tr>
                  ) : concluidos.map(s => {
                    const dataAprov = s.dtaprovacaoespacador ? new Date(s.dtaprovacaoespacador).toLocaleString('pt-BR') : '—';
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: '600', color: '#0f2544' }}>{s.id}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.local || '—'}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#334155' }}>{s.equip || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ color: '#15803d', fontWeight: '700', background: '#f0fdf4', padding: '3px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '12px' }}>
                            OS {s.numServ}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ color: '#475569', fontSize: '12px' }}>{s.aprovadopor?.nome || '—'}</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>{dataAprov}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {/* Botão Ver detalhes — ícone olho */}
                            <button
                              onClick={() => { setModalServico(s); setModalReadOnly(true); }}
                              title="Ver detalhes"
                              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', padding: 0 }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                            </button>
                            {/* Botão Descartar — X */}
                            <button
                              onClick={() => handleDescartarServico(s)}
                              title="Descartar serviço"
                              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', padding: 0, color: '#dc2626', fontSize: '18px', lineHeight: 1, fontWeight: '400' }}
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          )}
        </>
      )}

      {/* Modal de aprovação/reprovação */}
      {modalServico && (
        <AprovacaoModal
          servico={modalServico}
          readOnly={modalReadOnly}
          onClose={() => { setModalServico(null); setModalReadOnly(false); }}
          onAprovar={handleAprovar}
          onReprovar={handleReprovar}
          onVoltarStatus={handleVoltarRevisao}
          onUploadFoto={handleUploadFotoManual}
          onDescartarServico={handleDescartarServico}
        />
      )}
    </div>
  );
};

export default EspacadoresTab;