import {formatFechaCorta, parseTimestamp} from '../fechas';

describe('parseTimestamp', () => {
  it('acepta el formato nativo de Postgres que devuelve la API', () => {
    const fecha = parseTimestamp('2026-08-04 18:55:08.259598+00');

    expect(fecha?.toISOString()).toBe('2026-08-04T18:55:08.259Z');
  });

  it('respeta el offset con minutos', () => {
    const fecha = parseTimestamp('2026-08-04 14:55:08.259598-04:00');

    expect(fecha?.toISOString()).toBe('2026-08-04T18:55:08.259Z');
  });

  it('acepta timestamps sin fracción de segundo', () => {
    const fecha = parseTimestamp('2026-08-04 18:55:08+00');

    expect(fecha?.toISOString()).toBe('2026-08-04T18:55:08.000Z');
  });

  it('sigue aceptando ISO 8601', () => {
    const fecha = parseTimestamp('2026-08-04T18:55:08.259Z');

    expect(fecha?.toISOString()).toBe('2026-08-04T18:55:08.259Z');
  });

  it('devuelve null ante valores ausentes o ilegibles', () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp('ayer por la tarde')).toBeNull();
  });
});

describe('formatFechaCorta', () => {
  it('devuelve cadena vacía en vez de "Invalid Date"', () => {
    expect(formatFechaCorta('ayer por la tarde')).toBe('');
    expect(formatFechaCorta(null)).toBe('');
  });

  it('formatea la fecha legible', () => {
    expect(formatFechaCorta('2026-08-04 18:55:08.259598+00')).not.toBe('');
  });
});
