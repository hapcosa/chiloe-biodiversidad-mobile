import type {Insignia, InsigniaOtorgada} from '../../types/insignia';
import {insigniaEmoji, insigniasPendientes} from '../insignias';

const catalogo = (
  codigo: string,
  tipo: Insignia['tipo'] = 'automatica',
): Insignia => ({
  id: 1,
  codigo,
  nombre: codigo,
  descripcion: '',
  criterio: 'criterio',
  tipo,
  metrica: tipo === 'automatica' ? 'encuentros' : null,
  umbral: tipo === 'automatica' ? 10 : null,
});

const ganada = (codigo: string): InsigniaOtorgada => ({
  ...catalogo(codigo),
  otorgada_en: '2026-08-27T12:00:00Z',
});

describe('insigniaEmoji', () => {
  it('usa el ícono del código conocido', () => {
    expect(insigniaEmoji('cinco-reinos')).toBe('🌈');
  });

  it('un código que esta versión no conoce cae en el genérico', () => {
    expect(insigniaEmoji('insignia-del-futuro')).toBe('🏅');
  });
});

describe('insigniasPendientes', () => {
  it('deja fuera las ya ganadas', () => {
    const pendientes = insigniasPendientes(
      [catalogo('observador'), catalogo('constante')],
      [ganada('observador')],
    );

    expect(pendientes.map(insignia => insignia.codigo)).toEqual(['constante']);
  });

  it('no lista las de rol: no hay nada que hacer para ganarlas', () => {
    const pendientes = insigniasPendientes(
      [catalogo('curador', 'rol'), catalogo('observador')],
      [],
    );

    expect(pendientes.map(insignia => insignia.codigo)).toEqual(['observador']);
  });

  it('conserva el orden del catálogo', () => {
    const pendientes = insigniasPendientes(
      [catalogo('primer-encuentro'), catalogo('observador'), catalogo('constante')],
      [],
    );

    expect(pendientes.map(insignia => insignia.codigo)).toEqual([
      'primer-encuentro',
      'observador',
      'constante',
    ]);
  });
});
