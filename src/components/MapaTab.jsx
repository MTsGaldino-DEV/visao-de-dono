import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
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

// ── SVG marker factory ──────────────────────────────────────────────────────
const createMarkerIcon = (color) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
      <defs>
        <filter id="shadow" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z"
            fill="${color}" filter="url(#shadow)"/>
      <circle cx="14" cy="13" r="5.5" fill="#fff" opacity="0.95"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  });
};

// Cache dos ícones
const iconCache = {};
const getIcon = (status) => {
  const color = STATUS_COLORS[status] || '#94a3b8';
  if (!iconCache[color]) {
    iconCache[color] = createMarkerIcon(color);
  }
  return iconCache[color];
};

// ── Parseia "lat lng" => { lat, lng } ───────────────────────────────────────
const parseCoord = (coordStr) => {
  if (!coordStr || typeof coordStr !== 'string') return null;
  const parts = coordStr.trim().split(/[\s,]+/).map(s => parseFloat(s.replace(',', '.')));
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  if (Math.abs(parts[0]) > 90 || Math.abs(parts[1]) > 180) return null;
  return { lat: parts[0], lng: parts[1] };
};

// ── Componente para fitBounds automaticamente ───────────────────────────────
const FitBounds = ({ markers }) => {
  const map = useMap();
  const prevCount = useRef(0);

  useEffect(() => {
    if (markers.length === 0) return;
    // Fit only on initial load or when markers change significantly
    if (prevCount.current !== markers.length) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      prevCount.current = markers.length;
    }
  }, [markers, map]);

  return null;
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

  // ── Carregar serviços ─────────────────────────────────────────────────────
  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('servicos')
        .select('*')
        .not('status', 'eq', 'cancelado');
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

  // ── Serviços com coordenadas válidas ──────────────────────────────────────
  const servicosComCoord = useMemo(() => {
    return servicos
      .filter(s => {
        if (statusFilter.length > 0 && !statusFilter.includes(s.status)) return false;
        return parseCoord(s.coord) !== null;
      })
      .map(s => ({ ...s, _coord: parseCoord(s.coord) }));
  }, [servicos, statusFilter]);

  const semCoord = servicos.length - servicos.filter(s => parseCoord(s.coord)).length;

  // ── Contagem por status para legenda ──────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts = {};
    servicos.forEach(s => {
      if (parseCoord(s.coord)) {
        counts[s.status] = (counts[s.status] || 0) + 1;
      }
    });
    return counts;
  }, [servicos]);

  const toggleStatusFilter = (status) => {
    setStatusFilter(prev => {
      if (prev.includes(status)) return prev.filter(s => s !== status);
      return [...prev, status];
    });
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

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── Header com stats ───────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '14px', flexWrap: 'wrap', gap: '10px',
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2544' }}>
            Mapa de Serviços
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
            {servicosComCoord.length} serviços no mapa
            {semCoord > 0 && (
              <span style={{ marginLeft: '8px', color: '#f59e0b' }}>
                · {semCoord} sem coordenada
              </span>
            )}
          </div>
        </div>

        {/* Reset filtro */}
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

      {/* ── Container do mapa ─────────────────────────────────────────────── */}
      <div style={{
        borderRadius: '12px', overflow: 'hidden',
        border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        height: '620px', position: 'relative',
      }}>
        {servicosComCoord.length === 0 ? (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#f8fafc', flexDirection: 'column', gap: '10px',
          }}>
            <div style={{ fontSize: '36px' }}>📍</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>
              Nenhum serviço com coordenadas encontrado
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Os serviços precisam ter o campo "coord" preenchido para aparecer no mapa.
            </div>
          </div>
        ) : (
          <MapContainer
            center={[servicosComCoord[0]._coord.lat, servicosComCoord[0]._coord.lng]}
            zoom={10}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FitBounds markers={servicosComCoord.map(s => s._coord)} />

            {servicosComCoord.map(s => (
              <Marker
                key={s.id}
                position={[s._coord.lat, s._coord.lng]}
                icon={getIcon(s.status)}
                eventHandlers={{
                  click: () => {
                    setSelectedService(s);
                    setModalOpen(true);
                  },
                }}
              >
                <Popup>
                  <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", minWidth: '200px' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f2544' }}>
                        {s.id}
                      </span>
                      <span style={{
                        fontSize: '9px', padding: '2px 7px', borderRadius: '20px',
                        fontWeight: '600', color: '#fff',
                        background: STATUS_COLORS[s.status] || '#94a3b8',
                      }}>
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.6' }}>
                      {s.tipo && <div><strong>Tipo:</strong> {s.tipo}</div>}
                      {s.local && <div><strong>Local:</strong> {s.local}</div>}
                      {s.equip && <div><strong>Equip:</strong> {s.equip}</div>}
                      {s.desc && (
                        <div style={{ marginTop: '4px', color: '#64748b', fontSize: '10px' }}>
                          {s.desc.length > 80 ? s.desc.slice(0, 80) + '…' : s.desc}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedService(s);
                        setModalOpen(true);
                      }}
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
              </Marker>
            ))}
          </MapContainer>
        )}
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
