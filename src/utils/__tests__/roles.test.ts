import {permiteProfesion} from '../roles';

describe('permiteProfesion', () => {
  it('la permite en los roles que la justifican', () => {
    for (const rol of ['moderator', 'admin', 'researcher'] as const) {
      expect(permiteProfesion(rol)).toBe(true);
    }
  });

  it('no la permite en una cuenta corriente', () => {
    expect(permiteProfesion('user')).toBe(false);
  });
});
