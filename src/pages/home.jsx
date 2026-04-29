import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import CadastroForm from '../components/CadastroForm';
import ServicosTable from '../components/ServicosTable';
import PlacasTab from '../components/PlacasTab';
import PainelTab from '../components/PainelTab';

const Home = () => {
  const { user, logout, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('cadastrar');

  const isDono = user?.role === 'dono';

  const tabs = [
    { key: 'cadastrar', label: 'Cadastrar' },
    { key: 'servicos',  label: 'Serviços'  },
    { key: 'placas',    label: 'Placas'    },
    ...(isDono ? [{ key: 'painel', label: 'Painel' }] : []),
  ];

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f0f2f5', fontFamily: "'Segoe UI', system-ui, sans-serif",
        color: '#94a3b8', fontSize: '13px',
      }}>
        Carregando...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f0f2f5',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      fontSize: '14px',
      color: '#1a1a2e',
    }}>

      {/* TOPBAR — minimalista, fundo branco */}
      <header style={{
        backgroundColor: '#ffffff',
        padding: '0 28px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '52px',
        borderBottom: '1px solid #e8ecf0',
      }}>

        {/* Logo — olho idêntico ao Login */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
            <ellipse cx="18" cy="18" rx="17" ry="17" fill="#1a3a5c"/>
            <path d="M4,18 Q18,4 32,18 Q18,32 4,18 Z" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="18" cy="18" r="5" fill="#fff"/>
            <circle cx="18" cy="18" r="2" fill="#1a3a5c"/>
          </svg>
          <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544', letterSpacing: '-0.01em' }}>
            Visão de Dono
          </span>
        </div>

        {/* Usuário + Sair */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {user?.label}
            <span style={{ color: '#cbd5e1', margin: '0 6px' }}>·</span>
            <span style={{ color: '#94a3b8' }}>{user?.matricula}</span>
          </span>
          <button
            onClick={logout}
            style={{
              fontSize: '12px', padding: '5px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              background: '#fff',
              color: '#64748b',
              cursor: 'pointer',
              fontWeight: '500',
              fontFamily: 'inherit',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#334155'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
          >
            Sair
          </button>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main style={{ padding: '24px', maxWidth: '1500px', margin: '0 auto' }}>

        {/* TABS */}
        <nav style={{
          display: 'flex',
          gap: '2px',
          marginBottom: '20px',
          background: '#fff',
          borderRadius: '10px',
          padding: '4px',
          border: '1px solid #e2e8f0',
          width: 'fit-content',
        }}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '7px 18px',
                background: activeTab === key ? '#0f2544' : 'transparent',
                border: 'none',
                borderRadius: '7px',
                fontSize: '13px',
                cursor: 'pointer',
                color: activeTab === key ? '#ffffff' : '#64748b',
                fontWeight: activeTab === key ? '600' : '400',
                transition: 'all 0.12s',
                letterSpacing: '0.01em',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => { if (activeTab !== key) { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#334155'; }}}
              onMouseLeave={e => { if (activeTab !== key) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* CONTEÚDO DAS TABS
            Mantemos CadastroForm e ServicosTable sempre montados (display none/block)
            para evitar que desmonte ao trocar de aba e perca o estado/listener do Firebase */}
        <div style={{ display: activeTab === 'cadastrar' ? 'block' : 'none' }}>
          <CadastroForm />
        </div>

        <div style={{ display: activeTab === 'servicos' ? 'block' : 'none' }}>
          <ServicosTable />
        </div>

        <div style={{ display: activeTab === 'placas' ? 'block' : 'none' }}>
          <PlacasTab />
        </div>

        <div style={{ display: activeTab === 'painel' ? 'block' : 'none' }}>
          <PainelTab />
        </div>
      </main>
    </div>
  );
};

export default Home;