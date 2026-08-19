import type {Reino, Species} from '../types/domain';

// El camino desde el disparo hasta el encuentro guardado. Vive fuera de la
// pantalla porque es la parte con reglas —qué se puede hacer desde dónde— y
// así se prueba sin montar la cámara.
export type PasoCaptura =
  | {paso: 'visor'}
  | {paso: 'revision'; fotoPath: string}
  | {paso: 'especie'; fotoPath: string}
  | {paso: 'formulario'; fotoPath: string; species: Species | null; reino: Reino};

export type EventoCaptura =
  | {tipo: 'capturada'; fotoPath: string}
  | {tipo: 'repetir'}
  | {tipo: 'descartar'}
  | {tipo: 'crearEncuentro'}
  | {tipo: 'especieElegida'; species: Species}
  // Sin especie el reino igual hace falta: la columna es NOT NULL y el mapa
  // filtra por ella. Quien registra sabe si vio un animal o una planta aunque
  // no sepa cuál.
  | {tipo: 'sinEspecie'; reino: Reino}
  | {tipo: 'atras'}
  | {tipo: 'guardado'};

export const PASO_INICIAL: PasoCaptura = {paso: 'visor'};

export const siguientePaso = (actual: PasoCaptura, evento: EventoCaptura): PasoCaptura => {
  switch (actual.paso) {
    case 'visor':
      return evento.tipo === 'capturada'
        ? {paso: 'revision', fotoPath: evento.fotoPath}
        : actual;

    case 'revision':
      if (evento.tipo === 'crearEncuentro') {
        return {paso: 'especie', fotoPath: actual.fotoPath};
      }
      // Repetir y descartar terminan igual: se vuelve al visor y la foto de
      // esta pasada deja de estar en juego.
      if (evento.tipo === 'repetir' || evento.tipo === 'descartar' || evento.tipo === 'atras') {
        return PASO_INICIAL;
      }
      return actual;

    case 'especie':
      if (evento.tipo === 'especieElegida') {
        return {
          paso: 'formulario',
          fotoPath: actual.fotoPath,
          species: evento.species,
          reino: evento.species.reino,
        };
      }
      if (evento.tipo === 'sinEspecie') {
        return {
          paso: 'formulario',
          fotoPath: actual.fotoPath,
          species: null,
          reino: evento.reino,
        };
      }
      if (evento.tipo === 'atras') {
        return {paso: 'revision', fotoPath: actual.fotoPath};
      }
      return actual;

    case 'formulario':
      if (evento.tipo === 'atras') {
        return {paso: 'especie', fotoPath: actual.fotoPath};
      }
      if (evento.tipo === 'guardado') {
        return PASO_INICIAL;
      }
      return actual;
  }
};
