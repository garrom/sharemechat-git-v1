// Avatar por defecto unificado (2026-08-28). Sustituye a los PNG con género
// (avatarChica/avatarChico) y a las iniciales (LetterAvatar/NoPhoto) por una
// silueta neutra en trazo (estilo "línea"), diferenciada solo por ROL:
//   - CLIENT  → azul→cian     (/img/avatar-client.svg)
//   - MODEL   → coral→violeta (/img/avatar-model.svg)   [identidad de marca]
//   - MASTER  → dorado        (/img/avatar-master.svg)
// Neutro de género a propósito (antes chica=modelo / chico=cliente asumía sexo).

export const AVATAR_CLIENT = '/img/avatar-client.svg';
export const AVATAR_MODEL = '/img/avatar-model.svg';
export const AVATAR_MASTER = '/img/avatar-master.svg';

// Devuelve la ruta del avatar por defecto según el rol. Acepta 'CLIENT',
// 'USER', 'MODEL', 'MASTER' (case-insensitive). Fallback: cliente.
export function defaultAvatarFor(role) {
  const r = String(role || '').toUpperCase();
  if (r === 'MODEL') return AVATAR_MODEL;
  if (r === 'MASTER') return AVATAR_MASTER;
  return AVATAR_CLIENT;
}

export default defaultAvatarFor;
