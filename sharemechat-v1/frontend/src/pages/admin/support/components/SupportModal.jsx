import React from 'react';
import styled from 'styled-components';

// Frente B.3.2 (ADR-046). Base de modal reutilizada por los 5 modales del
// panel (claim / resolve / profile create / profile edit / grant add). Calco
// del patron ModalBackdrop / ModalCard que ya usa AdminStreamModerationPanel;
// se extrae para no repetir 5 veces la misma cascada de styled-components.

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(20, 30, 45, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 12px;
  width: min(${(p) => p.$width || 540}px, calc(100% - 32px));
  max-height: calc(100vh - 48px);
  overflow: auto;
  padding: 22px 24px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.25);
`;

const Title = styled.h4`
  margin: 0 0 6px 0;
  font-size: 1.05rem;
  color: #162033;
`;

const Subtitle = styled.div`
  font-size: 0.85rem;
  color: #52607a;
  line-height: 1.45;
  margin-bottom: 14px;
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 18px;
`;

const SupportModal = ({
  title,
  subtitle,
  width,
  onClose,
  children,
  actions,
}) => (
  <Backdrop
    role="dialog"
    aria-modal="true"
    onMouseDown={(e) => {
      // Click en el backdrop cierra; click en la card no.
      if (e.target === e.currentTarget && typeof onClose === 'function') onClose();
    }}
  >
    <Card $width={width} onMouseDown={(e) => e.stopPropagation()}>
      {title ? <Title>{title}</Title> : null}
      {subtitle ? <Subtitle>{subtitle}</Subtitle> : null}
      {children}
      {actions ? <Actions>{actions}</Actions> : null}
    </Card>
  </Backdrop>
);

export default SupportModal;
