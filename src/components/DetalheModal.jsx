import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const STATUS_CONFIG = {
  cadastrado: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Cadastrado' },
  enviado:    { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe', label: 'Enviado CEMIG' },
  pendente:   { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Pendente' },
  concluido:  { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Concluído' },
  cancelado:  { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Cancelado' },
};

const fmtDt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const baseInput = {
  width: '100%', padding: '8px 11px',
  border: '1px solid #e2e8f0', borderRadius: '8px',
  fontSize: '13px', background: '#f8fafc', color: '#1e293b',
  boxSizing: 'border-box', outline: 'none',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const SectionTitle = ({ children }) => (
  <div style={{
    fontSize: '10px', fontWeight: '700', color: '#94a3b8',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px',
  }}>
    {children}
  </div>
);

const Field = ({ label, children, fullWidth }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: fullWidth ? '1 / -1' : undefined }}>
    <label style={{ fontSize: '10px', fontWeight: '600', color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {label}
    </label>
    {children}
  </div>
);

const DetalheModal = ({ service, isOpen, onClose, isDono: isDonoProp }) => {
  const { user } = useAuth();
  // Qualquer usuário pode editar os próprios campos; dono tem acesso total
  const isDono = isDonoProp;

  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (service) {
      setFormData({
        local:  service.local  || '',
        desc:   service.desc   || '',
        tipo:   service.tipo   || '',
        equip:  service.equip  || '',
        coord:  service.coord  || '',
        data:   service.data   || '',
        foto:   service.foto   || '',
        orig:   service.orig   || '',
        obs:    service.obs    || '',
        numServ: service.numServ || '',
      });
      setSaved(false);
    }
  }, [service]);

  if (!isOpen || !service) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const inp = (name) => ({
    ...baseInput,
    borderColor: focused === name ? '#3b82f6' : '#e2e8f0',
    background:  focused === name ? '#fff'    : '#f8fafc',
    boxShadow:   focused === name ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
  });

  // Hoje como max para datetime
  const hoje = new Date();
  const maxDate = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}T23:59:59`;

  const salvar = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'servicos', service._docId), {
        ...formData,
        hist: [...(service.hist || []), {
          who: user.label, matricula: user.matricula,
          when: new Date().toISOString(),
          msg: 'Dados do serviço atualizados.',
        }],
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { alert('Erro ao salvar alterações.'); }
    finally { setLoading(false); }
  };

  const statusCfg = STATUS_CONFIG[service.status] || { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', label: service.status };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.6)',
        backdropFilter: 'blur(4px)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0',
        width: '640px', maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(15,37,68,0.25)',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: '#fff', borderRadius: '14px 14px 0 0', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544' }}>{service.id}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                Cadastrado por {service.autor} ({service.matriculaAutor})
              </div>
            </div>
            <span style={{
              fontSize: '10px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600',
              background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}`,
            }}>
              {statusCfg.label}
            </span>
          </div>
          <button onClick={onClose} style={{
            width: '30px', height: '30px', border: '1px solid #e2e8f0', borderRadius: '8px',
            background: '#f8fafc', color: '#64748b', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', padding: 0,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.color = '#b91c1c'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
          >×</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Bloco: Identificação ── */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', padding: '16px' }}>
            <SectionTitle>Identificação</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Data do levantamento" fullWidth>
                <input type="datetime-local" step="1" name="data"
                  min="2025-01-01T00:00:00" max={maxDate}
                  value={formData.data} onChange={handleChange}
                  style={inp('data')} onFocus={() => setFocused('data')} onBlur={() => setFocused('')}
                />
              </Field>
              <Field label="Localidade">
                <input type="text" name="local" placeholder="Ex: Frei Inocêncio"
                  value={formData.local} onChange={handleChange}
                  style={inp('local')} onFocus={() => setFocused('local')} onBlur={() => setFocused('')}
                />
              </Field>
              <Field label="Tipo de serviço">
                <select name="tipo" value={formData.tipo} onChange={handleChange}
                  style={inp('tipo')} onFocus={() => setFocused('tipo')} onBlur={() => setFocused('')}>
                  <option value="NSIS">NSIS</option>
                  <option value="NSMP">NSMP</option>
                  <option value="RC02">RC02</option>
                  <option value="INBE">INBE</option>
                </select>
              </Field>
              <Field label="Descrição" fullWidth>
                <textarea name="desc" rows={3} placeholder="Descrição do serviço..."
                  value={formData.desc} onChange={handleChange}
                  style={{ ...inp('desc'), resize: 'vertical' }}
                  onFocus={() => setFocused('desc')} onBlur={() => setFocused('')}
                />
              </Field>
            </div>
          </div>

          {/* ── Bloco: Técnico ── */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', padding: '16px' }}>
            <SectionTitle>Técnico &amp; Equipamento</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Equipamento (nº da placa)">
                <input type="text" name="equip" placeholder="Ex: 13867"
                  value={formData.equip} onChange={handleChange}
                  style={inp('equip')} onFocus={() => setFocused('equip')} onBlur={() => setFocused('')}
                />
              </Field>
              <Field label="Coordenada">
                <input type="text" name="coord" placeholder="-18.517, -41.936"
                  value={formData.coord} onChange={handleChange}
                  style={inp('coord')} onFocus={() => setFocused('coord')} onBlur={() => setFocused('')}
                />
              </Field>
              <Field label="Técnico de origem">
                <input type="text" name="orig" placeholder="Nome do técnico"
                  value={formData.orig} onChange={handleChange}
                  style={inp('orig')} onFocus={() => setFocused('orig')} onBlur={() => setFocused('')}
                />
              </Field>
              <Field label="Link da foto">
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" name="foto" placeholder="https://..."
                    value={formData.foto} onChange={handleChange}
                    style={{ ...inp('foto'), flex: 1 }}
                    onFocus={() => setFocused('foto')} onBlur={() => setFocused('')}
                  />
                  {formData.foto && (
                    <a href={formData.foto} target="_blank" rel="noreferrer"
                      style={{
                        padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: '8px',
                        background: '#f8fafc', color: '#64748b', display: 'flex', alignItems: 'center',
                        textDecoration: 'none', flexShrink: 0,
                      }}
                      title="Abrir foto"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  )}
                </div>
              </Field>
              <Field label="Observações" fullWidth>
                <input type="text" name="obs" placeholder="Observações adicionais"
                  value={formData.obs} onChange={handleChange}
                  style={inp('obs')} onFocus={() => setFocused('obs')} onBlur={() => setFocused('')}
                />
              </Field>
            </div>
          </div>

          {/* ── Bloco: CEMIG ── */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', padding: '16px' }}>
            <SectionTitle>CEMIG</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Nº do serviço CEMIG">
                <input type="text" name="numServ" placeholder="Ex: 240850456"
                  value={formData.numServ} onChange={handleChange}
                  style={inp('numServ')} onFocus={() => setFocused('numServ')} onBlur={() => setFocused('')}
                />
              </Field>
            </div>
          </div>

          {/* ── Histórico ── */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', padding: '16px' }}>
            <SectionTitle>Histórico</SectionTitle>
            {(service.hist || []).length === 0 && (
              <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                Sem histórico registrado.
              </div>
            )}
            {(service.hist || []).slice().reverse().map((h, i, arr) => (
              <div key={i} style={{
                display: 'flex', gap: '10px',
                paddingBottom: i < arr.length - 1 ? '10px' : 0,
                marginBottom:  i < arr.length - 1 ? '10px' : 0,
                borderBottom:  i < arr.length - 1 ? '1px solid #e2e8f0' : 'none',
              }}>
                <div style={{
                  width: '28px', height: '28px', flexShrink: 0, background: '#e0f2fe',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: '700', color: '#0369a1',
                }}>
                  {(h.who || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>{h.who}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{fmtDt(h.when)}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{h.msg}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Ações ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              Todos os campos são editáveis por qualquer usuário.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onClose} style={{
                padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '8px',
                background: '#fff', color: '#475569', cursor: 'pointer',
                fontSize: '13px', fontWeight: '500', fontFamily: 'inherit',
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                Fechar
              </button>
              <button onClick={salvar} disabled={loading} style={{
                padding: '8px 20px', border: 'none', borderRadius: '8px',
                background: saved
                  ? 'linear-gradient(135deg, #15803d, #16a34a)'
                  : loading ? '#94a3b8'
                  : 'linear-gradient(135deg, #0f2544, #1d4ed8)',
                color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: '600', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'background 0.2s',
              }}>
                {saved ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Salvo!
                  </>
                ) : loading ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DetalheModal;