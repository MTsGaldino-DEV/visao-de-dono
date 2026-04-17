import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/firebase';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '13px',
  background: '#f8fafc',
  color: '#1e293b',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.15s, background 0.15s',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
};

const labelStyle = {
  fontSize: '11px',
  fontWeight: '600',
  color: '#64748b',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: '5px',
  display: 'block',
};

const fieldStyle = { display: 'flex', flexDirection: 'column' };

const SectionLabel = ({ children }) => (
  <div style={{
    fontSize: '10px', fontWeight: '700', color: '#94a3b8',
    letterSpacing: '0.1em', textTransform: 'uppercase',
    marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px',
  }}>
    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
    {children}
    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
  </div>
);

// Popup de sucesso
const SuccessPopup = ({ onClose }) => (
  <div style={{
    position: 'fixed', inset: 0,
    background: 'rgba(15,37,68,0.45)',
    backdropFilter: 'blur(3px)',
    zIndex: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px',
  }}>
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      padding: '36px 40px',
      textAlign: 'center',
      maxWidth: '340px',
      width: '100%',
      boxShadow: '0 20px 60px rgba(15,37,68,0.18)',
      animation: 'popIn 0.2s ease',
    }}>
      <style>{`@keyframes popIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
      <div style={{
        width: '56px', height: '56px',
        background: '#f0fdf4',
        border: '2px solid #bbf7d0',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f2544', marginBottom: '6px' }}>
        Serviço cadastrado!
      </div>
      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>
        O serviço foi registrado com sucesso e já aparece na lista.
      </div>
      <button
        onClick={onClose}
        style={{
          padding: '9px 28px',
          border: 'none',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #0f2544, #1d4ed8)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        OK
      </button>
    </div>
  </div>
);

const CadastroForm = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    data: '', local: '', desc: '', tipo: '', equip: '', coord: '', foto: '', orig: '', obs: ''
  });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Limites de data: 01/01/2025 até hoje
  const hoje = new Date();
  const maxDate = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}T23:59:59`;
  const minDate = '2025-01-01T00:00:00';

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id.replace('f-', '')]: value }));
  };

  const cadastrar = async () => {
    if (!formData.local || !formData.desc || !formData.tipo) {
      alert('Preencha os campos obrigatórios: Localidade, Descrição e Tipo.');
      return;
    }
    if (formData.data) {
      const dataSelecionada = new Date(formData.data);
      const agora = new Date();
      const minimo = new Date('2025-01-01');
      if (dataSelecionada > agora) {
        alert('A data não pode ser no futuro.');
        return;
      }
      if (dataSelecionada < minimo) {
        alert('A data não pode ser anterior a 01/01/2025.');
        return;
      }
    }
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'servicos'));
      const total = snapshot.size;
      const novoId = `VD${String(total + 1).padStart(4, '0')}`;

      await addDoc(collection(db, 'servicos'), {
        ...formData,
        id: novoId,
        status: 'cadastrado',
        numServ: '',
        autor: user.label,
        matriculaAutor: user.matricula,
        dtCadastro: serverTimestamp(),
        hist: [{ who: user.label, matricula: user.matricula, when: new Date().toISOString(), msg: 'Serviço cadastrado.' }]
      });
      setFormData({ data: '', local: '', desc: '', tipo: '', equip: '', coord: '', foto: '', orig: '', obs: '' });
      setShowSuccess(true);
    } catch (error) {
      alert('Erro ao cadastrar o serviço.');
    } finally {
      setLoading(false);
    }
  };

  const getInputStyle = (id) => ({
    ...inputStyle,
    borderColor: focused === id ? '#3b82f6' : '#e2e8f0',
    background: focused === id ? '#fff' : '#f8fafc',
    boxShadow: focused === id ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
  });

  return (
    <>
      {showSuccess && <SuccessPopup onClose={() => setShowSuccess(false)} />}

      <div style={{
        background: '#fff', borderRadius: '12px',
        border: '1px solid #e2e8f0', overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'linear-gradient(to right, #f8fafc, #fff)',
        }}>
          <div style={{
            width: '32px', height: '32px',
            background: 'linear-gradient(135deg, #0f2544, #1d4ed8)',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f2544' }}>Novo Serviço Levantado</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>Preencha os campos para registrar o levantamento</div>
          </div>
        </div>

        {/* Formulário */}
        <div style={{ padding: '20px' }}>
          <SectionLabel>Identificação</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Data do levantamento</label>
              <input
                type="datetime-local" step="1" id="f-data"
                min={minDate} max={maxDate}
                value={formData.data} onChange={handleChange}
                style={getInputStyle('data')}
                onFocus={() => setFocused('data')} onBlur={() => setFocused('')}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Localidade <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" id="f-local" placeholder="Ex: Frei Inocêncio"
                value={formData.local} onChange={handleChange} style={getInputStyle('local')}
                onFocus={() => setFocused('local')} onBlur={() => setFocused('')} />
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Descrição da solicitação <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea id="f-desc" rows={3} placeholder="Descreva detalhadamente o serviço..."
                value={formData.desc} onChange={handleChange}
                style={{ ...getInputStyle('desc'), resize: 'vertical' }}
                onFocus={() => setFocused('desc')} onBlur={() => setFocused('')} />
            </div>
          </div>

          <SectionLabel>Técnico</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Tipo de serviço <span style={{ color: '#ef4444' }}>*</span></label>
              <select id="f-tipo" value={formData.tipo} onChange={handleChange}
                style={getInputStyle('tipo')} onFocus={() => setFocused('tipo')} onBlur={() => setFocused('')}>
                <option value="">Selecione...</option>
                <option value="NSIS">NSIS</option>
                <option value="NSMP">NSMP</option>
                <option value="RC02">RC02</option>
                <option value="INBE">INBE</option>
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Equipamento (nº da placa)</label>
              <input type="text" id="f-equip" placeholder="Ex: 13867"
                value={formData.equip} onChange={handleChange} style={getInputStyle('equip')}
                onFocus={() => setFocused('equip')} onBlur={() => setFocused('')} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Coordenada</label>
              <input type="text" id="f-coord" placeholder="-18.517, -41.936"
                value={formData.coord} onChange={handleChange} style={getInputStyle('coord')}
                onFocus={() => setFocused('coord')} onBlur={() => setFocused('')} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Técnico de origem</label>
              <input type="text" id="f-orig" placeholder="Nome do técnico"
                value={formData.orig} onChange={handleChange} style={getInputStyle('orig')}
                onFocus={() => setFocused('orig')} onBlur={() => setFocused('')} />
            </div>
          </div>

          <SectionLabel>Complemento</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Link da foto</label>
              <input type="text" id="f-foto" placeholder="https://..."
                value={formData.foto} onChange={handleChange} style={getInputStyle('foto')}
                onFocus={() => setFocused('foto')} onBlur={() => setFocused('')} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Observações</label>
              <input type="text" id="f-obs" placeholder="Observações adicionais"
                value={formData.obs} onChange={handleChange} style={getInputStyle('obs')}
                onFocus={() => setFocused('obs')} onBlur={() => setFocused('')} />
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: '16px', borderTop: '1px solid #f1f5f9',
          }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              <span style={{ color: '#ef4444' }}>*</span> Campos obrigatórios
            </div>
            <button onClick={cadastrar} disabled={loading} style={{
              padding: '9px 22px', borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', border: 'none',
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0f2544, #1d4ed8)',
              color: '#fff', fontWeight: '600', letterSpacing: '0.02em',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px',
              opacity: loading ? 0.7 : 1,
            }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              {loading ? 'Cadastrando...' : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Cadastrar serviço
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CadastroForm;