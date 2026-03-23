import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
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
  queueText = null,
  balanceText,
  showLocaleSwitcher = true,
  topRightContent = null,
  tabs = [],
  items = [],
}) => {
  const hasHeader =
    Boolean(queueText) ||
    Boolean(topRightContent) ||
    Boolean(balanceText);

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

      {hasHeader ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          {queueText ? <QueueText className="me-3">{queueText}</QueueText> : null}
          {topRightContent || (balanceText ? <SaldoText>{balanceText}</SaldoText> : null)}
        </div>
      ) : null}

      {showLocaleSwitcher ? (
        <LocaleSwitcher onAfterChange={() => closeMenu()} />
      ) : null}

      {items.map((item) => (
        <NavButton
          key={item.key}
          type="button"
          onClick={() => {
            if (!item.disabled) {
              item.onClick();
            }
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
