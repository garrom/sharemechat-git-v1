import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../i18n';
import { getTranslationConfig, updateMyLanguages } from '../api/translationApi';
import { useSession } from './SessionProvider';
import {
  ProfileCard,
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardBody,
  Hint,
} from '../styles/subpages/PerfilClientModelStyle';

/**
 * Fase 2 i18n (2026-08-21): card "Tu idioma" (Nivel B). Reemplaza a
 * PreferredChatLangCard. UN SOLO idioma por usuario: el que habla con fluidez.
 * Es el destino de traducción de chat + el idioma principal del perfil público.
 *
 * Decisión del operador (2026-08-21): single-select (no multi). Con un solo
 * idioma dominante, TODOS los mensajes recibidos se traducen a él, sin la
 * ambigüedad del multi (p. ej. "hablo algo de francés" -> no se traduciría).
 *
 * Distinto del idioma de INTERFAZ (navbar, 5 idiomas): aquí caben los 15 + mg,
 * así que una modelo malgache puede tener el chat en malgache aunque vea la
 * página en inglés.
 *
 * Backend: PUT /api/users/me/languages con una lista de UN elemento
 * [{ langCode, primary: true }]. Lista de idiomas de /messages/translation-config.
 */
const LANG_LABELS = {
  es: 'Español', en: 'English', pt: 'Português', fr: 'Français', it: 'Italiano',
  de: 'Deutsch', nl: 'Nederlands', pl: 'Polski', ru: 'Русский', ja: '日本語',
  zh: '中文', ko: '한국어', ar: 'العربية', tr: 'Türkçe', ro: 'Română', mg: 'Malagasy',
};

export default function MyLanguagesCard() {
  const t = (key, options) => i18n.t(key, options);
  const { user, refresh } = useSession();

  const [supported, setSupported] = useState([]);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Valor inicial: el idioma primario del usuario; si no, su uiLocale.
  useEffect(() => {
    const langs = Array.isArray(user?.languages) ? user.languages : [];
    const prim = langs.find((l) => l.primary) || langs[0];
    setValue(prim ? prim.langCode : ((user && (user.uiLocale || user.ui_locale)) || ''));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    getTranslationConfig()
      .then((data) => {
        if (cancelled) return;
        setSupported(Array.isArray(data?.langs) ? data.langs : []);
      })
      .catch(() => { if (!cancelled) setSupported([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const onChange = useCallback(async (ev) => {
    const val = ev.target.value;
    if (!val) return;
    setValue(val);
    setMsg(''); setError(''); setSaving(true);
    try {
      await updateMyLanguages([{ langCode: val, primary: true }]);
      await refresh();
      setMsg(t('myLanguages.savedOk', 'Idioma guardado.'));
    } catch (e) {
      setError((e && e.message) || t('myLanguages.saveError', 'No se pudo guardar el idioma.'));
    } finally {
      setSaving(false);
    }
  }, [refresh, t]);

  if (loading || supported.length === 0) return null;

  return (
    <ProfileCard>
      <CardHeader>
        <CardTitle>{t('myLanguages.title', 'Tu idioma')}</CardTitle>
        <CardSubtitle>
          {t('myLanguages.subtitle',
            'El idioma que hablas con fluidez. Se muestra en tu perfil y es al que se traducen tus chats.')}
        </CardSubtitle>
      </CardHeader>
      <CardBody>
        {msg && <Hint role="status" style={{ color: '#166534' }}>{msg}</Hint>}
        {error && <Hint role="alert" style={{ color: '#b45309' }}>{error}</Hint>}

        <select
          value={value}
          onChange={onChange}
          disabled={saving}
          aria-label={t('myLanguages.title', 'Tu idioma')}
          style={{
            width: '100%', maxWidth: 320, padding: '8px 10px', fontSize: 14,
            borderRadius: 8, border: '1px solid #e6e7ea', background: '#fff',
          }}
        >
          {supported.map((code) => (
            <option key={code} value={code}>{LANG_LABELS[code] || code}</option>
          ))}
        </select>
      </CardBody>
    </ProfileCard>
  );
}
