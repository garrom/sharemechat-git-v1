// src/components/useAppModals.js
import { useCallback } from 'react';
import styled from 'styled-components';
import { useModal } from './ModalProvider';

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

const PacksGrid = styled.div`
  display: grid;
  gap: 10px;
  margin: 4px 0;
  grid-template-columns: 1fr;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const PackCard = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #30363d;
  background: #0d1117;
  color: #e6edf3;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;

  &:hover {
    background: #11161d;
    border-color: #3a3f46;
    transform: translateY(-1px);
  }
`;

const PackHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const PackMinutes = styled.span`
  font-weight: 600;
  font-size: 15px;
`;

const PackPrice = styled.span`
  font-weight: 600;
  font-size: 15px;
`;

const PackTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: #1f6feb22;
  color: #58a6ff;
`;

const PackHint = styled.span`
  font-size: 12px;
  color: #8b949e;
`;

// === Hook de alto nivel con todos los modales de la app ===

export const useAppModals = () => {
  const { alert, confirm, openModal, closeModal } = useModal();

  /**
   * Modal genérico para confirmar navegación que cortaría el streaming/llamada.
   */
  const openNavigationGuard = useCallback(
    async (message) => {
      const ok = await confirm({
        title: '¿Salir ahora?',
        message:
          message ||
          'Si sales ahora se interrumpirá el streaming o la llamada actual. ¿Quieres continuar?',
        okText: 'Salir',
        cancelText: 'Cancelar',
        variant: 'confirm',
        size: 'sm',
      });
      return ok; // true -> salir, false -> quedarse
    },
    [confirm]
  );

  /**
   * Confirmación al eliminar un favorito.
   */
  const openRemoveFavoriteConfirm = useCallback(
    async (displayName = 'este usuario') => {
      const ok = await confirm({
        title: 'Eliminar de favoritos',
        message: `¿Seguro que quieres eliminar a ${displayName} de tus favoritos?`,
        okText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'confirm',
        size: 'sm',
        danger: true,
      });
      return ok;
    },
    [confirm]
  );

  /**
   * Aviso típico cuando el contacto no está conectado / disponible y tratamos de llamar.
   */
  const openCallOfflineNotice = useCallback(
    async (displayName = 'este usuario') => {
      await alert({
        title: 'Usuario no disponible',
        message: `${displayName} no está conectado en este momento.`,
        variant: 'info',
        size: 'sm',
      });
    },
    [alert]
  );

  /**
   * Modal de selección de pack de minutos / saldo.
   *
   * Ejemplo de uso:
   *   const { openPurchaseModal } = useAppModals();
   *   const result = await openPurchaseModal({
   *     packs: [
   *       { id: 'P5',  minutes: 5,  price: 1.99, currency: 'EUR' },
   *       { id: 'P15', minutes: 15, price: 4.50, currency: 'EUR', recommended: true },
   *       ...
   *     ],
   *     currency: 'EUR',
   *     context: 'insufficient-balance',
   *   });
   *
   *   if (result.confirmed) { ... }
   */
  const openPurchaseModal = useCallback(
    ({ packs, currency = 'EUR', context = 'manual' } = {}) => {
      const effectivePacks =
        Array.isArray(packs) && packs.length > 0 ? packs : DEFAULT_PACKS;

      if (!effectivePacks.length) {
        // Si no hay packs, devolvemos un cancel inmediato
        return Promise.resolve({ confirmed: false });
      }

      const titleByContext = (() => {
        if (context === 'insufficient-balance') return 'Saldo insuficiente';
        if (context === 'random') return 'Añadir minutos para seguir chateando';
        if (context === 'calling') return 'Añadir minutos para la llamada';
        if (context === 'gift') return 'Saldo insuficiente para regalos';
        return 'Añadir minutos';
      })();

      const subtitleByContext = (() => {
        if (context === 'insufficient-balance') {
          return 'Elige un pack de minutos para continuar usando el servicio.';
        }
        if (context === 'random') {
          return 'Selecciona un pack para seguir en el videochat.';
        }
        if (context === 'calling') {
          return 'Selecciona un pack para continuar con la llamada 1 a 1.';
        }
        if (context === 'gift') {
          return 'Selecciona un pack para poder enviar regalos.';
        }
        return 'Selecciona el pack que prefieras.';
      })();

      return new Promise((resolve) => {
        const handleCancel = () => {
          closeModal();
          resolve({ confirmed: false });
        };

        const handleSelect = (pack) => {
          closeModal();
          resolve({ confirmed: true, pack });
        };

        openModal({
          title: titleByContext,
          variant: 'select',
          size: 'md',
          // bodyKind 'default' porque usamos nuestro propio layout
          bodyKind: 'default',
          content: (
            <div>
              <PackHint>{subtitleByContext}</PackHint>
              <PacksGrid>
                {effectivePacks.map((pack) => (
                  <PackCard key={pack.id} type="button" onClick={() => handleSelect(pack)}>
                    <PackHeader>
                      <PackMinutes>{pack.minutes} minutos</PackMinutes>
                      <PackPrice>
                        {pack.price.toFixed(2)} {pack.currency || currency}
                      </PackPrice>
                    </PackHeader>
                    {pack.recommended && <PackTag>Recomendado</PackTag>}
                    {pack.promoTag && <PackHint>{pack.promoTag}</PackHint>}
                  </PackCard>
                ))}
              </PacksGrid>
            </div>
          ),
          actions: [
            {
              label: 'Cancelar',
              primary: false,
              danger: false,
              onClick: handleCancel,
            },
          ],
        }).then(() => {
          // Ignoramos la promesa interna de openModal; resolvemos desde handleSelect/handleCancel.
        });
      });
    },
    [openModal, closeModal]
  );

  return {
    // Exponemos helpers base por si quieres usarlos en algún sitio:
    alert,
    confirm,
    // Y nuestros modales de alto nivel:
    openNavigationGuard,
    openRemoveFavoriteConfirm,
    openCallOfflineNotice,
    openPurchaseModal,
  };
};

export default useAppModals;
