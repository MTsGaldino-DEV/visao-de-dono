import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const CONECTOR_URL = 'http://localhost:3333';

const norm = (s) => (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Identifica serviço de espaçador (mesmo critério do EspacadoresTab)
const isEspacador = (s) => s.tipo === 'NSIS' && /espa[cç]ador(es)?/i.test(s.desc || '');

// ── Estilos base ──────────────────────────────────────────────────────────────
const card = {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const btn = (cor = '#0f2544') => ({
    padding: '8px 18px',
    borderRadius: '8px',
    border: 'none',
    background: cor,
    color: '#fff',
    fontWeight: '700',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'opacity 0.15s',
});

const STATUS_LINHA = {
    pendente: { color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', label: 'Aguardando' },
    iniciando: { color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe', label: 'Iniciando…' },
    sucesso: { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'Criado' },
    erro: { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', label: 'Erro' },
    manual: { color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', label: 'Manual' },
};

const LOG_CORES = {
    debug: { color: '#64748b', bg: '#f8fafc', prefix: '·' },
    info: { color: '#1d4ed8', bg: '#eff6ff', prefix: 'ℹ' },
    sucesso: { color: '#15803d', bg: '#f0fdf4', prefix: '✓' },
    erro: { color: '#b91c1c', bg: '#fef2f2', prefix: '✗' },
    aviso: { color: '#c2410c', bg: '#fff7ed', prefix: '⚠' },
    iniciando: { color: '#7c3aed', bg: '#faf5ff', prefix: '▶' },
};

// ── Componente ────────────────────────────────────────────────────────────────
const GerarServicosTab = () => {
    const [servicos, setServicos] = useState([]);
    const [selecionados, setSelecionados] = useState([]);
    const [executorGlobal, setExecutorGlobal] = useState('Região');
    const [executores, setExecutores] = useState({});
    const [statusLinhas, setStatusLinhas] = useState({});
    const [etapa, setEtapa] = useState('idle');
    const [conectorOk, setConectorOk] = useState(false);
    const [busca, setBusca] = useState('');
    const [filtroLocal, setFiltroLocal] = useState('');
    const [logs, setLogs] = useState([]);
    const [debugAberto, setDebugAberto] = useState(false);
    const esFonte = useRef(null);
    const logsEndRef = useRef(null);

    const addLog = (tipo, msg, servId = null) => {
        const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [...prev, { hora, tipo, msg, servId, id: Date.now() + Math.random() }]);
    };

    // Auto-scroll do painel de debug
    useEffect(() => {
        if (debugAberto && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, debugAberto]);

    // ── Carrega serviços cadastrados ──────────────────────────────────────────
    useEffect(() => {
        const carregar = async () => {
            const { data } = await supabase.from('servicos').select('*');
            if (data) setServicos(data.map(d => ({ ...d, _docId: d.id })));
        };
        carregar();
        const channel = supabase.channel('servicos_gerar')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, carregar)
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, []);

    // ── Verifica se conector está rodando ─────────────────────────────────────
    useEffect(() => {
        const checar = async () => {
            try {
                const r = await fetch(`${CONECTOR_URL}/ping`, { signal: AbortSignal.timeout(2000) });
                const j = await r.json();
                setConectorOk(j.ok);
            } catch {
                setConectorOk(false);
            }
        };
        checar();
        const t = setInterval(checar, 5000);
        return () => clearInterval(t);
    }, []);

    // ── SSE: recebe status em tempo real ──────────────────────────────────────
    useEffect(() => {
        if (etapa !== 'rodando') return;
        const es = new EventSource(`${CONECTOR_URL}/status-stream`);
        esFonte.current = es;

        es.onmessage = (e) => {
            const ev = JSON.parse(e.data);

            if (ev.tipo === 'debug') {
                addLog('debug', ev.msg, ev.id || null);
            }
            if (ev.tipo === 'inicio_lote') {
                addLog('info', `Iniciando lote com ${ev.total} serviço(s).`);
            }
            if (ev.tipo === 'iniciando') {
                setStatusLinhas(prev => ({ ...prev, [selecionados[ev.index]]: { tipo: 'iniciando', msg: ev.msg } }));
                addLog('iniciando', `[${ev.id}] ${ev.msg}`);
            }
            if (ev.tipo === 'sucesso') {
                const docId = ev.docId || selecionados[ev.index];
                setStatusLinhas(prev => ({ ...prev, [docId]: { tipo: 'sucesso', msg: ev.msg, numGerado: ev.numGerado } }));
                addLog('sucesso', `[${ev.id}] Criado com sucesso${ev.numGerado ? ` — NS Nº ${ev.numGerado}` : ' (nº não capturado)'}`, ev.id);
                // Salva numServ e status no Supabase
                if (docId && ev.numGerado) {
                    supabase.from('servicos').update({
                        numServ: ev.numGerado,
                        status: 'gerado',
                    }).eq('id', docId).then(({ error }) => {
                        if (error) {
                            addLog('aviso', `Supabase: erro ao salvar numServ — ${error.message}`);
                            console.warn('Erro ao salvar numServ no Supabase:', error);
                        }
                    });
                } else if (docId && !ev.numGerado) {
                    addLog('aviso', `[${ev.id}] Serviço criado mas número não foi capturado. Verifique manualmente.`);
                }
            }
            if (ev.tipo === 'erro') {
                const tipo = ev.msg.startsWith('MANUAL:') ? 'manual' : 'erro';
                setStatusLinhas(prev => ({ ...prev, [selecionados[ev.index]]: { tipo, msg: ev.msg.replace('MANUAL: ', '') } }));
                addLog('erro', `[${ev.id}] ${ev.msg}`);
            }
            if (ev.tipo === 'fim_lote') {
                setEtapa('finalizado');
                addLog('info', 'Lote finalizado.');
                es.close();
            }
            if (ev.tipo === 'aguardando_captcha') {
                setEtapa('aguardando_captcha');
            }
            if (ev.tipo === 'sessao_ok') {
                addLog('sucesso', 'Sessão verificada. Iniciando automação…');
            }
            if (ev.tipo === 'cancelado') {
                addLog('aviso', 'Geração cancelada pelo usuário.');
            }
        };

        es.onerror = () => {
            addLog('aviso', 'Conexão SSE interrompida.');
        };

        return () => es.close();
    }, [etapa]);

    // ── Filtra serviços disponíveis para gerar ────────────────────────────────
    const disponiveis = servicos.filter(s => {
        if (!isEspacador(s)) return false;
        if (s.numServ) return false;
        if (busca) {
            const hay = [s.id, s.local, s.desc, s.equip].join(' ').toLowerCase();
            if (!hay.includes(busca.toLowerCase())) return false;
        }
        if (filtroLocal && norm(s.local) !== norm(filtroLocal)) return false;
        return true;
    });

    const localidades = [...new Set(servicos.filter(s => isEspacador(s) && !s.numServ).map(s => s.local).filter(Boolean))].sort();

    const toggleSelecionado = (docId) => {
        setSelecionados(prev =>
            prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
        );
    };

    const toggleTodos = () => {
        const ids = disponiveis.map(s => s._docId);
        const todosMarcados = ids.every(id => selecionados.includes(id));
        setSelecionados(todosMarcados ? selecionados.filter(id => !ids.includes(id)) : [...new Set([...selecionados, ...ids])]);
    };

    // ── Ações ─────────────────────────────────────────────────────────────────
    const iniciarSessao = async () => {
        setLogs([]);
        setDebugAberto(true);
        addLog('info', 'Abrindo navegador e navegando para o login CEMIG…');
        try {
            const r = await fetch(`${CONECTOR_URL}/iniciar-sessao`, { method: 'POST' });
            const j = await r.json();
            if (j.ok) {
                setEtapa('aguardando_captcha');
                addLog('info', 'Navegador aberto. Aguardando reCAPTCHA…');
            } else {
                addLog('erro', 'Erro ao iniciar sessão: ' + j.erro);
                alert('Erro: ' + j.erro);
            }
        } catch {
            addLog('erro', 'Conector não está respondendo. Verifique se node conector.js está rodando.');
            alert('Conector não está rodando. Execute: node conector.js');
        }
    };

    const continuarAposCaptcha = async () => {
        addLog('info', 'Verificando sessão após reCAPTCHA…');
        try {
            const r = await fetch(`${CONECTOR_URL}/continuar-apos-captcha`, { method: 'POST' });
            const j = await r.json();
            if (j.ok) {
                setEtapa('rodando');
                addLog('sucesso', 'Sessão OK. Iniciando geração do lote…');
                iniciarGeracao();
            } else {
                addLog('erro', j.erro);
                alert(j.erro);
            }
        } catch (err) {
            addLog('erro', 'Erro ao verificar sessão: ' + err.message);
            alert('Erro ao verificar sessão: ' + err.message);
        }
    };

    const iniciarGeracao = async () => {
        const lista = selecionados.map(docId => {
            const s = servicos.find(sv => sv._docId === docId);
            // Normaliza o equipamento: pega apenas o que está antes do primeiro traço
            const equipRaw = s.equip || '';
            const transformador = equipRaw.includes('-') ? equipRaw.split('-')[0].trim() : equipRaw;
            return {
                _docId: s._docId,
                id: s.id,
                desc: s.desc,
                transformador,
                executor: executores[docId] || executorGlobal,
            };
        });

        const inicial = {};
        selecionados.forEach(id => { inicial[id] = { tipo: 'pendente', msg: 'Aguardando…' }; });
        setStatusLinhas(inicial);

        await fetch(`${CONECTOR_URL}/gerar-servicos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicos: lista }),
        });
    };

    const cancelar = async () => {
        await fetch(`${CONECTOR_URL}/cancelar`, { method: 'POST' }).catch(() => { });
        addLog('aviso', 'Cancelamento solicitado.');
        setEtapa('idle');
    };

    const resetar = () => {
        setSelecionados([]);
        setStatusLinhas({});
        setEtapa('idle');
    };

    const limparLogs = () => setLogs([]);

    // ── Contadores do resumo ──────────────────────────────────────────────────
    const qtdSucesso = Object.values(statusLinhas).filter(s => s.tipo === 'sucesso').length;
    const qtdErro = Object.values(statusLinhas).filter(s => s.tipo === 'erro').length;
    const qtdManual = Object.values(statusLinhas).filter(s => s.tipo === 'manual').length;
    const rodando = etapa === 'rodando';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

            {/* ── Banner status do conector ── */}
            <div style={{
                ...card, padding: '12px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderLeft: `4px solid ${conectorOk ? '#15803d' : '#c2410c'}`,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: conectorOk ? '#15803d' : '#c2410c' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: conectorOk ? '#15803d' : '#c2410c' }}>
                        {conectorOk ? 'Conector ativo' : 'Conector offline'}
                    </span>
                    {!conectorOk && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                            — Execute no terminal: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>cd conector &amp;&amp; node conector.js</code>
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Botão Debug */}
                    <button
                        onClick={() => setDebugAberto(v => !v)}
                        style={{
                            padding: '6px 14px', borderRadius: '7px', border: '1px solid #e2e8f0',
                            background: debugAberto ? '#1e293b' : '#f8fafc', color: debugAberto ? '#94a3b8' : '#475569',
                            fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: '5px',
                        }}
                    >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                        Debug {logs.length > 0 && <span style={{ background: '#64748b', color: '#fff', borderRadius: '10px', padding: '0 5px', fontSize: '10px' }}>{logs.length}</span>}
                    </button>

                    {etapa === 'idle' && (
                        <button
                            onClick={iniciarSessao}
                            disabled={!conectorOk || selecionados.length === 0}
                            style={{
                                ...btn('#0f2544'),
                                opacity: (!conectorOk || selecionados.length === 0) ? 0.4 : 1,
                                cursor: (!conectorOk || selecionados.length === 0) ? 'not-allowed' : 'pointer',
                            }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            Iniciar geração ({selecionados.length})
                        </button>
                    )}
                    {etapa === 'aguardando_captcha' && (
                        <button onClick={continuarAposCaptcha} style={btn('#7c3aed')}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                            Resolvi o reCAPTCHA — Continuar
                        </button>
                    )}
                    {rodando && (
                        <button onClick={cancelar} style={btn('#b91c1c')}>
                            Cancelar
                        </button>
                    )}
                    {etapa === 'finalizado' && (
                        <button onClick={resetar} style={btn('#15803d')}>
                            Nova geração
                        </button>
                    )}
                </div>
            </div>

            {/* ── Painel de Debug ── */}
            {debugAberto && (
                <div style={{
                    ...card,
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 14px', borderBottom: '1px solid #1e293b',
                    }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            🖥 Log de execução
                        </span>
                        <button
                            onClick={limparLogs}
                            style={{ fontSize: '10px', color: '#475569', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                            Limpar
                        </button>
                    </div>
                    <div style={{
                        maxHeight: '260px',
                        overflowY: 'auto',
                        padding: '8px 0',
                        fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
                        fontSize: '11px',
                    }}>
                        {logs.length === 0 ? (
                            <div style={{ padding: '16px 14px', color: '#334155', fontSize: '11px' }}>
                                Nenhum log ainda. Clique em "Iniciar geração" para começar.
                            </div>
                        ) : (
                            logs.map(l => {
                                const cfg = LOG_CORES[l.tipo] || LOG_CORES.debug;
                                return (
                                    <div key={l.id} style={{
                                        display: 'flex', gap: '8px', alignItems: 'flex-start',
                                        padding: '2px 14px',
                                        borderLeft: `2px solid transparent`,
                                    }}>
                                        <span style={{ color: '#334155', flexShrink: 0, userSelect: 'none', fontSize: '10px', paddingTop: '1px' }}>
                                            {l.hora}
                                        </span>
                                        <span style={{ color: cfg.color, flexShrink: 0, userSelect: 'none', fontSize: '12px', lineHeight: '1' }}>
                                            {cfg.prefix}
                                        </span>
                                        <span style={{ color: l.tipo === 'erro' ? '#f87171' : l.tipo === 'sucesso' ? '#4ade80' : l.tipo === 'aviso' ? '#fb923c' : l.tipo === 'iniciando' ? '#c084fc' : l.tipo === 'info' ? '#60a5fa' : '#64748b', lineHeight: '1.5', wordBreak: 'break-word' }}>
                                            {l.msg}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            )}

            {/* ── Aviso aguardando reCAPTCHA ── */}
            {etapa === 'aguardando_captcha' && (
                <div style={{ ...card, padding: '16px 20px', borderLeft: '4px solid #7c3aed', background: '#faf5ff' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#7c3aed', marginBottom: '4px' }}>
                        ⏳ Aguardando reCAPTCHA
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                        O Edge foi aberto. Por favor: <strong>preencha sua senha</strong>, resolva o reCAPTCHA e clique em entrar no sistema. Depois volte aqui e clique em <strong>"Resolvi o reCAPTCHA — Continuar"</strong>.
                    </div>
                </div>
            )}

            {/* ── Resumo quando rodando ou finalizado ── */}
            {(rodando || etapa === 'finalizado') && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    {[
                        { label: 'Total', value: selecionados.length, color: '#0f2544' },
                        { label: 'Criados', value: qtdSucesso, color: '#15803d' },
                        { label: 'Erros', value: qtdErro, color: '#b91c1c' },
                        { label: 'Manuais', value: qtdManual, color: '#c2410c' },
                    ].map(({ label, value, color }) => (
                        <div key={label} style={{ ...card, padding: '14px 18px' }}>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                            <div style={{ fontSize: '24px', fontWeight: '800', color }}>{value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Painel principal: filtros + lista ── */}
            <div style={card}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544', marginBottom: '12px' }}>
                        Serviços disponíveis para geração
                    </div>

                    {/* Filtros */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ position: 'relative' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
                                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text" placeholder="Buscar por ID, localidade, descrição…"
                                value={busca} onChange={e => setBusca(e.target.value)}
                                style={{ width: '100%', padding: '7px 10px 7px 30px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                            />
                        </div>
                        <select value={filtroLocal} onChange={e => setFiltroLocal(e.target.value)}
                            style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'inherit' }}>
                            <option value="">Todas as localidades</option>
                            {localidades.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Executor padrão:</span>
                            <select value={executorGlobal} onChange={e => setExecutorGlobal(e.target.value)}
                                style={{ flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'inherit' }}>
                                <option value="Região">Região</option>
                                <option value="COD">COD</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                            <strong style={{ color: '#0f2544' }}>{selecionados.length}</strong> selecionados de {disponiveis.length} disponíveis
                        </div>
                        {disponiveis.length > 0 && (
                            <button onClick={toggleTodos} style={{ fontSize: '11px', color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}>
                                {disponiveis.every(s => selecionados.includes(s._docId)) ? 'Desmarcar todos' : 'Selecionar todos'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabela */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: 36, padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}></th>
                                <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ID</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Localidade</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Descrição</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transformador</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', width: 110 }}>Executor</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', width: 160 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {disponiveis.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '12px' }}>
                                        Nenhum serviço de espaçadores disponível. Serviços precisam ser do tipo NSIS, estar concluídos e conter "espaçador" na descrição, sem número CEMIG.
                                    </td>
                                </tr>
                            )}
                            {disponiveis.map((s, i) => {
                                const sel = selecionados.includes(s._docId);
                                const st = statusLinhas[s._docId];
                                const stCfg = st ? STATUS_LINHA[st.tipo] : null;
                                const exeInd = executores[s._docId];

                                return (
                                    <tr key={s._docId}
                                        style={{ background: sel ? '#f0f7ff' : i % 2 === 0 ? '#fff' : '#fafbfc', cursor: rodando ? 'default' : 'pointer' }}
                                        onClick={() => !rodando && toggleSelecionado(s._docId)}
                                        onMouseEnter={e => { if (!rodando) e.currentTarget.style.background = '#f0f7ff'; }}
                                        onMouseLeave={e => { if (!rodando) e.currentTarget.style.background = sel ? '#f0f7ff' : i % 2 === 0 ? '#fff' : '#fafbfc'; }}
                                    >
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f8fafc' }} onClick={e => e.stopPropagation()}>
                                            <div
                                                onClick={() => !rodando && toggleSelecionado(s._docId)}
                                                style={{
                                                    width: 15, height: 15, borderRadius: 3, border: sel ? '4px solid #1d4ed8' : '1.5px solid #cbd5e1',
                                                    background: sel ? '#1d4ed8' : '#fff', cursor: rodando ? 'default' : 'pointer', flexShrink: 0,
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f8fafc', fontWeight: '700', color: '#0f2544' }}>{s.id}</td>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f8fafc', color: '#334155' }}>{s.local || '—'}</td>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f8fafc', color: '#334155', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {s.desc?.slice(0, 60)}{s.desc?.length > 60 ? '…' : ''}
                                        </td>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f8fafc', color: '#475569', fontWeight: '600', letterSpacing: '0.04em' }}>
                                            {s.equip || <span style={{ color: '#ef4444', fontWeight: '400' }}>Sem transformador</span>}
                                        </td>

                                        <td style={{ padding: '6px 12px', borderBottom: '1px solid #f8fafc' }} onClick={e => e.stopPropagation()}>
                                            <select
                                                value={exeInd || executorGlobal}
                                                onChange={e => setExecutores(prev => ({ ...prev, [s._docId]: e.target.value }))}
                                                disabled={rodando}
                                                style={{ padding: '4px 8px', border: exeInd ? '1px solid #bfdbfe' : '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px', fontFamily: 'inherit', background: exeInd ? '#eff6ff' : '#fff', outline: 'none', cursor: rodando ? 'default' : 'pointer' }}
                                            >
                                                <option value="Região">Região</option>
                                                <option value="COD">COD</option>
                                            </select>
                                        </td>

                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f8fafc' }}>
                                            {stCfg ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: stCfg.bg, color: stCfg.color, border: `1px solid ${stCfg.border}`, width: 'fit-content' }}>
                                                        {stCfg.label}
                                                    </span>
                                                    {st.numGerado && <span style={{ fontSize: '10px', color: '#15803d', fontWeight: '600' }}>NS {st.numGerado}</span>}
                                                    {st.msg && st.tipo !== 'sucesso' && (
                                                        <span style={{ fontSize: '10px', color: '#94a3b8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={st.msg}>
                                                            {st.msg}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '10px', color: '#cbd5e1' }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Legenda executor ── */}
            <div style={{ ...card, padding: '12px 18px', display: 'flex', gap: '24px', fontSize: '11px', color: '#64748b' }}>
                <span style={{ fontWeight: '700', color: '#0f2544' }}>Executor:</span>
                <span><strong>Região</strong> — equipe regional</span>
                <span><strong>COD</strong> — Centro de Operação da Distribuição</span>
                <span><strong>Tipo de Turma:</strong> sempre DUPLA</span>
                <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>
                    O executor pode ser definido globalmente ou individualmente por serviço.
                </span>
            </div>

        </div>
    );
};

export default GerarServicosTab;