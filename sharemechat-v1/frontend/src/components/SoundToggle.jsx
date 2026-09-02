import React, { useState } from 'react';
import { isSoundsEnabled, setSoundsEnabled, playSound } from '../utils/sounds';

// Interruptor "Sonidos" (on/off) para los avisos sonoros de UX (llamada,
// regalos, mensajes, match). Preferencia por dispositivo (localStorage); el
// volumen lo gobierna el sistema, patrón estándar (WhatsApp/Telegram/Discord).
// Recibe `t` del padre (perfil) para i18n; funciona también sin `t`.
const SoundToggle = ({ t }) => {
  const [on, setOn] = useState(() => isSoundsEnabled());
  const tr = (k, def) => (typeof t === 'function' ? t(k, { defaultValue: def }) : def);

  const label = tr('profileCommon.sounds.label', 'Sonidos');
  const desc = tr('profileCommon.sounds.desc', 'Avisos sonoros de llamada, regalos y mensajes.');

  const toggle = () => {
    const next = !on;
    setOn(next);
    setSoundsEnabled(next);
    if (next) playSound('message'); // pequeño feedback al activar
  };

  const card = {
    background: '#ffffff', border: '1px solid rgba(31,41,55,0.10)', borderRadius: '14px',
    padding: '18px 20px', marginTop: '18px',
  };
  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' };
  const txt = { minWidth: 0 };
  const lab = { margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#1f2937' };
  const ds = { margin: '2px 0 0', fontSize: '0.84rem', color: '#6b7280' };
  const sw = {
    position: 'relative', width: '46px', height: '26px', flex: 'none',
    borderRadius: '999px', border: 'none', cursor: 'pointer',
    background: on ? '#ea1d1d' : '#cbd0d8', transition: 'background .15s', padding: 0,
  };
  const knob = {
    position: 'absolute', top: '3px', left: on ? '23px' : '3px',
    width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
    transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.25)',
  };

  return (
    <div style={card}>
    <div style={row}>
      <div style={txt}>
        <p style={lab}>🔊 {label}</p>
        <p style={ds}>{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={toggle}
        style={sw}
      >
        <span style={knob} />
      </button>
    </div>
    </div>
  );
};

export default SoundToggle;
