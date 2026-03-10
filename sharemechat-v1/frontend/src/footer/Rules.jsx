import React from 'react';
import { useHistory } from 'react-router-dom';
import {
  FooterInner,
  LegalText
} from '../styles/public-styles/FooterStyles';

const PageWrap = {
  background: '#ffffff',
  color: '#1f2937',
  padding: '44px 0 72px'
};

const HeroBlock = {
  maxWidth: '920px',
  margin: '0 auto'
};

const BackButtonWrap = {
  marginBottom: '20px'
};

const BackButton = {
  appearance: 'none',
  background: 'transparent',
  color: '#1e3a8a',
  border: '1px solid rgba(31, 41, 55, 0.12)',
  borderRadius: '999px',
  padding: '8px 14px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 500,
  lineHeight: 1,
  transition: 'all 160ms ease'
};

const BackButtonHover = {
  background: '#f8fafc',
  border: '1px solid #93c5fd'
};

const PageTitle = {
  margin: '0',
  fontSize: '1.55rem',
  fontWeight: 600,
  lineHeight: 1.2,
  color: '#1f2937',
  letterSpacing: '-0.01em'
};

const MetaText = {
  marginTop: '10px',
  marginBottom: '0',
  fontSize: '0.9rem',
  lineHeight: '1.6',
  color: '#6b7280',
  fontWeight: 400
};

const IntroText = {
  marginTop: '16px',
  marginBottom: '0',
  fontSize: '0.96rem',
  lineHeight: '1.7',
  color: '#4b5563',
  fontWeight: 400
};

const ContentWrap = {
  maxWidth: '920px',
  margin: '34px auto 0'
};

const Section = {
  marginBottom: '26px'
};

const SectionTitle = {
  margin: '0 0 8px 0',
  fontSize: '1rem',
  fontWeight: 600,
  lineHeight: 1.35,
  color: '#1f2937'
};

const Paragraph = {
  margin: '0',
  fontSize: '0.95rem',
  lineHeight: '1.75',
  color: '#4b5563',
  fontWeight: 400
};

const List = {
  margin: '10px 0 0 0',
  paddingLeft: '18px',
  color: '#4b5563',
  fontSize: '0.95rem',
  lineHeight: '1.75',
  fontWeight: 400
};

export default function Rules() {
  const history = useHistory();
  const [isBackHovered, setIsBackHovered] = React.useState(false);

  const handleBack = () => {
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
          <div style={BackButtonWrap}>
            <button
              type="button"
              style={{ ...BackButton, ...(isBackHovered ? BackButtonHover : {}) }}
              onClick={handleBack}
              onMouseEnter={() => setIsBackHovered(true)}
              onMouseLeave={() => setIsBackHovered(false)}
            >
              ← Back
            </button>
          </div>

          <h1 style={PageTitle}>Community Guidelines</h1>

          <p style={MetaText}>Effective date: March 2026</p>

          <p style={IntroText}>
            This page forms part of the SharemeChat Terms of Service. These
            Community Guidelines define the basic rules for using the platform
            and participating in live video sessions. By using SharemeChat, you
            agree to comply with these rules. Violations may result in warnings,
            session termination, temporary suspension, or permanent bans.
          </p>
        </div>

        <div style={ContentWrap}>
          <div style={Section}>
            <h2 style={SectionTitle}>Mandatory Rules</h2>
            <p style={Paragraph}>
              The rules below apply to all users of SharemeChat and are intended
              to protect the platform, users, and the integrity of live sessions.
            </p>
          </div>

          <div style={Section}>
            <h3 style={SectionTitle}>1. Adults Only</h3>
            <p style={Paragraph}>
              SharemeChat is strictly intended for users aged 18 or older. If we
              reasonably suspect that a user is under the age of 18, we may
              request proof of age. Failure to provide verification may result in
              immediate account termination.
            </p>
          </div>

          <div style={Section}>
            <h3 style={SectionTitle}>2. Respect Your Chat Partner</h3>
            <p style={Paragraph}>
              Users must treat others with respect. Offensive language,
              harassment, threats, hate speech, intimidation, or abusive
              behavior are not allowed on the platform.
            </p>
          </div>

          <div style={Section}>
            <h3 style={SectionTitle}>3. Face Visibility Requirement</h3>
            <p style={Paragraph}>
              During live sessions, your face should remain clearly visible.
              Users may not point the camera away from themselves, use
              freeze-frames, broadcast pre-recorded content, or simulate a live
              presence in any misleading way.
            </p>
          </div>

          <div style={Section}>
            <h3 style={SectionTitle}>4. Public Area Conduct</h3>
            <p style={Paragraph}>
              In public or non-age-gated areas of the platform, users must
              remain appropriately presented and comply with all platform safety
              requirements. Any behavior that is unsafe, deceptive, or clearly
              inappropriate for a general-access area may lead to enforcement.
            </p>
          </div>

          <div style={Section}>
            <h3 style={SectionTitle}>5. Prohibited Behaviour</h3>
            <p style={Paragraph}>
              The following behavior is strictly prohibited:
            </p>
            <ul style={List}>
              <li>Harassment, abusive language, or threats.</li>
              <li>Impersonation, scams, or fraudulent conduct.</li>
              <li>Illegal activity or attempts to involve minors.</li>
              <li>Attempts to deceive other users or moderators.</li>
              <li>Attempts to bypass platform safeguards or moderation.</li>
            </ul>
          </div>

          <div style={Section}>
            <h3 style={SectionTitle}>6. Reports and Moderation</h3>
            <p style={Paragraph}>
              SharemeChat may use reports, technical signals, and moderation
              processes to investigate suspected violations. Users are encouraged
              to report inappropriate conduct through the platform whenever
              necessary.
            </p>
          </div>

          <div style={Section}>
            <h3 style={SectionTitle}>7. Enforcement</h3>
            <p style={Paragraph}>
              SharemeChat reserves the right to terminate sessions, suspend
              accounts, or permanently ban users who violate these Community
              Guidelines. The severity and duration of enforcement measures will
              depend on the nature and seriousness of the violation.
            </p>
          </div>

          <div style={{ marginTop: '34px' }}>
            <LegalText style={{ color: '#6b7280', opacity: 1 }}>
              Shareme Technologies OÜ
              <br />
              Registry code: 17444422
              <br />
              Lõõtsa tn 5, 11415 Tallinn, Harju maakond, Estonia
              <br />
              contact@sharemechat.com
            </LegalText>
          </div>
        </div>
      </FooterInner>
    </div>
  );
}