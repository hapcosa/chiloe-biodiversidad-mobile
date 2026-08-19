import React, {useCallback, useState} from 'react';
import {CameraScreen} from './CameraScreen';
import {MiEncuentroFormScreen} from './MiEncuentroFormScreen';
import {RevisionCapturaScreen} from './RevisionCapturaScreen';
import {SeleccionEspecieScreen} from './SeleccionEspecieScreen';
import {
  PASO_INICIAL,
  siguientePaso,
  type EventoCaptura,
  type PasoCaptura,
} from '../utils/flujoCaptura';

// Camino completo de la pestaña "Capturar": visor → revisión → especie →
// formulario. Se resuelve con estado local y no con un stack de navegación
// porque el visor tiene que desmontarse al salir de la pestaña (si no, deja la
// cámara tomada) y un stack lo mantendría vivo por debajo.
export const CapturaFlowScreen = (): React.JSX.Element => {
  const [paso, setPaso] = useState<PasoCaptura>(PASO_INICIAL);

  const despachar = useCallback((evento: EventoCaptura) => {
    setPaso(actual => siguientePaso(actual, evento));
  }, []);

  switch (paso.paso) {
    case 'visor':
      return (
        <CameraScreen
          hint="Saca la foto y decide qué hacer con ella"
          onCapture={capture => despachar({tipo: 'capturada', fotoPath: capture.filePath})}
        />
      );

    case 'revision':
      return (
        <RevisionCapturaScreen
          fotoPath={paso.fotoPath}
          onCrearEncuentro={() => despachar({tipo: 'crearEncuentro'})}
          onDescartar={() => despachar({tipo: 'descartar'})}
          onRepetir={() => despachar({tipo: 'repetir'})}
        />
      );

    case 'especie':
      return (
        <SeleccionEspecieScreen
          onBack={() => despachar({tipo: 'atras'})}
          onSelect={species => despachar({tipo: 'especieElegida', species})}
          onSinEspecie={reino => despachar({tipo: 'sinEspecie', reino})}
        />
      );

    case 'formulario':
      return (
        <MiEncuentroFormScreen
          fotoInicial={paso.fotoPath}
          onBack={() => despachar({tipo: 'atras'})}
          onSaved={() => despachar({tipo: 'guardado'})}
          reino={paso.reino}
          species={paso.species}
        />
      );
  }
};
