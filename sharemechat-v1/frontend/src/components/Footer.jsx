import React from 'react';
import styled from 'styled-components';

const StyledFooter = styled.footer`
  text-align: center;
  font-size: 14px;
  color: #adb5bd;
  padding: 12px 0;
  background: #111;
  border-top: 1px solid #222;
`;

export default function Footer() {
  return (
    <StyledFooter>
      <p>© Sharemechat 2025. Todos los derechos reservados™</p>
    </StyledFooter>
  );
}
