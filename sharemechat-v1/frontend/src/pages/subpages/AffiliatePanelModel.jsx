// src/pages/subpages/AffiliatePanelModel.jsx
//
// ADR-049 Subpasada 2C: placeholder del panel de Afiliadas de la modelo.
// La implementacion real (URL de referral, QR descargable, stats de clicks,
// clientes atribuidos, comisiones) llega en la Subpasada 2D. Aqui solo
// dejamos la ruta viva con un mensaje "proximamente" para que el pill del
// navbar tenga destino.
//
// El componente reutiliza NavbarModel con handlers que devuelven al
// dashboard principal para preservar la navegacion. El pill de "Afiliada"
// del navbar queda deshabilitado en esta vista (sin sentido navegar a
// donde ya estas).

import React from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../../i18n';
import { useSession } from '../../components/SessionProvider';
import NavbarModel from '../../components/navbar/NavbarModel';
import { StyledContainer } from '../../styles/NavbarStyles';

const AffiliatePanelModel = () => {
  const history = useHistory();
  const { user: sessionUser } = useSession();

  const goDashboard = () => history.push('/model');
  const goProfile = () => history.push('/perfil-model');

  const displayName = sessionUser?.nickname || sessionUser?.email || '';

  return (
    <StyledContainer>
      <NavbarModel
        activeTab="afiliada"
        displayName={displayName}
        showBottomNav={false}
        showBalance={false}
        showQueue={false}
        onBrandClick={goDashboard}
        onGoVideochat={goDashboard}
        onGoFavorites={goDashboard}
        onGoBlog={goDashboard}
        onGoStats={goDashboard}
        onGoAffiliate={() => {}}
        affiliateDisabled={true}
        onProfile={goProfile}
        onWithdraw={goDashboard}
        onLogout={goDashboard}
      />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          padding: '48px 24px',
          maxWidth: '720px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <h1 style={{ color: '#f9fafb', marginTop: 0, fontSize: '1.75rem' }}>
          {i18n.t('affiliatePlaceholder.title')}
        </h1>
        <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.6 }}>
          {i18n.t('affiliatePlaceholder.body')}
        </p>
      </main>
    </StyledContainer>
  );
};

export default AffiliatePanelModel;
