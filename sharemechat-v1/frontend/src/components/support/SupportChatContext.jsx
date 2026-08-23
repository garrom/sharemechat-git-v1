// Contexto de chat de soporte (2026-08-23). Comparte UNA sola instancia de
// useSupportChat entre el centro (SupportChat) y la 3ª columna
// (SupportSpotlight), para que ambos vean el mismo estado (mensajes, estado de
// resolución, rate limit, escalado) sin doble-polling ni divergencia.
//
// El hook solo hace polling REST en HUMAN_HANDLING; con dos instancias, la
// columna derecha no reflejaría los mensajes/estado del centro en modo IA.
//
// Uso: envolver el centro + la derecha (o el SupportChat de un ticket) en
// <SupportChatProvider>. SupportChat y SupportSpotlight leen vía
// useSupportChatCtx(). readOnly/ticketContext/dark siguen siendo props de vista.

import React, { createContext, useContext } from 'react';
import useSupportChat from '../../hooks/useSupportChat';

const SupportChatContext = createContext(null);

export function SupportChatProvider({ pinnedConversationId = null, children }) {
  const chat = useSupportChat({ pinnedConversationId });
  return (
    <SupportChatContext.Provider value={chat}>
      {children}
    </SupportChatContext.Provider>
  );
}

// Devuelve el estado compartido del chat de soporte. Lanza si se usa fuera del
// provider (error de integración, no de runtime del usuario).
export function useSupportChatCtx() {
  const ctx = useContext(SupportChatContext);
  if (ctx === null) {
    throw new Error('useSupportChatCtx debe usarse dentro de <SupportChatProvider>');
  }
  return ctx;
}

export default SupportChatContext;
