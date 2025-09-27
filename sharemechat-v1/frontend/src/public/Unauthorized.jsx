import React from 'react';
import { useHistory } from 'react-router-dom';
import { Center, Card, Title, Subtitle, ButtonPrimary } from '../styles/PublicShellStyles';

const Unauthorized = () => {
  const history = useHistory();
  return (
    <Center>
      <Card>
        <Title $danger>401 - No autorizado</Title>
        <Subtitle>No tienes permisos para acceder a esta página.</Subtitle>
        <ButtonPrimary type="button" onClick={() => history.push('/')}>
          Ir al login
        </ButtonPrimary>
      </Card>
    </Center>
  );
};

export default Unauthorized;
