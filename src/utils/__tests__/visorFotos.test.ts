import {
  ESCALA_ACERCADA,
  ESCALA_MAXIMA,
  ESCALA_MINIMA,
  clampArrastre,
  distanciaEntreDedos,
  escalaAlternada,
  escalaDePellizco,
  etiquetaPosicion,
  indiceDesdeOffset,
  limitesArrastre,
} from '../visorFotos';

describe('indiceDesdeOffset', () => {
  it('redondea a la página más cercana', () => {
    expect(indiceDesdeOffset(0, 400, 3)).toBe(0);
    expect(indiceDesdeOffset(210, 400, 3)).toBe(1);
    expect(indiceDesdeOffset(190, 400, 3)).toBe(0);
    expect(indiceDesdeOffset(800, 400, 3)).toBe(2);
  });

  it('no se sale del rango aunque el scroll rebote', () => {
    expect(indiceDesdeOffset(-120, 400, 3)).toBe(0);
    expect(indiceDesdeOffset(5000, 400, 3)).toBe(2);
  });

  it('tolera una medida de pantalla todavía sin resolver', () => {
    expect(indiceDesdeOffset(300, 0, 3)).toBe(0);
    expect(indiceDesdeOffset(300, 400, 0)).toBe(0);
  });
});

describe('etiquetaPosicion', () => {
  it('numera desde uno', () => {
    expect(etiquetaPosicion(0, 4)).toBe('1 de 4');
    expect(etiquetaPosicion(3, 4)).toBe('4 de 4');
  });

  it('calla cuando hay una sola foto', () => {
    expect(etiquetaPosicion(0, 1)).toBeNull();
    expect(etiquetaPosicion(0, 0)).toBeNull();
  });
});

describe('limitesArrastre', () => {
  it('no deja margen con la foto entera', () => {
    expect(limitesArrastre(ESCALA_MINIMA, 400, 800)).toEqual({x: 0, y: 0});
  });

  it('reparte el sobrante a los dos lados', () => {
    // Al doble, sobran 400 de ancho y 800 de alto: la mitad para cada lado.
    expect(limitesArrastre(2, 400, 800)).toEqual({x: 200, y: 400});
  });

  it('trata una escala por debajo del mínimo como el mínimo', () => {
    expect(limitesArrastre(0.5, 400, 800)).toEqual({x: 0, y: 0});
  });
});

describe('clampArrastre', () => {
  it('deja pasar lo que cabe', () => {
    expect(clampArrastre(50, -30, {x: 200, y: 400})).toEqual({x: 50, y: -30});
  });

  it('corta en el borde para no destapar el fondo', () => {
    expect(clampArrastre(900, -900, {x: 200, y: 400})).toEqual({x: 200, y: -400});
  });

  it('clava en cero cuando no sobra nada', () => {
    expect(clampArrastre(120, 80, {x: 0, y: 0})).toEqual({x: 0, y: 0});
  });
});

describe('escalaAlternada', () => {
  it('acerca desde el mínimo y vuelve desde cualquier acercamiento', () => {
    expect(escalaAlternada(ESCALA_MINIMA)).toBe(ESCALA_ACERCADA);
    expect(escalaAlternada(1.2)).toBe(ESCALA_MINIMA);
    expect(escalaAlternada(ESCALA_MAXIMA)).toBe(ESCALA_MINIMA);
  });
});

describe('escalaDePellizco', () => {
  it('escala con la proporción entre las distancias', () => {
    expect(escalaDePellizco(1, 100, 200)).toBe(2);
    expect(escalaDePellizco(2, 200, 100)).toBe(1);
  });

  it('no baja del mínimo ni pasa del máximo', () => {
    expect(escalaDePellizco(1, 200, 20)).toBe(ESCALA_MINIMA);
    expect(escalaDePellizco(2, 100, 1000)).toBe(ESCALA_MAXIMA);
  });

  it('ignora una distancia inicial degenerada en vez de dividir por cero', () => {
    expect(escalaDePellizco(1.5, 0, 300)).toBe(1.5);
  });
});

describe('distanciaEntreDedos', () => {
  it('mide la hipotenusa entre los dos primeros dedos', () => {
    expect(
      distanciaEntreDedos([
        {pageX: 0, pageY: 0},
        {pageX: 30, pageY: 40},
      ]),
    ).toBe(50);
  });

  it('devuelve cero con un solo dedo', () => {
    expect(distanciaEntreDedos([{pageX: 10, pageY: 10}])).toBe(0);
  });
});
