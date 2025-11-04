//Home.jsx
import React from 'react';
import { useHistory } from 'react-router-dom';
import { Wrap, Card, Title, Sub, Row, Btn, StyledBrand } from '../styles/public-styles/HomeStyles';

const Home = () => {
  const history = useHistory();
  return (
    <Wrap>
      <Card>
        <StyledBrand href="/" aria-label="SharemeChat">ShareMeChat</StyledBrand>
        <Title>Welcome</Title>
        <Sub>Videochat 1:1. Modelos verificadas. Acceso solo 18+.</Sub>
        <Row>
          <Btn $primary onClick={() => history.push('/login')}>Entrar</Btn>
          <Btn onClick={() => history.push('/register-client')}>Registrarme como Cliente</Btn>
          <Btn onClick={() => history.push('/register-model')}>Registrarme como Modelo</Btn>
        </Row>
      </Card>
    </Wrap>
  );
};

export default Home;
