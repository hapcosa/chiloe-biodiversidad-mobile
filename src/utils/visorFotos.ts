// Geometría del visor de fotos a pantalla completa.
//
// El visor muestra la foto con encaje "contain" (entera, sin recortar) y deja
// acercarla. Al acercarla la foto se sale de la pantalla, así que hay que
// acotar el arrastre: sin tope se puede empujar la foto fuera de la vista y
// quedar mirando el fondo negro.
//
// Todo lo que sigue es aritmética pura para poder probarla sin renderizar.

export const ESCALA_MINIMA = 1;
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
