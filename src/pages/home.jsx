import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import CadastroForm from '../components/CadastroForm';
import ServicosTable from '../components/ServicosTable';
import PlacasTab from '../components/PlacasTab';
import PainelTab from '../components/PainelTab';
import FaturamentoTab from '../components/Faturamentotab';
import LogsTab from '../components/LogsTab';
import GerarServicosTab from '../components/GerarServicosTab';
import UsuariosTab from '../components/UsuariosTab';
import EspacadoresTab from '../components/EspacadoresTab';
import DuplicidadeTab from '../components/DuplicidadeTab';
import LevantamentosTab from '../components/LevantamentosTab';
import MapaTab from '../components/MapaTab';
import FluxoInstalacoes from '../components/espacadores/FluxoInstalacoes';
import Sidebar, { LogoOlho } from '../components/Sidebar';
import { telaInicial, telaSalvaLegada, localizarTela } from '../lib/navegacao';
import { supabase } from '../lib/supabase';

// Tela salva no navegador; na primeira vez, aproveita a aba/sub-aba da navegação antiga
const telaSalva = () => localStorage.getItem('vd_tela') || telaSalvaLegada({
  aba: localStorage.getItem('vd_tab'),
  subDespacho: localStorage.getItem('vd_subtab_despacho'),
  subAdmin: localStorage.getItem('vd_subtab_admin'),
});

const Home = () => {
  const { user, logout, loading } = useAuth();
  const soFechamento = user?.role === 'fechamento';

  const [telaEscolhida, setTelaEscolhida] = useState(telaSalva);
  const [menuAberto, setMenuAberto] = useState(false);

  // Sempre uma tela permitida para o perfil (inclusive quando a salva no navegador não serve)
  const tela = user ? telaInicial(user.role, telaEscolhida) : telaEscolhida;

  const navegar = (key) => {
    setTelaEscolhida(key);
    localStorage.setItem('vd_tela', key);
    setMenuAberto(false);
  };

  const [pendentesCount, setPendentesCount] = useState(0);

  useEffect(() => {
    const fetchPendentes = async () => {
      const { count } = await supabase
        .from('levantamentos')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente');
      setPendentesCount(count || 0);
    };

    if (user) {
      fetchPendentes();
      const channel = supabase.channel('home_levantamentos')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'levantamentos' }, () => {
          fetchPendentes();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

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

  const local = localizarTela(tela);
  const mostrar = (key) => ({ display: tela === key ? 'block' : 'none' });

  return (
    <div className="vd-app">
      {/* Celular: barra fina com botão que abre a sidebar como gaveta */}
      <header className="vd-topbar-mobile">
        <button className="vd-menu-btn" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">☰</button>
        <LogoOlho tamanho={24} />
        <span>Visão de Dono</span>
      </header>

      <Sidebar
        user={user}
        telaAtiva={tela}
        onNavegar={navegar}
        contagens={{ levantamentos: pendentesCount }}
        onSair={logout}
        aberta={menuAberto}
        onFechar={() => setMenuAberto(false)}
      />

      <main className="vd-main">
        <div className="vd-main-inner">
          {local && (
            <h1 className="vd-page-title">
              {local.grupo.label !== local.item.label && <span className="grupo">{local.grupo.label} ›</span>}
              {local.item.label}
            </h1>
          )}

          {/* CONTEÚDO DAS TELAS
              Mantemos CadastroForm, ServicosTable, Placas, Espaçadores e Painel sempre montados (display none/block)
              para evitar que desmonte ao trocar de tela e perca o estado/listener */}
          {!soFechamento && (
            <>
              <div style={mostrar('cadastrar')}>
                <CadastroForm />
              </div>

              <div style={mostrar('servicos')}>
                <ServicosTable />
              </div>

              <div style={mostrar('placas')}>
                <PlacasTab />
              </div>

              <div style={mostrar('espacadores')}>
                <EspacadoresTab />
              </div>
            </>
          )}

          <div style={mostrar('levantamentos')}>
            {tela === 'levantamentos' && <LevantamentosTab />}
          </div>

          <div style={mostrar('mapa')}>
            {tela === 'mapa' && <MapaTab />}
          </div>

          {!soFechamento && (
            <div style={mostrar('painel')}>
              <PainelTab />
            </div>
          )}

          <div style={mostrar('faturamento')}>
            {tela === 'faturamento' && <FaturamentoTab />}
          </div>

          <div style={mostrar('instalacoes')}>
            {tela === 'instalacoes' && <FluxoInstalacoes />}
          </div>

          <div style={mostrar('gerar-os')}>
            {tela === 'gerar-os' && <GerarServicosTab />}
          </div>

          <div style={mostrar('duplicidade')}>
            {tela === 'duplicidade' && <DuplicidadeTab />}
          </div>

          <div style={mostrar('logs')}>
            {tela === 'logs' && <LogsTab />}
          </div>

          <div style={mostrar('usuarios')}>
            {tela === 'usuarios' && <UsuariosTab />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
