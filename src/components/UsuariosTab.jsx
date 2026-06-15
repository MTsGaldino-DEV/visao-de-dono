import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const UsuariosTab = () => {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState('');
  
  // Form state
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [role, setRole] = useState('tecnico');
  const [equipe, setEquipe] = useState('');
  
  // Filters
  const [filtroRole, setFiltroRole] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Inline reset password state
  const [resetUid, setResetUid] = useState(null);
  const [novaSenha, setNovaSenha] = useState('');

  useEffect(() => {
    fetchUsuarios();
    
    const subscription = supabase.channel('usuarios-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setUsuarios(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setUsuarios(prev => prev.map(u => u.uid === payload.new.uid ? payload.new : u));
        } else if (payload.eventType === 'DELETE') {
          setUsuarios(prev => prev.filter(u => u.uid !== payload.old.uid));
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchUsuarios = async () => {
    const { data } = await supabase.from('usuarios').select('*').order('nome');
    if (data) setUsuarios(data);
  };

  const handleCadastrar = async (e) => {
    e.preventDefault();
    if (senha.length < 6) {
      alert("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setLoading(true);
    setMensagem('');
    
    try {
      const { data, error } = await supabase.functions.invoke('gerenciar-usuarios', {
        body: { acao: 'criar', nome, matricula, senha, role, equipe }
      });
      
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      
      setMensagem('Usuário cadastrado!');
      setNome('');
      setMatricula('');
      setSenha('');
      setRole('tecnico');
      setEquipe('');
      
      setTimeout(() => setMensagem(''), 3000);
    } catch (err) {
      alert("Erro ao cadastrar usuário: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (uid, currentStatus) => {
    const { error } = await supabase.from('usuarios').update({ ativo: !currentStatus }).eq('uid', uid);
    if (error) alert("Erro ao atualizar status: " + error.message);
  };

  const handleResetSenha = async (uid) => {
    if (novaSenha.length < 6) {
      alert("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('gerenciar-usuarios', {
        body: { acao: 'trocar_senha', uid, novaSenha }
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      
      alert("Senha atualizada com sucesso!");
      setResetUid(null);
      setNovaSenha('');
    } catch (err) {
      alert("Erro ao atualizar senha: " + err.message);
    }
  };

  const handleExcluir = async (uid, nomeUsuario) => {
    if (window.confirm(`Tem certeza que deseja excluir o usuário ${nomeUsuario}?`)) {
      try {
        const { data, error } = await supabase.functions.invoke('gerenciar-usuarios', {
          body: { acao: 'deletar', uid }
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
      } catch (err) {
        alert("Erro ao excluir usuário: " + err.message);
      }
    }
  };

  const usuariosFiltrados = usuarios.filter(u => {
    if (filtroRole !== 'todos' && u.role !== filtroRole) return false;
    if (filtroStatus === 'ativo' && !u.ativo) return false;
    if (filtroStatus === 'inativo' && u.ativo) return false;
    return true;
  });

  return (
    <div style={{ padding: '24px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#0f2544', marginBottom: '24px' }}>Gerenciamento de Usuários</h2>
      
      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        {/* Lado Esquerdo - Formulário */}
        <div style={{ flex: '1', minWidth: '300px', maxWidth: '400px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#334155', marginBottom: '16px' }}>Cadastrar Novo Usuário</h3>
          
          <form onSubmit={handleCadastrar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Nome</label>
              <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Matrícula</label>
              <input type="text" required value={matricula} onChange={(e) => setMatricula(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input type={mostrarSenha ? "text" : "password"} required value={senha} onChange={(e) => setSenha(e.target.value)} style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '12px' }}>
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Mínimo 6 caracteres</span>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fff' }}>
                <option value="tecnico">Técnico</option>
                <option value="despachante">Despachante</option>
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Equipe</label>
              <input type="text" value={equipe} onChange={(e) => setEquipe(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            
            <button disabled={loading} type="submit" style={{ marginTop: '8px', padding: '12px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </button>
            
            {mensagem && (
              <div style={{ padding: '10px', background: '#dcfce7', color: '#166534', borderRadius: '6px', fontSize: '13px', textAlign: 'center', fontWeight: '500' }}>
                {mensagem}
              </div>
            )}
          </form>
        </div>

        {/* Lado Direito - Lista */}
        <div style={{ flex: '2', minWidth: '400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#334155' }}>Lista de Usuários ({usuariosFiltrados.length})</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select value={filtroRole} onChange={(e) => setFiltroRole(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#64748b', backgroundColor: '#fff' }}>
                <option value="todos">Todos Roles</option>
                <option value="tecnico">Técnicos</option>
                <option value="despachante">Despachantes</option>
              </select>
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#64748b', backgroundColor: '#fff' }}>
                <option value="todos">Todos Status</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
              </select>
            </div>
          </div>
          
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '12px 16px', fontWeight: '500' }}>Nome / Matrícula</th>
                  <th style={{ padding: '12px 16px', fontWeight: '500' }}>Role / Equipe</th>
                  <th style={{ padding: '12px 16px', fontWeight: '500' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map(u => (
                  <tr key={u.uid} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '500', color: '#334155' }}>{u.nome}</div>
                      <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>{u.matricula}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ 
                        display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                        ...(u.role === 'tecnico' ? { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' } : { background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe' })
                      }}>
                        {u.role === 'tecnico' ? 'Técnico' : 'Despachante'}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>{u.equipe || '-'}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                        background: u.ativo ? '#dcfce7' : '#fee2e2', color: u.ativo ? '#166534' : '#991b1b'
                      }}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {resetUid === u.uid ? (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <input type="password" placeholder="Nova senha" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} style={{ width: '100px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                          <button onClick={() => handleResetSenha(u.uid)} style={{ padding: '4px 8px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Salvar</button>
                          <button onClick={() => {setResetUid(null); setNovaSenha('');}} style={{ padding: '4px 8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Cancelar</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleToggleStatus(u.uid, u.ativo)} style={{ padding: '4px 8px', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                            {u.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                          <button onClick={() => setResetUid(u.uid)} style={{ padding: '4px 8px', background: 'transparent', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                            Senha
                          </button>
                          <button onClick={() => handleExcluir(u.uid, u.nome)} style={{ padding: '4px 8px', background: 'transparent', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                            Excluir
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {usuariosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsuariosTab;
