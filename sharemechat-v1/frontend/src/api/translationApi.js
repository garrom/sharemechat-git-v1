import { apiFetch } from '../config/http';

// pending-hardening §5.3 (2026-08-08): API helpers para traduccion
// automatica de chat P2P. Backend endpoints en MessagesController:
//   GET  /api/messages/translation-config -> {provider, enabled, langs[]}
//   POST /api/messages/translate-batch     -> [{messageId, translatedText, ...}]

export async function getTranslationConfig() {
  return apiFetch('/messages/translation-config', { method: 'GET' });
}

export async function translateBatch(ids, lang) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return apiFetch('/messages/translate-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, lang }),
  });
}

// Fase 2 i18n (2026-08-21): edita los idiomas que habla el usuario
// (user_languages). `languages` = [{ langCode, primary, level? }], con
// exactamente uno primary=true (destino de traducción de chat + idioma del
// perfil). Sustituye a updatePreferredChatLang.
export async function updateMyLanguages(languages) {
  return apiFetch('/users/me/languages', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Array.isArray(languages) ? languages : []),
  });
}
