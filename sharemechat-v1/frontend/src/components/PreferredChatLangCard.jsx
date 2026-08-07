import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../i18n';
import { getTranslationConfig, updatePreferredChatLang } from '../api/translationApi';
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
 * pending-hardening §5.3: seleccion del idioma preferido para chat P2P.
 *
 * Backend PUT /api/users/me/preferred-chat-lang. Fallback si NULL: uiLocale.
 * La lista de idiomas soportados viene del backend
 * (/api/messages/translation-config). Si la feature esta desactivada en el
 * entorno (translation.google.enabled=false), no renderizamos nada.
 *
 * Nombres nativos hardcoded aqui (mas UX-friendly que codigos "es", "en",
 * ...). Sincronizar con SupportedChatLanguages.CODES del backend.
 */
const LANG_LABELS = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  nl: 'Nederlands',
  pl: 'Polski',
  ru: 'Русский',
  ja: '日本語',
  zh: '中文',
  ko: '한국어',
  ar: 'العربية',
  tr: 'Türkçe',
  ro: 'Română',
};

export default function PreferredChatLangCard() {
  const t = (key, options) => i18n.t(key, options);
  const { user, refresh } = useSession();

  const [enabled, setEnabled] = useState(false);
  const [supportedLangs, setSupportedLangs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const currentValue = (user && user.preferredChatLang) || '';

  useEffect(() => {
    let cancelled = false;
    getTranslationConfig()
      .then((data) => {
        if (cancelled) return;
        setEnabled(!!data?.enabled);
        setSupportedLangs(Array.isArray(data?.langs) ? data.langs : []);
      })
      .catch(() => { if (!cancelled) setEnabled(false); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const onChange = useCallback(async (ev) => {
    const val = ev.target.value || null;
    setError('');
    setMsg('');
    setSaving(true);
    try {
      await updatePreferredChatLang(val);
      await refresh();
      setMsg(t('preferredChatLang.savedOk', 'Idioma guardado.'));
    } catch (e) {
      setError((e && e.message) || t('preferredChatLang.saveError', 'No se pudo guardar el idioma.'));
    } finally {
      setSaving(false);
    }
  }, [refresh, t]);

  if (loading || !enabled) return null;

  return (
    <ProfileCard>
      <CardHeader>
        <CardTitle>{t('preferredChatLang.title', 'Idioma del chat')}</CardTitle>
        <CardSubtitle>
          {t('preferredChatLang.subtitle',
            'Los mensajes recibidos en otro idioma se traducirán automáticamente a este idioma en tu vista.')}
        </CardSubtitle>
      </CardHeader>
      <CardBody>
        {msg && <Hint role="status" style={{ color: '#166534' }}>{msg}</Hint>}
        {error && <Hint role="alert" style={{ color: '#b45309' }}>{error}</Hint>}

        <label htmlFor="preferredChatLang-select" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
          {t('preferredChatLang.label', 'Idioma preferido')}
        </label>
        <select
          id="preferredChatLang-select"
          value={currentValue}
          onChange={onChange}
          disabled={saving}
          style={{
            width: '100%',
            maxWidth: 320,
            padding: '8px 10px',
            fontSize: 14,
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#fff',
          }}
        >
          <option value="">
            {t('preferredChatLang.autoOption', 'Automático (usar idioma de la interfaz)')}
          </option>
          {supportedLangs.map((code) => (
            <option key={code} value={code}>
              {LANG_LABELS[code] || code}
            </option>
          ))}
        </select>

        <Hint style={{ marginTop: 10 }}>
          {t('preferredChatLang.hint',
            'Solo se traducen mensajes recibidos. Puedes ocultar todas las traducciones desde el propio chat.')}
        </Hint>
      </CardBody>
    </ProfileCard>
  );
}
