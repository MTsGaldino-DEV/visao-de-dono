import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const STATUS_CONFIG = {
  cadastrado: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Cadastrado' },
  enviado:    { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe', label: 'Enviado CEMIG' },
  pendente:   { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Pendente' },
  concluido:  { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Concluído' },
  cancelado:  { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Cancelado' },
  reprovado:  { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5', label: 'Reprovado' },
};

const POSTOS = {
  'Posto 1': [
    'FREI INOCENCIO','ALPERCATA','ALVARENGA','CAPITAO ANDRADE','ENGENHEIRO CALDAS',
    'FERNANDES TOURINHO','GOVERNADOR VALADARES','ITANHOMI','JAMPRUCA','JATAI',
    'MATHIAS LOBATO','SAO GERALDO TUMIRITINGA','SOBRALIA','TARUMIRIM','TUMIRITINGA',
  ],
  'Posto 2': [
    'COLUNA','SAO GERALDO DA PIEDADE','AGUA BOA','JOSE RAYDAN','PAULISTAS',
    'CANTAGALO','PECANHA','SAO JOAO EVANGELISTA','SAO JOSE DO JACURI',
    'SANTA EFIGENIA DE MINAS','GONZAGA','SANTA MARIA DO SUACUI','FREI LAGO NEGRO',
    'SAO PEDRO DO SUACUI','SAO SEBASTIAO DO MARANHAO','SARDOA',
  ],
  'Posto 3': [
    'CUPARAQUE','CONSELHEIRO PENA','RESPLENDOR','AIMORES','GOIABEIRA',
    'ITUETA','SANTA RITA DO ITUETO','SAO GERALDO DO BAIXIO','GALILEIA',
  ],
  'Posto 4': [
    'ITABIRINHA DE MANTENA','DIVINO LARANJEIRAS','CENTRAL DE MINAS','MENDES PIMENTEL',
    'NOVA BELEM','SAO FELIX DE MINAS','TIPITI','MANTENA','SAO JOAO DO MANTENINHA',
    'MARILAC','COROACI','VIRGOLANDIA','NACIP RAYDAN','SAO JOSE DA SAFIRA',
  ],
};

const norm = (s) => (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const postoDeLocalidade = (local) => {
  const localNorm = norm(local);
  for (const [posto, locs] of Object.entries(POSTOS)) {
    if (locs.some(l => norm(l) === localNorm || localNorm.includes(norm(l)) || norm(l).includes(localNorm)))
      return posto;
  }
  return null;
};

// ── MultiSelect Component ──────────────────────────────────────────────────
const MultiSelect = ({ options, selected, onChange, placeholder = "Todos" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);

  const displayLabel = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label || selected[0]
      : `${selected.length} selecionados`;

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
      <button onClick={() => setOpen(o => !o)} type="button" style={{
        width: '100%', padding: '7px 10px', border: selected.length > 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
        borderRadius: '8px', fontSize: '12px', background: selected.length > 0 ? '#eff6ff' : '#fff',
        color: selected.length > 0 ? '#1d4ed8' : '#1e293b', fontWeight: selected.length > 0 ? '600' : '400',
        cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', boxSizing: 'border-box', outline: 'none', height: '32px'
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ flexShrink: 0, marginLeft: '6px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: '100%', overflow: 'hidden',
          maxHeight: '250px', overflowY: 'auto'
        }}>
          {selected.length > 0 && (
            <button onClick={() => onChange([])} style={{
              width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: '11px',
              fontFamily: 'inherit', textAlign: 'left', fontWeight: '600', position: 'sticky', top: 0, zIndex: 301
            }}>Limpar seleção</button>
          )}
          {options.map(({ value, label, badge }) => {
            const sel = selected.includes(value);
            return (
              <button key={value} onClick={() => toggle(value)} style={{
                width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f8fafc',
                background: sel ? '#f0f7ff' : '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit', textAlign: 'left'
              }}>
                <div style={{
                  width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                  border: sel ? '4px solid #1d4ed8' : '1.5px solid #cbd5e1',
                  background: sel ? '#1d4ed8' : '#fff', transition: 'all 0.1s',
                }} />
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

const PAGE_SIZE = 50;

const DespacharTab = () => {
  const { user } = useAuth();
  
  const [servicos, setServicos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  // Filters
  const [filtroStatus, setFiltroStatus] = useState([]);
  const [filtroLocal, setFiltroLocal] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState([]);
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [posto, setPosto] = useState('');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedTecnico, setSelectedTecnico] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchServicos();
    fetchTecnicos();

    const subscription = supabase.channel('servicos-despacho')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, () => {
        fetchServicos();
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  const fetchServicos = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('servicos').select('*').order('data', { ascending: false });
    if (error) console.error('Erro ao buscar servicos:', error);
    if (data) setServicos(data);
    setLoading(false);
  };

  const fetchTecnicos = async () => {
    const { data, error } = await supabase.from('usuarios').select('*').eq('role', 'tecnico').eq('ativo', true);
    if (error) console.error('Erro ao buscar tecnicos:', error);
    if (data) setTecnicos(data);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filtroStatus, filtroLocal, filtroTipo, dataDe, dataAte, posto]);

  // Derived options for filters
  const locaisUnicos = [...new Set(servicos.map(s => norm(s.local)).filter(Boolean))].sort();
  const locaisOptions = locaisUnicos.map(l => ({ value: l, label: l }));
  
  const statusOptions = Object.entries(STATUS_CONFIG).map(([key, val]) => ({
    value: key, label: val.label, badge: val
  }));

  const tiposUnicos = [...new Set(servicos.map(s => s.tipoServ).filter(Boolean))].sort();
  const tiposOptions = tiposUnicos.map(t => ({ value: t, label: t }));

  const handleLimparFiltros = () => {
    setFiltroStatus([]);
    setFiltroLocal([]);
    setFiltroTipo([]);
    setDataDe('');
    setDataAte('');
    setPosto('');
  };

  const servicosFiltrados = servicos.filter(s => {
    if (filtroStatus.length > 0 && !filtroStatus.includes(s.status)) return false;
    if (filtroLocal.length > 0 && !filtroLocal.includes(norm(s.local))) return false;
    if (filtroTipo.length > 0 && !filtroTipo.includes(s.tipoServ)) return false;
    
    if (dataDe) {
      const sDate = s.data ? s.data.substring(0, 10) : '';
      if (sDate < dataDe) return false;
    }
    if (dataAte) {
      const sDate = s.data ? s.data.substring(0, 10) : '';
      if (sDate > dataAte) return false;
    }
    
    if (posto && postoDeLocalidade(s.local) !== posto) return false;
    
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(servicosFiltrados.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const currentData = servicosFiltrados.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSelectAll = () => {
    if (selectedIds.length === currentData.length && currentData.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentData.map(s => s.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAtribuir = async () => {
    if (!selectedTecnico) {
      alert('Selecione um técnico.');
      return;
    }
    setLoadingAction(true);
    try {
      const tecnico = tecnicos.find(t => t.uid === selectedTecnico);
      
      const promises = selectedIds.map(async (id) => {
        const servico = servicos.find(s => s.id === id);
        const novoHist = {
          who: user.label,
          matricula: user.matricula,
          when: new Date().toISOString(),
          msg: `Serviço atribuído para ${tecnico.nome}`
        };
        
        return supabase.from('servicos').update({
          atribuido_para: { uid: tecnico.uid, nome: tecnico.nome, matricula: tecnico.matricula, equipe: tecnico.equipe },
          dtAtribuicao: new Date().toISOString(),
          hist: [...(servico.hist || []), novoHist]
        }).eq('id', id);
      });
      
      await Promise.all(promises);
      setSelectedIds([]);
      setSelectedTecnico('');
    } catch (err) {
      alert('Erro ao atribuir serviços.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRemoverAtribuicao = async () => {
    if (!window.confirm(`Tem certeza que deseja remover a atribuição de ${selectedIds.length} serviços?`)) return;
    
    setLoadingAction(true);
    try {
      const promises = selectedIds.map(async (id) => {
        const servico = servicos.find(s => s.id === id);
        const novoHist = {
          who: user.label,
          matricula: user.matricula,
          when: new Date().toISOString(),
          msg: `Atribuição removida`
        };
        
        return supabase.from('servicos').update({
          atribuido_para: null,
          dtAtribuicao: null,
          hist: [...(servico.hist || []), novoHist]
        }).eq('id', id);
      });
      
      await Promise.all(promises);
      setSelectedIds([]);
    } catch (err) {
      alert('Erro ao remover atribuição.');
    } finally {
      setLoadingAction(false);
    }
  };

  const inputStyle = { padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', background: '#fff', color: '#1e293b', height: '32px', boxSizing: 'border-box' };
  const labelUp = { fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '5px', display: 'block' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* ── Filtros ── */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ flex: '1', minWidth: '140px' }}>
              <label style={labelUp}>Status</label>
              <MultiSelect options={statusOptions} selected={filtroStatus} onChange={setFiltroStatus} placeholder="Todos Status" />
            </div>
            <div style={{ flex: '1', minWidth: '140px' }}>
              <label style={labelUp}>Localidade</label>
              <MultiSelect options={locaisOptions} selected={filtroLocal} onChange={setFiltroLocal} placeholder="Todas Localidades" />
            </div>
            <div style={{ flex: '1', minWidth: '140px' }}>
              <label style={labelUp}>Tipo</label>
              <MultiSelect options={tiposOptions} selected={filtroTipo} onChange={setFiltroTipo} placeholder="Todos Tipos" />
            </div>
            <div style={{ width: '130px' }}>
              <label style={labelUp}>Data de</label>
              <input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div style={{ width: '130px' }}>
              <label style={labelUp}>Data até</label>
              <input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div style={{ width: '140px' }}>
              <label style={labelUp}>Posto</label>
              <select value={posto} onChange={e => setPosto(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                <option value="">Todos os postos</option>
                {Object.keys(POSTOS).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={handleLimparFiltros} style={{ fontSize: '11px', padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#fff', color: '#64748b', cursor: 'pointer', fontWeight: '500', height: '32px' }}>
              Limpar filtros
            </button>
            <div style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', borderRadius: '20px', padding: '5px 12px', fontWeight: '600' }}>
              {servicosFiltrados.length} encontrados
            </div>
          </div>
          
        </div>
      </div>

      {/* ── Tabela ── */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', position: 'relative' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '12px', width: '40px', textAlign: 'center' }}>
                  <input type="checkbox" 
                    checked={currentData.length > 0 && selectedIds.length === currentData.length} 
                    onChange={toggleSelectAll} 
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: '700', padding: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>ID</th>
                <th style={{ textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: '700', padding: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Local</th>
                <th style={{ textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: '700', padding: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tipo</th>
                <th style={{ textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: '700', padding: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Equip</th>
                <th style={{ textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: '700', padding: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Status</th>
                <th style={{ textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: '700', padding: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Data</th>
                <th style={{ textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: '700', padding: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Atribuído para</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Carregando serviços...</td></tr>
              ) : currentData.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Nenhum serviço encontrado.</td></tr>
              ) : (
                currentData.map((s, i) => {
                  const scfg = STATUS_CONFIG[s.status] || { label: s.status, bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
                  const dataFormatada = s.data ? new Date(s.data).toLocaleDateString('pt-BR') : '—';
                  const isSelected = selectedIds.includes(s.id);
                  
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc', background: isSelected ? '#eff6ff' : i % 2 === 0 ? '#fff' : '#fafbfc', transition: 'background 0.1s' }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(s.id)} style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#0f2544' }}>{s.numServ || s.id}</td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{s.local || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontWeight: '500' }}>{s.tipoServ || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '500' }}>{s.equip || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: scfg.bg, color: scfg.color, border: `1px solid ${scfg.border}` }}>
                          {scfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{dataFormatada}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {s.atribuido_para ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: '#1d4ed8', fontWeight: '600', fontSize: '11px' }}>{s.atribuido_para.nome}</span>
                            {s.atribuido_para.equipe && <span style={{ color: '#94a3b8', fontSize: '10px' }}>{s.atribuido_para.equipe}</span>}
                          </div>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: '11px', fontStyle: 'italic' }}>Não atribuído</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Paginação */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Exibindo <strong style={{ color: '#0f2544' }}>{Math.min((safePage - 1) * PAGE_SIZE + 1, servicosFiltrados.length)}–{Math.min(safePage * PAGE_SIZE, servicosFiltrados.length)}</strong> de <strong style={{ color: '#0f2544' }}>{servicosFiltrados.length}</strong> registros
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', color: safePage === 1 ? '#cbd5e1' : '#475569', cursor: safePage === 1 ? 'not-allowed' : 'pointer' }}>Anterior</button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', color: safePage === totalPages ? '#cbd5e1' : '#475569', cursor: safePage === totalPages ? 'not-allowed' : 'pointer' }}>Próxima</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Barra de Ação (Atribuição) ── */}
      {selectedIds.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: '#0f2544', color: '#fff', padding: '16px 24px', borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: '24px', zIndex: 1000, border: '1px solid #1e3a8a'
        }}>
          <div style={{ fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
              {selectedIds.length}
            </div>
            serviço(s) selecionado(s)
          </div>
          
          <div style={{ width: '1px', height: '24px', background: '#1e3a8a' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select 
              value={selectedTecnico} 
              onChange={e => setSelectedTecnico(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #3b82f6', background: '#1e3a8a', color: '#fff', outline: 'none', width: '220px', fontSize: '13px' }}
            >
              <option value="">Selecione um técnico...</option>
              {tecnicos.map(t => (
                <option key={t.uid} value={t.uid}>{t.nome} — {t.matricula} {t.equipe ? `(${t.equipe})` : ''}</option>
              ))}
            </select>
            
            <button 
              onClick={handleAtribuir} 
              disabled={loadingAction || !selectedTecnico}
              style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: (loadingAction || !selectedTecnico) ? 'not-allowed' : 'pointer', opacity: (loadingAction || !selectedTecnico) ? 0.6 : 1, transition: 'all 0.15s' }}
            >
              {loadingAction ? 'Salvando...' : 'Atribuir'}
            </button>
            
            <button 
              onClick={handleRemoverAtribuicao}
              disabled={loadingAction}
              style={{ padding: '8px 16px', background: 'transparent', color: '#fca5a5', border: '1px solid #991b1b', borderRadius: '8px', fontWeight: '500', cursor: loadingAction ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
            >
              Remover atribuição
            </button>
          </div>
          
          <button 
            onClick={() => setSelectedIds([])}
            style={{ position: 'absolute', top: '-10px', right: '-10px', width: '24px', height: '24px', borderRadius: '50%', background: '#fff', color: '#0f2544', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default DespacharTab;
