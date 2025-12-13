import React from 'react';
import styled from 'styled-components';
import { ButtonActivarCam } from '../styles/ButtonStyles';

const Wrap = styled.div`
  display:flex;
  flex-direction:column;
  gap:18px;
  padding:26px 22px;
  background:#0b1220;
  border-radius:18px;
  border:1px solid rgba(255,255,255,0.12);
  box-shadow:0 30px 90px rgba(0,0,0,0.65);
  color:#f9fafb;
  max-width:640px;
`;

const Title = styled.h2`
  margin:0;
  font-size:1.6rem;
  font-weight:900;
  line-height:1.1;
`;

const Subtitle = styled.p`
  margin:0;
  font-size:1.05rem;
  font-weight:700;
  opacity:.9;
`;

const Text = styled.p`
  margin:0;
  font-size:.95rem;
  color:#d1d5db;
`;

const Actions = styled.div`
  display:flex;
  justify-content:flex-end;
  gap:12px;
  margin-top:6px;
`;

export default function PublicSignupTeaserModal({ onClose }) {
  return (
    <Wrap>
      <Title>Regístrate y prueba GRATIS</Title>
      <Subtitle>Videochat con modelos reales</Subtitle>
      <Text>
        Accede al videochat en vivo con modelos reales.
        Registro rápido, sin compromisos y con pruebas gratuitas.
      </Text>

      <Actions>
        <ButtonActivarCam type="button" onClick={onClose}>
          Quiero Registrarme
        </ButtonActivarCam>
      </Actions>
    </Wrap>
  );
}
