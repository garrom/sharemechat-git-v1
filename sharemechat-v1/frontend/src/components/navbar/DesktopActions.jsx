import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt,faBan } from '@fortawesome/free-solid-svg-icons';
import {
  NavText,
  SaldoText,
  QueueText,
  StyledNavAvatar,
} from '../../styles/NavbarStyles';
import { NavButton } from '../../styles/ButtonStyles';
import LocaleSwitcher from '../LocaleSwitcher';

const DesktopActions = ({
  displayName,
  queueText = null,
  balanceText = null,
  showLocaleSwitcher = true,
  primaryAction = null,
  secondaryAction = null,
  logoutLabel,
  logoutTitle,
  onLogout,
  avatarUrl = null,
  avatarFallback = null,
  avatarTitle,
  onAvatarClick,
  showAvatar = true,
  wrapperClassName = 'desktop-only',
  useNavGroupAttr = true,
}) => {
  return (
    <div
      className={wrapperClassName}
      data-nav-group={useNavGroupAttr ? true : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}
    >
      {queueText ? <QueueText className="me-3">{queueText}</QueueText> : null}

      <NavText className="me-3">{displayName}</NavText>

      {balanceText ? <SaldoText className="me-3">{balanceText}</SaldoText> : null}

      {showLocaleSwitcher ? <LocaleSwitcher /> : null}

      {primaryAction ? (
        <NavButton
          type="button"
          onClick={primaryAction.onClick}
          title={primaryAction.title}
          disabled={primaryAction.disabled}
        >
          {primaryAction.icon ? (
            <FontAwesomeIcon icon={primaryAction.icon} style={primaryAction.iconStyle} />
          ) : null}
          <span>{primaryAction.label}</span>
        </NavButton>
      ) : null}

      {secondaryAction ? (
        <NavButton
          type="button"
          onClick={secondaryAction.onClick}
          title={secondaryAction.title}
          disabled={secondaryAction.disabled}
        >
          {secondaryAction.icon ? (
            <FontAwesomeIcon icon={secondaryAction.icon} style={secondaryAction.iconStyle} />
          ) : null}
          <span>{secondaryAction.label}</span>
        </NavButton>
      ) : null}

      <NavButton type="button" onClick={onLogout} title={logoutTitle}>
        <FontAwesomeIcon icon={faSignOutAlt} />
        <span>{logoutLabel}</span>
      </NavButton>

      {showAvatar ? (
        <div
          style={{ position: 'relative', display: 'inline-block' }}
          className={!onAvatarClick ? 'disabled-avatar-wrap' : undefined}
        >
          <StyledNavAvatar
            src={avatarUrl || avatarFallback}
            alt="avatar"
            title={avatarTitle}
            onClick={onAvatarClick}
            style={
              onAvatarClick
                ? undefined
                : { opacity: 0.55, cursor: 'not-allowed' }
            }
          />

          {!onAvatarClick && (
            <span
              className="disabled-avatar-ban"
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                fontSize: '0.75rem',
                color: '#ef4444',
                background: '#020617',
                borderRadius: '50%',
                padding: '2px',
                lineHeight: 1,
                opacity: 0,
                pointerEvents: 'none',
                transition: 'opacity .15s ease',
              }}
            >
              <FontAwesomeIcon icon={faBan} />
            </span>
          )}

          {!onAvatarClick && (
            <style>{`
              .disabled-avatar-wrap:hover .disabled-avatar-ban {
                opacity: 1;
              }
            `}</style>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default DesktopActions;