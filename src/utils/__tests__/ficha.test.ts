import {construirFicha} from '../ficha';
import type {JsonValue, Reino, Species} from '../../types/domain';

const especie = (
  reino: Reino,
  atributos: {[key: string]: JsonValue},
): Species => ({
  id: 1,
  reino,
  genero_id: 1,
  nombre_cientifico: 'Ejemplo ejemplo',
  nombre_comun: 'Ejemplo',
  descripcion: '',
  habitat: '',
  distribucion_chiloe: '',
  endemica: false,
  estado_conservacion: '',
  fuentes: [],
  atributos_especificos: atributos,
  fotos_keys: [],
  imagenes_urls: [],
});

describe('construirFicha', () => {
  it('agrupa los atributos de animalia y resuelve las rutas anidadas', () => {
    const ficha = construirFicha(
      especie('animalia', {
        clase: 'Aves',
        alimentacion: 'nectarivoro',
        dieta_detalle: 'Néctar de flores tubulares.',
        comportamiento: {actividad: 'diurno', social: 'solitario', migratorio: true},
        tamano_promedio_cm: 10,
        peso_promedio_g: 6,
        reproduccion: 'oviparo',
      }),
    );

    expect(ficha.map(s => s.titulo)).toEqual([
      'Alimentación',
      'Comportamiento',
      'Morfología',
      'Reproducción',
    ]);
    expect(ficha[0]?.items).toEqual([
      {label: 'Tipo de dieta', value: 'Nectarívoro'},
      {label: 'Qué come', value: 'Néctar de flores tubulares.'},
    ]);
    expect(ficha[1]?.items).toEqual([
      {label: 'Actividad', value: 'Diurno'},
      {label: 'Vida social', value: 'Solitario'},
      {label: 'Migratorio', value: 'Sí'},
    ]);
    expect(ficha[2]?.items).toContainEqual({label: 'Peso promedio', value: '6 g'});
  });

  it('destaca la comestibilidad en fungi', () => {
    const ficha = construirFicha(
      especie('fungi', {
        comestibilidad: 'mortal',
        advertencia: 'Nunca consumir.',
        sustrato: ['suelo', 'hojarasca'],
        temporada: ['otono'],
      }),
    );

    const comestibilidad = ficha.find(s => s.titulo === 'Comestibilidad');
    expect(comestibilidad?.destacada).toBe(true);
    expect(comestibilidad?.items[0]).toEqual({
      label: 'Comestibilidad',
      value: 'Mortal',
    });
    expect(ficha.find(s => s.titulo === 'Dónde y cuándo')?.items).toEqual([
      {label: 'Sustrato', value: 'Suelo, Hojarasca'},
      {label: 'Temporada', value: 'Otoño'},
    ]);
  });

  it('traduce los meses de floración de plantae', () => {
    const ficha = construirFicha(
      especie('plantae', {
        tipo_planta: 'arbol',
        altura_promedio_m: 40,
        floracion_meses: [11, 12, 1],
        tipo_hoja: {ciclo: 'perenne', morfologia: 'simple'},
      }),
    );

    expect(ficha.find(s => s.titulo === 'Floración y fruto')?.items).toEqual([
      {label: 'Meses de floración', value: 'Noviembre, Diciembre, Enero'},
    ]);
    expect(ficha[0]?.items).toEqual([
      {label: 'Tipo de planta', value: 'Árbol'},
      {label: 'Altura promedio', value: '40 m'},
      {label: 'Follaje', value: 'Perenne'},
      {label: 'Hoja', value: 'Simple'},
    ]);
  });

  it('omite secciones vacías y no muestra las claves ocultas', () => {
    const ficha = construirFicha(
      especie('animalia', {clase: 'Mammalia', sonido_key: 'audio/x.mp3'}),
    );

    expect(ficha).toHaveLength(1);
    expect(ficha[0]?.titulo).toBe('Morfología');
    expect(JSON.stringify(ficha)).not.toContain('audio/x.mp3');
  });

  it('recoge en "Otros datos" las claves que la app todavía no conoce', () => {
    const ficha = construirFicha(
      especie('monera', {dominio: 'bacteria', patogenicidad: 'oportunista'}),
    );

    expect(ficha.find(s => s.titulo === 'Otros datos')?.items).toEqual([
      {label: 'Patogenicidad', value: 'Oportunista'},
    ]);
  });

  it('devuelve una ficha vacía si no hay atributos', () => {
    expect(construirFicha(especie('protista', {}))).toEqual([]);
  });
});
