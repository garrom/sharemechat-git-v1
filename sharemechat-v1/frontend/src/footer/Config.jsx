import React from 'react';
import { useHistory } from 'react-router-dom';
import { FooterInner, LegalText } from '../styles/public-styles/FooterStyles';

const PageWrap = {
  background: '#ffffff',
  color: '#1f2937',
  padding: '44px 0 72px'
};

const HeroBlock = {
  maxWidth: '920px',
  margin: '0 auto'
};

const BackButton = {
  appearance: 'none',
  background: 'transparent',
  color: '#1e3a8a',
  border: '1px solid rgba(31,41,55,0.12)',
  borderRadius: '999px',
  padding: '8px 14px',
  cursor: 'pointer',
  fontSize: '0.9rem'
};

const PageTitle = {
  margin: '0',
  fontSize: '1.9rem',
  fontWeight: 600,
  color: '#1f2937'
};

const Intro = {
  marginTop: '14px',
  fontSize: '0.96rem',
  lineHeight: '1.7',
  color: '#4b5563'
};

const ContentWrap = {
  maxWidth: '920px',
  margin: '34px auto 0'
};

const Section = {
  marginBottom: '28px'
};

const SectionTitle = {
  margin: '0 0 10px 0',
  fontSize: '1.1rem',
  fontWeight: 600,
  color: '#1f2937'
};

const Text = {
  margin: '0',
  fontSize: '0.95rem',
  lineHeight: '1.75',
  color: '#4b5563'
};

const Card = {
  border: '1px solid rgba(31,41,55,0.08)',
  borderRadius: '16px',
  padding: '18px 18px',
  marginBottom: '14px',
  background: '#ffffff'
};

const CardTitleRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '8px',
  flexWrap: 'wrap'
};

const CardTitle = {
  margin: '0',
  fontSize: '1rem',
  fontWeight: 600,
  color: '#1f2937'
};

const BadgeRequired = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '999px',
  padding: '5px 10px',
  fontSize: '0.78rem',
  fontWeight: 600,
  background: '#eef2ff',
  color: '#1e3a8a',
  border: '1px solid #c7d2fe'
};

const BadgeOptional = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '999px',
  padding: '5px 10px',
  fontSize: '0.78rem',
  fontWeight: 600,
  background: '#f8fafc',
  color: '#475569',
  border: '1px solid rgba(31,41,55,0.10)'
};

const LinkLike = {
  color: '#1e3a8a',
  cursor: 'pointer',
  fontWeight: 500
};

export default function Config() {
  const history = useHistory();

  const back = () => {
    if (window.history.length > 1) {
      history.goBack();
      return;
    }

    history.push('/');
  };

  return (
    <div style={PageWrap}>
      <FooterInner>
        <div style={HeroBlock}>
          <button style={BackButton} onClick={back}>
            ← Back
          </button>

          <h1 style={PageTitle}>Cookie Settings & Preferences</h1>

          <p style={Intro}>
            This page explains how cookie-related preferences are handled on
            SharemeChat. Some cookies are strictly necessary for the platform to
            function correctly, while other categories may be expanded or adjusted
            over time as the service evolves.
          </p>
        </div>

        <div style={ContentWrap}>
          <div style={Section}>
            <h2 style={SectionTitle}>Current Configuration</h2>
            <p style={Text}>
              At this stage, SharemeChat primarily relies on essential
              technologies required for authentication, security, and basic
              platform operation. Preference and analytics settings may be
              refined in future versions of the service.
            </p>
          </div>

          <div style={Card}>
            <div style={CardTitleRow}>
              <h3 style={CardTitle}>Essential Cookies</h3>
              <span style={BadgeRequired}>Always active</span>
            </div>

            <p style={Text}>
              These cookies and similar technologies are necessary for core
              features such as secure login, session continuity, fraud
              prevention, and platform stability. Because they are essential to
              the operation of the service, they cannot be disabled from this page.
            </p>
          </div>

          <div style={Card}>
            <div style={CardTitleRow}>
              <h3 style={CardTitle}>Preference Cookies</h3>
              <span style={BadgeOptional}>Limited</span>
            </div>

            <p style={Text}>
              Preference-related technologies may be used to remember certain
              user choices, such as interface or consent-related states, where
              applicable. These settings may become more detailed in future
              versions of SharemeChat.
            </p>
          </div>

          <div style={Card}>
            <div style={CardTitleRow}>
              <h3 style={CardTitle}>Analytics & Performance</h3>
              <span style={BadgeOptional}>Managed when applicable</span>
            </div>

            <p style={Text}>
              Where analytics or performance tools are used, they are intended
              to help improve service quality, stability, and user experience.
              Their use may depend on the applicable legal basis and the consent
              model available on the platform at that time.
            </p>
          </div>

          <div style={Section}>
            <h2 style={SectionTitle}>Browser Controls</h2>
            <p style={Text}>
              You can also manage cookies directly through your browser settings.
              Most modern browsers allow you to review, block, or delete cookies
              for specific websites. Please note that disabling essential
              cookies may affect login, session continuity, or other important
              parts of the service.
            </p>
          </div>

          <div style={Section}>
            <h2 style={SectionTitle}>Learn More</h2>
            <p style={Text}>
              For more information about how cookies and similar technologies
              are used on SharemeChat, please review our{' '}
              <span
                style={LinkLike}
                onClick={() => history.push('/legal?tab=cookies')}
              >
                Cookie Policy
              </span>{' '}
              and our{' '}
              <span
                style={LinkLike}
                onClick={() => history.push('/legal?tab=privacy')}
              >
                Privacy Policy
              </span>.
            </p>
          </div>

          <div style={Section}>
            <h2 style={SectionTitle}>Future Improvements</h2>
            <p style={Text}>
              As SharemeChat evolves, this page may include more granular
              preference controls, clearer consent options, and additional tools
              for managing non-essential technologies in a more detailed way.
            </p>
          </div>

          <div style={{ marginTop: '40px' }}>
            <LegalText style={{ color: '#6b7280', opacity: 1 }}>
              Shareme Technologies OÜ
              <br />
              Registry code: 17444422
              <br />
              Lõõtsa tn 5, 11415 Tallinn, Estonia
              <br />
              contact@sharemechat.com
            </LegalText>
          </div>
        </div>
      </FooterInner>
    </div>
  );
}