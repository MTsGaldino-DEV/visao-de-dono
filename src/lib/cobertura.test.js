import { describe, it, expect } from 'vitest';
import { agruparPorDistancia, contornoConvexo, areaKm2, calcularAreas } from './cobertura';

// 0.001° de latitude ≈ 111 m
const p = (id, dLat, dLng) => ({ id, lat: -18.85 + dLat * 0.001, lng: -41.95 + dLng * 0.001 });

describe('agruparPorDistancia', () => {
  it('encadeia serviços próximos e separa os distantes, maior grupo primeiro', () => {
    const pontos = [p('a', 0, 0), p('b', 5, 0), p('c', 10, 0), p('longe', 40, 0)];
    const grupos = agruparPorDistancia(pontos, 1000);
    expect(grupos.map(g => g.map(x => x.id).sort())).toEqual([['a', 'b', 'c'], ['longe']]);
  });
  it('com régua maior junta tudo', () => {
    const pontos = [p('a', 0, 0), p('longe', 40, 0)];
    expect(agruparPorDistancia(pontos, 5000)).toHaveLength(1);
  });
  it('lista vazia não tem grupos', () => {
    expect(agruparPorDistancia([], 1000)).toEqual([]);
  });
});

describe('contornoConvexo', () => {
  it('fica só com os serviços de ponta', () => {
    const pontos = [p('so', 0, 0), p('se', 0, 10), p('ne', 10, 10), p('no', 10, 0), p('meio', 5, 5)];
    const ids = contornoConvexo(pontos).map(x => x.id).sort();
    expect(ids).toEqual(['ne', 'no', 'se', 'so']);
  });
  it('um ou dois serviços são o próprio contorno', () => {
    expect(contornoConvexo([p('a', 0, 0)]).map(x => x.id)).toEqual(['a']);
    expect(contornoConvexo([p('a', 0, 0), p('b', 1, 1)])).toHaveLength(2);
  });
  it('serviços repetidos na mesma coordenada não duplicam o contorno', () => {
    expect(contornoConvexo([p('a', 0, 0), p('b', 0, 0)])).toHaveLength(1);
  });
});

describe('areaKm2', () => {
  it('mede o quadrado de ~1,1 km de lado', () => {
    const quadrado = [p('so', 0, 0), p('se', 0, 10), p('ne', 10, 10), p('no', 10, 0)];
    // 1,112 km × 1,052 km (longitude encolhe com o cosseno da latitude)
    expect(areaKm2(quadrado)).toBeCloseTo(1.17, 1);
  });
  it('menos de 3 pontos não têm área', () => {
    expect(areaKm2([p('a', 0, 0), p('b', 1, 1)])).toBe(0);
  });
});

describe('calcularAreas', () => {
  it('devolve serviços, contorno e km² de cada área', () => {
    const pontos = [p('so', 0, 0), p('se', 0, 5), p('ne', 5, 5), p('no', 5, 0), p('meio', 2, 2), p('longe', 50, 0)];
    const areas = calcularAreas(pontos, 1000);
    expect(areas).toHaveLength(2);
    expect(areas[0].servicos).toHaveLength(5);
    expect(areas[0].contorno).toHaveLength(4);
    expect(areas[0].km2).toBeGreaterThan(0);
    expect(areas[1].km2).toBe(0);
  });
});
