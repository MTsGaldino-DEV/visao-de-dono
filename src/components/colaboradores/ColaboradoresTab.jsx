import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { chamarGerenciarUsuarios } from '../../lib/gerenciarUsuarios';
import { formatarTelefone, somenteDigitos } from '../../lib/colaboradores';
import ColaboradorForm from './ColaboradorForm';

// Pessoal de campo: cadastro, edição, senha do app, ativar/desativar e exclusão.
// Dono e despachante usam esta tela (a policy despachante_colaboradores libera só colaboradores).

const th = { padding: '12px 16px', fontWeight: '600' };
const td = { padding: '12px 16px' };
const filtroSel = { padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', background: '#fff' };
const botao = { padding: '5px 10px', background: 'transparent', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' };
const etiqueta = { display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', marginRight: '4px' };

// 'tecnico'/'levantador' ainda não migrados contam como o tipo correspondente
const fazExecucao = (u) => !!u.faz_execucao || u.role === 'tecnico';
const fazLevantamento = (u) => !!u.faz_levantamento || u.role === 'levantador';

const ColaboradoresTab = () => {
  const [colaboradores, setColaboradores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroFuncao, setFiltroFuncao] = useState('todas');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('ativo');
  const [formulario, setFormulario] = useState(null); // { colaborador: u | null }
  const [resetUid, setResetUid] = useState(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [versao, setVersao] = useState(0); // incrementar recarrega a lista

  useEffect(() => {
    let ativo = true;
    const buscar = () => supabase.from('usuarios').select('*')
      .in('role', ['colaborador', 'tecnico', 'levantador']).order('nome')
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) setErro(error.message);
        else { setColaboradores(data || []); setErro(''); }
        setCarregando(false);
      });
    buscar();
    const canal = supabase.channel('colaboradores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, buscar)
      .subscribe();
    return () => { ativo = false; supabase.removeChannel(canal); };
  }, [versao]);

  const recarregar = () => setVersao(v => v + 1);

  const avisar = (msg) => { setMensagem(msg); setTimeout(() => setMensagem(''), 3000); };

  const alternarAtivo = async (u) => {
    const { data, error } = await supabase.from('usuarios').update({ ativo: !u.ativo }).eq('uid', u.uid).select();
    if (error || !data?.length) alert('Erro ao atualizar: ' + (error?.message || 'sem permissão'));
    recarregar();
  };

  const trocarSenha = async (u) => {
    if (novaSenha.length < 6) { alert('A senha deve ter no mínimo 6 caracteres.'); return; }
    try {
      await chamarGerenciarUsuarios('trocar_senha', { uid: u.uid, novaSenha });
      setResetUid(null); setNovaSenha('');
      avisar(`Senha de ${u.nome} atualizada.`);
    } catch (e) { alert('Erro ao trocar senha: ' + e.message); }
  };

  const excluir = async (u) => {
    if (!window.confirm(`Excluir ${u.nome}? O login do app será apagado.\n\nSe a pessoa só saiu da equipe, prefira "Desativar": o cadastro fica guardado.`)) return;
    try {
      await chamarGerenciarUsuarios('deletar', { uid: u.uid });
      avisar(`${u.nome} excluído.`);
    } catch (e) { alert('Erro ao excluir: ' + e.message); }
    recarregar();
  };

  const funcoes = [...new Set(colaboradores.map(u => u.funcao).filter(Boolean))].sort();
  const termo = busca.trim().toLowerCase();
  const termoDigitos = somenteDigitos(busca);
  const lista = colaboradores.filter(u => {
    if (filtroStatus === 'ativo' && !u.ativo) return false;
    if (filtroStatus === 'inativo' && u.ativo) return false;
    if (filtroFuncao !== 'todas' && u.funcao !== filtroFuncao) return false;
    if (filtroTipo === 'execucao' && !fazExecucao(u)) return false;
    if (filtroTipo === 'levantamento' && !fazLevantamento(u)) return false;
    if (!termo) return true;
    return (u.nome || '').toLowerCase().includes(termo) || (u.matricula || '').toLowerCase().includes(termo)
      || (termoDigitos.length >= 3 && (u.cpf || '').includes(termoDigitos));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setFormulario({ colaborador: null })} style={{ padding: '10px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
          + Novo colaborador
        </button>
        <input type="text" placeholder="Buscar por nome, matrícula ou CPF..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', flex: '1 1 240px', maxWidth: '360px' }} />
        <select value={filtroFuncao} onChange={e => setFiltroFuncao(e.target.value)} style={filtroSel}>
          <option value="todas">Todas as funções</option>
          {funcoes.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={filtroSel}>
          <option value="todos">Execução e levantamento</option>
          <option value="execucao">Execução</option>
          <option value="levantamento">Levantamento</option>
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={filtroSel}>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      {erro && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', padding: '12px 14px', fontSize: '13px' }}>
          <b>Não foi possível carregar os colaboradores:</b> {erro}
        </div>
      )}
      {mensagem && (
        <div style={{ background: '#dcfce7', color: '#166534', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', fontWeight: '600' }}>{mensagem}</div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
            <tr>
              <th style={th}>Nome / Matrícula</th>
              <th style={th}>Função</th>
              <th style={th}>O que faz</th>
              <th style={th}>Telefone</th>
              <th style={th}>Equipe</th>
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Carregando…</td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Nenhum colaborador encontrado.</td></tr>
            ) : lista.map(u => (
              <tr key={u.uid} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={td}>
                  <div style={{ fontWeight: '600', color: '#0f2544' }}>{u.nome}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{u.matricula}</div>
                </td>
                <td style={{ ...td, color: '#334155' }}>{u.funcao || '—'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {fazExecucao(u) && <span style={{ ...etiqueta, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>Execução</span>}
                  {fazLevantamento(u) && <span style={{ ...etiqueta, background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>Levantamento</span>}
                </td>
                <td style={{ ...td, color: '#475569', whiteSpace: 'nowrap' }}>{u.telefone ? formatarTelefone(u.telefone) : '—'}</td>
                <td style={{ ...td, color: '#475569' }}>{u.equipe || '—'}</td>
                <td style={td}>
                  <span style={{ ...etiqueta, background: u.ativo ? '#dcfce7' : '#fee2e2', color: u.ativo ? '#166534' : '#991b1b' }}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                </td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {resetUid === u.uid ? (
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <input autoFocus type="password" placeholder="Nova senha" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') trocarSenha(u); if (e.key === 'Escape') { setResetUid(null); setNovaSenha(''); } }}
                        style={{ width: '110px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                      <button onClick={() => trocarSenha(u)} style={{ ...botao, background: '#0f2544', color: '#fff', border: 'none' }}>Salvar</button>
                      <button onClick={() => { setResetUid(null); setNovaSenha(''); }} style={{ ...botao, color: '#94a3b8', border: 'none' }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button onClick={() => setFormulario({ colaborador: u })} style={{ ...botao, color: '#0f2544', border: '1px solid #cbd5e1' }}>Editar</button>
                      <button onClick={() => { setResetUid(u.uid); setNovaSenha(''); }} style={{ ...botao, color: '#3b82f6', border: '1px solid #bfdbfe' }}>Senha</button>
                      <button onClick={() => alternarAtivo(u)} style={{ ...botao, color: '#64748b', border: '1px solid #e2e8f0' }}>{u.ativo ? 'Desativar' : 'Ativar'}</button>
                      <button onClick={() => excluir(u)} style={{ ...botao, color: '#ef4444', border: '1px solid #fecaca' }}>Excluir</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formulario && (
        <ColaboradorForm
          colaborador={formulario.colaborador}
          onClose={() => setFormulario(null)}
          onSalvo={(msg) => { setFormulario(null); avisar(msg); recarregar(); }}
        />
      )}
    </div>
  );
};

export default ColaboradoresTab;
