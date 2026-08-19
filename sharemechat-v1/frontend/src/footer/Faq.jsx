import React from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FooterInner, LegalText } from '../styles/public-styles/FooterStyles';
import Seo from '../components/Seo';

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

const AccordionItem = {
  borderBottom: '1px solid rgba(31,41,55,0.08)'
};

const QuestionRow = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
  padding: '18px 0',
  cursor: 'pointer',
  fontSize: '1.05rem',
  fontWeight: 600,
  color: '#1f2937',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const AnswerWrap = {
  paddingBottom: '18px'
};

const Answer = {
  margin: '0',
  fontSize: '0.95rem',
  lineHeight: '1.75',
  color: '#4b5563'
};

const Link = {
  color: '#1e3a8a',
  cursor: 'pointer',
  fontWeight: 500
};

const Chevron = ({ open }) => (
  <span style={{
    fontSize: '0.9rem',
    transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
    transition: 'transform 0.2s ease'
  }}>
    ▼
  </span>
);

export default function Faq() {
  const history = useHistory();
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = React.useState(null);

  const back = () => {
    // history.push('/') respeta el basename del Router: preserva /en bajo inglés
    // y va a / en español. (Antes goBack() se saltaba el basename y perdía /en.)
    history.push('/');
  };

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Contenido i18n (namespace translation, clave faqPage). Locale-aware: la
  // interfaz cambia ES/EN con el resto de la app. Antes estaba hardcoded en
  // inglés (se veía en inglés también bajo /es).
  const items = t('faqPage.items', { returnObjects: true });
  const faqs = Array.isArray(items) ? items : [];

  return (
    <>
      <Seo pageKey="faq" urlPath="/faq" localeAware />
      <div style={PageWrap}>
      <FooterInner>

        <div style={HeroBlock}>
          <button style={BackButton} onClick={back}>{t('faqPage.back')}</button>

          <h1 style={PageTitle}>{t('faqPage.title')}</h1>

          <p style={Intro}>{t('faqPage.intro')}</p>
        </div>

        <div style={ContentWrap}>

          {faqs.map((item, i) => (
            <div key={i} style={AccordionItem}>
              <button style={QuestionRow} onClick={() => toggle(i)}>
                {item.q}
                <Chevron open={openIndex === i} />
              </button>

              {openIndex === i && (
                <div style={AnswerWrap}>
                  <p style={Answer}>
                    {item.a}
                    {item.to && (
                      <>
                        {' '}
                        <span style={Link} onClick={() => history.push(item.to)}>
                          {item.toLabel}
                        </span>
                      </>
                    )}
                    {Array.isArray(item.links) && item.links.map((l, j) => (
                      <React.Fragment key={j}>
                        {j === 0 ? ' ' : ' · '}
                        <span style={Link} onClick={() => history.push(l.to)}>
                          {l.label}
                        </span>
                      </React.Fragment>
                    ))}
                  </p>
                </div>
              )}
            </div>
          ))}

          <div style={{ marginTop: '40px' }}>
            <LegalText style={{ color: '#6b7280', opacity: 1 }}>
              Shareme Technologies OÜ
              <br />
              Registry code: 17444422
              <br />
              Lõõtsa tn 5, 11415 Tallinn, Estonia
              <br />
              <a href="mailto:contact+web@sharemechat.com" style={{ color: 'inherit', textDecoration: 'underline' }}>contact@sharemechat.com</a>
            </LegalText>
          </div>

        </div>
      </FooterInner>
      </div>
    </>
  );
}
