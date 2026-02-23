import React from 'react';
import { useHistory } from 'react-router-dom';

import {
  StyledContainer,
  StyledMainContent,
  GlobalBlack,
} from '../../styles/pages-styles/VideochatStyles';

import {
  StyledNavbar,
  StyledBrand,
  NavText,
} from '../../styles/NavbarStyles';

import { NavButton } from '../../styles/ButtonStyles';

import {
  Hint,
  CenteredMain,
  OnboardingCard,
} from '../../styles/subpages/PerfilClientModelStyle';

const ModelKycVeriffPage = () => {
  const history = useHistory();

  return (
    <StyledContainer>
      <GlobalBlack />

      <StyledNavbar>
        <StyledBrand
          href="#"
          aria-label="SharemeChat"
          onClick={(e) => e.preventDefault()}
        />

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}>
          <NavText>Veriff</NavText>
          <NavButton
            type="button"
            onClick={() => history.push('/dashboard-user-model')}
          >
            Volver
          </NavButton>
        </div>
      </StyledNavbar>

      <StyledMainContent data-tab="onboarding">
        <CenteredMain>
          <OnboardingCard>
            <h3>Estás en Veriff</h3>
            <Hint style={{ marginTop: 12, color: '#000' }}>
              Página interna placeholder del flujo KYC Veriff.
            </Hint>
          </OnboardingCard>
        </CenteredMain>
      </StyledMainContent>
    </StyledContainer>
  );
};

export default ModelKycVeriffPage;