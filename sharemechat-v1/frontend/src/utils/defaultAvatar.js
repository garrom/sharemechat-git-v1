// Avatar por defecto unificado. Sustituye a los PNG con género (avatarChica/
// avatarChico) y a las iniciales (LetterAvatar/NoPhoto).
// 2026-08-30 (decisión operador): UN ÚNICO diseño para todos los roles —
// fondo negro + silueta blanca en trazo. El aro rojo de marca lo aporta el
// navbar (box-shadow de StyledNavAvatar), no el propio SVG. Los 3 ficheros
// avatar-{client,model,master}.svg son idénticos hoy; se mantienen separados
// por si en el futuro se quiere volver a diferenciar por rol sin re-cablear.
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
