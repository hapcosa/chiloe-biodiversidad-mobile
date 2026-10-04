// Geometría del visor de fotos a pantalla completa.
//
// El visor muestra la foto con encaje "contain" (entera, sin recortar) y deja
// acercarla. Al acercarla la foto se sale de la pantalla, así que hay que
// acotar el arrastre: sin tope se puede empujar la foto fuera de la vista y
// quedar mirando el fondo negro.
//
// Todo lo que sigue es aritmética pura para poder probarla sin renderizar.

export const ESCALA_MINIMA = 1;
// Holgura para no confundir el pulso de un dedo apoyado con un arrastre.
export const UMBRAL_ARRASTRE = 2;
// Cuánto puede moverse un dedo y seguir contando como toque y no como arrastre.
export const UMBRAL_TOQUE = 6;
export const ESCALA_ACERCADA = 2.5;
export const ESCALA_MAXIMA = 4;

export const clamp = (valor: number, minimo: number, maximo: number): number =>
  Math.min(maximo, Math.max(minimo, valor));

/**
 * Página visible a partir del desplazamiento horizontal del carrusel. Cada
 * página ocupa el ancho entero de la pantalla, así que basta redondear.
 */
export const indiceDesdeOffset = (offsetX: number, anchoPagina: number, total: number): number => {
  if (anchoPagina <= 0 || total <= 0) {
    return 0;
  }
  return clamp(Math.round(offsetX / anchoPagina), 0, total - 1);
};

/** "3 de 7" para el contador. Devuelve null cuando hay una sola foto. */
export const etiquetaPosicion = (indice: number, total: number): string | null => {
  if (total <= 1) {
    return null;
  }
  return `${clamp(indice, 0, total - 1) + 1} de ${total}`;
};

/**
 * Cuánto se puede arrastrar la foto en cada eje sin destapar el fondo. Con la
 * escala al mínimo no sobra nada y el resultado es cero: el arrastre se ignora
 * y el gesto horizontal queda para el carrusel.
 */
export const limitesArrastre = (
  escala: number,
  anchoVista: number,
  altoVista: number,
): {x: number; y: number} => {
  const efectiva = Math.max(ESCALA_MINIMA, escala);
  return {
    x: Math.max(0, (anchoVista * efectiva - anchoVista) / 2),
    y: Math.max(0, (altoVista * efectiva - altoVista) / 2),
  };
};

/** Recorta el arrastre a los límites del eje correspondiente. */
export const clampArrastre = (
  x: number,
  y: number,
  limites: {x: number; y: number},
): {x: number; y: number} => ({
  x: clamp(x, -limites.x, limites.x),
  y: clamp(y, -limites.y, limites.y),
});

/** Doble toque: alterna entre ver la foto entera y acercarla. */
export const escalaAlternada = (escalaActual: number): number =>
  escalaActual > ESCALA_MINIMA ? ESCALA_MINIMA : ESCALA_ACERCADA;

/** Escala de un pellizco, acotada. Ignora la medición inicial degenerada. */
export const escalaDePellizco = (
  escalaBase: number,
  distanciaInicial: number,
  distanciaActual: number,
): number => {
  if (distanciaInicial <= 0) {
    return escalaBase;
  }
  return clamp(
    (escalaBase * distanciaActual) / distanciaInicial,
    ESCALA_MINIMA,
    ESCALA_MAXIMA,
  );
};

/** Distancia entre los dos primeros dedos de un gesto. */
export const distanciaEntreDedos = (
  dedos: ReadonlyArray<{pageX: number; pageY: number}>,
): number => {
  if (dedos.length < 2) {
    return 0;
  }
  const a = dedos[0];
  const b = dedos[1];
  if (!a || !b) {
    return 0;
  }
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

/**
 * Si el visor debe quedarse con el gesto. Cuenta los dedos aparte de mirar el
 * desplazamiento porque en un pellizco simétrico el centroide no se mueve:
 * mirando solo `dx`/`dy` un pellizco iniciado después de haberle cedido el
 * gesto al carrusel no se recuperaría nunca.
 */
export const debeTomarElGesto = (
  dedos: number,
  escala: number,
  dx: number,
  dy: number,
): boolean =>
  dedos >= 2 ||
  escala > ESCALA_MINIMA ||
  Math.abs(dx) > UMBRAL_ARRASTRE ||
  Math.abs(dy) > UMBRAL_ARRASTRE;

/**
 * Si el visor puede cederle el gesto al carrusel. Con la foto entera y un solo
 * dedo sí: es el deslizamiento que cambia de foto. Acercada, o con dos dedos
 * encima, no: cederlo dejaría el pellizco a medias, que es justo lo que hacía
 * que acercar con la foto entera no hiciera nada.
 */
export const puedeCederElGesto = (dedos: number, escala: number): boolean =>
  dedos < 2 && escala <= ESCALA_MINIMA;

/**
 * Si el gesto que terminó fue un toque. Un pellizco acaba con el centroide
 * donde empezó, así que sin descontarlo pasaría por toque y dos pellizcos
 * seguidos dispararían el doble toque.
 */
export const fueToque = (huboPellizco: boolean, dx: number, dy: number): boolean =>
  !huboPellizco && Math.abs(dx) < UMBRAL_TOQUE && Math.abs(dy) < UMBRAL_TOQUE;
