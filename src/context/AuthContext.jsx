import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ehColaborador, MSG_COLABORADOR_WEB } from '../lib/colaboradores';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('uid', userId)
        .single();

      if (error) {
        console.error('Erro ao buscar perfil:', error);
        return null;
      }

      return {
        uid: data.uid,
        matricula: data.matricula,
        role: data.role,
        label: data.nome
      };
    } catch (err) {
      console.error('Erro na requisição do perfil:', err);
      return null;
    }
  };

  const login = async (matricula, senha) => {
    const matriculaLimpa = matricula.trim();
    const email = `${matriculaLimpa}@visaodedono.com`;

    console.log('🔑 Tentando login com email:', email);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: senha
      });

      if (error) {
        throw error;
      }

      const fullUser = await fetchProfile(data.user.id);
      if (!fullUser) {
        throw new Error('Usuário não autorizado ou perfil não encontrado no sistema');
      }

      // Colaboradores usam só o app de celular
      if (ehColaborador(fullUser)) {
        await supabase.auth.signOut();
        const bloqueio = new Error(MSG_COLABORADOR_WEB);
        bloqueio.code = 'colaborador';
        throw bloqueio;
      }

      setUser(fullUser);
      console.log('✅ Login realizado com sucesso:', fullUser.label);
      return fullUser;
    } catch (error) {
      console.error('❌ Erro no login:', error.message);
      throw error;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    let mounted = true;

    // Função para checar a sessão inicial
    const checkInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          if (profile && ehColaborador(profile)) {
            await supabase.auth.signOut();
          } else if (mounted && profile) {
            setUser(profile);
            console.log('👤 Usuário logado via sessão inicial:', profile.matricula);
          }
        }
      } catch (error) {
        console.error('Erro ao checar sessão inicial:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkInitialSession();

    // Listener de mudanças de estado
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (profile && ehColaborador(profile)) {
          // o login() já encerra a sessão e mostra o aviso
        } else if (mounted && profile) {
          setUser(profile);
          console.log('👤 Usuário logado via onAuthStateChange:', profile.matricula);
        }
      } else if (event === 'SIGNED_OUT') {
        if (mounted) setUser(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);