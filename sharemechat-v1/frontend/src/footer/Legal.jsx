import React, { useState } from 'react';
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

const PageTitle = {
  margin: '0',
  fontSize: '1.55rem',
  fontWeight: 600,
  lineHeight: 1.2,
  color: '#1f2937',
  letterSpacing: '-0.01em'
};

const IntroText = {
  marginTop: '12px',
  marginBottom: '0',
  fontSize: '0.96rem',
  lineHeight: '1.7',
  color: '#4b5563',
  fontWeight: 400
};

const getBackButtonStyle = (hovered) => ({
  appearance: 'none',
  background: hovered ? '#f8fafc' : 'transparent',
  color: '#1e3a8a',
  border: hovered ? '1px solid #93c5fd' : '1px solid rgba(31, 41, 55, 0.12)',
  borderRadius: '999px',
  padding: '8px 14px',
  fontSize: '0.9rem',
  fontWeight: 500,
  cursor: 'pointer',
  marginBottom: '20px',
  transition: 'all 160ms ease'
});

const TabBar = {
  display: 'flex',
  gap: '10px',
  marginTop: '28px',
  marginBottom: '34px',
  flexWrap: 'wrap'
};

const getTabButtonStyle = (active) => ({
  appearance: 'none',
  background: active ? '#eef2ff' : 'transparent',
  color: active ? '#1e3a8a' : '#1f2937',
  border: active ? '1px solid #c7d2fe' : '1px solid rgba(31, 41, 55, 0.12)',
  borderRadius: '999px',
  padding: '9px 16px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 500,
  lineHeight: 1,
  transition: 'all 160ms ease'
});

const ContentWrap = {
  maxWidth: '920px',
  margin: '0 auto'
};

const DocTitle = {
  margin: '0 0 10px 0',
  fontSize: '1.4rem',
  fontWeight: 600,
  lineHeight: 1.25,
  color: '#1f2937',
  letterSpacing: '-0.01em'
};

const DocIntro = {
  margin: '0 0 26px 0',
  fontSize: '0.95rem',
  lineHeight: '1.7',
  color: '#4b5563',
  fontWeight: 400
};

