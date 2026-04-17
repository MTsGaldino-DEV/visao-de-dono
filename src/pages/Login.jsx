import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const matriculaLimpa = matricula.trim().replace('@visaodono.app', '');

    try {
      await login(matriculaLimpa, senha);
      navigate('/');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/configuration-not-found') {
        setError('Erro de configuração do Firebase. Aguarde 30 segundos e tente novamente.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Matrícula ou senha incorreta.');
      } else {
        setError('Erro ao fazer login. Tente novamente mais tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e, nextId) => {
    if (e.key === 'Enter' && nextId) {
      document.getElementById(nextId)?.focus();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f0f4f8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '32px 28px',
        width: '100%',
        maxWidth: '360px'
      }}>
        {/* Logo + Título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <ellipse cx="18" cy="18" rx="17" ry="17" fill="#1a3a5c"/>
            <path d="M4,18 Q18,4 32,18 Q18,32 4,18 Z" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="18" cy="18" r="5" fill="#fff"/>
            <circle cx="18" cy="18" r="2" fill="#1a3a5c"/>
          </svg>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a3a5c', margin: 0 }}>
            Visão de Dono
          </h2>
        </div>

        <p style={{ fontSize: '13px', color: '#888', margin: '0 0 24px 0' }}>
          Controle de serviços de campo
        </p>

        <form onSubmit={handleSubmit}>
          {/* Matrícula */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: '#888' }}>Matrícula</label>
            <input
              id="input-matricula"
              type="text"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'input-senha')}
              placeholder="Digite sua matrícula"
              style={{
                width: '100%',
                padding: '7px 9px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                fontSize: '13px',
                background: '#fff',
                color: '#222',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          {/* Senha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '18px' }}>
            <label style={{ fontSize: '11px', color: '#888' }}>Senha</label>
            <input
              id="input-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              style={{
                width: '100%',
                padding: '7px 9px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                fontSize: '13px',
                background: '#fff',
                color: '#222',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          {/* Erro */}
          {error && (
            <p style={{ color: '#c62828', fontSize: '12px', margin: '0 0 10px 0' }}>
              {error}
            </p>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px 18px',
              backgroundColor: '#1a3a5c',
              color: '#fff',
              border: '2px solid #1a3a5c',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            onMouseEnter={(e) => { if (!loading) e.target.style.backgroundColor = '#12294a'; }}
            onMouseLeave={(e) => { e.target.style.backgroundColor = '#1a3a5c'; }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;