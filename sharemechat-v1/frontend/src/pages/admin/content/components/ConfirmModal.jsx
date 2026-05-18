// src/pages/admin/content/components/ConfirmModal.jsx
//
// Modal de confirmacion reutilizable del CMS admin (paquete 7 bloque 4).
//
// Sustituye los `window.confirm` y `window.prompt` que usaba el editor de
// articulos del CMS. Aporta UI consistente con el resto del admin y permite
// estilizar destructive vs neutro segun el caso.
//
// Tres modos de uso:
//
//  1. Confirm simple (si/no): pasar `title`, `message`, `onConfirm`,
//     `onCancel`. No pasar `inputLabel`. Botones: Confirmar / Cancelar.
//
//  2. Confirm destructivo: pasar `tone="danger"`. El boton primario se
//     estiliza con `DangerButton`. Util para retract, delete, etc.
//
//  3. Confirm con input (sustituto de window.prompt): pasar `inputLabel`
//     y opcionalmente `inputPlaceholder` y `inputRequired`. Se anade un
//     campo de texto y `onConfirm` recibe el valor escrito.
//
// El modal cierra al pulsar fuera de la hoja, al pulsar Cancelar o al
// confirmar. Si se cancela, `onCancel` recibe `null` (o no se llama si
// no se ha pasado). Si se confirma con input, `onConfirm(textValue)`; sin
// input, `onConfirm()`.
//
// El estilo reutiliza los styled-components del modal de preview existente
// (PreviewOverlay, PreviewSheet, PreviewHeaderBar) para mantener
// consistencia visual en el admin.

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyledButton, StyledInput } from '../../../../styles/AdminStyles';
import {
  DangerButton,
  PreviewHeaderBar,
  PreviewOverlay,
  PreviewSheet,
  ToolbarRow,
  HelperText,
} from '../../../../styles/pages-styles/AdminContentStyles';

const ConfirmModal = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'default', // 'default' | 'danger'
  inputLabel = null,
  inputPlaceholder = '',
  inputRequired = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation('cms');
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');

  // Reset estado al abrir/cerrar.
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setInputError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasInput = inputLabel != null;
  const Primary = tone === 'danger' ? DangerButton : StyledButton;

  const handleConfirm = () => {
    if (hasInput) {
      const trimmed = (inputValue || '').trim();
      if (inputRequired && !trimmed) {
        setInputError(t('confirmModal.errInputRequired',
          'Este campo es obligatorio para continuar.'));
        return;
      }
      onConfirm(trimmed || null);
      return;
    }
    onConfirm();
  };

  const handleCancel = () => {
    if (typeof onCancel === 'function') onCancel(null);
  };

  const handleOverlayClick = () => {
    // Click fuera de la hoja = cancelar. Misma convencion que el modal de
    // preview del editor (PreviewOverlay onClick close).
    handleCancel();
  };

  return (
    <PreviewOverlay onClick={handleOverlayClick}>
      <PreviewSheet
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <PreviewHeaderBar>
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <StyledButton type="button" onClick={handleCancel}>
            {t('confirmModal.btnX', '✕')}
          </StyledButton>
        </PreviewHeaderBar>

        <div style={{ padding: '0 12px 12px', fontSize: 13, color: '#334155' }}>
          {message}
        </div>

        {hasInput ? (
          <div style={{ padding: '0 12px 12px' }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>
              {inputLabel}
            </label>
            <StyledInput
              type="text"
              value={inputValue}
              placeholder={inputPlaceholder}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (inputError) setInputError('');
              }}
              autoFocus
            />
            {inputError ? (
              <HelperText style={{ color: '#b91c1c' }}>{inputError}</HelperText>
            ) : null}
          </div>
        ) : null}

        <ToolbarRow style={{ padding: '0 12px 12px', justifyContent: 'flex-end' }}>
          <StyledButton type="button" onClick={handleCancel}>
            {cancelLabel || t('confirmModal.btnCancel', 'Cancelar')}
          </StyledButton>
          <Primary type="button" onClick={handleConfirm}>
            {confirmLabel || t('confirmModal.btnConfirm', 'Confirmar')}
          </Primary>
        </ToolbarRow>
      </PreviewSheet>
    </PreviewOverlay>
  );
};

export default ConfirmModal;
