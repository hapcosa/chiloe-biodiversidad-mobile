import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {colors, spacing} from '../styles/theme';

interface RangeSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  // Cómo mostrar el valor (ISO entero, exposición en ms, dioptrías…).
  format: (value: number) => string;
  // Escala logarítmica para rangos que abarcan órdenes de magnitud, como la
  // exposición (de ~0.1 ms a 500 ms): en lineal todo el recorrido útil queda
  // apelotonado en el primer milímetro.
  logarithmic?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Control deslizante mínimo hecho con PanResponder. No usamos
 * `@react-native-community/slider` para no sumar una dependencia nativa por un
 * control de tres líneas.
 */
export const RangeSlider = ({
  label,
  value,
  min,
  max,
  format,
  logarithmic = false,
  disabled = false,
  onChange,
}: RangeSliderProps): React.JSX.Element => {
  const [trackWidth, setTrackWidth] = useState(0);
  // El PanResponder se crea una vez, así que lee el ancho y el callback desde
  // refs en vez de capturarlos en el cierre.
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const {toRatio, fromRatio} = useMemo(() => {
    if (logarithmic && min > 0 && max > min) {
      const logMin = Math.log(min);
      const span = Math.log(max) - logMin;
      return {
        toRatio: (raw: number) => (Math.log(clamp(raw, min, max)) - logMin) / span,
        fromRatio: (ratio: number) => Math.exp(logMin + ratio * span),
      };
    }
    const span = max - min || 1;
    return {
      toRatio: (raw: number) => (clamp(raw, min, max) - min) / span,
      fromRatio: (ratio: number) => min + ratio * span,
    };
  }, [logarithmic, max, min]);

  const fromRatioRef = useRef(fromRatio);
  fromRatioRef.current = fromRatio;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: event => {
          if (widthRef.current > 0) {
            onChangeRef.current(
              fromRatioRef.current(
                clamp(event.nativeEvent.locationX / widthRef.current, 0, 1),
              ),
            );
          }
        },
        onPanResponderMove: event => {
          if (widthRef.current > 0) {
            onChangeRef.current(
              fromRatioRef.current(
                clamp(event.nativeEvent.locationX / widthRef.current, 0, 1),
              ),
            );
          }
        },
      }),
    [],
  );

  const onLayout = useCallback((event: LayoutChangeEvent): void => {
    const {width} = event.nativeEvent.layout;
    widthRef.current = width;
    setTrackWidth(width);
  }, []);

  const ratio = toRatio(value);

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{format(value)}</Text>
      </View>
      <View
        onLayout={onLayout}
        style={styles.track}
        {...(disabled ? {} : panResponder.panHandlers)}>
        <View style={[styles.fill, {width: ratio * trackWidth}]} />
        <View
          style={[styles.thumb, {left: clamp(ratio * trackWidth - 10, 0, trackWidth - 20)}]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  disabled: {
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.surface,
    fontWeight: '700',
  },
  value: {
    color: colors.surface,
    opacity: 0.8,
  },
  track: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
  },
  fill: {
    backgroundColor: colors.secondary,
    borderRadius: 10,
    height: 20,
    left: 0,
    position: 'absolute',
  },
  thumb: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    height: 20,
    position: 'absolute',
    width: 20,
  },
});
