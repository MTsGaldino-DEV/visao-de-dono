import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const EspacadoresTab = () => {
  const { user } = useAuth();
  const [servicos, setServicos] = useState([]);
  const [activeSection, setActiveSection] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [modalImage, setModalImage] = useState(null);
  
  // Reprovacao modal states
  const [reprovarId, setReprovarId] = useState(null);
  const [motivo, setMotivo] = useState('');
  
  // Gerar OS inline state
  const [gerarOsId, setGerarOsId] = useState(null);
  const [numeroDigitado, setNumeroDigitado] = useState('');

  useEffect(() => {
    fetchServicos();
    
    const channel = supabase.channel('servicos_espacadores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setServicos(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setServicos(prev => prev.map(s => s.id === payload.new.id ? payload.new : s));
        } else if (payload.eventType === 'DELETE') {
          setServicos(prev => prev.filter(s => s.id !== payload.old.id));
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchServicos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .eq('tipo', 'NSIS'); // we filter the rest in memory to simplify real-time logic
      
    if (error) {
      console.error('Erro ao buscar serviços:', error);
    } else {
      setServicos(data || []);
    }
    setLoading(false);
  };

  const isEspacador = (s) => s.tipo === 'NSIS' && s.status === 'concluido' && /espa[cç]ador(es)?/i.test(s.desc || '');

  const aguardandoAprovacao = servicos.filter(s => isEspacador(s) && !s.aprovacaoEspacador);
  const aguardandoOs = servicos.filter(s => isEspacador(s) && s.aprovacaoEspacador === 'aprovado' && !s.numServ);
  const concluidos = servicos.filter(s => isEspacador(s) && s.aprovacaoEspacador === 'aprovado' && s.numServ);

  const handleAprovar = async (servico) => {
    if (!window.confirm(`Tem certeza que deseja APROVAR o serviço ${servico.id}?`)) return;
    
    const newHist = [...(servico.hist || []), {
      who: user?.label || 'Dono',
      matricula: user?.matricula,
      when: new Date().toISOString(),
      msg: 'Fotos aprovadas'
    }];
    
    const { error } = await supabase.from('servicos').update({
      aprovacaoEspacador: 'aprovado',
      dtAprovacaoEspacador: new Date().toISOString(),
      aprovadoPor: { nome: user?.label, matricula: user?.matricula },
      hist: newHist
    }).eq('id', servico.id);
    
    if (error) alert("Erro ao aprovar: " + error.message);
  };

  const handleReprovarConfirm = async () => {
    if (!motivo.trim()) {
      alert("Informe o motivo da reprovação.");
      return;
    }
    
    const servico = servicos.find(s => s.id === reprovarId);
    if (!servico) return;
    
    const newHist = [...(servico.hist || []), {
      who: user?.label || 'Dono',
      matricula: user?.matricula,
      when: new Date().toISOString(),
      msg: `Fotos reprovadas: ${motivo}`
    }];
    
    // Volta para o técnico
    const { error } = await supabase.from('servicos').update({
      status: 'enviado', // Volta para a tela do tecnico (ajuste conforme a regra de negocio, geralmente 'enviado' ou 'reprovado')
      aprovacaoEspacador: 'reprovado',
      motivoReprovacaoEspacador: motivo,
      hist: newHist
    }).eq('id', servico.id);
    
    if (error) {
      alert("Erro ao reprovar: " + error.message);
    } else {
      setReprovarId(null);
      setMotivo('');
    }
  };

  const handleGerarOsConfirm = async () => {
    if (!numeroDigitado.trim()) {
      alert("Informe o número gerado da OS.");
      return;
    }
    
    const servico = servicos.find(s => s.id === gerarOsId);
    if (!servico) return;
    
    const newHist = [...(servico.hist || []), {
      who: user?.label || 'Dono',
      matricula: user?.matricula,
      when: new Date().toISOString(),
      msg: `OS gerada: ${numeroDigitado}`
    }];
    
    const { error } = await supabase.from('servicos').update({
      numServ: numeroDigitado,
      hist: newHist
    }).eq('id', servico.id);
    
    if (error) {
      alert("Erro ao salvar número da OS: " + error.message);
    } else {
      setGerarOsId(null);
      setNumeroDigitado('');
    }
  };

  const tabs = [
    { id: 1, label: `Aguardando Aprovação (${aguardandoAprovacao.length})`, count: aguardandoAprovacao.length },
    { id: 2, label: `Aguardando OS (${aguardandoOs.length})`, count: aguardandoOs.length },
    { id: 3, label: `Concluídos (${concluidos.length})`, count: concluidos.length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      
      {/* Navegação Interna */}
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
              transition: 'all 0.15s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Carregando serviços...</div>
      ) : (
        <>
          {/* SECÃO 1: Aguardando Aprovação */}
          {activeSection === 1 && (
            <div>
              {aguardandoAprovacao.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '12px' }}>
                  Nenhum serviço aguardando aprovação no momento.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {aguardandoAprovacao.map(s => {
                    const tecnicoNome = s.execucao?.tecnico?.nome || s.atribuido_para?.nome || 'Desconhecido';
                    const dataFim = s.execucao?.dataFim ? new Date(s.execucao.dataFim).toLocaleString('pt-BR') : 'Sem data';
                    const obs = s.execucao?.observacao || 'Nenhuma observação informada.';
                    const fotoAntes = s.execucao?.fotoAntes;
                    const fotoDepois = s.execucao?.fotoDepois;
                    const gps = s.execucao?.gps || null;

                    return (
                      <div key={s.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f2544' }}>{s.id}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{s.local || 'Sem localidade'} — {s.equip || 'Sem equip.'}</div>
                        </div>
                        
                        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ color: '#64748b' }}>Concluído em:</span>
                            <span style={{ fontWeight: '500', color: '#334155' }}>{dataFim}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ color: '#64748b' }}>Técnico:</span>
                            <span style={{ fontWeight: '500', color: '#1d4ed8' }}>{tecnicoNome}</span>
                          </div>
                          
                          {gps && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: '#64748b' }}>Localização:</span>
                              <a href={`https://maps.google.com/?q=${gps.lat},${gps.lng}`} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>Ver no mapa</a>
                            </div>
                          )}

                          <div style={{ marginTop: '4px' }}>
                            <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Fotos:</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {fotoAntes ? (
                                <div style={{ flex: 1, cursor: 'pointer', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', height: '100px' }} onClick={() => setModalImage(fotoAntes)}>
                                  <img src={fotoAntes} alt="Antes" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  <div style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '10px', textAlign: 'center', padding: '2px', position: 'relative', top: '-20px' }}>Antes</div>
                                </div>
                              ) : <div style={{ flex: 1, height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '6px', fontSize: '11px', color: '#94a3b8' }}>Sem foto (Antes)</div>}
                              
                              {fotoDepois ? (
                                <div style={{ flex: 1, cursor: 'pointer', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', height: '100px' }} onClick={() => setModalImage(fotoDepois)}>
                                  <img src={fotoDepois} alt="Depois" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  <div style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '10px', textAlign: 'center', padding: '2px', position: 'relative', top: '-20px' }}>Depois</div>
                                </div>
                              ) : <div style={{ flex: 1, height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '6px', fontSize: '11px', color: '#94a3b8' }}>Sem foto (Depois)</div>}
                            </div>
                          </div>
                          
                          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '12px', border: '1px solid #e2e8f0', marginTop: 'auto' }}>
                            <strong style={{ color: '#475569', display: 'block', marginBottom: '4px' }}>Observação:</strong>
                            <span style={{ color: '#334155', fontStyle: obs === 'Nenhuma observação informada.' ? 'italic' : 'normal' }}>{obs}</span>
                          </div>
                        </div>

                        {reprovarId === s.id ? (
                          <div style={{ padding: '12px 16px', background: '#fef2f2', borderTop: '1px solid #fecaca' }}>
                            <textarea
                              placeholder="Motivo da reprovação..."
                              value={motivo}
                              onChange={e => setMotivo(e.target.value)}
                              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '12px', marginBottom: '8px', resize: 'vertical', minHeight: '60px', boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={handleReprovarConfirm} style={{ flex: 1, padding: '8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Confirmar Reprovação</button>
                              <button onClick={() => { setReprovarId(null); setMotivo(''); }} style={{ padding: '8px', background: 'transparent', color: '#991b1b', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
                            <button onClick={() => handleAprovar(s)} style={{ flex: 1, padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <span>✓</span> Aprovar fotos
                            </button>
                            <button onClick={() => setReprovarId(s.id)} style={{ flex: 1, padding: '10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <span>✗</span> Reprovar fotos
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECÃO 2: Aguardando OS */}
          {activeSection === 2 && (
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
                      <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Nenhum serviço aguardando OS no momento.</td>
                    </tr>
                  ) : (
                    aguardandoOs.map(s => {
                      const dataAprov = s.dtAprovacaoEspacador ? new Date(s.dtAprovacaoEspacador).toLocaleString('pt-BR') : '—';
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: '600', color: '#0f2544' }}>{s.id}</div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.local || 'Sem localidade'}</div>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#334155' }}>{s.equip || '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '500' }}>
                              {s.aprovadoPor?.nome || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>{dataAprov}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            {gerarOsId === s.id ? (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  placeholder="Nº da OS CEMIG"
                                  value={numeroDigitado}
                                  onChange={e => setNumeroDigitado(e.target.value)}
                                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', width: '130px', outline: 'none' }}
                                  autoFocus
                                />
                                <button onClick={handleGerarOsConfirm} style={{ padding: '6px 12px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Salvar</button>
                                <button onClick={() => { setGerarOsId(null); setNumeroDigitado(''); }} style={{ padding: '6px 12px', background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Cancelar</button>
                              </div>
                            ) : (
                              <button onClick={() => setGerarOsId(s.id)} style={{ padding: '6px 14px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                Gerar OS
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SECÃO 3: Concluídos */}
          {activeSection === 3 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>ID / Localidade</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Equipamento</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Nº OS</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Aprovado por</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Data aprovação</th>
                  </tr>
                </thead>
                <tbody>
                  {concluidos.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Nenhum serviço concluído.</td>
                    </tr>
                  ) : (
                    concluidos.map(s => {
                      const dataAprov = s.dtAprovacaoEspacador ? new Date(s.dtAprovacaoEspacador).toLocaleString('pt-BR') : '—';
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: '600', color: '#0f2544' }}>{s.id}</div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.local || 'Sem localidade'}</div>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#334155' }}>{s.equip || '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ color: '#15803d', fontWeight: '700', background: '#f0fdf4', padding: '2px 8px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                              OS {s.numServ}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ color: '#475569', fontSize: '12px' }}>{s.aprovadoPor?.nome || '—'}</span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>{dataAprov}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* MODAL DA FOTO */}
      {modalImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={modalImage} alt="Ampliada" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
            <button onClick={() => setModalImage(null)} style={{ position: 'absolute', top: '-40px', right: 0, background: 'none', border: 'none', color: '#fff', fontSize: '32px', cursor: 'pointer', padding: '4px' }}>&times;</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EspacadoresTab;
