import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt,faBan } from '@fortawesome/free-solid-svg-icons';
import {
  SaldoText,
  QueueText,
  StyledNavActionsRow,
  StyledNavAvatar,
  StyledNavAvatarWrap,
} from '../../styles/NavbarStyles';
import { NavButton } from '../../styles/ButtonStyles';
import LocaleSwitcher from '../LocaleSwitcher';

const DesktopActions = ({
  queueText = null,
  balanceText = null,
  showLocaleSwitcher = true,
  primaryAction = null,
  secondaryAction = null,
  tertiaryAction = null,
  logoutLabel,
  logoutTitle,
  onLogout,
  logoutIconOnly = false,
  avatarUrl = null,
  avatarFallback = null,
  avatarTitle,
  onAvatarClick,
  showAvatar = true,
  wrapperClassName = 'desktop-only',
  useNavGroupAttr = true,
}) => {
  // ADR-049 Subpasada 2C: soporte opt-in para pills "icon-only" en el grupo
  // derecho del navbar. Cada action expone su propio flag `iconOnly`; cuando
  // es true, renderizamos solo el icono con padding compacto y anadimos
  // aria-label + title con la etiqueta como fallback semantico para
  // screen readers y tooltip nativo del navegador.
  const renderAction = (action) => {
    if (!action) return null;
    const iconOnly = !!action.iconOnly;
    return (
      <NavButton
        type="button"
        onClick={action.onClick}
        title={action.title || action.label}
        aria-label={iconOnly ? action.label : undefined}
        disabled={action.disabled}
        style={iconOnly ? { paddingInline: '12px' } : undefined}
      >
        {action.icon ? (
          <FontAwesomeIcon icon={action.icon} style={action.iconStyle} />
        ) : null}
        {!iconOnly ? <span>{action.label}</span> : null}
      </NavButton>
    );
  };
  return (
    <StyledNavActionsRow
      className={wrapperClassName}
      data-nav-group={useNavGroupAttr ? true : undefined}
    >
      {queueText ? <QueueText className="me-3">{queueText}</QueueText> : null}

      {balanceText ? <SaldoText className="me-3">{balanceText}</SaldoText> : null}

      {showLocaleSwitcher ? <LocaleSwitcher /> : null}

      {/* ADR-049 Subpasada 2C: el pill de Afiliada (tertiaryAction) va PRIMERO
          del grupo de acciones para destacar la seccion nueva mientras las
          utilitarias frecuentes (Stats/Withdraw/Logout) quedan icon-only al
          final. En NavbarClient tertiaryAction es null y el orden clasico se
          preserva. */}
      {renderAction(tertiaryAction)}

      {renderAction(primaryAction)}

      {renderAction(secondaryAction)}

      {logoutLabel ? (
        <NavButton
          type="button"
          onClick={onLogout}
          title={logoutTitle || logoutLabel}
          aria-label={logoutLabel}
          style={logoutIconOnly ? { paddingInline: '12px' } : undefined}
        >
          <FontAwesomeIcon icon={faSignOutAlt} />
          {!logoutIconOnly ? <span>{logoutLabel}</span> : null}
        </NavButton>
      ) : null}

      {showAvatar ? (
        <StyledNavAvatarWrap
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
        </StyledNavAvatarWrap>
      ) : null}
    </StyledNavActionsRow>
  );
};

export default DesktopActions;
