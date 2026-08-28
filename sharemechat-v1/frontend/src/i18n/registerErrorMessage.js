import i18n from './index';

// Mapea errores del backend de registro a mensajes i18n.
// El backend expone un `code` estable en el ApiError (NICKNAME_TAKEN / EMAIL_TAKEN)
// para los conflictos de unicidad; el frontend lo traduce al idioma activo.
// Si el code no está mapeado, cae al `message` crudo del backend (compat) y,
// en último término, a un error de red genérico.
const BY_CODE = {
  NICKNAME_TAKEN: 'common.errors.nicknameTaken',
  EMAIL_TAKEN: 'common.errors.emailTaken',
  // Bloqueo por país en el registro: el backend devuelve el code uniforme
  // REGISTRATION_UNAVAILABLE (mismo para todos los bloqueos de país, anti-
  // enumeración a nivel API). En los formularios de registro lo mostramos claro;
  // login/auth NO usan este helper, así que allí sigue el mensaje discreto.
  REGISTRATION_UNAVAILABLE: 'common.errors.countryBlocked',
};

export function registerErrorMessage(err) {
  const code = err && err.data && err.data.code;
  if (code && BY_CODE[code]) return i18n.t(BY_CODE[code]);
  return (
    (err && err.data && err.data.message) ||
    (err && err.message) ||
    i18n.t('common.networkError')
  );
}

export default registerErrorMessage;
