import React from 'react';
import i18n from '../i18n';
import { useSession } from './SessionProvider';
import { getResolvedLocale, getAvailableLocales } from '../i18n/localeUtils';
import { LOCALE_LABELS } from '../i18n/localeConfig';
import { LocaleSwitch, LocaleButton } from '../styles/NavbarStyles';

const LocaleSwitcher = ({ onAfterChange, style }) => {

  const { updateUiLocale } = useSession();

  const currentLocale = getResolvedLocale(i18n);
  const locales = getAvailableLocales();

  const handleChange = async (locale) => {
    if (locale === currentLocale) return;

    try {
      await updateUiLocale(locale);
      if (onAfterChange) onAfterChange(locale);
    } catch (e) {
      console.error('Locale change error', e);
    }
  };

  return (
    <LocaleSwitch style={style}>
      {locales.map((locale) => (
        <LocaleButton
          key={locale}
          type="button"
          $active={currentLocale === locale}
          onClick={() => handleChange(locale)}
        >
          {LOCALE_LABELS[locale] || locale.toUpperCase()}
        </LocaleButton>
      ))}
    </LocaleSwitch>
  );
};

export default LocaleSwitcher;
