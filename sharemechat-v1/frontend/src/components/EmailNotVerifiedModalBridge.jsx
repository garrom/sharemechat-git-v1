import React, { useEffect, useRef } from 'react';
import { useSession } from './SessionProvider';
import { useModal } from './ModalProvider';
import { apiFetch } from '../config/http';
import { isEmailNotVerifiedError } from '../utils/apiErrors';

const EmailNotVerifiedModalBridge = () => {
  const { error, loading } = useSession();
  const { openModal, closeModal, alert } = useModal();
  const shownRef = useRef(false);
  const modalOpenRef = useRef(false);

  useEffect(() => {
    const shouldShow = !loading && isEmailNotVerifiedError(error);

    if (!shouldShow) {
      shownRef.current = false;
      return;
    }

    if (shownRef.current || modalOpenRef.current) {
      return;
    }

    shownRef.current = true;
    modalOpenRef.current = true;

    openModal({
      title: 'Email no verificado',
      variant: 'warning',
      size: 'sm',
      onClose: () => closeModal(),
      content: 'Debes validar tu email antes de continuar.',
      actions: [
        {
          label: 'Mas tarde',
          onClick: () => closeModal(false),
        },
        {
          label: 'Reenviar email',
          primary: true,
          onClick: async () => {
            try {
              await apiFetch('/email-verification/resend', { method: 'POST' });
              closeModal(true);
              await alert({
                title: 'Email reenviado',
                message: 'Te hemos reenviado el email de validacion.',
                variant: 'success',
                size: 'sm',
              });
            } catch (e) {
              closeModal(false);
              await alert({
                title: 'No se pudo reenviar',
                message: e?.data?.message || 'No se pudo reenviar el email de validacion.',
                variant: 'warning',
                size: 'sm',
              });
            }
          },
        },
      ],
    }).finally(() => {
      modalOpenRef.current = false;
    });
  }, [error, loading, openModal, closeModal, alert]);

  return null;
};

export default EmailNotVerifiedModalBridge;
