// Traduce un toque sobre la vista de preview a coordenadas de la imagen del
// sensor, para el toque-para-enfocar.
//
// La vista dibuja el buffer con recorte centrado ("cover"): lo agranda hasta
// tapar la vista y lo que sobra queda fuera de pantalla. Hay que deshacer ese
// recorte y la rotación de pantalla, porque el lado nativo espera el punto en
// la orientación natural del dispositivo (solo compensa `sensorOrientation`).
//
// Es el espejo exacto de `ChiloeCameraPreviewView.applyPreviewTransform`.

export interface PreviewLayout {
  // Tamaño del buffer de preview tal como lo entrega la cámara (apaisado en
  // casi todos los teléfonos).
  bufferWidth: number;
  bufferHeight: number;
  // Grados que hay que girar la salida del sensor para verla derecha con el
  // dispositivo en su orientación natural.
  sensorOrientation: number;
  // Grados que está girada la pantalla respecto de su orientación natural.
  displayRotation: number;
  viewWidth: number;
  viewHeight: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const isQuarterTurn = (degrees: number): boolean => degrees === 90 || degrees === 270;

/**
 * Devuelve el punto normalizado 0..1 en la imagen del sensor (ya girada por
 * `sensorOrientation`, sin la rotación de pantalla), o null si la geometría
 * todavía no es utilizable.
 */
export const viewPointToImagePoint = (
  layout: PreviewLayout,
  touchX: number,
  touchY: number,
): {x: number; y: number} | null => {
  const {bufferWidth, bufferHeight, viewWidth, viewHeight} = layout;
  if (bufferWidth <= 0 || bufferHeight <= 0 || viewWidth <= 0 || viewHeight <= 0) {
    return null;
  }

  const sensorTurn = isQuarterTurn(normalizeDegrees(layout.sensorOrientation));
  const baseWidth = sensorTurn ? bufferHeight : bufferWidth;
  const baseHeight = sensorTurn ? bufferWidth : bufferHeight;

  // La vista compensa cuánto está girada la pantalla, en sentido contrario.
  const rotation = normalizeDegrees(360 - normalizeDegrees(layout.displayRotation));
  const screenTurn = isQuarterTurn(rotation);
  const shownWidth = screenTurn ? baseHeight : baseWidth;
  const shownHeight = screenTurn ? baseWidth : baseHeight;

  // Recorte centrado: se agranda hasta cubrir la vista sin deformar.
  const scale = Math.max(viewWidth / shownWidth, viewHeight / shownHeight);
  const renderedWidth = shownWidth * scale;
  const renderedHeight = shownHeight * scale;

  const u = clamp01((touchX - (viewWidth - renderedWidth) / 2) / renderedWidth);
  const v = clamp01((touchY - (viewHeight - renderedHeight) / 2) / renderedHeight);

  return undoRotation(u, v, rotation);
};

const normalizeDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;

// Deshace el giro horario que la vista aplicó para compensar la pantalla.
const undoRotation = (u: number, v: number, rotation: number): {x: number; y: number} => {
  switch (rotation) {
    case 90:
      return {x: v, y: 1 - u};
    case 180:
      return {x: 1 - u, y: 1 - v};
    case 270:
      return {x: 1 - v, y: u};
    default:
      return {x: u, y: v};
  }
};
