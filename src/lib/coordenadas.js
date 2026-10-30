// Leitura única de coordenadas ("lat lng") para o sistema todo.
// Módulo puro (sem Supabase) para poder ser testado com Vitest.

const NUMERO_COORD = /^[+-]?\d+(?:[.,]\d+)?$/;

// Caixa em volta do Brasil: pega latitude sem sinal (Atlântico Norte), "0 0" e lat/lng trocadas
const BRASIL = { latMin: -33.8, latMax: 5.3, lngMin: -74.0, lngMax: -34.7 };

export const MENSAGEM_COORDENADA = {
  formato: 'Não deu para ler a coordenada. Use "-18.85 -41.95".',
  fora_brasil: 'Coordenada fora do Brasil — confira o sinal de menos.',
  virgula: 'Use vírgula nos decimais e espaço entre latitude e longitude: -18,844040 -41,957216',
};

// Separadores: ";", ", " (vírgula seguida de espaço) ou espaço. Sem nenhum deles, tenta "," simples;
// com 4 pedaços ("-18,85,-41,95") a vírgula também é a decimal e junta de dois em dois.
export const lerCoordenada = (texto) => {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  let partes = t.split(/\s*;\s*|\s*,\s+|\s+/);
  if (partes.length === 1) {
    partes = t.split(',');
    if (partes.length === 4) partes = [`${partes[0]},${partes[1]}`, `${partes[2]},${partes[3]}`];
  }
  if (partes.length !== 2 || !partes.every(p => NUMERO_COORD.test(p))) return null;
  const [lat, lng] = partes.map(p => Number(p.replace(',', '.')));
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

// { ok: true, lat, lng } ou { ok: false, motivo: 'vazia' | 'formato' | 'fora_brasil' }
export const validarCoordenada = (texto) => {
  if (!String(texto ?? '').trim()) return { ok: false, motivo: 'vazia' };
  const c = lerCoordenada(texto);
  if (!c) return { ok: false, motivo: 'formato' };
  const dentro = c.lat >= BRASIL.latMin && c.lat <= BRASIL.latMax && c.lng >= BRASIL.lngMin && c.lng <= BRASIL.lngMax;
  return dentro ? { ok: true, ...c } : { ok: false, motivo: 'fora_brasil' };
};

// Vão de espaçador: formato obrigatório "-18,844040 -41,957216" — vírgula nos decimais, espaço entre os dois
const COORD_COM_VIRGULA = /^[+-]?\d+(?:,\d+)?\s+[+-]?\d+(?:,\d+)?$/;

// Mesmo retorno de validarCoordenada, com o motivo extra 'virgula'
export const validarCoordenadaVao = (texto) => {
  const t = String(texto ?? '').trim();
  if (t && !COORD_COM_VIRGULA.test(t)) return { ok: false, motivo: 'virgula' };
  return validarCoordenada(t);
};

// Formato do vão ("-18,844040 -41,957216"), para gravar e mostrar; null se ilegível
export const coordenadaComVirgula = (texto) => {
  const c = lerCoordenada(texto);
  return c ? `${c.lat.toFixed(6)} ${c.lng.toFixed(6)}`.replace(/\./g, ',') : null;
};

// Preenchida mas inválida (vazia não conta: é "sem coordenada")
export const coordenadaIncorreta = (texto) => {
  const v = validarCoordenada(texto);
  return !v.ok && v.motivo !== 'vazia';
};

// Formato gravado no banco, o mesmo que o Mapa lê ("lat lng" com ponto decimal)
export const formatarCoordenada = (texto) => {
  const c = lerCoordenada(texto);
  return c ? `${c.lat.toFixed(6)} ${c.lng.toFixed(6)}` : null;
};

export const distanciaMetros = (a, b) => {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
