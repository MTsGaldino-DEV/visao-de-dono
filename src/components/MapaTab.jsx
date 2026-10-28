import { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Polygon, Polyline, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase, fetchAll } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { validarCoordenada } from '../lib/coordenadas';
import { calcularAreas, DISTANCIA_NOVA_AREA_M } from '../lib/cobertura';
import DetalheModal from './DetalheModal';

// ── Cores por status (mesma paleta dos badges) ──────────────────────────────
const STATUS_COLORS = {
  cadastrado: '#1d4ed8',
  enviado: '#7c3aed',
  acionado: '#f59e0b',
  em_execucao: '#3b82f6',
  pendente: '#94a3b8',
  concluido: '#15803d',
  cancelado: '#94a3b8',
  reprovado: '#dc2626',
  executado: '#15803d',
};

const STATUS_LABELS = {
  cadastrado: 'Cadastrado',
  enviado: 'Enviado CEMIG',
  acionado: 'Acionado',
  em_execucao: 'Em Execução',
  pendente: 'Pendente',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  reprovado: 'Reprovado',
  executado: 'Executado',
};

// ── Tons de azul das áreas (identidade do site, legíveis no fundo escuro) ───
const CORES_AREA = ['#3b82f6', '#60a5fa', '#38bdf8', '#818cf8', '#93c5fd', '#2dd4bf'];

const formatarDistancia = (m) => (m >= 1000 ? `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km` : `${m} m`);
const formatarKm2 = (km2) => `${km2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km²`;

