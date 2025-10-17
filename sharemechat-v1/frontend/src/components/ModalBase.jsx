import React, { useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Backdrop, Wrapper, Dialog, Header, Title, CloseBtn, Body, Footer, ModalBtn } from '../styles/ModalStyles';

/**
 * Modal base reusable
 * Props:
 * - open (bool)
 * - onClose () => void
 * - title (string|node)
 * - children (node)
 * - actions: [{ label, onClick, primary, danger, autoFocus }]
 * - size: 'sm' | 'md' | 'lg'
 * - variant: 'info' | 'success' | 'warning' | 'danger' | 'confirm' | 'select'
 * - icon: node opcional (en header)
 * - closeOnBackdrop = true
 * - closeOnEsc = true
 * - bodyKind: 'default' | 'choices'  (para listas de opciones rápidas)
 */
const ModalBase = ({
  open,
  onClose,
  title,
  children,
  actions = [],
  size = 'md',
  variant = 'info',
  icon = null,
  closeOnBackdrop = true,
  closeOnEsc = true,
  bodyKind = 'default',
}) => {
  const dialogRef = useRef(null);
  const lastFocusedRef = useRef(null);

  // bloquear scroll del body
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  // recordar foco anterior y hacer focus trap
  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = document.activeElement;
    const el = dialogRef.current;
    if (!el) return;

    const focusables = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    if (first && typeof first.focus === 'function') first.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && closeOnEsc) {
        e.stopPropagation();
        onClose?.();
      }
      if (e.key === 'Tab') {
        // simple trap
        const nodes = Array.from(focusables);
        if (!nodes.length) return;
        const currentIdx = nodes.indexOf(document.activeElement);
        if (e.shiftKey) {
          // back
          if (currentIdx <= 0) {
            e.preventDefault();
            nodes[nodes.length - 1].focus();
          }
        } else {
          // forward
          if (currentIdx === nodes.length - 1) {
            e.preventDefault();
            nodes[0].focus();
          }
        }
      }
    };
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, closeOnEsc]);

  // devolver foco al cerrar
  useEffect(() => {
    if (open) return;
    const prev = lastFocusedRef.current;
    if (prev && typeof prev.focus === 'function') {
      prev.focus();
    }
  }, [open]);

  const handleBackdrop = useCallback(() => {
    if (closeOnBackdrop) onClose?.();
  }, [closeOnBackdrop, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <>
      <Backdrop onClick={handleBackdrop} />
      <Wrapper aria-hidden={false}>
        <Dialog
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          data-variant={variant}
          $size={size}
        >
          <Header>
            {icon}
            <Title id="modal-title">{title}</Title>
            <CloseBtn
              aria-label="Cerrar"
              onClick={() => onClose?.()}
              title="Cerrar"
            >
              ×
            </CloseBtn>
          </Header>

          <Body data-kind={bodyKind}>
            {children}
          </Body>

          <Footer>
            {actions.map((a, i) => (
              <ModalBtn
                key={i}
                data-primary={a.primary ? 'true' : 'false'}
                data-danger={a.danger ? 'true' : 'false'}
                autoFocus={a.autoFocus}
                onClick={a.onClick}
                type={a.type || 'button'}
              >
                {a.label}
              </ModalBtn>
            ))}
          </Footer>
        </Dialog>
      </Wrapper>
    </>,
    document.body
  );
};

export default ModalBase;
