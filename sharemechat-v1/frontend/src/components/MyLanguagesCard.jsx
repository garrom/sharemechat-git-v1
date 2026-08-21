import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
 * Fase 2 i18n (2026-08-21): card "Idiomas que hablo" (Nivel B). Reemplaza a
 * PreferredChatLangCard. El usuario marca los idiomas que habla y CUÁL es su
 * idioma principal. El principal es el destino de traducción de chat + el
 * idioma principal del perfil público.
 *
 * Backend: PUT /api/users/me/languages con [{ langCode, primary }]. La lista de
 * idiomas soportados viene de /api/messages/translation-config (los 15 + mg).
 *
 * Nombres nativos hardcoded (más UX-friendly que códigos). Sincronizar con
 * SupportedChatLanguages.CODES del backend.
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
  const [selected, setSelected] = useState([]); // array de langCode
  const [primary, setPrimary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Inicializa la selección desde el usuario (user.languages del /me).
  useEffect(() => {
    const langs = Array.isArray(user?.languages) ? user.languages : [];
    setSelected(langs.map((l) => l.langCode));
    const prim = langs.find((l) => l.primary);
    setPrimary(prim ? prim.langCode : (langs[0] ? langs[0].langCode : null));
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

  const isSelected = useCallback((code) => selected.includes(code), [selected]);

  const toggle = useCallback((code) => {
    setMsg(''); setError('');
    setSelected((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((c) => c !== code);
        setPrimary((p) => (p === code ? (next[0] || null) : p));
        return next;
      }
      const next = [...prev, code];
      setPrimary((p) => (p == null ? code : p));
      return next;
    });
  }, []);

  const choosePrimary = useCallback((code) => {
    setMsg(''); setError('');
    if (!selected.includes(code)) return;
    setPrimary(code);
  }, [selected]);

  const onSave = useCallback(async () => {
    setMsg(''); setError('');
    if (selected.length === 0) {
      setError(t('myLanguages.errorEmpty', 'Elige al menos un idioma que hables.'));
      return;
    }
    const prim = primary && selected.includes(primary) ? primary : selected[0];
    const payload = selected.map((code) => ({ langCode: code, primary: code === prim }));
    setSaving(true);
    try {
      await updateMyLanguages(payload);
      await refresh();
      setMsg(t('myLanguages.savedOk', 'Idiomas guardados.'));
    } catch (e) {
      setError((e && e.message) || t('myLanguages.saveError', 'No se pudieron guardar los idiomas.'));
    } finally {
      setSaving(false);
    }
  }, [selected, primary, refresh, t]);

  // Orden: los soportados, con los seleccionados arriba para comodidad.
  const ordered = useMemo(() => {
    const sel = supported.filter((c) => selected.includes(c));
    const rest = supported.filter((c) => !selected.includes(c));
    return [...sel, ...rest];
  }, [supported, selected]);

  if (loading || supported.length === 0) return null;

  return (
    <ProfileCard>
      <CardHeader>
        <CardTitle>{t('myLanguages.title', 'Idiomas que hablo')}</CardTitle>
        <CardSubtitle>
          {t('myLanguages.subtitle',
            'Marca los idiomas que hablas y cuál es tu idioma principal. El principal es el que se muestra en tu perfil y al que se traducen tus chats.')}
        </CardSubtitle>
      </CardHeader>
      <CardBody>
        {msg && <Hint role="status" style={{ color: '#166534' }}>{msg}</Hint>}
        {error && <Hint role="alert" style={{ color: '#b45309' }}>{error}</Hint>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 360 }}>
          {ordered.map((code) => {
            const sel = isSelected(code);
            const isPrimary = sel && primary === code;
            return (
              <div
                key={code}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px',
                  borderRadius: 8, border: '1px solid #e6e7ea',
                  background: sel ? '#fbeaea' : '#fff',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={sel}
                    disabled={saving}
                    onChange={() => toggle(code)}
                  />
                  <span>{LANG_LABELS[code] || code}</span>
                  <span style={{ color: '#8b94a1', fontSize: 11, textTransform: 'uppercase' }}>{code}</span>
                </label>
                <label
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                    color: sel ? '#1f2933' : '#c3c8cf',
                    cursor: sel ? 'pointer' : 'default', whiteSpace: 'nowrap',
                  }}
                  title={t('myLanguages.primaryHint', 'Idioma principal')}
                >
                  <input
                    type="radio"
                    name="primary-language"
                    checked={isPrimary}
                    disabled={!sel || saving}
                    onChange={() => choosePrimary(code)}
                  />
                  {t('myLanguages.primary', 'principal')}
                </label>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            marginTop: 12, padding: '8px 16px', fontSize: 14, fontWeight: 700,
            color: '#fff', background: '#ea1d1d', border: 'none', borderRadius: 8,
            cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? t('common.saving', 'Guardando…') : t('myLanguages.save', 'Guardar idiomas')}
        </button>
      </CardBody>
    </ProfileCard>
  );
}
