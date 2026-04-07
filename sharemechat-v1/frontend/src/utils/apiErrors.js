export const EMAIL_NOT_VERIFIED_CODE = 'EMAIL_NOT_VERIFIED';

export const isEmailNotVerifiedError = (err) =>
  String(err?.code || err?.data?.code || '').toUpperCase() === EMAIL_NOT_VERIFIED_CODE;

export const getApiErrorMessage = (err, fallback = 'Ha ocurrido un error.') =>
  err?.data?.message || err?.message || fallback;
