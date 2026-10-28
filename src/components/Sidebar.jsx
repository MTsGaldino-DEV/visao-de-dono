import { useState } from 'react';
import { menuDoPerfil } from '../lib/navegacao';
import './Sidebar.css';

// Ícones SVG inline (traço herda a cor do item)
const Svg = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const ICONES = {
  cadastrar: <Svg><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Svg>,
  servicos: <Svg><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></Svg>,
  diversos: <Svg><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Svg>,
  espacadores: <Svg><line x1="2" y1="7" x2="22" y2="7" /><line x1="2" y1="17" x2="22" y2="17" /><line x1="8" y1="7" x2="8" y2="17" /><line x1="16" y1="7" x2="16" y2="17" /></Svg>,
  levantamentos: <Svg><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><polyline points="9 14 11 16 15 12" /></Svg>,
  mapa: <Svg><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></Svg>,
  painel: <Svg><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Svg>,
  faturamento: <Svg><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></Svg>,
  instalacoes: <Svg><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></Svg>,
  'gerar-os': <Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></Svg>,
  duplicidade: <Svg><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>,
  usuarios: <Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>,
  colaboradores: <Svg><path d="M2 18a10 10 0 0 1 20 0" /><path d="M10 10V5a2 2 0 0 1 4 0v5" /><path d="M4 15v-3a6 6 0 0 1 3-5.2" /><path d="M20 15v-3a6 6 0 0 0-3-5.2" /><line x1="1" y1="18" x2="23" y2="18" /></Svg>,
  logs: <Svg><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Svg>,
};

const IcChevron = ({ aberto }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: 'transform .2s', transform: aberto ? 'rotate(180deg)' : 'none' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const PERFIS = { dono: 'Dono', despachante: 'Despachante', fechamento: 'Fechamento', tecnico: 'Técnico', levantador: 'Levantador' };

// Mesmo olho do topo antigo, com as cores invertidas para o fundo escuro
export const LogoOlho = ({ tamanho = 30 }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="18" rx="17" ry="17" fill="#fff" />
    <path d="M4,18 Q18,4 32,18 Q18,32 4,18 Z" fill="none" stroke="#0f2544" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="18" cy="18" r="5" fill="#0f2544" />
    <circle cx="18" cy="18" r="2" fill="#fff" />
  </svg>
);

const Sidebar = ({ user, telaAtiva, onNavegar, contagens = {}, onSair, aberta = false, onFechar }) => {
  const grupos = menuDoPerfil(user?.role);
  const [recolhidos, setRecolhidos] = useState(() => new Set());

  const alternar = (id) => setRecolhidos(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <>
      {aberta && <div className="vd-sidebar-overlay" onClick={onFechar} />}
      <aside className={`vd-sidebar${aberta ? ' aberta' : ''}`}>
        <div className="vd-brand">
          <LogoOlho />
          <div className="vd-brand-text">
            <div className="l1">Visão de Dono</div>
            <div className="l2">Despacho de campo</div>
          </div>
        </div>

        <nav className="vd-nav">
          {grupos.map(grupo => {
            const aberto = !recolhidos.has(grupo.id);
            return (
              <div key={grupo.id} className="vd-nav-group">
                <button className="vd-nav-group-label" onClick={() => alternar(grupo.id)} aria-expanded={aberto}>
                  <span>{grupo.label}</span>
                  <span className="vd-nav-group-chevron"><IcChevron aberto={aberto} /></span>
                </button>
                <div className={`vd-nav-group-items${aberto ? ' open' : ''}`}>
                  {grupo.itens.map(item => (
                    <button
                      key={item.key}
                      className={`vd-nav-item${telaAtiva === item.key ? ' active' : ''}`}
                      onClick={() => onNavegar(item.key)}
                      tabIndex={aberto ? 0 : -1}
                    >
                      {ICONES[item.key]}
                      <span>{item.label}</span>
                      {contagens[item.key] > 0 && <span className="count">{contagens[item.key]}</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="vd-sidebar-footer">
          <div className="vd-user">
            <div className="nome">{user?.label}</div>
            <div className="info">{user?.matricula}{PERFIS[user?.role] ? ` · ${PERFIS[user.role]}` : ''}</div>
          </div>
          <button className="vd-sair" onClick={onSair}>Sair</button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
