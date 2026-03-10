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
  const [openIndex, setOpenIndex] = React.useState(null);

  const back = () => {
    if (window.history.length > 1) history.goBack();
    else history.push('/');
  };

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqs = [
    {
      q: "What is SharemeChat?",
      a: "SharemeChat is a live 1-to-1 video chat platform where users can connect with verified models in real time for private conversations inside the platform."
    },
    {
      q: "How does the video chat work?",
      a: "Once registered, you can start a live session and the system connects you with an available model. If you enjoy the interaction you can add that model to your contacts and interact again later."
    },
    {
      q: "Do I need to install anything?",
      a: "No. SharemeChat works directly in your browser using real-time video technology. You only need a webcam, internet connection and a modern browser."
    },
    {
      q: "Is SharemeChat free?",
      a: "Creating an account is free. Some users may receive limited promotional access or trials. Private video sessions operate using prepaid credits."
    },
    {
      q: "How do payments work?",
      a: "Sessions are paid using prepaid credits. Credits are purchased through simple one-time payments inside the platform. There are no subscriptions and no hidden charges."
    },
    {
      q: "Is payment secure?",
      a: "Yes. Payments are processed through trusted payment providers used by major online platforms. Sensitive payment details are handled by secure payment infrastructure."
    },
    {
      q: "Can I stop a session whenever I want?",
      a: "Yes. You can end a video session at any moment directly from the interface."
    },
    {
      q: "What happens if my connection drops?",
      a: "If a connection problem occurs the session automatically stops and the platform only counts the actual time the session was active."
    },
    {
      q: "Can I block someone?",
      a: "Yes. If you do not wish to interact with a particular user again you can block them from the platform."
    },
    {
      q: "Can I report inappropriate behaviour?",
      a: "Yes. Reporting tools allow users to flag abusive or suspicious behaviour. Reports are reviewed to maintain a safe environment."
    },
    {
      q: "Is SharemeChat safe?",
      a: "Security and privacy are extremely important. The platform uses moderation systems, monitoring tools and technical safeguards to protect both users and models."
    },
    {
      q: "Where can I read the platform rules?",
      a: (
        <>
          You can review the platform rules in our{" "}
          <span style={Link} onClick={() => history.push('/community-guidelines')}>
            Community Guidelines
          </span>{" "}
          and legal information in the{" "}
          <span style={Link} onClick={() => history.push('/legal?tab=terms')}>
            Terms of Service
          </span>.
        </>
      )
    }
  ];

  return (
    <div style={PageWrap}>
      <FooterInner>

        <div style={HeroBlock}>
          <button style={BackButton} onClick={back}>← Back</button>

          <h1 style={PageTitle}>Frequently Asked Questions</h1>

          <p style={Intro}>
            Here you can find answers to the most common questions about
            SharemeChat, how the platform works, and how sessions and payments operate.
          </p>
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
                  <p style={Answer}>{item.a}</p>
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
              contact@sharemechat.com
            </LegalText>
          </div>

        </div>
      </FooterInner>
    </div>
  );
}