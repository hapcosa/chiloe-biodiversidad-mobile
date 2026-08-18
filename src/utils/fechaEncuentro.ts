// Fecha de un encuentro que puede ser un recuerdo de hace años (Fase 9, PR 7).
//
// La app no trae selector de fecha nativo y no se añade una dependencia solo
// para esto: el usuario escribe día, mes y año. Toda la lógica vive aquí,
// separada de la pantalla, porque es lo único que puede fallar de verdad.

export const ANIO_MINIMO = 1900;

export interface PartesFecha {
  dia: string;
  mes: string;
  anio: string;
}

export type ResultadoFecha = {ok: true; iso: string} | {ok: false; error: string};

const dosDigitos = (valor: number): string => String(valor).padStart(2, '0');

export const partesDeFecha = (fecha: Date): PartesFecha => ({
  dia: dosDigitos(fecha.getDate()),
  mes: dosDigitos(fecha.getMonth() + 1),
  anio: String(fecha.getFullYear()),
});

const mismoDia = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Convierte lo que se escribió en un `observado_en` que la API acepta.
 *
 * Si el día es hoy se usa la hora actual; si es anterior, las 12:00 locales.
 * El mediodía no es arbitrario: con 00:00 la conversión a UTC saltaría al día
 * anterior desde Chiloé (UTC−3/−4) y el encuentro quedaría fechado un día
 * antes del que la persona eligió.
 */
export const construirObservadoEn = (
  partes: PartesFecha,
  ahora: Date,
): ResultadoFecha => {
  const dia = Number(partes.dia);
  const mes = Number(partes.mes);
  const anio = Number(partes.anio);

  if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(anio)) {
    return {ok: false, error: 'La fecha debe ser números'};
  }
  if (anio < ANIO_MINIMO || anio > ahora.getFullYear()) {
    return {ok: false, error: `El año debe estar entre ${ANIO_MINIMO} y ${ahora.getFullYear()}`};
  }
  if (mes < 1 || mes > 12) {
    return {ok: false, error: 'El mes debe estar entre 1 y 12'};
  }

  const fecha = new Date(anio, mes - 1, dia, 12, 0, 0, 0);
  // Date normaliza en silencio: un 31 de febrero se convierte en marzo. Si el
  // día no sobrevivió el viaje, es que no existía.
  if (fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return {ok: false, error: 'Ese día no existe en ese mes'};
  }

  if (mismoDia(fecha, ahora)) {
    return {ok: true, iso: ahora.toISOString()};
  }
  if (fecha.getTime() > ahora.getTime()) {
    return {ok: false, error: 'No se puede registrar un encuentro futuro'};
  }

  return {ok: true, iso: fecha.toISOString()};
};

export const esHoy = (partes: PartesFecha, ahora: Date): boolean => {
  const hoy = partesDeFecha(ahora);
  return (
    Number(partes.dia) === Number(hoy.dia) &&
    Number(partes.mes) === Number(hoy.mes) &&
    Number(partes.anio) === Number(hoy.anio)
  );
};
