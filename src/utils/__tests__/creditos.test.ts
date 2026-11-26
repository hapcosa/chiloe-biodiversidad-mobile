import {creditoDeUrl, enlaceSeguro, licenciaDe} from '../creditos';

const creditos = {
  'especies/2026/11/05/abc-pudu.jpg': {autor: 'Ana', licencia: 'cc-by'},
};

describe('creditoDeUrl', () => {
  it('encuentra el crédito por la key con que termina la URL', () => {
    expect(
      creditoDeUrl(
        'https://storage.example/especies-fotos/especies/2026/11/05/abc-pudu.jpg',
        creditos,
      )?.autor,
    ).toBe('Ana');
  });

  it('no atribuye nada a una foto sin entrada', () => {
    expect(
      creditoDeUrl('https://storage.example/especies-fotos/otra.jpg', creditos),
    ).toBeUndefined();
    expect(creditoDeUrl('https://storage.example/x.jpg', undefined)).toBeUndefined();
  });
});

describe('licenciaDe', () => {
  it('nombra y enlaza las licencias aceptadas', () => {
    expect(licenciaDe('cc-by-sa')).toEqual({
      nombre: 'CC BY-SA 4.0',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    });
  });

  it('no inventa un enlace para una licencia desconocida', () => {
    expect(licenciaDe('otra')).toEqual({nombre: 'otra', url: null});
  });
});

describe('enlaceSeguro', () => {
  it('solo deja pasar https', () => {
    expect(enlaceSeguro('https://www.inaturalist.org/photos/1')).not.toBeNull();
    expect(enlaceSeguro('intent://algo')).toBeNull();
    expect(enlaceSeguro(undefined)).toBeNull();
  });
});
