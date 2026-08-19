import {
  PASO_INICIAL,
  siguientePaso,
  type PasoCaptura,
} from '../flujoCaptura';
import type {Species} from '../../types/domain';

const ESPECIE = {id: 7, reino: 'plantae', nombre_comun: 'Canelo'} as unknown as Species;

const REVISION: PasoCaptura = {paso: 'revision', fotoPath: '/tmp/foto.jpg'};
const ESPECIE_PASO: PasoCaptura = {paso: 'especie', fotoPath: '/tmp/foto.jpg'};

describe('siguientePaso', () => {
  it('el disparo lleva del visor a la revisión con la foto recién sacada', () => {
    expect(siguientePaso(PASO_INICIAL, {tipo: 'capturada', fotoPath: '/tmp/foto.jpg'})).toEqual(
      REVISION,
    );
  });

  it('repetir y descartar vuelven al visor', () => {
    expect(siguientePaso(REVISION, {tipo: 'repetir'})).toEqual(PASO_INICIAL);
    expect(siguientePaso(REVISION, {tipo: 'descartar'})).toEqual(PASO_INICIAL);
  });

  it('crear encuentro pasa a elegir especie sin perder la foto', () => {
    expect(siguientePaso(REVISION, {tipo: 'crearEncuentro'})).toEqual(ESPECIE_PASO);
  });

  it('elegir una especie fija el reino desde la especie', () => {
    expect(siguientePaso(ESPECIE_PASO, {tipo: 'especieElegida', species: ESPECIE})).toEqual({
      paso: 'formulario',
      fotoPath: '/tmp/foto.jpg',
      species: ESPECIE,
      reino: 'plantae',
    });
  });

  it('sin especie el formulario igual recibe un reino: la columna no admite nulo', () => {
    expect(siguientePaso(ESPECIE_PASO, {tipo: 'sinEspecie', reino: 'fungi'})).toEqual({
      paso: 'formulario',
      fotoPath: '/tmp/foto.jpg',
      species: null,
      reino: 'fungi',
    });
  });

  it('volver atrás desde el formulario devuelve al selector, no al visor', () => {
    const formulario = siguientePaso(ESPECIE_PASO, {tipo: 'sinEspecie', reino: 'fungi'});
    expect(siguientePaso(formulario, {tipo: 'atras'})).toEqual(ESPECIE_PASO);
  });

  it('guardar cierra el flujo y deja la cámara lista para la próxima', () => {
    const formulario = siguientePaso(ESPECIE_PASO, {tipo: 'especieElegida', species: ESPECIE});
    expect(siguientePaso(formulario, {tipo: 'guardado'})).toEqual(PASO_INICIAL);
  });

  it('un evento que no corresponde al paso actual no mueve nada', () => {
    expect(siguientePaso(PASO_INICIAL, {tipo: 'crearEncuentro'})).toEqual(PASO_INICIAL);
    expect(siguientePaso(REVISION, {tipo: 'especieElegida', species: ESPECIE})).toEqual(REVISION);
  });
});
