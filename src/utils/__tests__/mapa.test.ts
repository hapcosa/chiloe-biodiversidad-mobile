import type {CeldaMapa} from '../../types/mapa';
import {
  esPuntoCaliente,
  plural,
  resumenCelda,
  tituloCelda,
  radioCeldaMetros,
  regionDeUbicacion,
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

describe('plural', () => {
  it('usa el singular cuando hay uno solo', () => {
    expect(plural(1, 'encuentro', 'encuentros')).toBe('1 encuentro');
  });

  it('usa el plural con cero y con más de uno', () => {
    expect(plural(0, 'encuentro', 'encuentros')).toBe('0 encuentros');
    expect(plural(4, 'especie', 'especies')).toBe('4 especies');
  });
});

describe('regionDeUbicacion', () => {
  const chiloeEntero = {
    latitude: -42.62,
    longitude: -73.85,
    latitudeDelta: 1.6,
    longitudeDelta: 1.6,
  };

  it('acerca cuando el mapa venía mostrando la isla entera', () => {
    const region = regionDeUbicacion(-41.87, -73.82, chiloeEntero);
    expect(region.latitude).toBe(-41.87);
    expect(region.longitude).toBe(-73.82);
    expect(region.latitudeDelta).toBe(0.1);
    expect(region.longitudeDelta).toBe(0.1);
  });

  it('conserva la escala si ya se estaba mirando de cerca', () => {
    const cerca = {...chiloeEntero, latitudeDelta: 0.01, longitudeDelta: 0.02};
    const region = regionDeUbicacion(-41.87, -73.82, cerca);
    expect(region.latitudeDelta).toBe(0.01);
    expect(region.longitudeDelta).toBe(0.02);
  });

  it('no devuelve deltas negativos aunque el mapa entregue uno', () => {
    const raro = {...chiloeEntero, latitudeDelta: -0.01, longitudeDelta: -0.02};
    const region = regionDeUbicacion(-41.87, -73.82, raro);
    expect(region.latitudeDelta).toBe(0.01);
    expect(region.longitudeDelta).toBe(0.02);
  });
});

describe('tituloCelda', () => {
  it('nombra el punto caliente', () => {
    expect(tituloCelda(celda({total: 12}))).toBe('Punto caliente');
  });

  it('llama zona a lo que no llega a punto caliente', () => {
    expect(tituloCelda(celda({total: 3}))).toBe('Zona con encuentros');
  });
});

describe('resumenCelda', () => {
  it('en un punto caliente no cuenta especies, porque siempre sería una', () => {
    expect(resumenCelda(celda({total: 12}))).toBe('12 registros');
  });

  it('cuenta encuentros y especies en una zona común', () => {
    expect(resumenCelda(celda({total: 3, especies_distintas: 2}))).toBe(
      '3 encuentros · 2 especies',
    );
  });

  it('no dice "0 especies" cuando nadie identifico nada', () => {
    expect(resumenCelda(celda({total: 2, especies_distintas: 0}))).toBe(
      '2 encuentros · sin identificar',
    );
  });

  it('respeta el singular', () => {
    expect(resumenCelda(celda({total: 1, especies_distintas: 1}))).toBe(
      '1 encuentro · 1 especie',
    );
  });
});
