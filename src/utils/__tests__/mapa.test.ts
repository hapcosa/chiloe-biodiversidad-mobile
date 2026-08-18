import type {CeldaMapa} from '../../types/mapa';
import {
  esPuntoCaliente,
  radioCeldaMetros,
  regionToBbox,
  regionToZoom,
  regionesEquivalentes,
} from '../mapa';

const celda = (overrides: Partial<CeldaMapa> = {}): CeldaMapa => ({
  lat: -42.6,
  lng: -73.9,
  grados: 0.02,
  total: 10,
  especies_distintas: 1,
  especie_dominante_id: 7,
  sensible: false,
  ...overrides,
});

describe('regionToBbox', () => {
  it('reparte los deltas a cada lado del centro', () => {
    const bbox = regionToBbox({
      latitude: -42.6,
      longitude: -73.8,
      latitudeDelta: 0.4,
      longitudeDelta: 0.2,
    });

    expect(bbox.min_lat).toBeCloseTo(-42.8);
    expect(bbox.max_lat).toBeCloseTo(-42.4);
    expect(bbox.min_lng).toBeCloseTo(-73.9);
    expect(bbox.max_lng).toBeCloseTo(-73.7);
  });

  it('recorta en los polos y el antimeridiano', () => {
    const bbox = regionToBbox({
      latitude: -89,
      longitude: 179,
      latitudeDelta: 20,
      longitudeDelta: 20,
    });

    expect(bbox.min_lat).toBe(-90);
    expect(bbox.max_lng).toBe(180);
  });
});

describe('regionToZoom', () => {
  it('da 0 cuando se ve el mundo entero', () => {
    expect(
      regionToZoom({latitude: 0, longitude: 0, latitudeDelta: 360, longitudeDelta: 360}),
    ).toBe(0);
  });

  it('sube un nivel cada vez que se parte el ancho en dos', () => {
    const zoom180 = regionToZoom({
      latitude: 0,
      longitude: 0,
      latitudeDelta: 180,
      longitudeDelta: 180,
    });
    const zoom90 = regionToZoom({
      latitude: 0,
      longitude: 0,
      latitudeDelta: 90,
      longitudeDelta: 90,
    });

    expect(zoom180).toBe(1);
    expect(zoom90).toBe(2);
  });

  it('no se va a infinito con un delta degenerado', () => {
    expect(
      regionToZoom({latitude: 0, longitude: 0, latitudeDelta: 0, longitudeDelta: 0}),
    ).toBe(20);
  });
});

describe('regionesEquivalentes', () => {
  const base = {
    latitude: -42.6,
    longitude: -73.8,
    latitudeDelta: 0.4,
    longitudeDelta: 0.4,
  };

  it('ignora un movimiento mínimo', () => {
    expect(regionesEquivalentes(base, {...base, latitude: -42.601})).toBe(true);
  });

  it('detecta un desplazamiento real', () => {
    expect(regionesEquivalentes(base, {...base, latitude: -42.3})).toBe(false);
  });

  it('detecta un cambio de zoom', () => {
    expect(
      regionesEquivalentes(base, {...base, latitudeDelta: 0.2, longitudeDelta: 0.2}),
    ).toBe(false);
  });
});

describe('esPuntoCaliente', () => {
  it('marca una concentración apretada de una sola especie', () => {
    expect(esPuntoCaliente(celda())).toBe(true);
  });

  it('descarta las celdas con pocos registros', () => {
    expect(esPuntoCaliente(celda({total: 3}))).toBe(false);
  });

  it('descarta las celdas grandes: "acá se ve mucho" no ubica nada', () => {
    expect(esPuntoCaliente(celda({grados: 0.5}))).toBe(false);
  });

  it('descarta la mezcla de especies, que habla del tránsito de gente', () => {
    expect(esPuntoCaliente(celda({especies_distintas: 4}))).toBe(false);
  });

  it('descarta la celda sin especie dominante', () => {
    expect(esPuntoCaliente(celda({especie_dominante_id: null}))).toBe(false);
  });
});

describe('radioCeldaMetros', () => {
  it('usa el lado real de la celda, no un radio fijo', () => {
    expect(radioCeldaMetros(celda({grados: 0.02}))).toBeCloseTo(1113.2, 0);
    expect(radioCeldaMetros(celda({grados: 0.2}))).toBeCloseTo(11132, 0);
  });
});
