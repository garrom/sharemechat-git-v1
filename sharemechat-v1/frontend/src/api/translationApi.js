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

export async function updatePreferredChatLang(preferredChatLang) {
  return apiFetch('/users/me/preferred-chat-lang', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferredChatLang: preferredChatLang || null }),
  });
}
