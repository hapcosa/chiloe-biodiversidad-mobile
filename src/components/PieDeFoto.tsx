import React from 'react';
import {Linking, Text, type StyleProp, type TextStyle} from 'react-native';
import type {CreditoFoto} from '../types/domain';
import {enlaceSeguro, licenciaDe} from '../utils/creditos';

interface PieDeFotoProps {
  credito: CreditoFoto;
  style?: StyleProp<TextStyle>;
}

const abrir = (url: string | null) =>
  url
    ? () => {
        // Sin navegador que abra el enlace no hay nada útil que decir.
        Linking.openURL(url).catch(() => {});
      }
    : undefined;

/** Autor, licencia y origen de una foto; las dos últimas abren su enlace. */
export const PieDeFoto = ({credito, style}: PieDeFotoProps): React.JSX.Element => {
  const licencia = licenciaDe(credito.licencia);
  const origen = enlaceSeguro(credito.url_origen);

  return (
    <Text style={style}>
      Foto: {credito.autor || 'autor no indicado'} ·{' '}
      <Text
        accessibilityRole={licencia.url ? 'link' : undefined}
        onPress={abrir(licencia.url)}>
        {licencia.nombre}
      </Text>
      {origen ? (
        <>
          {' · '}
          <Text accessibilityRole="link" onPress={abrir(origen)}>
            {credito.fuente || 'Origen'}
          </Text>
        </>
      ) : null}
    </Text>
  );
};
