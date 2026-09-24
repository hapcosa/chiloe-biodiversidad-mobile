import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  ESCALA_MINIMA,
  clampArrastre,
  distanciaEntreDedos,
  escalaAlternada,
  escalaDePellizco,
  etiquetaPosicion,
  indiceDesdeOffset,
  limitesArrastre,
} from '../utils/visorFotos';

const MS_DOBLE_TOQUE = 280;

interface PaginaProps {
  uri: string;
  ancho: number;
  alto: number;
  activa: boolean;
  onZoom: (escala: number) => void;
}

// Una foto a pantalla completa, con pellizco para acercar y arrastre para
// recorrerla. Mientras está al mínimo no consume el gesto horizontal, así que
// el carrusel sigue paginando con normalidad.
const PaginaFoto = ({uri, ancho, alto, activa, onZoom}: PaginaProps) => {
  const escala = useRef(new Animated.Value(ESCALA_MINIMA)).current;
  const traslacion = useRef(new Animated.ValueXY({x: 0, y: 0})).current;

  // Espejo numérico de los Animated.Value: el gesto necesita leer el valor
  // actual y `Animated.Value` no lo expone de forma pública.
  const escalaRef = useRef(ESCALA_MINIMA);
  const traslacionRef = useRef({x: 0, y: 0});
  const escalaBase = useRef(ESCALA_MINIMA);
  const traslacionBase = useRef({x: 0, y: 0});
  const distanciaBase = useRef(0);
  const ultimoToque = useRef(0);

  const aplicar = useCallback(
    (nuevaEscala: number, x: number, y: number) => {
      const acotada = clampArrastre(x, y, limitesArrastre(nuevaEscala, ancho, alto));
      escalaRef.current = nuevaEscala;
      traslacionRef.current = acotada;
      escala.setValue(nuevaEscala);
      traslacion.setValue(acotada);
      onZoom(nuevaEscala);
    },
    [alto, ancho, escala, onZoom, traslacion],
  );

  const restablecer = useCallback(() => {
    aplicar(ESCALA_MINIMA, 0, 0);
  }, [aplicar]);

  // Al salir de pantalla la foto vuelve a su tamaño: si no, se regresa a ella
  // acercada y desplazada sin haberlo pedido.
  useEffect(() => {
    if (!activa) {
      restablecer();
    }
  }, [activa, restablecer]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_evt, gesto) =>
          escalaRef.current > ESCALA_MINIMA ||
          Math.abs(gesto.dx) > 2 ||
          Math.abs(gesto.dy) > 2,
        // Con la foto al mínimo el carrusel puede quitarnos el gesto y paginar;
        // acercada, no: el arrastre es para recorrer la foto.
        onPanResponderTerminationRequest: () => escalaRef.current <= ESCALA_MINIMA,
        onPanResponderGrant: () => {
          escalaBase.current = escalaRef.current;
          traslacionBase.current = traslacionRef.current;
          distanciaBase.current = 0;
        },
        onPanResponderMove: (evt, gesto) => {
          const dedos = evt.nativeEvent.touches;
          if (dedos.length >= 2) {
            const distancia = distanciaEntreDedos(dedos);
            if (distanciaBase.current === 0) {
              distanciaBase.current = distancia;
              escalaBase.current = escalaRef.current;
              return;
            }
            const nueva = escalaDePellizco(
              escalaBase.current,
              distanciaBase.current,
              distancia,
            );
            aplicar(nueva, traslacionRef.current.x, traslacionRef.current.y);
            return;
          }
          if (escalaRef.current <= ESCALA_MINIMA) {
            return;
          }
          aplicar(
            escalaRef.current,
            traslacionBase.current.x + gesto.dx,
            traslacionBase.current.y + gesto.dy,
          );
        },
        onPanResponderRelease: (_evt, gesto) => {
          distanciaBase.current = 0;
          const fueToque = Math.abs(gesto.dx) < 6 && Math.abs(gesto.dy) < 6;
          if (!fueToque) {
            return;
          }
          const ahora = Date.now();
          if (ahora - ultimoToque.current < MS_DOBLE_TOQUE) {
            ultimoToque.current = 0;
            aplicar(escalaAlternada(escalaRef.current), 0, 0);
            return;
          }
          ultimoToque.current = ahora;
        },
      }),
    [aplicar],
  );

  return (
    <View style={{width: ancho, height: alto}} {...responder.panHandlers}>
      <Animated.Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={{uri}}
        style={[
          {width: ancho, height: alto},
          {
            transform: [
              {translateX: traslacion.x},
              {translateY: traslacion.y},
              {scale: escala},
            ],
          },
        ]}
      />
    </View>
  );
};

export interface VisorFotosProps {
  urls: string[];
  indiceInicial?: number;
  visible: boolean;
  onClose: () => void;
}

/**
 * Carrusel de fotos a pantalla completa. Se abre sobre la pantalla que lo usa,
 * muestra la foto entera —no recortada como en la ficha— y deja pasar de una a
 * otra deslizando.
 */
export const VisorFotos = ({urls, indiceInicial = 0, visible, onClose}: VisorFotosProps) => {
  const {width, height} = useWindowDimensions();
  const [indice, setIndice] = useState(indiceInicial);
  const [acercada, setAcercada] = useState(false);

  useEffect(() => {
    if (visible) {
      setIndice(indiceInicial);
      setAcercada(false);
    }
  }, [indiceInicial, visible]);

  const onScrollEnd = useCallback(
    (evento: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndice(indiceDesdeOffset(evento.nativeEvent.contentOffset.x, width, urls.length));
    },
    [urls.length, width],
  );

  const onZoom = useCallback((escala: number) => {
    setAcercada(escala > ESCALA_MINIMA);
  }, []);

  const contador = etiquetaPosicion(indice, urls.length);

  if (urls.length === 0) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      visible={visible}
      transparent={false}>
      <View style={styles.fondo}>
        <FlatList
          data={urls}
          getItemLayout={(_datos, i) => ({length: width, offset: width * i, index: i})}
          horizontal
          initialScrollIndex={indiceInicial}
          keyExtractor={url => url}
          onMomentumScrollEnd={onScrollEnd}
          pagingEnabled
          // Con la foto acercada el arrastre la recorre en vez de cambiarla.
          scrollEnabled={!acercada}
          showsHorizontalScrollIndicator={false}
          renderItem={({item, index}) => (
            <PaginaFoto
              activa={index === indice}
              alto={height}
              ancho={width}
              onZoom={index === indice ? onZoom : () => {}}
              uri={item}
            />
          )}
        />

        <View style={styles.barra} pointerEvents="box-none">
          {contador ? <Text style={styles.contador}>{contador}</Text> : <View />}
          <Pressable
            accessibilityLabel="Cerrar la foto"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onClose}
            style={styles.cerrar}>
            <Text style={styles.cerrarTexto}>✕</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fondo: {
    backgroundColor: '#000000',
    flex: 1,
  },
  barra: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    right: 0,
    top: 24,
  },
  contador: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: '#000000',
    textShadowRadius: 4,
  },
  cerrar: {
    alignItems: 'center',
    backgroundColor: '#00000088',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  cerrarTexto: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
