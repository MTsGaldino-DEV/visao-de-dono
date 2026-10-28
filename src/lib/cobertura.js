// Áreas de cobertura do Mapa: agrupa serviços próximos e liga os de ponta.
// Módulo puro (sem Supabase) para poder ser testado com Vitest.
// Os pontos são objetos com { lat, lng } (o resto dos campos é preservado).

import { distanciaMetros } from './coordenadas';

export const DISTANCIA_NOVA_AREA_M = 1000;

// Dois serviços a até `distanciaM` um do outro ficam na mesma área (encadeado). Maior grupo primeiro.
export const agruparPorDistancia = (pontos, distanciaM) => {
  const pai = pontos.map((_, i) => i);
  const raiz = (i) => (pai[i] === i ? i : (pai[i] = raiz(pai[i])));
  for (let i = 0; i < pontos.length; i++) {
    for (let j = i + 1; j < pontos.length; j++) {
      if (raiz(i) !== raiz(j) && distanciaMetros(pontos[i], pontos[j]) <= distanciaM) pai[raiz(i)] = raiz(j);
    }
  }
  const grupos = new Map();
  pontos.forEach((p, i) => {
    const r = raiz(i);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(p);
  });
  return [...grupos.values()].sort((a, b) => b.length - a.length);
};

// Envoltória convexa (cadeia monótona): só os serviços de ponta, em ordem ao redor da área
export const contornoConvexo = (pontos) => {
  if (pontos.length === 0) return [];
  const k = Math.cos((pontos[0].lat * Math.PI) / 180); // longitude encolhe longe do equador
  const ordenados = [...pontos].sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  const unicos = ordenados.filter((p, i) => i === 0 || p.lat !== ordenados[i - 1].lat || p.lng !== ordenados[i - 1].lng);
  if (unicos.length < 3) return unicos;
  const cruz = (o, a, b) => (a.lng - o.lng) * k * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng) * k;
  const meia = (lista) => {
    const h = [];
    for (const p of lista) {
      while (h.length >= 2 && cruz(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    return h.slice(0, -1);
  };
  return [...meia(unicos), ...meia([...unicos].reverse())];
};

export const areaKm2 = (contorno) => {
  if (contorno.length < 3) return 0;
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;
  const k = Math.cos(rad(contorno[0].lat));
  let soma = 0;
  contorno.forEach((p, i) => {
    const q = contorno[(i + 1) % contorno.length];
    soma += rad(p.lng) * k * R * rad(q.lat) * R - rad(q.lng) * k * R * rad(p.lat) * R;
  });
  return Math.abs(soma) / 2;
};

export const calcularAreas = (pontos, distanciaM = DISTANCIA_NOVA_AREA_M) =>
  agruparPorDistancia(pontos, distanciaM).map((servicos) => {
    const contorno = contornoConvexo(servicos);
    return { servicos, contorno, km2: areaKm2(contorno) };
  });
