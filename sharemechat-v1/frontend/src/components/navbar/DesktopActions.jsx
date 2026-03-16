import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
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
  balanceText,
  showLocaleSwitcher = true,
  primaryAction = null,
  secondaryAction = null,
  logoutLabel,
  logoutTitle,
  onLogout,
  avatarUrl,
  avatarFallback,
  avatarTitle,
  onAvatarClick,
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

      <SaldoText className="me-3">{balanceText}</SaldoText>

      {showLocaleSwitcher ? <LocaleSwitcher /> : null}

      {primaryAction ? (
        <NavButton
          type="button"
          onClick={primaryAction.onClick}
          title={primaryAction.title}
        >
          {primaryAction.icon ? <FontAwesomeIcon icon={primaryAction.icon} style={primaryAction.iconStyle} /> : null}
          <span>{primaryAction.label}</span>
        </NavButton>
      ) : null}

      {secondaryAction ? (
        <NavButton
          type="button"
          onClick={secondaryAction.onClick}
          title={secondaryAction.title}
        >
          {secondaryAction.icon ? <FontAwesomeIcon icon={secondaryAction.icon} style={secondaryAction.iconStyle} /> : null}
          <span>{secondaryAction.label}</span>
        </NavButton>
      ) : null}

      <NavButton type="button" onClick={onLogout} title={logoutTitle}>
        <FontAwesomeIcon icon={faSignOutAlt} />
        <span>{logoutLabel}</span>
      </NavButton>

      <StyledNavAvatar
        src={avatarUrl || avatarFallback}
        alt="avatar"
        title={avatarTitle}
        onClick={onAvatarClick}
      />
    </div>
  );
};

export default DesktopActions;