// src/components/useAppModals.js
import { useCallback } from 'react';
import styled from 'styled-components';
import { useHistory, useLocation } from 'react-router-dom';
import { useModal } from './ModalProvider';
import LoginModalContent from './LoginModalContent';

/**
 * Tipos de contexto para el modal de compra:
 *  - 'random'               → streaming aleatorio
 *  - 'calling'              → llamada 1 a 1
 *  - 'insufficient-balance' → disparado por "saldo insuficiente"
 *  - 'manual'               → botones de "añadir saldo/minutos"
 *
 * NO son obligatorios, pero ayudan si luego quieres afinar textos.
 */

// === Packs por defecto (TEMPORAL, luego se sacarán de BBDD/backend) ===
const DEFAULT_PACKS = [
  { id: 'P5', minutes: 5, price: 5, currency: 'EUR' },
  { id: 'P15', minutes: 15, price: 12, currency: 'EUR', recommended: true },
  { id: 'P30', minutes: 30, price: 27, currency: 'EUR' },
  { id: 'P45', minutes: 45, price: 40, currency: 'EUR' },
];

// === Estilos específicos para el modal de compra ===
const PacksGrid = styled.div`display:grid;gap:10px;margin:4px 0;grid-template-columns:1fr;@media (min-width:640px){grid-template-columns:repeat(2,minmax(0,1fr));}}`;
const PackCard = styled.button`display:flex;flex-direction:column;align-items:flex-start;gap:4px;width:100%;padding:10px 12px;border-radius:10px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;cursor:pointer;text-align:left;transition:background .15s ease,border-color .15s ease,transform .1s ease;&:hover{background:#11161d;border-color:#3a3f46;transform:translateY(-1px);}}`;
const PackHeader = styled.div`display:flex;align-items:center;justify-content:space-between;width:100%;`;
const PackMinutes = styled.span`font-weight:600;font-size:15px;`;
const PackPrice = styled.span`font-weight:600;font-size:15px;`;
const PackTag = styled.span`display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;background:#1f6feb22;color:#58a6ff;`;
const PackHint = styled.span`font-size:12px;color:#8b949e;`;
const PayoutInput = styled.input`width:100%;padding:8px 10px;border-radius:6px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:14px;margin-top:6px;outline:none;&:focus{border-color:#58a6ff;box-shadow:0 0 0 1px #58a6ff44;}}`;

