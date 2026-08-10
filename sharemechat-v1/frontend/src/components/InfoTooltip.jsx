import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';

// Tooltip de ayuda para un campo de formulario. Envuelve al input (children) y
// pinta un icono (i) dentro del campo, a la derecha. Al activarlo, el mensaje
// aparece FLOTANDO por encima (position:absolute) -> no ocupa hueco ni desplaza
// los campos siguientes. Desktop: hover. Movil: tap (toggle). Cierra al tocar
// fuera o con Escape.
//
// Uso:
//   <InfoTooltip text={t('...')} ariaLabel={t('...')}>
//     <Input ... style={{ paddingRight: 44 }} />
//   </InfoTooltip>

const Wrap = styled.div`
  position: relative;
  width: 100%;
`;

// Contenedor solo del icono + globo. Los eventos de hover viven aqui (no en el
// input), asi que pasar el raton por el campo no dispara el tooltip.
const TipUnit = styled.span``;

const InfoBtn = styled.button`
  position: absolute;
  right: 13px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid #4b5563;
  background: transparent;
  color: #9ca3af;
  font-size: 12px;
  font-weight: 700;
  font-style: normal;
  line-height: 1;
  cursor: pointer;
  transition: border-color .15s ease, color .15s ease;
  &.active { border-color: #00f59d; color: #00f59d; }
  &:hover { border-color: #00f59d; color: #00f59d; }
  &:focus-visible { outline: 2px solid #00f59d; outline-offset: 2px; }
`;

const InfoPop = styled.div`
  position: absolute;
  z-index: 20;
  top: calc(100% + 9px);
  left: 0;
  right: 0;
  background: #0f172a;
  border: 1px solid #263449;
  border-radius: 12px;
  padding: 11px 13px;
  color: #dbe4f0;
  font-size: 0.78rem;
  line-height: 1.45;
  box-shadow: 0 16px 40px rgba(0,0,0,0.7);
  &::before {
    content: "";
    position: absolute;
    top: -7px;
    right: 16px;
    width: 12px;
    height: 12px;
    background: #0f172a;
    border-left: 1px solid #263449;
    border-top: 1px solid #263449;
    transform: rotate(45deg);
  }
`;

const InfoTooltip = ({ text, ariaLabel, children }) => {
  const [open, setOpen] = useState(false);
  const unitRef = useRef(null);
  const pointer = useRef('mouse');

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (unitRef.current && !unitRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <Wrap>
      {children}
      <TipUnit
        ref={unitRef}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(true); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setOpen(false); }}
      >
        <InfoBtn
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          className={open ? 'active' : ''}
          onPointerDown={(e) => { pointer.current = e.pointerType; }}
          onClick={() => { if (pointer.current !== 'mouse') setOpen((o) => !o); }}
        >
          i
        </InfoBtn>
        {open && <InfoPop role="tooltip">{text}</InfoPop>}
      </TipUnit>
    </Wrap>
  );
};

export default InfoTooltip;
