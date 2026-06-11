import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
const US_PARA_REAL = 2880.23;
const ROLES_PERMITIDAS = ['dono'];

const fmtReal = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const fmtUS = (v) =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v || 0);

const fmtNum = (v) =>
    new Intl.NumberFormat('pt-BR').format(v || 0);

// Converte serial do Excel para Date JS
const excelSerialToDate = (serial) => {
    if (!serial || isNaN(serial)) return null;
    // Excel epoch: 1900-01-01, com bug do ano bissexto 1900
    const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return utc;
};

const fmtDate = (d) => {
    if (!d) return '—';
    if (d instanceof Date) {
        return d.toLocaleDateString('pt-BR');
    }
    // string dd/mm/yyyy ou iso
    try {
        const dt = new Date(d);
        if (!isNaN(dt)) return dt.toLocaleDateString('pt-BR');
    } catch { }
    return String(d);
};

const parseDate = (val) => {
    if (!val) return null;
    if (typeof val === 'number') return excelSerialToDate(val);
    if (val instanceof Date) return val;
    // dd/mm/yyyy
    const parts = String(val).split('/');
    if (parts.length === 3) {
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
    return new Date(val);
};

// ─────────────────────────────────────────────────────────────────────────────
// Estilos base (mesma linguagem visual do projeto)
// ─────────────────────────────────────────────────────────────────────────────
const card = {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const th = {
    textAlign: 'left',
    fontSize: '10px',
    color: '#94a3b8',
    fontWeight: '700',
    padding: '9px 12px',
    borderBottom: '1px solid #f1f5f9',
    background: '#f8fafc',
    whiteSpace: 'nowrap',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
};

const td = {
    padding: '9px 12px',
    borderBottom: '1px solid #f8fafc',
    verticalAlign: 'middle',
    fontSize: '12px',
    color: '#334155',
    whiteSpace: 'nowrap',
};

const labelUp = {
    fontSize: '10px',
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    marginBottom: '5px',
    display: 'block',
};

const inputStyle = {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '12px',
    background: '#fff',
    color: '#1e293b',
    outline: 'none',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    boxSizing: 'border-box',
};

// ─────────────────────────────────────────────────────────────────────────────
// Mini barra de progresso
// ─────────────────────────────────────────────────────────────────────────────
const MiniBar = ({ value, max, color = '#1d4ed8' }) => {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (
        <div style={{ height: '4px', borderRadius: '2px', background: '#f1f5f9', overflow: 'hidden', minWidth: '60px' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.4s' }} />
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal de confirmação
// ─────────────────────────────────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onConfirm, onCancel, stats }) => {
    if (!isOpen) return null;
    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.65)',
                backdropFilter: 'blur(4px)', zIndex: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div style={{
                background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0',
                width: '460px', maxWidth: '100%', padding: '28px',
                boxShadow: '0 20px 60px rgba(15,37,68,0.25)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '10px',
                        background: '#fff7ed', border: '1px solid #fed7aa',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f2544' }}>Confirmar importação</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Esta ação substituirá todos os dados atuais</div>
                    </div>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {[
                            { label: 'Total na planilha', value: fmtNum(stats.total), color: '#0f2544' },
                            { label: 'Encontrados no sistema', value: fmtNum(stats.matched), color: '#15803d' },
                            { label: 'Com valor final > 0', value: fmtNum(stats.comValor), color: '#1d4ed8' },
                            { label: 'Não encontrados', value: fmtNum(stats.naoEncontrados), color: '#c2410c' },
                        ].map(({ label, value, color }) => (
                            <div key={label}>
                                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', marginBottom: '3px' }}>{label}</div>
                                <div style={{ fontSize: '20px', fontWeight: '800', color }}>{value}</div>
                            </div>
                        ))}
                    </div>
                    {stats.naoEncontrados > 0 && (
                        <div style={{ marginTop: '12px', padding: '8px 12px', background: '#fef2f2', borderRadius: '7px', border: '1px solid #fecaca', fontSize: '11px', color: '#b91c1c' }}>
                            {fmtNum(stats.naoEncontrados)} serviço(s) da planilha não foram encontrados no sistema e serão ignorados.
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={onCancel} style={{
                        padding: '9px 18px', border: '1px solid #e2e8f0', borderRadius: '8px',
                        background: '#fff', color: '#475569', cursor: 'pointer', fontSize: '13px',
                        fontWeight: '500', fontFamily: 'inherit',
                    }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >Cancelar</button>
                    <button onClick={onConfirm} style={{
                        padding: '9px 20px', border: 'none', borderRadius: '8px',
                        background: 'linear-gradient(135deg, #0f2544, #1d4ed8)',
                        color: '#fff', cursor: 'pointer', fontSize: '13px',
                        fontWeight: '700', fontFamily: 'inherit',
                    }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        Confirmar importação
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal de serviços não encontrados
// ─────────────────────────────────────────────────────────────────────────────
const NaoEncontradosModal = ({ isOpen, onClose, lista }) => {
    if (!isOpen) return null;
    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(15,37,68,0.6)',
                backdropFilter: 'blur(4px)', zIndex: 400,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0',
                width: '580px', maxWidth: '100%', maxHeight: '80vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(15,37,68,0.25)',
            }}>
                <div style={{
                    padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    position: 'sticky', top: 0, background: '#fff', borderRadius: '14px 14px 0 0',
                }}>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f2544' }}>
                            Serviços não encontrados no sistema
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            {fmtNum(lista.length)} NSIS da planilha sem correspondência
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        width: '30px', height: '30px', border: '1px solid #e2e8f0', borderRadius: '8px',
                        background: '#f8fafc', color: '#64748b', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', padding: 0,
                    }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
                    >×</button>
                </div>
                <div style={{ overflowY: 'auto', padding: '16px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                            <tr>
                                <th style={th}>NSIS</th>
                                <th style={th}>NSMP</th>
                                <th style={th}>Tipo de Serviço</th>
                                <th style={th}>Valor Final (US)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lista.map((r, i) => (
                                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                    <td style={{ ...td, fontWeight: '700', color: '#b91c1c' }}>{r.nsis}</td>
                                    <td style={td}>{r.nsmp || '—'}</td>
                                    <td style={{ ...td, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.tipoServico || '—'}</td>
                                    <td style={td}>{fmtUS(r.valorFinal)} US</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
const FaturamentoTab = () => {
    const { user } = useAuth();

    // Permissão
    const temPermissao = ROLES_PERMITIDAS.includes(user?.role);

    // Dados
    const [servicos, setServicos] = useState([]);
    const [faturamento, setFaturamento] = useState(null); // { registros, atualizadoEm, estatisticas }
    const [carregandoDados, setCarregandoDados] = useState(true);

    // Importação
    const [importando, setImportando] = useState(false);
    const [confirmStats, setConfirmStats] = useState(null);
    const [pendingRows, setPendingRows] = useState([]);
    const [pendingNaoEncontrados, setPendingNaoEncontrados] = useState([]);
    const [salvando, setSalvando] = useState(false);
    const inputFileRef = useRef(null);

    // Modais
    const [showNaoEncontrados, setShowNaoEncontrados] = useState(false);
    const [naoEncontradosLista, setNaoEncontradosLista] = useState([]);

    // Filtros
    const [filtroBusca, setFiltroBusca] = useState('');
    const [filtroFaturas, setFiltroFaturas] = useState([]); // multiselect
    const [filtroDataDe, setFiltroDataDe] = useState('');
    const [filtroDataAte, setFiltroDataAte] = useState('');
    const [filtroApenasComValor, setFiltroApenasComValor] = useState(false);
    const [faturaDropdownOpen, setFaturaDropdownOpen] = useState(false);
    const faturaDropdownRef = useRef(null);

    // Paginação
    const [pagina, setPagina] = useState(1);
    const PAGE_SIZE = 50;

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        const handler = (e) => {
            if (faturaDropdownRef.current && !faturaDropdownRef.current.contains(e.target))
                setFaturaDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Carregar serviços do Supabase
    useEffect(() => {
        const carregar = async () => {
            const { data } = await supabase.from('servicos').select('*');
            if (data) setServicos(data.map(d => ({ ...d, _docId: d.id })));
        };
        carregar();
        const channel = supabase.channel('servicos_faturamento')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, carregar)
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, []);

    // Carregar faturamento salvo
    useEffect(() => {
        const load = async () => {
            setCarregandoDados(true);
            try {
                const { data } = await supabase.from('config').select('*').eq('id', 'faturamento').single();
                if (data) setFaturamento(data);
            } catch { }
            setCarregandoDados(false);
        };
        load();
    }, []);

    // ── Processar planilha ───────────────────────────────────────────────────
    const processarPlanilha = useCallback((file) => {
        setImportando(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                // Detectar linha de cabeçalho
                // Procura linha com "Serviço" ou "NSIS" na primeira coluna
                let headerIdx = 0;
                for (let i = 0; i < Math.min(10, raw.length); i++) {
                    const first = String(raw[i][0] || '').toLowerCase();
                    if (first.includes('servi') || first.includes('nsis')) {
                        headerIdx = i;
                        break;
                    }
                }

                const headers = raw[headerIdx].map(h => String(h || '').trim().toUpperCase());
                const dataRows = raw.slice(headerIdx + 1).filter(r => r.some(c => c !== ''));

                // Mapear índices de colunas
                // Planilha real: Serviço | NSMP | Nº do equipe | Tipo de Serviço | VALOR INICIAL | NSPR | VALOR FINAL | SALDO | DT EXECUÇÃO | APROPRIAÇÃO/FATURA
                // Planilha teste: qtd | NSIS | NSMP | Nº do equipe | Tipo de Serviço | VALOR INICIAL | NSPR | VALOR FINAL | SALDO | DT EXECUÇÃO | APROPRIAÇÃO/FATURA | IR
                const idx = {
                    nsis: headers.findIndex(h => h.includes('SERVI') || h === 'NSIS'),
                    nsmp: headers.findIndex(h => h.includes('NSMP')),
                    equip: headers.findIndex(h => h.includes('EQUIPE') || h.includes('EQUIP')),
                    tipoServico: headers.findIndex(h => h.includes('TIPO')),
                    valorInicial: headers.findIndex(h => h.includes('INICIAL')),
                    nspr: headers.findIndex(h => h.includes('NSPR')),
                    valorFinal: headers.findIndex(h => h.includes('FINAL')),
                    dtExecucao: headers.findIndex(h => h.includes('EXEC') || h.includes('DT')),
                    apropriacao: headers.findIndex(h => h.includes('APROP') || h.includes('FATURA')),
                };

                // Fallback por posição para planilha real sem qtd:
                // 0=Serviço,1=NSMP,2=Nº equip,3=Tipo,4=Val Inicial,5=NSPR,6=Val Final,7=Saldo,8=DT,9=Aprop
                if (idx.nsis === -1) idx.nsis = 0;
                if (idx.nsmp === -1) idx.nsmp = 1;
                if (idx.equip === -1) idx.equip = 2;
                if (idx.tipoServico === -1) idx.tipoServico = 3;
                if (idx.valorInicial === -1) idx.valorInicial = 4;
                if (idx.nspr === -1) idx.nspr = 5;
                if (idx.valorFinal === -1) idx.valorFinal = 6;
                if (idx.dtExecucao === -1) idx.dtExecucao = 8;
                if (idx.apropriacao === -1) idx.apropriacao = 9;

                // Montar mapa de numServ do sistema
                const sistemaMap = {};
                servicos.forEach(s => {
                    if (s.numServ) sistemaMap[String(s.numServ).trim()] = s;
                });

                const encontrados = [];
                const naoEncontrados = [];

                dataRows.forEach(row => {
                    const nsis = String(row[idx.nsis] || '').trim();
                    if (!nsis || nsis === '0') return;

                    const valorFinalRaw = row[idx.valorFinal];
                    const valorFinal = parseFloat(String(valorFinalRaw).replace(',', '.')) || 0;

                    const dtRaw = row[idx.dtExecucao];
                    const dtParsed = parseDate(dtRaw);

                    const apropriacao = String(row[idx.apropriacao] || '').trim();

                    const registro = {
                        nsis,
                        nsmp: String(row[idx.nsmp] || '').trim(),
                        equip: String(row[idx.equip] || '').trim(),
                        tipoServico: String(row[idx.tipoServico] || '').trim(),
                        valorInicial: parseFloat(String(row[idx.valorInicial] || '0').replace(',', '.')) || 0,
                        nspr: String(row[idx.nspr] || '').trim(),
                        valorFinal,
                        dtExecucao: dtParsed ? dtParsed.toISOString() : null,
                        apropriacao: apropriacao === '0' ? '' : apropriacao,
                    };

                    if (sistemaMap[nsis]) {
                        // Enriquecer com dados do sistema
                        const s = sistemaMap[nsis];
                        registro.local = s.local || '';
                        registro.desc = s.desc || '';
                        registro.status = s.status || '';
                        registro.id = s.id || '';
                        encontrados.push(registro);
                    } else {
                        naoEncontrados.push(registro);
                    }
                });

                const comValor = encontrados.filter(r => r.valorFinal > 0);

                setConfirmStats({
                    total: dataRows.filter(r => String(r[idx.nsis] || '').trim() && String(r[idx.nsis] || '').trim() !== '0').length,
                    matched: encontrados.length,
                    comValor: comValor.length,
                    naoEncontrados: naoEncontrados.length,
                });
                setPendingRows(encontrados);
                setPendingNaoEncontrados(naoEncontrados);
                setNaoEncontradosLista(naoEncontrados);
            } catch (err) {
                alert('Erro ao processar planilha: ' + err.message);
            }
            setImportando(false);
        };
        reader.readAsArrayBuffer(file);
    }, [servicos]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        processarPlanilha(file);
    };

    const confirmarImportacao = async () => {
        setSalvando(true);
        try {
            const totalUS = pendingRows
                .filter(r => r.valorFinal > 0)
                .reduce((acc, r) => acc + r.valorFinal, 0);

            const payload = {
                registros: pendingRows,
                atualizadoEm: new Date().toISOString(),
                atualizadoPor: user.label,
                estatisticas: {
                    totalLinhas: confirmStats.total,
                    encontrados: confirmStats.matched,
                    comValor: confirmStats.comValor,
                    naoEncontrados: confirmStats.naoEncontrados,
                    totalUS,
                },
                naoEncontrados: pendingNaoEncontrados,
            };

            await supabase.from('config').upsert({ id: 'faturamento', ...payload });
            setFaturamento(payload);
            setConfirmStats(null);
            setPendingRows([]);
            setPendingNaoEncontrados([]);
        } catch (err) {
            alert('Erro ao salvar: ' + err.message);
        }
        setSalvando(false);
    };

    // ── Filtros aplicados ────────────────────────────────────────────────────
    const registros = faturamento?.registros || [];

    const faturasList = [...new Set(
        registros.map(r => r.apropriacao).filter(Boolean)
    )].sort();

    const registrosFiltrados = registros.filter(r => {
        if (filtroApenasComValor && r.valorFinal <= 0) return false;
        if (filtroFaturas.length > 0 && !filtroFaturas.includes(r.apropriacao)) return false;
        if (filtroDataDe) {
            const de = new Date(filtroDataDe);
            const dt = r.dtExecucao ? new Date(r.dtExecucao) : null;
            if (!dt || dt < de) return false;
        }
        if (filtroDataAte) {
            const ate = new Date(filtroDataAte + 'T23:59:59');
            const dt = r.dtExecucao ? new Date(r.dtExecucao) : null;
            if (!dt || dt > ate) return false;
        }
        if (filtroBusca.trim()) {
            const q = filtroBusca.toLowerCase();
            const hay = [r.nsis, r.nsmp, r.nspr, r.tipoServico, r.local, r.desc, r.apropriacao, r.equip]
                .join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    // Métricas filtradas
    const totalUS = registrosFiltrados
        .filter(r => r.valorFinal > 0)
        .reduce((a, r) => a + r.valorFinal, 0);
    const totalReais = totalUS * US_PARA_REAL;
    const totalComValor = registrosFiltrados.filter(r => r.valorFinal > 0).length;
    const totalSemValor = registrosFiltrados.filter(r => r.valorFinal <= 0).length;

    // Agrupamento por fatura
    const porFatura = {};
    registrosFiltrados.filter(r => r.valorFinal > 0).forEach(r => {
        const k = r.apropriacao || '(sem fatura)';
        if (!porFatura[k]) porFatura[k] = { us: 0, count: 0 };
        porFatura[k].us += r.valorFinal;
        porFatura[k].count++;
    });
    const faturasSorted = Object.entries(porFatura).sort((a, b) => b[1].us - a[1].us);
    const maxUS = faturasSorted[0]?.[1].us || 1;

    // Agrupamento por tipo de serviço
    const porTipo = {};
    registrosFiltrados.filter(r => r.valorFinal > 0).forEach(r => {
        const k = r.tipoServico || 'Outros';
        if (!porTipo[k]) porTipo[k] = { us: 0, count: 0 };
        porTipo[k].us += r.valorFinal;
        porTipo[k].count++;
    });
    const tiposSorted = Object.entries(porTipo).sort((a, b) => b[1].us - a[1].us).slice(0, 8);

    // Agrupamento por mês
    const porMes = {};
    registrosFiltrados.filter(r => r.valorFinal > 0 && r.dtExecucao).forEach(r => {
        const dt = new Date(r.dtExecucao);
        const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        if (!porMes[k]) porMes[k] = { us: 0, count: 0, label: dt.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) };
        porMes[k].us += r.valorFinal;
        porMes[k].count++;
    });
    const mesesSorted = Object.entries(porMes).sort((a, b) => a[0].localeCompare(b[0]));
    const maxMesUS = mesesSorted.reduce((m, [, v]) => Math.max(m, v.us), 1);

    // Paginação
    const totalPages = Math.max(1, Math.ceil(registrosFiltrados.length / PAGE_SIZE));
    const safePage = Math.min(pagina, totalPages);
    const pageSlice = registrosFiltrados.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const temFiltro = filtroBusca || filtroFaturas.length > 0 || filtroDataDe || filtroDataAte || filtroApenasComValor;

    // ── Sem permissão ────────────────────────────────────────────────────────
    if (!temPermissao) {
        return (
            <div style={{ ...card, padding: '48px', textAlign: 'center' }}>
                <div style={{
                    width: '48px', height: '48px', borderRadius: '12px',
                    background: '#fef2f2', border: '1px solid #fecaca',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.5" strokeLinecap="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544', marginBottom: '6px' }}>Acesso restrito</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Esta aba é visível apenas para administradores.</div>
            </div>
        );
    }

    // ── Carregando ───────────────────────────────────────────────────────────
    if (carregandoDados) {
        return (
            <div style={{ ...card, padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Carregando dados de faturamento...
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* ── Modais ── */}
            <ConfirmModal
                isOpen={!!confirmStats}
                stats={confirmStats || {}}
                onConfirm={confirmarImportacao}
                onCancel={() => { setConfirmStats(null); setPendingRows([]); setPendingNaoEncontrados([]); }}
            />
            <NaoEncontradosModal
                isOpen={showNaoEncontrados}
                onClose={() => setShowNaoEncontrados(false)}
                lista={naoEncontradosLista}
            />

            {/* ── Header: importação ── */}
            <div style={{ ...card, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544' }}>Faturamento do projeto</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            {faturamento
                                ? <>Última atualização: <strong style={{ color: '#334155' }}>
                                    {new Date(faturamento.atualizadoEm).toLocaleString('pt-BR')}
                                </strong> · por <strong style={{ color: '#334155' }}>{faturamento.atualizadoPor}</strong></>
                                : 'Nenhuma planilha importada ainda.'}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {faturamento?.naoEncontrados?.length > 0 && (
                            <button
                                onClick={() => { setNaoEncontradosLista(faturamento.naoEncontrados); setShowNaoEncontrados(true); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    padding: '7px 13px', border: '1px solid #fecaca', borderRadius: '8px',
                                    background: '#fef2f2', color: '#b91c1c', cursor: 'pointer',
                                    fontSize: '11px', fontWeight: '600', fontFamily: 'inherit',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                                onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                {fmtNum(faturamento.naoEncontrados.length)} não encontrados
                            </button>
                        )}

                        <input
                            ref={inputFileRef}
                            type="file"
                            accept=".xlsx,.xls"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                        <button
                            onClick={() => inputFileRef.current?.click()}
                            disabled={importando || salvando}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 16px', border: 'none', borderRadius: '8px',
                                background: 'linear-gradient(135deg, #0f2544, #1d4ed8)',
                                color: '#fff', cursor: importando || salvando ? 'not-allowed' : 'pointer',
                                fontSize: '12px', fontWeight: '700', fontFamily: 'inherit',
                                opacity: importando || salvando ? 0.7 : 1,
                                boxShadow: '0 2px 8px rgba(29,78,216,0.3)',
                            }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            {importando ? 'Processando...' : salvando ? 'Salvando...' : 'Importar planilha'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Se não há dados ── */}
            {!faturamento && (
                <div style={{ ...card, padding: '64px', textAlign: 'center' }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '14px',
                        background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                        border: '1px solid #bfdbfe',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                    }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544', marginBottom: '8px' }}>
                        Nenhum dado de faturamento
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '300px', margin: '0 auto' }}>
                        Importe uma planilha Excel para visualizar o painel de faturamento.
                    </div>
                </div>
            )}

            {faturamento && (<>

                {/* ── Cards de resumo ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    {[
                        {
                            label: 'Total US faturado',
                            value: fmtUS(totalUS) + ' US',
                            sub: temFiltro ? 'filtrado' : 'geral',
                            color: '#0f2544',
                            icon: (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round">
                                    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                </svg>
                            ),
                            iconBg: '#eff6ff', iconBorder: '#bfdbfe',
                        },
                        {
                            label: 'Valor em reais',
                            value: fmtReal(totalReais),
                            sub: `US × R$ ${US_PARA_REAL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                            color: '#15803d',
                            icon: (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                </svg>
                            ),
                            iconBg: '#f0fdf4', iconBorder: '#bbf7d0',
                        },
                        {
                            label: 'Serviços c/ valor',
                            value: fmtNum(totalComValor),
                            sub: `${fmtNum(registrosFiltrados.length)} total filtrado`,
                            color: '#1d4ed8',
                            icon: (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            ),
                            iconBg: '#eff6ff', iconBorder: '#bfdbfe',
                        },
                        {
                            label: 'Aguard. lançamento',
                            value: fmtNum(totalSemValor),
                            sub: 'valor final = 0',
                            color: '#c2410c',
                            icon: (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth="2.5" strokeLinecap="round">
                                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                            ),
                            iconBg: '#fff7ed', iconBorder: '#fed7aa',
                        },
                    ].map(({ label, value, sub, color, icon, iconBg, iconBorder }) => (
                        <div key={label} style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
                                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: iconBg, border: `1px solid ${iconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {icon}
                                </div>
                            </div>
                            <div style={{ fontSize: '22px', fontWeight: '800', color, lineHeight: 1.1 }}>{value}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{sub}</div>
                        </div>
                    ))}
                </div>

                {/* ── Gráfico por fatura + por tipo ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                    {/* Por fatura */}
                    <div style={{ ...card, padding: '16px 20px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f2544', marginBottom: '4px' }}>US por Apropriação/Fatura</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '14px' }}>Somente serviços com valor final {'>'} 0</div>
                        {faturasSorted.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '12px' }}>Sem dados</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {faturasSorted.map(([fatura, { us, count }]) => (
                                    <div key={fatura}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#334155' }}>{fatura}</span>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#0f2544' }}>{fmtUS(us)} US</span>
                                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>{fmtNum(count)} serv.</span>
                                            </div>
                                        </div>
                                        <MiniBar value={us} max={maxUS} color="#1d4ed8" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Por tipo de serviço */}
                    <div style={{ ...card, padding: '16px 20px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f2544', marginBottom: '4px' }}>US por Tipo de Serviço</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '14px' }}>Top 8 tipos com maior faturamento</div>
                        {tiposSorted.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '12px' }}>Sem dados</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {tiposSorted.map(([tipo, { us, count }], i) => {
                                    const colors = ['#1d4ed8', '#7c3aed', '#0369a1', '#15803d', '#c2410c', '#b45309', '#0f766e', '#be185d'];
                                    return (
                                        <div key={tipo}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                                <span style={{
                                                    fontSize: '11px', fontWeight: '600', color: '#334155',
                                                    maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }} title={tipo}>{tipo}</span>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexShrink: 0 }}>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#0f2544' }}>{fmtUS(us)} US</span>
                                                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{fmtNum(count)}</span>
                                                </div>
                                            </div>
                                            <MiniBar value={us} max={tiposSorted[0][1].us} color={colors[i % colors.length]} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Evolução por mês ── */}
                {mesesSorted.length > 0 && (
                    <div style={{ ...card, padding: '16px 20px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f2544', marginBottom: '4px' }}>Evolução mensal de US</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>Distribuição de US por mês de execução</div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', overflowX: 'auto', paddingBottom: '4px' }}>
                            {mesesSorted.map(([key, { us, count, label }]) => {
                                const pct = maxMesUS > 0 ? (us / maxMesUS) * 100 : 0;
                                const barH = Math.max(8, Math.round(pct * 1.2));
                                return (
                                    <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '64px' }}>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#0f2544' }}>{fmtUS(us)}</div>
                                        <div style={{
                                            width: '100%', height: `${barH}px`, minHeight: '8px',
                                            borderRadius: '4px 4px 0 0',
                                            background: 'linear-gradient(180deg, #1d4ed8, #3b82f6)',
                                            transition: 'height 0.4s',
                                            position: 'relative',
                                        }} title={`${label}: ${fmtUS(us)} US — ${count} serviços`} />
                                        <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</div>
                                        <div style={{ fontSize: '9px', color: '#94a3b8' }}>{fmtNum(count)} sv.</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Filtros ── */}
                <div style={{ ...card, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f2544' }}>Registros importados</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {temFiltro && (
                                <button onClick={() => {
                                    setFiltroBusca(''); setFiltroFaturas([]); setFiltroDataDe('');
                                    setFiltroDataAte(''); setFiltroApenasComValor(false); setPagina(1);
                                }}
                                    style={{ fontSize: '11px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                    Limpar filtros
                                </button>
                            )}
                            <div style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', borderRadius: '20px', padding: '3px 10px', fontWeight: '500' }}>
                                {fmtNum(registrosFiltrados.length)} registros
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', alignItems: 'end' }}>
                        {/* Busca */}
                        <div>
                            <label style={labelUp}>Busca</label>
                            <div style={{ position: 'relative' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
                                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input type="text" placeholder="NSIS, NSMP, NSPR, localidade, descrição..."
                                    value={filtroBusca} onChange={e => { setFiltroBusca(e.target.value); setPagina(1); }}
                                    style={{ ...inputStyle, paddingLeft: '30px' }} />
                            </div>
                        </div>

                        {/* Fatura multiselect */}
                        <div ref={faturaDropdownRef}>
                            <label style={labelUp}>Apropriação/Fatura</label>
                            <button onClick={() => setFaturaDropdownOpen(o => !o)} style={{
                                width: '100%', padding: '7px 10px', border: filtroFaturas.length > 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                borderRadius: '8px', fontSize: '12px', background: filtroFaturas.length > 0 ? '#eff6ff' : '#fff',
                                color: filtroFaturas.length > 0 ? '#1d4ed8' : '#1e293b', fontWeight: filtroFaturas.length > 0 ? '600' : '400',
                                cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between', boxSizing: 'border-box', outline: 'none', position: 'relative',
                            }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {filtroFaturas.length === 0 ? 'Todas' : filtroFaturas.length === 1 ? filtroFaturas[0] : `${filtroFaturas.length} selecionadas`}
                                </span>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                    style={{ flexShrink: 0, marginLeft: '6px', transform: faturaDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>
                            {faturaDropdownOpen && (
                                <div style={{
                                    position: 'absolute', zIndex: 200, background: '#fff', border: '1px solid #e2e8f0',
                                    borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                                    minWidth: '200px', maxHeight: '220px', overflowY: 'auto', marginTop: '4px',
                                }}>
                                    {filtroFaturas.length > 0 && (
                                        <button onClick={() => { setFiltroFaturas([]); setPagina(1); }} style={{
                                            width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f1f5f9',
                                            background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: '11px',
                                            fontFamily: 'inherit', textAlign: 'left', fontWeight: '600',
                                        }}>Limpar seleção</button>
                                    )}
                                    {faturasList.map(f => {
                                        const sel = filtroFaturas.includes(f);
                                        return (
                                            <button key={f} onClick={() => {
                                                setFiltroFaturas(prev => sel ? prev.filter(x => x !== f) : [...prev, f]);
                                                setPagina(1);
                                            }} style={{
                                                width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f8fafc',
                                                background: sel ? '#f0f7ff' : '#fff', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit',
                                            }}>
                                                <div style={{
                                                    width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                                                    border: sel ? '4px solid #1d4ed8' : '1.5px solid #cbd5e1',
                                                    background: sel ? '#1d4ed8' : '#fff',
                                                }} />
                                                <span style={{ fontSize: '12px', color: '#334155' }}>{f}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Data de */}
                        <div>
                            <label style={labelUp}>Data de execução — de</label>
                            <input type="date" value={filtroDataDe}
                                onChange={e => { setFiltroDataDe(e.target.value); setPagina(1); }}
                                style={inputStyle} />
                        </div>

                        {/* Data até */}
                        <div>
                            <label style={labelUp}>até</label>
                            <input type="date" value={filtroDataAte}
                                onChange={e => { setFiltroDataAte(e.target.value); setPagina(1); }}
                                style={inputStyle} />
                        </div>
                    </div>

                    {/* Toggle só com valor */}
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={() => { setFiltroApenasComValor(v => !v); setPagina(1); }} style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '5px 12px', borderRadius: '7px', cursor: 'pointer', fontFamily: 'inherit',
                            border: filtroApenasComValor ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                            background: filtroApenasComValor ? '#eff6ff' : '#f8fafc',
                            color: filtroApenasComValor ? '#1d4ed8' : '#64748b',
                            fontSize: '11px', fontWeight: filtroApenasComValor ? '700' : '500',
                            transition: 'all 0.12s',
                        }}>
                            <div style={{
                                width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                                border: filtroApenasComValor ? '4px solid #1d4ed8' : '1.5px solid #cbd5e1',
                                background: filtroApenasComValor ? '#1d4ed8' : '#fff',
                            }} />
                            Exibir apenas com valor final {'>'} 0
                        </button>
                    </div>
                </div>

                {/* ── Tabela de registros ── */}
                <div style={card}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr>
                                    <th style={th}>NSIS</th>
                                    <th style={th}>NSMP</th>
                                    <th style={th}>NSPR</th>
                                    <th style={th}>Tipo de Serviço</th>
                                    <th style={th}>Localidade</th>
                                    <th style={th}>Equipamento</th>
                                    <th style={th}>Dt. Execução</th>
                                    <th style={th}>Apropriação</th>
                                    <th style={{ ...th, textAlign: 'right' }}>US Inicial</th>
                                    <th style={{ ...th, textAlign: 'right' }}>US Final</th>
                                    <th style={{ ...th, textAlign: 'right' }}>R$ Final</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageSlice.length === 0 && (
                                    <tr>
                                        <td colSpan={11} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '13px' }}>
                                            Nenhum registro encontrado com esses filtros.
                                        </td>
                                    </tr>
                                )}
                                {pageSlice.map((r, i) => {
                                    const temVal = r.valorFinal > 0;
                                    return (
                                        <tr key={r.nsis + i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
                                            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafbfc'}
                                        >
                                            <td style={{ ...td, fontWeight: '700', color: '#0f2544' }}>{r.nsis}</td>
                                            <td style={{ ...td, color: '#64748b' }}>{r.nsmp || '—'}</td>
                                            <td style={{ ...td, color: '#64748b' }}>{r.nspr || '—'}</td>
                                            <td style={{ ...td, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.tipoServico || '—'}</td>
                                            <td style={td}>{r.local || '—'}</td>
                                            <td style={td}>{r.equip || '—'}</td>
                                            <td style={td}>{r.dtExecucao ? fmtDate(new Date(r.dtExecucao)) : '—'}</td>
                                            <td style={td}>
                                                {r.apropriacao
                                                    ? <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>{r.apropriacao}</span>
                                                    : <span style={{ color: '#cbd5e1' }}>—</span>}
                                            </td>
                                            <td style={{ ...td, textAlign: 'right', color: '#64748b' }}>{fmtUS(r.valorInicial)}</td>
                                            <td style={{ ...td, textAlign: 'right', fontWeight: '700', color: temVal ? '#15803d' : '#c2410c' }}>
                                                {temVal ? fmtUS(r.valorFinal) : <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>Aguardando</span>}
                                            </td>
                                            <td style={{ ...td, textAlign: 'right', color: temVal ? '#15803d' : '#94a3b8', fontWeight: temVal ? '600' : '400' }}>
                                                {temVal ? fmtReal(r.valorFinal * US_PARA_REAL) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {registrosFiltrados.length > 0 && (
                                <tfoot>
                                    <tr style={{ background: '#f0f4ff', borderTop: '2px solid #bfdbfe' }}>
                                        <td colSpan={8} style={{ ...td, fontWeight: '700', color: '#0f2544', fontSize: '11px', letterSpacing: '0.05em' }}>
                                            TOTAL ({fmtNum(totalComValor)} serviços com valor)
                                        </td>
                                        <td style={{ ...td, textAlign: 'right' }} />
                                        <td style={{ ...td, textAlign: 'right', fontWeight: '800', color: '#0f2544', fontSize: '13px' }}>
                                            {fmtUS(totalUS)} US
                                        </td>
                                        <td style={{ ...td, textAlign: 'right', fontWeight: '800', color: '#15803d', fontSize: '13px' }}>
                                            {fmtReal(totalReais)}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* Paginação */}
                    {totalPages > 1 && (
                        <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc', borderRadius: '0 0 12px 12px' }}>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                                Exibindo <strong style={{ color: '#0f2544' }}>{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, registrosFiltrados.length)}</strong> de <strong style={{ color: '#0f2544' }}>{fmtNum(registrosFiltrados.length)}</strong>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={safePage === 1}
                                    style={{ height: '30px', width: '30px', border: '1px solid #e2e8f0', borderRadius: '7px', background: safePage === 1 ? '#f8fafc' : '#fff', color: safePage === 1 ? '#cbd5e1' : '#475569', cursor: safePage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
                                </button>
                                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                                    const p = Math.max(1, Math.min(totalPages - 6, safePage - 3)) + i;
                                    if (p > totalPages) return null;
                                    return (
                                        <button key={p} onClick={() => setPagina(p)} style={{
                                            height: '30px', minWidth: '30px', padding: '0 6px', border: p === safePage ? '2px solid #1d4ed8' : '1px solid #e2e8f0',
                                            borderRadius: '7px', background: p === safePage ? '#eff6ff' : '#fff',
                                            color: p === safePage ? '#1d4ed8' : '#475569', fontWeight: p === safePage ? '700' : '500',
                                            cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit',
                                        }}>{p}</button>
                                    );
                                })}
                                <button onClick={() => setPagina(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                    style={{ height: '30px', width: '30px', border: '1px solid #e2e8f0', borderRadius: '7px', background: safePage === totalPages ? '#f8fafc' : '#fff', color: safePage === totalPages ? '#cbd5e1' : '#475569', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Rodapé: estatísticas da importação ── */}
                <div style={{ ...card, padding: '12px 20px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '11px', color: '#64748b' }}>
                        <span>📥 Importação: <strong style={{ color: '#0f2544' }}>{fmtNum(faturamento.estatisticas?.totalLinhas)} linhas</strong> na planilha</span>
                        <span>✅ <strong style={{ color: '#15803d' }}>{fmtNum(faturamento.estatisticas?.encontrados)}</strong> encontrados no sistema</span>
                        <span>💰 <strong style={{ color: '#1d4ed8' }}>{fmtNum(faturamento.estatisticas?.comValor)}</strong> com valor final {'>'} 0</span>
                        <span>⚠️ <strong style={{ color: '#c2410c' }}>{fmtNum(faturamento.estatisticas?.naoEncontrados)}</strong> não encontrados</span>
                        <span style={{ marginLeft: 'auto' }}>
                            US total bruto: <strong style={{ color: '#0f2544' }}>{fmtUS(faturamento.estatisticas?.totalUS)} US</strong>
                        </span>
                    </div>
                </div>

            </>)}
        </div>
    );
};

export default FaturamentoTab;