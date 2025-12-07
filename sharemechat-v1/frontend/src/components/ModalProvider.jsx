// src/components/ModalProvider.jsx
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import ModalBase from './ModalBase';

const ModalCtx = createContext(null);

/**
 * ModalProvider: renderiza un ModalBase controlado y expone helpers:
 *  - openModal(options) => Promise(resolveValue)
 *  - closeModal()
 * Helpers: alert, confirm, selectOptions
 */
export const ModalProvider = ({ children }) => {
  const [modal, setModal] = useState({ open: false });

  const closeModal = useCallback((returnValue = undefined) => {
    setModal((m) => {
      m._resolver?.(returnValue);
      return { open: false };
    });
  }, []);

  const openModal = useCallback((opts) => {
    // opts: { title, content, actions, variant, size, bodyKind, onClose, hideChrome }
    return new Promise((resolve) => {
      setModal({
        open: true,
        ...opts,
        _resolver: resolve,
      });
    });
  }, []);

  // Helpers
  const alert = useCallback(
    ({ title = 'Aviso', message, variant = 'info', size = 'sm' }) => {
      return openModal({
        title,
        content: message,
        variant,
        size,
        actions: [{ label: 'OK', primary: true, autoFocus: true, onClick: () => closeModal(true) }],
      });
    },
    [openModal, closeModal]
  );

  const confirm = useCallback(
    ({ title = 'Confirmar', message, okText = 'Aceptar', cancelText = 'Cancelar', variant = 'confirm', size = 'sm', danger = false }) => {
      return new Promise((resolve) => {
        openModal({
          title,
          content: message,
          variant,
          size,
          actions: [
            { label: cancelText, onClick: () => { closeModal(false); resolve(false); } },
            { label: okText, primary: !danger, danger, onClick: () => { closeModal(true); resolve(true); } },
          ],
        }).then(() => {}); // evitar doble resolución
      });
    },
    [openModal, closeModal]
  );

  const selectOptions = useCallback(
    ({ title = 'Elige una opción', options = [], size = 'sm' }) => {
      // options: [{ label, value }]
      return new Promise((resolve) => {
        openModal({
          title,
          variant: 'select',
          size,
          bodyKind: 'choices',
          content: (
            <div>
              {options.map((opt, i) => (
                <button key={i} onClick={() => { closeModal(opt.value); resolve(opt.value); }}>
                  {opt.label}
                </button>
              ))}
            </div>
          ),
          actions: [{ label: 'Cerrar', onClick: () => { closeModal(undefined); resolve(undefined); } }],
        }).then(() => {});
      });
    },
    [openModal, closeModal]
  );

  const value = useMemo(
    () => ({ openModal, closeModal, alert, confirm, selectOptions }),
    [openModal, closeModal, alert, confirm, selectOptions]
  );

  return (
    <ModalCtx.Provider value={value}>
      {children}
      {/* Render del modal controlado */}
      <ModalBase
        open={modal.open}
        onClose={() => {
          // Si el modal trae onClose personalizado, delegamos en él.
          // Si no, cerramos por defecto.
          if (modal.onClose) {
            modal.onClose();
          } else {
            closeModal();
          }
        }}
        title={modal.title}
        variant={modal.variant}
        size={modal.size}
        bodyKind={modal.bodyKind}
        hideChrome={modal.hideChrome}
        actions={(modal.actions || []).map((a) => ({
          ...a,
          onClick: (e) => {
            a.onClick?.(e);
          },
        }))}
      >
        {modal.content}
      </ModalBase>
    </ModalCtx.Provider>
  );
};

export const useModal = () => {
  const ctx = useContext(ModalCtx);
  if (!ctx) throw new Error('useModal must be used within <ModalProvider/>');
  return ctx;
};
