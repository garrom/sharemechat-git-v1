// EmojiTextPicker.jsx
// Boton 😊 en el composer que abre un panel de emojis unicode para INSERTAR
// en el texto que se escribe (Fase 2, parte selector). Distinto de los
// emojis-regalo de la barra (que se ENVIAN como mensaje). Autocontenido:
// gestiona su apertura/cierre y el click-fuera. No depende de backend.
//
// Uso:
//   <EmojiTextPicker onInsert={(e) => setCenterInput((v) => (v || '') + e)} disabled={!allowChat} />
import React, { useState, useRef, useEffect } from 'react';

const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎',
  '🥰', '😜', '🤗', '🤩', '😌', '😏', '😉', '😳',
  '🤭', '🙈', '😴', '🥳', '😭', '😅', '🤔', '😻',
  '🔥', '💦', '💋', '❤️', '💕', '💖', '💯', '✨',
  '👍', '👏', '🙌', '👌', '🌹', '🍑', '🍆',
];

export default function EmojiTextPicker({ onInsert, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        disabled={disabled}
        aria-label="Emojis"
        title="Emojis"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.09)',
          background: open ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)',
          color: '#fff',
          fontSize: 18,
          lineHeight: 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        😊
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Selector de emojis"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: 0,
            zIndex: 60,
            width: 'min(320px, 78vw)',
            background: '#1b2028',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 14,
            padding: 10,
            boxShadow: '0 18px 44px rgba(0,0,0,0.55)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 2,
              maxHeight: 180,
              overflowY: 'auto',
            }}
          >
            {EMOJIS.map((e, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { if (typeof onInsert === 'function') onInsert(e); }}
                aria-label={e}
                style={{
                  border: 0,
                  background: 'transparent',
                  fontSize: 20,
                  lineHeight: 1,
                  padding: 5,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
