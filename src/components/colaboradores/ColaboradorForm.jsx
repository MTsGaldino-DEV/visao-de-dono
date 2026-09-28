import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { chamarGerenciarUsuarios } from '../../lib/gerenciarUsuarios';
import { FUNCOES, formatarCpf, formatarTelefone, validarColaborador, payloadColaborador } from '../../lib/colaboradores';

const rotulo = { display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' };
const campo = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit' };
const erroCampo = { fontSize: '12px', color: '#dc2626', marginTop: '4px' };

const vazio = { nome: '', matricula: '', senha: '', funcao: '', cpf: '', telefone: '', faz_execucao: true, faz_levantamento: false, equipe: '' };

// Formulário de cadastro/edição de colaborador (modal)
const ColaboradorForm = ({ colaborador, onSalvo, onClose }) => {
  const novo = !colaborador;
  const [form, setForm] = useState(() => (novo ? vazio : {
    ...vazio,
    ...colaborador,
    funcao: colaborador.funcao || '',
    cpf: formatarCpf(colaborador.cpf),
    telefone: formatarTelefone(colaborador.telefone),
    equipe: colaborador.equipe || '',
    // 'tecnico' ainda não migrado conta como execução
    faz_execucao: !!colaborador.faz_execucao || colaborador.role === 'tecnico',
    faz_levantamento: !!colaborador.faz_levantamento || colaborador.role === 'levantador',
  }));
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [salvando, setSalvando] = useState(false);

  const mudar = (chave, valor) => setForm(f => ({ ...f, [chave]: valor }));

  const salvar = async (e) => {
    e.preventDefault();
    const encontrados = validarColaborador(form, { novo });
    setErros(encontrados);
    setErroGeral('');
    if (Object.keys(encontrados).length) return;

    setSalvando(true);
    try {
      if (novo) {
        await chamarGerenciarUsuarios('criar', {
          ...payloadColaborador(form), matricula: form.matricula.trim(), senha: form.senha, role: 'colaborador',
        });
        onSalvo('Colaborador cadastrado!');
      } else {
        const { data, error } = await supabase.from('usuarios')
          .update(payloadColaborador(form)).eq('uid', colaborador.uid).select();
        if (error) throw new Error(error.code === '23505' ? 'CPF já cadastrado para outro colaborador.' : error.message);
        if (!data?.length) throw new Error('Sem permissão para editar este colaborador.');
        onSalvo('Colaborador atualizado!');
      }
    } catch (err) {
      setErroGeral(err.message);
      setSalvando(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.55)', zIndex: 1000 }} />
      <form onSubmit={salvar} style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1001, background: '#fff', borderRadius: '14px', width: '94%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto', padding: '22px 24px', boxShadow: '0 24px 60px rgba(15,37,68,0.25)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#0f2544' }}>{novo ? 'Novo colaborador' : `Editar ${colaborador.nome}`}</h3>
          <button type="button" onClick={onClose} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: '30px', height: '30px', fontSize: '17px', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        <div>
          <label style={rotulo}>Nome</label>
          <input style={campo} value={form.nome} onChange={e => mudar('nome', e.target.value)} />
          {erros.nome && <div style={erroCampo}>{erros.nome}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div>
            <label style={rotulo}>Matrícula</label>
            <input style={{ ...campo, background: novo ? '#fff' : '#f1f5f9' }} value={form.matricula} disabled={!novo} onChange={e => mudar('matricula', e.target.value)} />
            {!novo && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>A matrícula é o login do app e não pode ser alterada.</div>}
            {erros.matricula && <div style={erroCampo}>{erros.matricula}</div>}
          </div>
          {novo && (
            <div>
              <label style={rotulo}>Senha do app</label>
              <input style={campo} type="password" value={form.senha} onChange={e => mudar('senha', e.target.value)} />
              {erros.senha && <div style={erroCampo}>{erros.senha}</div>}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div>
            <label style={rotulo}>Função</label>
            <input style={campo} list="funcoes-colaborador" placeholder="Escolha ou digite" value={form.funcao} onChange={e => mudar('funcao', e.target.value)} />
            <datalist id="funcoes-colaborador">{FUNCOES.map(f => <option key={f} value={f} />)}</datalist>
          </div>
          <div>
            <label style={rotulo}>Equipe (opcional)</label>
            <input style={campo} value={form.equipe} onChange={e => mudar('equipe', e.target.value)} />
          </div>
          <div>
            <label style={rotulo}>CPF</label>
            <input style={campo} inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={e => mudar('cpf', formatarCpf(e.target.value))} />
            {erros.cpf && <div style={erroCampo}>{erros.cpf}</div>}
          </div>
          <div>
            <label style={rotulo}>Telefone</label>
            <input style={campo} inputMode="tel" placeholder="(00) 00000-0000" value={form.telefone} onChange={e => mudar('telefone', formatarTelefone(e.target.value))} />
            {erros.telefone && <div style={erroCampo}>{erros.telefone}</div>}
          </div>
        </div>

        <div>
          <label style={rotulo}>O que faz no app</label>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', fontSize: '14px', color: '#334155' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.faz_execucao} onChange={e => mudar('faz_execucao', e.target.checked)} /> Execução de serviços
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.faz_levantamento} onChange={e => mudar('faz_levantamento', e.target.checked)} /> Levantamento
            </label>
          </div>
          {erros.tipos && <div style={erroCampo}>{erros.tipos}</div>}
        </div>

        {erroGeral && (
          <div style={{ padding: '10px 12px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px' }}>{erroGeral}</div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={salvando} style={{ padding: '10px 22px', background: '#0f2544', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: salvando ? 'wait' : 'pointer', opacity: salvando ? 0.7 : 1 }}>
            {salvando ? 'Salvando…' : novo ? 'Cadastrar' : 'Salvar'}
          </button>
        </div>
      </form>
    </>
  );
};

export default ColaboradorForm;
