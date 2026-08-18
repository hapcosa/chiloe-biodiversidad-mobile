import {viewPointToImagePoint} from '../previewGeometry';

// Caso típico: A53 en vertical, buffer 1440x1080 (apaisado), sensor a 90º,
// pantalla sin girar, vista 1080x1560.
const vertical = {
  bufferWidth: 1440,
  bufferHeight: 1080,
  sensorOrientation: 90,
  displayRotation: 0,
  viewWidth: 1080,
  viewHeight: 1560,
};

describe('viewPointToImagePoint', () => {
  it('devuelve el centro para un toque en el centro de la vista', () => {
    const punto = viewPointToImagePoint(vertical, 540, 780);
    expect(punto).not.toBeNull();
    expect(punto?.x).toBeCloseTo(0.5, 5);
    expect(punto?.y).toBeCloseTo(0.5, 5);
  });

  it('deshace el recorte del eje que sobra', () => {
    // El contenido mostrado es 1080x1440 y la vista 1080x1560: para cubrirla se
    // escala 1.0833 y queda 1170 de ancho, así que se pierde contenido a los
    // lados. El borde izquierdo de la vista NO es el borde de la imagen.
    const izquierda = viewPointToImagePoint(vertical, 0, 780);
    expect(izquierda?.x).toBeCloseTo(45 / 1170, 5);
    expect(izquierda?.x).toBeGreaterThan(0);
    // El eje que sí calza llega justo al borde.
    const arriba = viewPointToImagePoint(vertical, 540, 0);
    expect(arriba?.y).toBeCloseTo(0, 5);
  });

  it('recorta a 0..1 los toques fuera del contenido', () => {
    const fuera = viewPointToImagePoint(vertical, -500, -500);
    expect(fuera?.x).toBe(0);
    expect(fuera?.y).toBe(0);
  });

  it('deshace la rotación de pantalla', () => {
    // Con la pantalla a 90º la vista gira el contenido 270º; un toque en el
    // centro sigue siendo el centro, pero el eje X pasa a ser el Y.
    const apaisado = {
      ...vertical,
      displayRotation: 90,
      viewWidth: 1560,
      viewHeight: 1080,
    };
    const centro = viewPointToImagePoint(apaisado, 780, 540);
    expect(centro?.x).toBeCloseTo(0.5, 5);
    expect(centro?.y).toBeCloseTo(0.5, 5);

    const derecha = viewPointToImagePoint(apaisado, 1560, 540);
    const izquierda = viewPointToImagePoint(apaisado, 0, 540);
    // Al girar, el eje horizontal de la pantalla mapea al vertical de la imagen.
    expect(derecha?.x).toBeCloseTo(0.5, 5);
    expect(izquierda?.x).toBeCloseTo(0.5, 5);
    expect(derecha?.y).not.toBeCloseTo(izquierda?.y ?? 0, 2);
  });

  it('devuelve null si el buffer todavía no se conoce', () => {
    expect(viewPointToImagePoint({...vertical, bufferWidth: 0}, 10, 10)).toBeNull();
    expect(viewPointToImagePoint({...vertical, viewHeight: 0}, 10, 10)).toBeNull();
  });
});
