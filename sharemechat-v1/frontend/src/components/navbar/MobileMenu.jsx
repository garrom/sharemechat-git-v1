import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  NavText,
  SaldoText,
  QueueText,
  MobileMenu as StyledMobileMenu,
  MobileMenuTabs,
  MobileMenuTabButton,
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
  tabs = [],
  items = [],
}) => {
  return (
    <StyledMobileMenu className={!menuOpen ? 'hidden' : ''}>
      {tabs.length > 0 ? (
        <MobileMenuTabs>
          {tabs.map((tab) => (
            <MobileMenuTabButton
              key={tab.key}
              type="button"
              $active={tab.active}
              onClick={() => {
                tab.onClick();
                closeMenu();
              }}
              title={tab.label}
            >
              {tab.label}
            </MobileMenuTabButton>
          ))}
        </MobileMenuTabs>
      ) : null}

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