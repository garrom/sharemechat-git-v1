import React from 'react';
import styled from 'styled-components';
import { useHistory } from 'react-router-dom';

const Wrap = styled.div`
  min-height: 100vh; display:flex; align-items:center; justify-content:center;
  background: #0d1117; color:#fff; padding: 24px;
`;
const Card = styled.div`
  max-width: 720px; width:100%; background:#161b22; border:1px solid #21262d;
  border-radius: 14px; padding: 28px;
`;
const Title = styled.h1`margin:0 0 8px; font-size: 32px;`;
const Sub = styled.p`margin:0 0 20px; color:#9aa1a9;`;
const Row = styled.div`display:flex; gap:10px; flex-wrap:wrap;`;
const Btn = styled.button`
  border:0; border-radius:10px; padding:10px 14px; font-weight:700; cursor:pointer;
  background:${p=>p.primary ? '#0d6efd' : '#30363d'}; color:#fff;
`;

const Home = () => {
  const history = useHistory();
  return (
    <Wrap>
      <Card>
        <Title>ShareMeChat</Title>
        <Sub>Videochat 1:1. Modelos verificadas. Acceso solo 18+.</Sub>
        <Row>
          <Btn primary onClick={() => history.push('/login')}>Entrar</Btn>
          <Btn onClick={() => history.push('/register-client')}>Registrarme como Cliente</Btn>
          <Btn onClick={() => history.push('/register-model')}>Registrarme como Modelo</Btn>
        </Row>
      </Card>
    </Wrap>
  );
};

export default Home;
