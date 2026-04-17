import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Banco de usuários autorizados
  const usersDB = {
    '27630': { role: 'dono', label: 'Matheus' },
    '33783': { role: 'dono', label: 'Rafaela' },
    '34649': { role: 'aprendiz', label: 'Ana' }
  };

  const login = async (matricula, senha) => {
    const matriculaLimpa = matricula.trim();
    const email = `${matriculaLimpa}@visaodono.app`;

    console.log('🔑 Tentando login com email:', email);

    try {
      await signInWithEmailAndPassword(auth, email, senha);

      const userInfo = usersDB[matriculaLimpa];
      if (!userInfo) {
        throw new Error('Usuário não autorizado no sistema');
      }

      const fullUser = {
        uid: 'firebase-' + matriculaLimpa,
        matricula: matriculaLimpa,
        ...userInfo
      };

      setUser(fullUser);
      console.log('✅ Login realizado com sucesso:', fullUser.label);
      return fullUser;
    } catch (error) {
      console.error('❌ Erro no login:', error.code, error.message);
      throw error;
    }
  };

  const logout = () => signOut(auth);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const matricula = firebaseUser.email.split('@')[0];
        const userInfo = usersDB[matricula];
        if (userInfo) {
          setUser({ uid: firebaseUser.uid, matricula, ...userInfo });
          console.log('👤 Usuário logado via onAuthStateChanged:', matricula);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);