//###########
//## HOOK
//#########
export const useAppModals = () => {
  const { alert, confirm, openModal, closeModal } = useModal();
  const history = useHistory();
  const location = useLocation();

  /** Confirmación al eliminar un favorito. */
  const openRemoveFavoriteConfirm = useCallback(async (displayName = 'este usuario') => {
    const ok = await confirm({ title:'Eliminar de favoritos', message:`¿Seguro que quieres eliminar a ${displayName} de tus favoritos?`, okText:'Eliminar', cancelText:'Cancelar', variant:'confirm', size:'sm', danger:true });
    return ok;
  }, [confirm]);

  /** Aviso típico cuando el contacto no está conectado / disponible y tratamos de llamar. */
  const openCallOfflineNotice = useCallback(async (displayName = 'este usuario') => {
    await alert({ title:'Usuario no disponible', message:`${displayName} no está conectado en este momento.`, variant:'info', size:'sm' });
  }, [alert]);

  /** Aviso cuando el usuario intenta salir teniendo una comunicación activa. */
  const openActiveSessionGuard = useCallback(async ({ hasStreaming, hasCalling }) => {
    const active = !!hasStreaming || !!hasCalling;
    if (!active) return true;
    await alert({ title:'Comunicación activa', message:'Tienes un streaming activo. Pulsa COLGAR para salir.', variant:'warning', size:'sm' });
    return false;
  }, [alert]);

  /** Modal de selección de pack de minutos / saldo. */
  const openPurchaseModal = useCallback(({ packs, currency = 'EUR', context = 'manual' } = {}) => {
    const effectivePacks = Array.isArray(packs) && packs.length > 0 ? packs : DEFAULT_PACKS;
    if (!effectivePacks.length) return Promise.resolve({ confirmed:false });

    const titleByContext = (() => {
      if (context === 'insufficient-balance') return 'Saldo insuficiente';
      if (context === 'random') return 'Añadir minutos para seguir chateando';
      if (context === 'calling') return 'Añadir minutos para la llamada';
      if (context === 'gift') return 'Saldo insuficiente para regalos';
      return 'Añadir minutos';
    })();

    const subtitleByContext = (() => {
      if (context === 'insufficient-balance') return 'Elige un pack de minutos para continuar usando el servicio.';
      if (context === 'random') return 'Selecciona un pack para seguir en el videochat.';
      if (context === 'calling') return 'Selecciona un pack para continuar con la llamada 1 a 1.';
      if (context === 'gift') return 'Selecciona un pack para poder enviar regalos.';
      return 'Selecciona el pack que prefieras.';
    })();

    return new Promise((resolve) => {
      const handleCancel = () => { closeModal(); resolve({ confirmed:false }); };
      const handleSelect = (pack) => { closeModal(); resolve({ confirmed:true, pack }); };

      openModal({
        title: titleByContext,
        variant: 'select',
        size: 'md',
        bodyKind: 'payout',
        content: (
          <div>
            <PackHint>{subtitleByContext}</PackHint>
            <PacksGrid>
              {effectivePacks.map((pack) => (
                <PackCard key={pack.id} type="button" onClick={() => handleSelect(pack)}>
                  <PackHeader>
                    <PackMinutes>{pack.minutes} minutos</PackMinutes>
                    <PackPrice>{pack.price.toFixed(2)} {pack.currency || currency}</PackPrice>
                  </PackHeader>
                  {pack.recommended && <PackTag>Recomendado</PackTag>}
                  {pack.promoTag && <PackHint>{pack.promoTag}</PackHint>}
                </PackCard>
              ))}
            </PacksGrid>
          </div>
        ),
        actions: [{ label:'Cancelar', primary:false, danger:false, onClick:handleCancel }],
      }).then(() => {});
    });
  }, [openModal, closeModal]);

  /** Modal para solicitar un retiro (payout) indicando un importe. */
  const openPayoutModal = useCallback(({ title = 'Solicitud de retiro', message, initialAmount = 10 } = {}) => {
    return new Promise((resolve) => {
      let currentValue = initialAmount !== null && initialAmount !== undefined ? String(initialAmount) : '';

      const handleCancel = () => { closeModal(); resolve({ confirmed:false }); };
      const handleConfirm = () => {
        const numeric = Number(currentValue);
        if (!Number.isFinite(numeric) || numeric <= 0) {
          alert({ title:'Importe no válido', message:'Introduce una cantidad numérica positiva.', variant:'warning', size:'sm' });
          return;
        }
        closeModal();
        resolve({ confirmed:true, amount:numeric });
      };

      openModal({
        title,
        variant: 'confirm',
        size: 'sm',
        bodyKind: 'payout',
        content: (
          <div>
            <PackHint>{message || 'Introduce la cantidad que deseas retirar:'}</PackHint>
            <PayoutInput
              type="text"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={currentValue}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                currentValue = digits;
                e.target.value = digits;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
            />
          </div>
        ),
        actions: [
          { label:'Cancelar', primary:false, danger:false, onClick:handleCancel },
          { label:'Solicitar retiro', primary:true, danger:false, onClick:handleConfirm },
        ],
      }).then(() => {});
    });
  }, [openModal, closeModal, alert]);


  const openLoginModal = useCallback(() => {
    const cameFromLoginRoute = location.pathname === '/login';

    const handleClose = () => {
      if (cameFromLoginRoute) history.push('/');
      closeModal();
    };

    openModal({
      title: '',
      variant: 'info',
      size: 'lg',
      bodyKind: 'default',
      hideChrome: true,
      onClose: handleClose,
      content: <LoginModalContent onClose={handleClose} />,
      actions: [],
    }).then(() => {});
  }, [openModal, closeModal, history, location.pathname]);


  return {
    // Exponemos helpers base
    alert,
    confirm,
    // modales de alto nivel:
    openRemoveFavoriteConfirm,
    openCallOfflineNotice,
    openPurchaseModal,
    openPayoutModal,
    openActiveSessionGuard,
    openLoginModal,
  };
};

export default useAppModals;