// ── Enquadra os serviços válidos no carregamento e quando a quantidade muda ──
const FitBounds = ({ pontos, onMapa }) => {
  const map = useMap();
  const prevCount = useRef(0);

  useEffect(() => { onMapa(map); }, [map, onMapa]);

  useEffect(() => {
    if (pontos.length === 0 || prevCount.current === pontos.length) return;
    map.fitBounds(L.latLngBounds(pontos.map(p => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 });
    prevCount.current = pontos.length;
  }, [pontos, map]);

  return null;
};

// ── Forma da área: polígono, faixa (2 serviços) ou círculo (1 serviço) ──────
const FormaArea = ({ area, indice, cor }) => {
  const latlngs = area.contorno.map(p => [p.lat, p.lng]);
  const rotulo = `Área ${indice + 1}: ${area.servicos.length} serviço(s)${area.km2 ? ` · ${formatarKm2(area.km2)}` : ''}`;
  const tooltip = <Tooltip sticky>{rotulo}</Tooltip>;
  if (latlngs.length >= 3) {
    return (
      <Polygon positions={latlngs} pathOptions={{ color: cor, weight: 2.5, fillColor: cor, fillOpacity: 0.28, lineJoin: 'round' }}>
        {tooltip}
      </Polygon>
    );
  }
  if (latlngs.length === 2) {
    return <Polyline positions={latlngs} pathOptions={{ color: cor, weight: 14, opacity: 0.35, lineCap: 'round' }}>{tooltip}</Polyline>;
  }
  return <Circle center={latlngs[0]} radius={60} pathOptions={{ color: cor, weight: 2, fillColor: cor, fillOpacity: 0.28 }}>{tooltip}</Circle>;
};

// ── Componente principal ────────────────────────────────────────────────────
const MapaTab = () => {
  const { user } = useAuth();
  const isDono = user?.role === 'dono';
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState([]);
  const [distancia, setDistancia] = useState(DISTANCIA_NOVA_AREA_M);
  const [verServicos, setVerServicos] = useState(true);
  const [soPonta, setSoPonta] = useState(false);
  const [mapa, setMapa] = useState(null);
  const distanciaAdiada = useDeferredValue(distancia);

  // ── Carregar serviços ─────────────────────────────────────────────────────
  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      const { data, error } = await fetchAll(() => supabase
        .from('servicos')
        .select('*')
        .not('status', 'eq', 'cancelado'));
      if (error) console.error('Erro ao buscar serviços:', error);
      else setServicos(data || []);
      setLoading(false);
    };
    carregar();

    const channel = supabase.channel('servicos_mapa')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, () => {
        carregar();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Separa válidos, sem coordenada e com coordenada incorreta ─────────────
  const { validos, semCoord, incorretos } = useMemo(() => {
    const validos = [], incorretos = [];
    let semCoord = 0;
    servicos.forEach(s => {
      const v = validarCoordenada(s.coord);
      if (v.ok) validos.push({ ...s, lat: v.lat, lng: v.lng });
      else if (v.motivo === 'vazia') semCoord++;
      else incorretos.push({ ...s, _motivo: v.motivo });
    });
    return { validos, semCoord, incorretos };
  }, [servicos]);

  const servicosNoMapa = useMemo(
    () => (statusFilter.length > 0 ? validos.filter(s => statusFilter.includes(s.status)) : validos),
    [validos, statusFilter],
  );

  const areas = useMemo(() => calcularAreas(servicosNoMapa, distanciaAdiada), [servicosNoMapa, distanciaAdiada]);
  const totalKm2 = areas.reduce((soma, a) => soma + a.km2, 0);

  // ── Contagem por status para legenda ──────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts = {};
    validos.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
    return counts;
  }, [validos]);

  const toggleStatusFilter = (status) => {
    setStatusFilter(prev => {
      if (prev.includes(status)) return prev.filter(s => s !== status);
      return [...prev, status];
    });
  };

  const abrirDetalhe = (s) => { setSelectedService(s); setModalOpen(true); };
  const irParaArea = (area) => {
    if (mapa) mapa.fitBounds(L.latLngBounds(area.servicos.map(p => [p.lat, p.lng])).pad(0.3), { maxZoom: 17 });
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '600px', color: '#94a3b8', fontSize: '13px',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '36px', height: '36px', border: '3px solid #e2e8f0',
            borderTopColor: '#0f2544', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
          }} />
          Carregando mapa...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  const linhaStat = (rotulo, valor, cor = '#0f2544') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ color: '#64748b' }}>{rotulo}</span>
      <b style={{ color: cor }}>{valor}</b>
    </div>
  );
  const tituloPainel = (texto) => (
    <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.05em', color: '#94a3b8', margin: '14px 0 6px' }}>
      {texto}
    </div>
  );

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        .mapa-grade { display: grid; grid-template-columns: 1fr 260px; gap: 12px; }
        @media (max-width: 900px) { .mapa-grade { grid-template-columns: 1fr; } }
        .mapa-escuro { filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9) saturate(0.35); }
      `}</style>

      {/* ── Header com stats e controles ───────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: '14px', flexWrap: 'wrap', gap: '10px',
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544' }}>
            Cobertura de Levantamento
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
            {servicosNoMapa.length} serviços no mapa · {areas.length} {areas.length === 1 ? 'área' : 'áreas'}
            {semCoord > 0 && <span style={{ marginLeft: '8px', color: '#f59e0b' }}>· {semCoord} sem coordenada</span>}
            {incorretos.length > 0 && <span style={{ marginLeft: '8px', color: '#dc2626' }}>· {incorretos.length} com coordenada incorreta</span>}
          </div>
        </div>

        <div style={{
          display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap',
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
          padding: '8px 12px', fontSize: '12px', color: '#475569', fontWeight: '600',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            Distância para abrir nova área
            <input type="range" min="200" max="2000" step="50" value={distancia}
              onChange={e => setDistancia(Number(e.target.value))}
              style={{ width: '150px', accentColor: '#1d4ed8' }} />
            <span style={{ color: '#1d4ed8', minWidth: '54px' }}>{formatarDistancia(distancia)}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" checked={verServicos} onChange={e => setVerServicos(e.target.checked)} /> Mostrar serviços
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: verServicos ? 1 : 0.5 }}>
            <input type="checkbox" checked={soPonta} disabled={!verServicos} onChange={e => setSoPonta(e.target.checked)} /> Só os de ponta
          </label>
          {statusFilter.length > 0 && (
            <button
              onClick={() => setStatusFilter([])}
              style={{
                padding: '5px 12px', fontSize: '11px', fontWeight: '600',
                background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px',
                color: '#64748b', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Limpar filtros ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Legenda interativa ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap',
      }}>
        {Object.entries(statusCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([status, count]) => {
            const color = STATUS_COLORS[status] || '#94a3b8';
            const label = STATUS_LABELS[status] || status;
            const active = statusFilter.length === 0 || statusFilter.includes(status);
            return (
              <button
                key={status}
                onClick={() => toggleStatusFilter(status)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '4px 10px', borderRadius: '20px', fontSize: '11px',
                  fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
                  border: `1.5px solid ${active ? color : '#e2e8f0'}`,
                  background: active ? `${color}12` : '#f8fafc',
                  color: active ? color : '#94a3b8',
                  opacity: active ? 1 : 0.55,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: active ? color : '#cbd5e1',
                  flexShrink: 0,
                }} />
                {label}
                <span style={{
                  fontSize: '10px', fontWeight: '700',
                  background: active ? `${color}20` : '#f1f5f9',
                  padding: '0 5px', borderRadius: '10px',
                }}>
                  {count}
                </span>
              </button>
            );
          })}
      </div>

      <div className="mapa-grade">
        {/* ── Container do mapa ───────────────────────────────────────────── */}
        <div style={{
          borderRadius: '12px', overflow: 'hidden',
          border: '1px solid #0f2544', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          height: '620px', position: 'relative', background: '#0b1220',
        }}>
          {servicosNoMapa.length === 0 ? (
            <div style={{
              height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: '10px',
            }}>
              <div style={{ fontSize: '36px' }}>📍</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#cbd5e1' }}>
                Nenhum serviço com coordenada válida encontrado
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Os serviços precisam ter o campo "coord" preenchido, dentro do Brasil, para aparecer no mapa.
              </div>
            </div>
          ) : (
            <MapContainer
              center={[servicosNoMapa[0].lat, servicosNoMapa[0].lng]}
              zoom={12}
              style={{ height: '100%', width: '100%', background: '#0b1220' }}
              zoomControl={true}
            >
              {/* OpenStreetMap escurecido por CSS: a CARTO Dark passou a exigir chave de API */}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                className="mapa-escuro"
                maxZoom={19}
              />

              <FitBounds pontos={servicosNoMapa} onMapa={setMapa} />

              {areas.map((area, i) => (
                <FormaArea key={`area-${i}-${area.servicos.length}`} area={area} indice={i} cor={CORES_AREA[i % CORES_AREA.length]} />
              ))}

              {verServicos && areas.flatMap(area => {
                const ponta = new Set(area.contorno);
                return area.servicos
                  .filter(s => !soPonta || ponta.has(s))
                  .map(s => {
                    const ehPonta = ponta.has(s);
                    const cor = STATUS_COLORS[s.status] || '#94a3b8';
                    return (
                      <CircleMarker
                        key={s.id}
                        center={[s.lat, s.lng]}
                        radius={ehPonta ? 7 : 4.5}
                        pathOptions={{
                          color: ehPonta ? '#fff' : 'rgba(255,255,255,0.55)',
                          weight: ehPonta ? 2.5 : 1.5,
                          fillColor: cor, fillOpacity: 1,
                        }}
                      >
                        <Tooltip direction="top" offset={[0, ehPonta ? -7 : -4]}>{s.id}{s.tipo ? ` · ${s.tipo}` : ''}</Tooltip>
                        <Popup>
                          <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", minWidth: '210px' }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
                              marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9',
                            }}>
                              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544' }}>{s.id}</span>
                              <span style={{
                                fontSize: '9px', padding: '2px 7px', borderRadius: '20px',
                                fontWeight: '600', color: '#fff', background: cor,
                              }}>
                                {STATUS_LABELS[s.status] || s.status}
                              </span>
                              {ehPonta && (
                                <span style={{
                                  fontSize: '9px', padding: '2px 7px', borderRadius: '20px',
                                  fontWeight: '600', color: '#1d4ed8', background: '#dbeafe',
                                }}>
                                  Ponta
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.6' }}>
                              {s.tipo && <div><strong>Tipo:</strong> {s.tipo}</div>}
                              {s.local && <div><strong>Local:</strong> {s.local}</div>}
                              {s.equip && <div><strong>Equip:</strong> {s.equip}</div>}
                              {s.orig && <div><strong>Técnico de origem:</strong> {s.orig}</div>}
                              {s.desc && (
                                <div style={{ marginTop: '4px', color: '#64748b', fontSize: '10px' }}>
                                  {s.desc.length > 80 ? s.desc.slice(0, 80) + '…' : s.desc}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); abrirDetalhe(s); }}
                              style={{
                                marginTop: '10px', width: '100%', padding: '6px',
                                background: '#0f2544', color: '#fff', border: 'none',
                                borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                                cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              Ver detalhes →
                            </button>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  });
              })}
            </MapContainer>
          )}
        </div>

        {/* ── Painel lateral ──────────────────────────────────────────────── */}
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
          padding: '4px 14px 14px', fontSize: '12px', maxHeight: '620px', overflow: 'auto',
        }}>
          {tituloPainel('Resumo')}
          {linhaStat('Áreas', areas.length)}
          {linhaStat('Área coberta', formatarKm2(totalKm2))}
          {linhaStat('Serviços no mapa', servicosNoMapa.length)}
          {linhaStat('Sem coordenada', semCoord, semCoord ? '#f59e0b' : '#0f2544')}
          {linhaStat('Coordenada incorreta', incorretos.length, incorretos.length ? '#dc2626' : '#0f2544')}

          {incorretos.length > 0 && (
            <>
              {tituloPainel('Corrigir coordenada')}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {incorretos.map(s => (
                  <button
                    key={s.id}
                    onClick={() => abrirDetalhe(s)}
                    title={`${s.coord} — ${s._motivo === 'fora_brasil' ? 'fora do Brasil' : 'não deu para ler'}`}
                    style={{
                      padding: '2px 8px', fontSize: '11px', fontWeight: '600', fontFamily: 'inherit',
                      background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                      borderRadius: '20px', cursor: 'pointer',
                    }}
                  >
                    {s.id}
                  </button>
                ))}
              </div>
            </>
          )}

          {tituloPainel('Áreas (clique para ir)')}
          {areas.map((area, i) => (
            <div
              key={`lista-${i}-${area.servicos.length}`}
              onClick={() => irParaArea(area)}
              style={{
                display: 'flex', gap: '8px', alignItems: 'center', padding: '8px',
                borderRadius: '8px', cursor: 'pointer', marginTop: '6px', border: '1px solid #e2e8f0',
              }}
            >
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', flexShrink: 0, background: CORES_AREA[i % CORES_AREA.length] }} />
              <div>
                <b style={{ color: '#0f2544' }}>Área {i + 1}</b>
                <div style={{ color: '#94a3b8' }}>
                  {area.servicos.length} serviço(s){area.km2 ? ` · ${formatarKm2(area.km2)}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DetalheModal reutilizado ──────────────────────────────────────── */}
      <DetalheModal
        service={selectedService}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedService(null); }}
        isDono={isDono}
      />
    </div>
  );
};

export default MapaTab;
