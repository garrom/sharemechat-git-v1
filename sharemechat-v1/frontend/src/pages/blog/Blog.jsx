import React, { useState, useCallback } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { GlobalBlack } from '../../styles/public-styles/HomeStyles';
import PublicNavbar from '../../components/navbar/PublicNavbar';
import BlogContent from './BlogContent';
import { BlogLocaleContext } from './BlogLocaleContext';

const VALID_LOCALES = ['es', 'en'];

export default function Blog() {
  const [activeTab, setActiveTab] = useState('blog');
  const history = useHistory();
  const { locale: localeFromPath } = useParams();
  const locale = VALID_LOCALES.includes(localeFromPath) ? localeFromPath : 'es';

  const go = useCallback((path) => {
    history.push(path);
  }, [history]);

  const goLogin = useCallback(() => {
    go('/login');
  }, [go]);

  const handleLogoClick = (e) => {
    e.preventDefault();
    go('/');
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);

    if (tab === 'blog') {
      go(`/blog/${locale}`);
    } else {
      goLogin();
    }
  };

  // Context valor para LocaleSwitcher: estamos en listado, sin slug ni
  // alternates concretos. El switcher cambia entre /blog/es y /blog/en.
  const localeContextValue = {
    currentLocale: locale,
    currentSlug: null,
    alternates: VALID_LOCALES
      .filter((l) => l !== locale)
      .map((l) => ({ locale: l, slug: null, url: `/blog/${l}` })),
  };

  return (
    <BlogLocaleContext.Provider value={localeContextValue}>
      <GlobalBlack />

      <PublicNavbar
        activeTab={activeTab}
        onBrandClick={handleLogoClick}
        onGoVideochat={() => handleTabClick('videochat')}
        onGoFavorites={() => handleTabClick('favoritos')}
        onGoBlog={() => handleTabClick('blog')}
        onBuy={goLogin}
        onLogin={goLogin}
        showLocaleSwitcher={true}
        showBottomNav={true}
      />

      <BlogContent
        mode="public"
        locale={locale}
        onGoRegisterClient={goLogin}
        onGoRegisterModel={goLogin}
      />
    </BlogLocaleContext.Provider>
  );
}
