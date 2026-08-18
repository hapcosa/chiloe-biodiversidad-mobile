import {
  ANIO_MINIMO,
  construirObservadoEn,
  esHoy,
  partesDeFecha,
} from '../fechaEncuentro';

// Mediodía local del 18 de agosto de 2026, para que el test no dependa de la
// zona horaria de quien lo corre.
const ahora = new Date(2026, 7, 18, 15, 30, 0);

describe('construirObservadoEn', () => {
  it('usa la hora actual cuando la fecha es hoy', () => {
    const resultado = construirObservadoEn({dia: '18', mes: '08', anio: '2026'}, ahora);

    expect(resultado).toEqual({ok: true, iso: ahora.toISOString()});
  });

  it('fecha un recuerdo al mediodía local, no a medianoche', () => {
    // A medianoche, convertir a UTC desde Chiloé (UTC−3/−4) devolvería el día
    // anterior y el encuentro quedaría mal fechado.
    const resultado = construirObservadoEn({dia: '14', mes: '03', anio: '2019'}, ahora);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(new Date(resultado.iso).getFullYear()).toBe(2019);
      expect(new Date(resultado.iso).getMonth()).toBe(2);
      expect(new Date(resultado.iso).getDate()).toBe(14);
    }
  });

  it('rechaza el futuro', () => {
    const resultado = construirObservadoEn({dia: '19', mes: '08', anio: '2026'}, ahora);

    expect(resultado).toEqual({
      ok: false,
      error: 'No se puede registrar un encuentro futuro',
    });
  });

  it('rechaza un día que no existe en ese mes', () => {
    const resultado = construirObservadoEn({dia: '31', mes: '02', anio: '2019'}, ahora);

    expect(resultado).toEqual({ok: false, error: 'Ese día no existe en ese mes'});
  });

  it('acepta el 29 de febrero de un año bisiesto', () => {
    expect(construirObservadoEn({dia: '29', mes: '02', anio: '2020'}, ahora).ok).toBe(true);
    expect(construirObservadoEn({dia: '29', mes: '02', anio: '2019'}, ahora).ok).toBe(false);
  });

  it('rechaza años fuera del rango', () => {
    expect(construirObservadoEn({dia: '01', mes: '01', anio: String(ANIO_MINIMO - 1)}, ahora).ok).toBe(
      false,
    );
    expect(construirObservadoEn({dia: '01', mes: '01', anio: '2030'}, ahora).ok).toBe(false);
  });

  it('rechaza lo que no son números', () => {
    expect(construirObservadoEn({dia: 'ayer', mes: '08', anio: '2026'}, ahora).ok).toBe(false);
    expect(construirObservadoEn({dia: '', mes: '', anio: ''}, ahora).ok).toBe(false);
  });

  it('rechaza un mes fuera de rango', () => {
    expect(construirObservadoEn({dia: '01', mes: '13', anio: '2026'}, ahora).ok).toBe(false);
  });
});

describe('partesDeFecha y esHoy', () => {
  it('rellena a dos dígitos', () => {
    expect(partesDeFecha(new Date(2026, 0, 5))).toEqual({
      dia: '05',
      mes: '01',
      anio: '2026',
    });
  });

  it('compara por valor y no por texto, para tolerar el 8 sin cero delante', () => {
    expect(esHoy({dia: '18', mes: '8', anio: '2026'}, ahora)).toBe(true);
    expect(esHoy({dia: '17', mes: '08', anio: '2026'}, ahora)).toBe(false);
  });
});
