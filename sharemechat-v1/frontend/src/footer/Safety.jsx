import React from 'react';
import { useHistory } from 'react-router-dom';
import { FooterInner, LegalText } from '../styles/public-styles/FooterStyles';

const PageWrap = { background: '#ffffff', color: '#1f2937', padding: '44px 0 72px' };
const HeroBlock = { maxWidth: '920px', margin: '0 auto' };

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

const ContentWrap = { maxWidth: '920px', margin: '34px auto 0' };

const Section = { marginBottom: '28px' };

const SectionTitle = {
  margin: '0 0 10px 0',
  fontSize: '1.1rem',
  fontWeight: 600
};

const Text = {
  margin: '0',
  fontSize: '0.95rem',
  lineHeight: '1.75',
  color: '#4b5563'
};

export default function Safety() {

  const history = useHistory();

  const back = () => {
    if (window.history.length > 1) history.goBack();
    else history.push('/');
  };

  return (
    <div style={PageWrap}>
      <FooterInner>

        <div style={HeroBlock}>

          <button style={BackButton} onClick={back}>← Back</button>

          <h1 style={PageTitle}>Safety & Security</h1>

          <p style={Intro}>
            The safety of our users is extremely important to us. SharemeChat
            uses technical safeguards, moderation systems and security policies
            designed to protect both users and models while using the platform.
          </p>

        </div>

        <div style={ContentWrap}>

          <div style={Section}>
            <h2 style={SectionTitle}>User Protection</h2>
            <p style={Text}>
              SharemeChat implements monitoring systems and moderation tools
              to detect abusive behaviour, fraud attempts and violations of the
              platform rules. Sessions may be terminated and accounts suspended
              if suspicious activity is detected.
            </p>
          </div>

          <div style={Section}>
            <h2 style={SectionTitle}>Privacy</h2>
            <p style={Text}>
              We take privacy seriously. Personal data and technical information
              are handled according to our Privacy Policy and applicable data
              protection laws. Users should avoid sharing personal contact
              information with people they meet online.
            </p>
          </div>

          <div style={Section}>
            <h2 style={SectionTitle}>Moderation</h2>
            <p style={Text}>
              The platform may use automated tools as well as human moderation
              to maintain a safe environment. Reports submitted by users are
              reviewed and may lead to warnings, session termination, temporary
              suspension or permanent bans.
            </p>
          </div>

          <div style={Section}>
            <h2 style={SectionTitle}>Reporting Abuse</h2>
            <p style={Text}>
              If you encounter inappropriate behaviour you should end the
              session and report the user through the platform tools whenever
              possible. Reports help improve the safety of the community.
            </p>
          </div>

          <div style={Section}>
            <h2 style={SectionTitle}>Protection of Minors</h2>
            <p style={Text}>
              SharemeChat is strictly intended for adults aged 18 and older.
              Accounts suspected of belonging to minors may be suspended and
              age verification may be requested when necessary.
            </p>
          </div>

          <div style={Section}>
            <h2 style={SectionTitle}>Tips for Safe Use</h2>
            <p style={Text}>
              For a safe experience we recommend that users avoid sharing
              personal contact information, financial details or private data
              during conversations. If something makes you uncomfortable you
              should immediately end the session.
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