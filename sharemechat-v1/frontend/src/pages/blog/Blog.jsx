import React, { useState, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { GlobalBlack } from '../../styles/public-styles/HomeStyles';
import PublicNavbar from '../../components/navbar/PublicNavbar';
import BlogContent from './BlogContent';

export default function Blog() {
  const [activeTab, setActiveTab] = useState('blog');
  const history = useHistory();

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
      go('/blog');
    } else {
      goLogin();
    }
  };

  return (
    <>
      <GlobalBlack />

      <PublicNavbar
        activeTab={activeTab}
        onBrandClick={handleLogoClick}
        onGoVideochat={() => handleTabClick('videochat')}
        onGoFavorites={() => handleTabClick('favoritos')}
        onGoBlog={() => handleTabClick('blog')}
        onBuy={goLogin}
        onLogin={goLogin}
        showLocaleSwitcher={false}
        showBottomNav={true}
      />

      <BlogContent
        mode="public"
        onGoRegisterClient={goLogin}
        onGoRegisterModel={goLogin}
      />
    </>
  );
}