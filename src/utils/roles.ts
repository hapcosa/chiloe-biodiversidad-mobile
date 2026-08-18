import type {UserRole} from '../types/domain';

/**
 * La profesión respalda a quien modera o investiga; en una cuenta corriente
 * sería un dato personal publicado sin motivo. El servidor aplica el mismo
 * criterio al responder (`ToPerfilPublico` en auth-service): esto solo evita
 * ofrecer un campo que nadie llegaría a ver.
 */
export const permiteProfesion = (role: UserRole): boolean =>
  role === 'moderator' || role === 'admin' || role === 'researcher';
