import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  NavText,
  SaldoText,
  QueueText,
  MobileMenu as StyledMobileMenu,
} from '../../styles/NavbarStyles';
import { StyledIconWrapper } from '../../styles/pages-styles/VideochatStyles';
import { NavButton } from '../../styles/ButtonStyles';
import LocaleSwitcher from '../LocaleSwitcher';

const MobileMenu = ({
  menuOpen,
  closeMenu,
  displayName,
  queueText = null,
  balanceText,
  showLocaleSwitcher = true,
  topRightContent = null,
  items = [],
}) => {
  return (
    <StyledMobileMenu className={!menuOpen ? 'hidden' : ''}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        {queueText ? <QueueText className="me-3">{queueText}</QueueText> : null}
        <NavText>{displayName}</NavText>
        {topRightContent || <SaldoText>{balanceText}</SaldoText>}
      </div>

      {showLocaleSwitcher ? (
        <LocaleSwitcher onAfterChange={() => closeMenu()} />
      ) : null}

      {items.map((item) => (
        <NavButton
          key={item.key}
          type="button"
          onClick={() => {
            item.onClick();
            closeMenu();
          }}
          title={item.title}
          disabled={item.disabled}
        >
          {item.icon ? <FontAwesomeIcon icon={item.icon} style={item.iconStyle} /> : null}

          {item.useIconWrapper ? (
            <StyledIconWrapper>{item.label}</StyledIconWrapper>
          ) : (
            <span>{item.label}</span>
          )}
        </NavButton>
      ))}
    </StyledMobileMenu>
  );
};

export default MobileMenu;