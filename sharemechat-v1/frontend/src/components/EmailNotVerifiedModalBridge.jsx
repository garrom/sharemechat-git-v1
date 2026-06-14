import React, { useEffect, useRef } from 'react';
import i18n from '../i18n';
import { useModal } from './ModalProvider';
import { apiFetch } from '../config/http';

const tk = (key) => i18n.t(key);

/**
 * Bridge global del modal "verifica tu email". Frente "Email verification
 * gate total" (2026-06-15).
 *
 * Escucha el CustomEvent `email-not-verified` emitido por apiFetch cuando
 * detecta un 403 con code=EMAIL_NOT_VERIFIED. El error sigue propagandose
 * al caller; este componente solo se encarga de abrir el modal sin que
 * cada caller tenga que detectar el codigo inline.
 *
 * Antes (commit 7e84d02 y previos) leia `error` desde useSession(), pero
 * ese error nunca se seteaba para 401/403 (SessionProvider los trata como
 * logout). Resultado: el modal nunca aparecia. Ahora si.
 */
const EmailNotVerifiedModalBridge = () => {
  const { openModal, closeModal, alert } = useModal();
  const modalOpenRef = useRef(false);

  useEffect(() => {
    const handler = () => {
      if (modalOpenRef.current) return;
      modalOpenRef.current = true;

      openModal({
        title: tk('emailVerification.modal.title'),
        variant: 'warning',
        size: 'sm',
        onClose: () => closeModal(),
        content: tk('emailVerification.modal.body'),
        actions: [
          {
            label: tk('emailVerification.modal.close'),
            onClick: () => closeModal(false),
          },
          {
            label: tk('emailVerification.modal.resend.cta'),
            primary: true,
            onClick: async () => {
              try {
                await apiFetch('/email-verification/resend', { method: 'POST' });
                closeModal(true);
                await alert({
                  title: tk('emailVerification.modal.title'),
                  message: tk('emailVerification.modal.resend.success'),
                  variant: 'success',
                  size: 'sm',
                });
              } catch (e) {
                closeModal(false);
                await alert({
                  title: tk('emailVerification.modal.title'),
                  message: (e && e.data && e.data.message) || tk('emailVerification.modal.resend.error'),
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
    };

    window.addEventListener('email-not-verified', handler);
    return () => {
      window.removeEventListener('email-not-verified', handler);
    };
  }, [openModal, closeModal, alert]);

  return null;
};

export default EmailNotVerifiedModalBridge;