const Section = {
  marginBottom: '24px'
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

const LinkLike = {
  color: '#1e3a8a',
  textDecoration: 'none',
  fontWeight: 500,
  cursor: 'pointer'
};

export default function Legal() {
  const history = useHistory();
  const [tab, setTab] = useState('terms');
  const [hoveredTab, setHoveredTab] = useState(null);
  const [hoveredBack, setHoveredBack] = useState(false);

  const handleBack = () => {
    if (window.history.length > 1) {
      history.goBack();
      return;
    }

    history.push('/');
  };

  const tabStyle = (key) => {
    const active = tab === key;
    const hovered = hoveredTab === key;

    return {
      ...getTabButtonStyle(active),
      color: active || hovered ? '#1e3a8a' : '#1f2937',
      border: active
        ? '1px solid #c7d2fe'
        : hovered
          ? '1px solid #93c5fd'
          : '1px solid rgba(31, 41, 55, 0.12)',
      background: active
        ? '#eef2ff'
        : hovered
          ? '#f8fafc'
          : 'transparent'
    };
  };

  return (
    <div style={PageWrap}>
      <FooterInner>
        <div style={HeroBlock}>
          <button
            type="button"
            style={getBackButtonStyle(hoveredBack)}
            onClick={handleBack}
            onMouseEnter={() => setHoveredBack(true)}
            onMouseLeave={() => setHoveredBack(false)}
          >
            ← Back
          </button>

          <h1 style={PageTitle}>Legal Center</h1>

          <p style={IntroText}>
            This page brings together the main legal documents governing the use
            of SharemeChat. Please review them carefully before using the service.
          </p>

          <div style={TabBar}>
            <button
              type="button"
              style={tabStyle('terms')}
              onClick={() => setTab('terms')}
              onMouseEnter={() => setHoveredTab('terms')}
              onMouseLeave={() => setHoveredTab(null)}
              aria-pressed={tab === 'terms'}
            >
              Terms of Service
            </button>

            <button
              type="button"
              style={tabStyle('privacy')}
              onClick={() => setTab('privacy')}
              onMouseEnter={() => setHoveredTab('privacy')}
              onMouseLeave={() => setHoveredTab(null)}
              aria-pressed={tab === 'privacy'}
            >
              Privacy Policy
            </button>

            <button
              type="button"
              style={tabStyle('cookies')}
              onClick={() => setTab('cookies')}
              onMouseEnter={() => setHoveredTab('cookies')}
              onMouseLeave={() => setHoveredTab(null)}
              aria-pressed={tab === 'cookies'}
            >
              Cookie Policy
            </button>
          </div>
        </div>

        <div style={ContentWrap}>
          {tab === 'terms' && (
            <>
              <h2 style={DocTitle}>Terms of Service</h2>

              <p style={DocIntro}>
                These Terms of Service govern your access to and use of SharemeChat,
                including the website, the mobile web experience, and related
                services. By creating an account, accessing, or using the service,
                you agree to these terms.
              </p>

              <div style={Section}>
                <h3 style={SectionTitle}>1. Operator and Scope</h3>
                <p style={Paragraph}>
                  SharemeChat is operated by Shareme Technologies OÜ. These terms
                  apply to the SharemeChat website, mobile web experience, user
                  accounts, premium features, live sessions, messaging features, and
                  related support or safety processes made available through the
                  platform.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>2. Eligibility and Age Verification</h3>
                <p style={Paragraph}>
                  SharemeChat is intended exclusively for adults aged 18 or older.
                  We may request age or identity verification when necessary to
                  protect the platform, users, and compliance obligations. Access
                  or use by minors is strictly prohibited.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>3. Accounts and Access</h3>
                <p style={Paragraph}>
                  You must provide accurate information and keep your account
                  credentials secure. You may not create accounts in bulk, use bots,
                  impersonate others, share accounts, or attempt to bypass access
                  controls, platform safeguards, or eligibility restrictions.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>4. Nature of the Service</h3>
                <p style={Paragraph}>
                  SharemeChat is a premium 1-to-1 video chat platform for adult
                  users. Users may be matched randomly with available participants
                  and may also interact with profiles they have added to favorites.
                  Features, pricing models, session availability, and user
                  experience may vary depending on the device, browser, region, or
                  operational state of the service.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>5. User Conduct and Prohibited Conduct</h3>
                <p style={Paragraph}>
                  Your use of the service must comply with the platform rules,
                  community standards, and applicable law. The following behaviors
                  are strictly prohibited:
                </p>
                <ul style={List}>
                  <li>Harassment, threats, hate speech, coercion, or extortion.</li>
                  <li>Illegal activity or any content involving minors. Any attempt to involve, depict, solicit, promote, or normalize minors in any context is strictly prohibited and may be reported to competent authorities.</li>
                  <li>Fraud, impersonation, phishing, scams, or abuse of promotions.</li>
                  <li>Explicit sexual content or conduct forbidden by platform rules.</li>
                  <li>Attempts to bypass moderation, controls, or security systems.</li>
                  <li>Use of the service in a misleading, abusive, or commercially unauthorized way.</li>
                </ul>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>6. Live Camera and Session Rules</h3>
                <p style={Paragraph}>
                  During live sessions, users may be required to keep their face
                  clearly visible on camera and to comply with platform rules for
                  live interaction. We may interrupt or limit sessions where camera
                  use, behavior, displayed material, or session conduct creates a
                  safety, compliance, moderation, or technical concern.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>7. Moderation, Enforcement, and Content Removal</h3>
                <p style={Paragraph}>
                  SharemeChat may use automated signals, technical checks, and human
                  review to operate the service, enforce rules, and protect users.
                  We may remove or restrict content, hide profiles, interrupt live
                  sessions, limit features, require additional verification, or take
                  other reasonable enforcement action where necessary for safety,
                  compliance, fraud prevention, or operational integrity.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>8. Reports, Safety, and Review</h3>
                <p style={Paragraph}>
                  Users may report abuse, misconduct, or safety concerns through
                  in-platform tools or available support channels. Reports may be
                  reviewed using technical records and internal moderation processes.
                  Depending on the circumstances, outcomes may include warnings,
                  session termination, feature restrictions, account suspension, or
                  permanent removal from the service.
                </p>
                <p style={{ ...Paragraph, marginTop: '10px' }}>
                  A user who believes that a moderation or account restriction
                  decision was made in error may contact support to request review.
                  Any such review remains at SharemeChat&apos;s discretion and does not
                  create an obligation to reverse or modify the measure.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>9. Payments, Prepaid Balance, and Premium Features</h3>
                <p style={Paragraph}>
                  Certain premium features may require prepaid balance, credits, or
                  similar stored value within your account. Account balance is
                  credited after the applicable payment has been successfully
                  confirmed by the relevant payment provider or payment flow used by
                  the platform. Prices,
                  packages, and feature availability may change over time.
                </p>
                <p style={{ ...Paragraph, marginTop: '10px' }}>
                  Premium usage, including live sessions and certain premium events,
                  may consume prepaid balance. Consumption in live sessions may be
                  calculated according to the applicable duration of the session and
                  the technical records of the service. Sessions that do not become
                  properly established or confirmed may end without charge. We may
                  prevent the start or continuation of premium features where the
                  available balance is insufficient.
                </p>
                <p style={{ ...Paragraph, marginTop: '10px' }}>
                  The sending of virtual gifts consumes balance immediately according
                  to the stated value of the selected gift.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>10. Refunds</h3>
                <p style={Paragraph}>
                  Refunds are not automatic and are reviewed on a case-by-case basis.
                  We may grant refunds or account adjustments in cases involving
                  technical errors, incorrect charges, or other verifiable incidents
                  affecting premium usage. Where appropriate, a refund may be
                  provided as an account balance adjustment, credit, or other
                  internal correction applied to the service account.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>11. Payment Disputes, Fraud, and Chargebacks</h3>
                <p style={Paragraph}>
                  We may investigate misuse, fraud, payment irregularities, payment
                  disputes, or chargebacks relating to the service. During review,
                  we may suspend or restrict accounts, limit access to premium
                  features, delay account changes, or adjust balances, credits, or
                  access to premium features that were improperly credited, obtained,
                  or retained in connection with the relevant activity.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>12. User Content</h3>
                <p style={Paragraph}>
                  If you upload or send content, you retain ownership of your content,
                  but you grant SharemeChat a limited license to host, store, display,
                  reproduce, and process it only as necessary to operate, secure, and
                  improve the service.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>13. Intellectual Property</h3>
                <p style={Paragraph}>
                  The platform, including its software, branding, design, and related
                  assets, belongs to SharemeChat and its licensors. Users receive a
                  limited, revocable, non-transferable license to use the service for
                  lawful personal purposes.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>14. Privacy and Cookies</h3>
                <p style={Paragraph}>
                  The way we collect and process personal data is described in our{' '}
                  <span
                    style={LinkLike}
                    onClick={() => setTab('privacy')}
                    onMouseEnter={() => setHoveredTab('privacy-link')}
                    onMouseLeave={() => setHoveredTab(null)}
                  >
                    Privacy Policy
                  </span>{' '}
                  and our{' '}
                  <span
                    style={LinkLike}
                    onClick={() => setTab('cookies')}
                    onMouseEnter={() => setHoveredTab('cookies-link')}
                    onMouseLeave={() => setHoveredTab(null)}
                  >
                    Cookie Policy
                  </span>.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>15. Technical Factors and Availability</h3>
                <p style={Paragraph}>
                  Session quality depends on network conditions, devices, browsers,
                  local connectivity, and third-party infrastructure. We do not
                  guarantee uninterrupted or error-free availability of the service
                  at all times, and some features may be unavailable, delayed, or
                  limited in certain circumstances.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>16. Disclaimer of Warranties</h3>
                <p style={Paragraph}>
                  The service is provided on an "as is" and "as available" basis,
                  without warranties of any kind, to the maximum extent permitted by law.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>17. Limitation of Liability</h3>
                <p style={Paragraph}>
                  To the maximum extent permitted by law, SharemeChat is not liable
                  for indirect, incidental, special, consequential, or punitive
                  damages arising out of or related to the use of the service.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>18. Suspension and Termination</h3>
                <p style={Paragraph}>
                  We may suspend or terminate accounts immediately in cases involving
                  rule violations, suspected fraud, abuse, security concerns, or
                  compliance risks. After termination, your right to access the
                  service ends.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>19. Governing Law</h3>
                <p style={Paragraph}>
                  These terms are governed by the laws of Estonia. Any dispute related
                  to the service will be subject to the jurisdiction of the competent
                  courts located in Tallinn, Estonia.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>20. Contact, Safety, and Security</h3>
                <p style={Paragraph}>
                  For legal or support questions, you may contact SharemeChat at
                  contact@sharemechat.com or support@sharemechat.com. Safety or
                  security concerns should be reported through available in-platform
                  tools or the appropriate support contact.
                </p>
              </div>
            </>
          )}

          {tab === 'privacy' && (
            <>
              <h2 style={DocTitle}>Privacy Policy</h2>

              <p style={DocIntro}>
                This Privacy Policy explains how personal data is collected, used,
                stored, and protected when you use SharemeChat.
              </p>

              <div style={Section}>
                <h3 style={SectionTitle}>1. Data Controller</h3>
                <p style={Paragraph}>
                  Shareme Technologies OÜ
                  <br />
                  Registry code: 17444422
                  <br />
                  Lõõtsa tn 5, 11415 Tallinn, Harju maakond, Estonia
                  <br />
                  contact@sharemechat.com
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>2. Information We Collect</h3>
                <p style={Paragraph}>
                  We may collect account data, profile details, verification data for
                  models, technical information such as IP address, session and cookie
                  identifiers, access logs, platform usage events, messaging data, and
                  payment-related records processed through authorized providers.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>3. Why We Process Data</h3>
                <p style={Paragraph}>
                  Personal data is processed to provide the service, authenticate
                  users, operate matching and video chat features, prevent abuse and
                  fraud, comply with legal obligations, support users, and improve the
                  service through internal analytics and operational metrics.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>4. Service Providers</h3>
                <p style={Paragraph}>
                  We may share data with service providers acting on our behalf,
                  including infrastructure providers, payment processors, corporate
                  email services, and identity verification providers when applicable.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>5. International Transfers</h3>
                <p style={Paragraph}>
                  If any provider processes personal data outside the European
                  Economic Area, such transfers will be carried out under appropriate
                  safeguards, including standard contractual clauses or equivalent
                  protective measures where required.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>6. Retention Periods</h3>
                <p style={Paragraph}>
                  Data is kept only for as long as necessary to operate the service,
                  meet legal obligations, respond to disputes or claims, maintain
                  security, and comply with accounting or compliance requirements.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>7. Your Rights</h3>
                <p style={Paragraph}>
                  You may request access, rectification, deletion, restriction,
                  objection, or portability of your personal data, subject to
                  applicable law. Requests may be sent to contact@sharemechat.com.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>8. Security Measures</h3>
                <p style={Paragraph}>
                  We use measures such as encrypted connections, secure cookie-based
                  authentication where applicable, anti-abuse systems, activity logs,
                  fraud detection, and data minimization practices appropriate for the
                  nature of the service.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>9. Minors</h3>
                <p style={Paragraph}>
                  SharemeChat is strictly intended for adults aged 18 or older. If we
                  detect that a minor has provided personal data, we may remove that
                  data and block access to the platform.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>10. Policy Updates</h3>
                <p style={Paragraph}>
                  We may update this Privacy Policy from time to time to reflect
                  changes in the service, legal requirements, or operational needs.
                  The current version published on the website will always apply.
                </p>
              </div>
            </>
          )}

          {tab === 'cookies' && (
            <>
              <h2 style={DocTitle}>Cookie Policy</h2>

              <p style={DocIntro}>
                This Cookie Policy explains how cookies and similar technologies are
                used on sharemechat.com and how users can manage them.
              </p>

              <div style={Section}>
                <h3 style={SectionTitle}>1. What Cookies Are</h3>
                <p style={Paragraph}>
                  Cookies are small files stored on your device when you browse a
                  website. They help the platform function properly, remember certain
                  settings, support security, and improve the overall service.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>2. Types of Cookies We May Use</h3>
                <p style={Paragraph}>
                  We may use strictly necessary cookies, preference cookies, security
                  cookies, and optional analytics cookies when an appropriate legal
                  basis exists.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>3. Essential Session Cookies</h3>
                <p style={Paragraph}>
                  Authentication-related cookies may be used to maintain logged-in
                  sessions, refresh secure tokens, and support account access. These
                  cookies are necessary for core platform functionality.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>4. Managing Cookie Settings</h3>
                <p style={Paragraph}>
                  You can manage or delete cookies through your browser settings.
                  Disabling strictly necessary cookies may prevent parts of the
                  service from functioning correctly, including account login and
                  session continuity.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>5. Third-Party Cookies</h3>
                <p style={Paragraph}>
                  If we integrate third-party services such as analytics, embedded
                  tools, or payment providers, those services may set their own
                  cookies in accordance with their own policies.
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>6. Controller Information</h3>
                <p style={Paragraph}>
                  Shareme Technologies OÜ
                  <br />
                  Registry code: 17444422
                  <br />
                  Lõõtsa tn 5, 11415 Tallinn, Harju maakond, Estonia
                  <br />
                  contact@sharemechat.com
                </p>
              </div>

              <div style={Section}>
                <h3 style={SectionTitle}>7. Changes to This Policy</h3>
                <p style={Paragraph}>
                  We may update this Cookie Policy to reflect changes in platform
                  functionality, third-party integrations, or legal requirements. The
                  current version published on the site will always be the applicable one.
                </p>
              </div>
            </>
          )}

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
