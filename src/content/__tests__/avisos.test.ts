import {requiereAvisoFauna} from '../avisos';

describe('requiereAvisoFauna', () => {
  it('solo pide el aviso en animalia', () => {
    expect(requiereAvisoFauna('animalia')).toBe(true);
    for (const reino of ['plantae', 'fungi', 'protista', 'monera'] as const) {
      expect(requiereAvisoFauna(reino)).toBe(false);
    }
  });
});
