import React, { useCallback, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useHistory, useLocation } from 'react-router-dom';
import i18n from '../i18n';
import { useModal } from './ModalProvider';
import LoginModalContent from './LoginModalContent';
import PublicSignupTeaserModal from './PublicSignupTeaserModal';
import { TERMS_VERSION, isLocalAgeOk } from '../consent/consentClient';

/**
 * Tipos de contexto para el modal de compra:
 *  - 'random'               → streaming aleatorio
 *  - 'calling'              → llamada 1 a 1
 *  - 'insufficient-balance' → disparado por "saldo insuficiente"
 *  - 'manual'               → botones de "añadir saldo/minutos"
 */

// === Catálogo vigente (ADR-011 + ADR-012 / BFPM Fase 4A). Centralización formal pendiente de fase posterior. ===
// minutesGranted refleja minutos de servicio reales que recibe el cliente (incluye bonus BFPM si aplica).
// minutes se mantiene igual a minutesGranted por compatibilidad con el modal existente.
const DEFAULT_PACKS = [
  { id: 'P10', minutes: 10, minutesGranted: 10, price: 10, currency: 'EUR' },
  { id: 'P20', minutes: 22, minutesGranted: 22, price: 20, currency: 'EUR', recommended: true },
  { id: 'P40', minutes: 44, minutesGranted: 44, price: 40, currency: 'EUR' },
];

// === Estilos específicos para el modal de compra ===
const PacksGrid = styled.div`
  display: grid;
  gap: 12px;
  margin: 12px 0 4px 0;
  grid-template-columns: 1fr;
`;

const PackCard = styled.button`
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  width: 100%;
  padding: 16px 18px;
  border-radius: 14px;
  border: 1px solid ${(p) => (p.$recommended ? '#ff3a85' : '#30363d')};
  background: #0d1117;
  color: #e6edf3;
  cursor: pointer;
  text-align: left;
  box-shadow: ${(p) => (p.$recommended ? '0 0 0 1px #ff3a85 inset' : 'none')};
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  &:hover {
    background: #11161d;
    border-color: ${(p) => (p.$recommended ? '#ff3a85' : '#3a3f46')};
    transform: translateY(-1px);
  }
  &:focus-visible {
    outline: 2px solid #ff3a85;
    outline-offset: 2px;
  }
`;

const PackHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const PackMinutes = styled.span`
  font-weight: 700;
  font-size: 20px;
  letter-spacing: 0.01em;
`;

const PackPrice = styled.span`
  font-weight: 500;
  font-size: 15px;
  color: #c9d1d9;
`;

const HotBadge = styled.span`
  position: absolute;
  top: 8px;
  right: -28px;
  transform: rotate(35deg);
  transform-origin: center;
  background: #ff3a85;
  color: #ffffff;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  padding: 2px 30px;
  text-transform: uppercase;
  pointer-events: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
`;

const PurchaseSubtitle = styled.div`
  font-size: 13px;
  color: #8b949e;
  text-align: center;
  margin: 4px 0 8px 0;
  line-height: 1.4;
`;

const SecureFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 14px;
  font-size: 12px;
  color: #8b949e;
`;

const PackHint = styled.span`
  font-size: 12px;
  color: #8b949e;
`;

const PayoutInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #30363d;
  background: #0d1117;
  color: #e6edf3;
  font-size: 14px;
  margin-top: 6px;
  outline: none;

  &:focus {
    border-color: #58a6ff;
    box-shadow: 0 0 0 1px #58a6ff44;
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &[type='number'] {
    -moz-appearance: textfield;
  }
`;

const RadioGroup = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 10px;
  text-align: left;
`;

const RadioOption = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #30363d;
  background: #0a0f16;
  color: #e6edf3;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.08s ease;

  &:hover {
    background: #101622;
    border-color: #3a3f46;
    box-shadow: 0 0 0 1px rgba(47, 129, 247, 0.22);
    transform: translateY(-1px);
  }
  input {
    margin-top: 3px;
  }
`;

const RadioText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const RadioTitle = styled.div`
  font-weight: 700;
  font-size: 14px;
  line-height: 1.2;
`;

const RadioDesc = styled.div`
  font-size: 12px;
  color: #9aa1a9;
  line-height: 1.35;
`;

const ChoiceWrap = styled.div`
  display: grid;
  gap: 10px;
  margin-top: 10px;
  grid-template-columns: 1fr;

  @media (min-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const ChoiceRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid #30363d;
  border-radius: 10px;
  background: #0a0f16;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.08s ease;
  &:hover {
    background: #101622;
    border-color: #3a3f46;
    transform: translateY(-1px);
  }
  input {
    accent-color: #2f81f7;
  }
`;

const ChoiceText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ChoiceTitle = styled.span`
  font-weight: 700;
  color: #e6edf3;
  font-size: 14px;
`;

const ChoiceSub = styled.span`
  color: #9aa1a9;
  font-size: 12px;
  line-height: 1.35;
`;

const ReportWrap = styled.div`
  display: grid;
  gap: 10px;
  margin-top: 8px;
`;

const ReportTextArea = styled.textarea`
  width: 100%;
  min-height: 50px;
  resize: vertical;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #30363d;
  background: #0d1117;
  color: #e6edf3;
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: #58a6ff;
    box-shadow: 0 0 0 1px #58a6ff44;
  }
`;

const CheckRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  font-size: 13px;
  color: #e6edf3;
  cursor: pointer;

  input {
    accent-color: #2f81f7;
  }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const NextWaitWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 4px;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #e6edf3;
`;

const NextWaitSpinner = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.18);
  border-top-color: rgba(255, 255, 255, 0.85);
  animation: ${spin} 0.9s linear infinite;
`;

const NextWaitTitle = styled.div`
  font-weight: 800;
  font-size: 14px;
  letter-spacing: 0.02em;
`;

const NextWaitText = styled.div`
  font-size: 12px;
  color: #9aa1a9;
  line-height: 1.35;
  max-width: 320px;
`;

export const useAppModals = () => {
  const { alert, confirm, openModal, closeModal } = useModal();
  const history = useHistory();
  const location = useLocation();

  const nextWaitTimerRef = useRef(null);

  const clearNextWaitTimer = useCallback(() => {
    if (nextWaitTimerRef.current) {
      clearTimeout(nextWaitTimerRef.current);
      nextWaitTimerRef.current = null;
    }
  }, []);

  const openNextWaitModal = useCallback(
    ({ title = i18n.t('modals.nextWait.title'), message = i18n.t('modals.nextWait.message'), durationMs = 1500 } = {}) => {
      try {
        clearNextWaitTimer();
      } catch {}

      openModal({
        title: '',
        variant: 'info',
        size: 'sm',
        bodyKind: 'default',
        hideChrome: true,
        onClose: () => {
          try {
            clearNextWaitTimer();
          } catch {}
          closeModal();
        },
        content: (
          <NextWaitWrap>
            <NextWaitSpinner />
            <NextWaitTitle>{title}</NextWaitTitle>
            <NextWaitText>{message}</NextWaitText>
          </NextWaitWrap>
        ),
        actions: [],
      }).then(() => {});

      const ms = Math.max(350, Number(durationMs) || 0);
      nextWaitTimerRef.current = setTimeout(() => {
        nextWaitTimerRef.current = null;
        try {
          closeModal();
        } catch {}
      }, ms);
    },
    [openModal, closeModal, clearNextWaitTimer]
  );

  const openRemoveFavoriteConfirm = useCallback(async (displayName = 'este usuario') => {
    const ok = await confirm({
      title: i18n.t('modals.removeFavorite.title'),
      message: i18n.t('modals.removeFavorite.message', { displayName }),
      okText: 'Eliminar',
      cancelText: i18n.t('common.cancel'),
      variant: 'confirm',
      size: 'sm',
      danger: true,
    });
    return ok;
  }, [confirm]);

  const openCallOfflineNotice = useCallback(async (displayName = 'este usuario') => {
    await alert({
      title: i18n.t('modals.callOffline.title'),
      message: i18n.t('modals.callOffline.message', { displayName }),
      variant: 'info',
      size: 'sm'
    });
  }, [alert]);

  const openActiveSessionGuard = useCallback(async ({ hasStreaming, hasCalling }) => {
    const active = !!hasStreaming || !!hasCalling;
    if (!active) return true;
    await alert({
      title: i18n.t('modals.activeSession.title'),
      message: i18n.t('modals.activeSession.message'),
      variant: 'warning',
      size: 'sm'
    });
    return false;
  }, [alert]);

  const openPurchaseModal = useCallback(({ packs, currency = 'EUR', context = 'manual' } = {}) => {
    const effectivePacks = Array.isArray(packs) && packs.length > 0 ? packs : DEFAULT_PACKS;
    if (!effectivePacks.length) return Promise.resolve({ confirmed: false });

    const titleByContext = (() => {
      if (context === 'insufficient-balance') return i18n.t('modals.purchase.insufficientBalanceTitle');
      if (context === 'random') return i18n.t('modals.purchase.randomTitle');
      if (context === 'calling') return i18n.t('modals.purchase.callingTitle');
      if (context === 'gift') return i18n.t('modals.purchase.insufficientBalanceTitle');
      return i18n.t('modals.purchase.defaultTitle');
    })();

    const subtitleByContext = i18n.t('modals.purchase.defaultSubtitle');

    return new Promise((resolve) => {
      const handleCancel = () => { closeModal(); resolve({ confirmed: false }); };
      const handleSelect = (pack) => { closeModal(); resolve({ confirmed: true, pack }); };

      openModal({
        title: titleByContext,
        variant: 'select',
        size: 'md',
        bodyKind: 'payout',
        content: (
          <div>
            <PurchaseSubtitle>{subtitleByContext}</PurchaseSubtitle>
            <PacksGrid>
              {effectivePacks.map((pack) => (
                <PackCard
                  key={pack.id}
                  type="button"
                  $recommended={!!pack.recommended}
                  onClick={() => handleSelect(pack)}
                >
                  <PackHeader>
                    <PackMinutes>{pack.minutes} min</PackMinutes>
                    <PackPrice>{pack.price.toFixed(2)} {pack.currency || currency}</PackPrice>
                  </PackHeader>
                  {pack.recommended && (
                    <HotBadge>{i18n.t('modals.purchase.hot', { defaultValue: 'HOT' })}</HotBadge>
                  )}
                  {pack.promoTag && <PackHint>{pack.promoTag}</PackHint>}
                </PackCard>
              ))}
            </PacksGrid>
            <SecureFooter>
              <span aria-hidden="true">🔒</span>
              <span>{i18n.t('modals.purchase.secure', { defaultValue: 'Pago seguro' })}</span>
            </SecureFooter>
          </div>
        ),
        actions: [{ label: i18n.t('common.cancel'), primary: false, danger: false, onClick: handleCancel }],
      }).then(() => {});
    });
  }, [openModal, closeModal]);

  const openPayoutModal = useCallback(({ title = i18n.t('modals.payout.title'), message, initialAmount = 50 } = {}) => {
    return new Promise((resolve) => {
      let currentValue = initialAmount !== null && initialAmount !== undefined ? String(initialAmount) : '';

      const handleCancel = () => { closeModal(); resolve({ confirmed: false }); };
      const handleConfirm = () => {
        const numeric = Number(currentValue);
        if (!Number.isFinite(numeric) || numeric <= 0) {
          alert({
            title: i18n.t('modals.payout.invalidAmountTitle'),
            message: i18n.t('modals.payout.invalidAmountMessage'),
            variant: 'warning',
            size: 'sm'
          });
          return;
        }
        closeModal();
        resolve({ confirmed: true, amount: numeric });
      };

      openModal({
        title,
        variant: 'confirm',
        size: 'sm',
        bodyKind: 'payout',
        content: (
          <div>
            <PackHint>{message || i18n.t('modals.payout.prompt')}</PackHint>
            <PayoutInput
              type="number"
              inputMode="numeric"
              min="50"
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
          { label: i18n.t('common.cancel'), primary: false, danger: false, onClick: handleCancel },
          { label: i18n.t('modals.payout.submit'), primary: true, danger: false, onClick: handleConfirm },
        ],
      }).then(() => {});
    });
  }, [openModal, closeModal, alert]);

  const openUnsubscribeModal = useCallback(({ title = i18n.t('modals.unsubscribe.title'), size = 'sm', options } = {}) => {
    const effectiveOptions = Array.isArray(options) && options.length ? options : [
      { value: 'not-matching', label: i18n.t('modals.unsubscribe.options.notMatching.title') },
      { value: 'too-expensive', label: i18n.t('modals.unsubscribe.options.expensive.title') },
      { value: 'privacy', label: i18n.t('modals.unsubscribe.options.privacy.title') },
      { value: 'technical', label: i18n.t('modals.unsubscribe.options.technical.title') },
      { value: 'other', label: i18n.t('common.other') },
    ];

    return new Promise((resolve) => {
      let selected = effectiveOptions[0]?.value ?? 'pause';

      const handleCancel = () => { closeModal(); resolve({ confirmed: false, reason: null }); };
      const handleConfirm = () => { closeModal(); resolve({ confirmed: true, reason: selected || null }); };

      openModal({
        title,
        variant: 'danger',
        size,
        bodyKind: 'payout',
        content: (
          <div>
            <PackHint>{i18n.t('modals.unsubscribe.reasonLabel')}</PackHint>
            <RadioGroup role="radiogroup" aria-label={i18n.t('modals.unsubscribe.reasonLabel')}>
              {effectiveOptions.map((opt) => (
                <RadioOption key={opt.value}>
                  <input
                    type="radio"
                    name="unsubscribeReason"
                    defaultChecked={opt.value === selected}
                    onChange={() => { selected = opt.value; }}
                  />
                  <RadioText>
                    <RadioTitle>{opt.label}</RadioTitle>
                    {opt.desc ? <RadioDesc>{opt.desc}</RadioDesc> : null}
                  </RadioText>
                </RadioOption>
              ))}
            </RadioGroup>
            <PackHint style={{marginTop:10}}>{i18n.t('modals.unsubscribe.warning')}</PackHint>
          </div>
        ),
        actions: [
          { label: i18n.t('common.cancel'), primary: false, danger: false, onClick: handleCancel },
          { label: i18n.t('modals.unsubscribe.title'), primary: false, danger: true, onClick: handleConfirm },
        ],
      }).then(() => {});
    });
  }, [openModal, closeModal]);

  const openReportAbuseModal = useCallback(({ displayName = 'este usuario' } = {}) => {
    return new Promise((resolve) => {
      let selectedType = 'ABUSE';
      let description = '';
      let alsoBlock = true;

      const onCancel = () => {
        closeModal();
        resolve({ confirmed: false });
      };

      const onConfirm = () => {
        const desc = String(description || '').trim();

        if (selectedType === 'OTHER' && !desc) {
          alert({
            title: i18n.t('modals.report.descriptionRequiredTitle'),
            message: i18n.t('modals.report.descriptionRequiredMessage'),
            variant: 'warning',
            size: 'sm',
          });
          return;
        }

        closeModal();
        resolve({
          confirmed: true,
          reportType: selectedType,
          description: desc,
          alsoBlock: !!alsoBlock,
        });
      };

      openModal({
        title: i18n.t('modals.report.title'),
        variant: 'danger',
        size: 'sm',
        bodyKind: 'payout',
        content: (
          <div>
            <ReportWrap>
              <ChoiceWrap>
                <ChoiceRow>
                  <input
                    type="radio"
                    name="report-type"
                    defaultChecked
                    onChange={() => { selectedType = 'ABUSE'; }}
                  />
                  <ChoiceText>
                    <ChoiceTitle>{i18n.t('modals.report.options.abuse')}</ChoiceTitle>
                  </ChoiceText>
                </ChoiceRow>

                <ChoiceRow>
                  <input
                    type="radio"
                    name="report-type"
                    onChange={() => { selectedType = 'HARASSMENT'; }}
                  />
                  <ChoiceText>
                    <ChoiceTitle>{i18n.t('modals.report.options.harassment')}</ChoiceTitle>
                  </ChoiceText>
                </ChoiceRow>

                <ChoiceRow>
                  <input
                    type="radio"
                    name="report-type"
                    onChange={() => { selectedType = 'NUDITY'; }}
                  />
                  <ChoiceText>
                    <ChoiceTitle>{i18n.t('modals.report.options.nudity')}</ChoiceTitle>
                  </ChoiceText>
                </ChoiceRow>

                <ChoiceRow>
                  <input
                    type="radio"
                    name="report-type"
                    onChange={() => { selectedType = 'FRAUD'; }}
                  />
                  <ChoiceText>
                    <ChoiceTitle>{i18n.t('modals.report.options.fraud')}</ChoiceTitle>
                  </ChoiceText>
                </ChoiceRow>

                <ChoiceRow>
                  <input
                    type="radio"
                    name="report-type"
                    onChange={() => { selectedType = 'MINOR'; }}
                  />
                  <ChoiceText>
                    <ChoiceTitle>{i18n.t('modals.report.options.minor')}</ChoiceTitle>
                  </ChoiceText>
                </ChoiceRow>

                <ChoiceRow>
                  <input
                    type="radio"
                    name="report-type"
                    onChange={() => { selectedType = 'OTHER'; }}
                  />
                  <ChoiceText>
                    <ChoiceTitle>{i18n.t('common.other')}</ChoiceTitle>
                  </ChoiceText>
                </ChoiceRow>
              </ChoiceWrap>

              <div>
                <PackHint>{i18n.t('modals.report.descriptionLabel')}</PackHint>
                <ReportTextArea
                  placeholder={i18n.t('modals.report.descriptionPlaceholder')}
                  onChange={(e) => { description = e.target.value; }}
                />
              </div>

              <CheckRow>
                <input
                  type="checkbox"
                  defaultChecked
                  onChange={(e) => { alsoBlock = e.target.checked; }}
                />
                <span>{i18n.t('modals.report.alsoBlock')}</span>
              </CheckRow>
            </ReportWrap>
          </div>
        ),
        actions: [
          { label: i18n.t('common.cancel'), primary: false, danger: false, onClick: onCancel },
          { label: i18n.t('modals.report.submit'), primary: false, danger: true, onClick: onConfirm },
        ],
      }).then(() => {});
    });
  }, [openModal, closeModal, alert]);

  const openBlockReasonModal = useCallback(({ displayName = 'este usuario' } = {}) => {
    return new Promise((resolve) => {
      let selected = 'pause';

      const onCancel = () => { closeModal(); resolve({ confirmed: false, reason: null }); };
      const onConfirm = () => { closeModal(); resolve({ confirmed: true, reason: selected }); };

      openModal({
        title: i18n.t('modals.block.title'),
        variant: 'danger',
        size: 'sm',
        bodyKind: 'payout',
        content: (
          <div>
            <PackHint>{i18n.t('modals.block.reasonLabel', { displayName })}</PackHint>
            <ChoiceWrap>
              <ChoiceRow>
                <input type="radio" name="block-reason" defaultChecked onChange={() => { selected = 'pause'; }} />
                <ChoiceText>
                  <ChoiceTitle>{i18n.t('modals.block.options.pause')}</ChoiceTitle>
                </ChoiceText>
              </ChoiceRow>

              <ChoiceRow>
                <input type="radio" name="block-reason" onChange={() => { selected = 'never'; }} />
                <ChoiceText>
                  <ChoiceTitle>{i18n.t('modals.block.options.never')}</ChoiceTitle>
                </ChoiceText>
              </ChoiceRow>

              <ChoiceRow>
                <input type="radio" name="block-reason" onChange={() => { selected = 'other'; }} />
                <ChoiceText>
                  <ChoiceTitle>{i18n.t('common.other')}</ChoiceTitle>
                </ChoiceText>
              </ChoiceRow>
            </ChoiceWrap>
          </div>
        ),
        actions: [
          { label: i18n.t('common.cancel'), primary: false, danger: false, onClick: onCancel },
          { label: i18n.t('modals.block.title'), primary: false, danger: true, onClick: onConfirm },
        ],
      }).then(() => {});
    });
  }, [openModal, closeModal]);

  const openLoginModal = useCallback((options = {}) => {
    if (!isLocalAgeOk(TERMS_VERSION)) {
      return;
    }

    const { initialView = 'login' } = options;
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
      content: (
        <LoginModalContent
          initialView={initialView}
          onClose={handleClose}
          onLoginSuccess={closeModal}
        />
      ),
      actions: [],
    }).then(() => {});
  }, [openModal, closeModal, history, location.pathname]);


  const openPublicSignupTeaser = useCallback(() => {
    if (!isLocalAgeOk(TERMS_VERSION)) {
      return;
    }

    openModal({
      title: '',
      variant: 'info',
      size: 'lg',
      bodyKind: 'default',
      hideChrome: true,
      onClose: () => {
        closeModal();
        openLoginModal({ initialView: 'register-gender' });
      },
      content: (
        <PublicSignupTeaserModal
          onClose={() => {
            closeModal();
            openLoginModal({ initialView: 'register-gender' });
          }}
        />
      ),
      actions: [],
    }).then(() => {});
  }, [openModal, closeModal, openLoginModal]);


  return {
    alert,
    confirm,
    openRemoveFavoriteConfirm,
    openCallOfflineNotice,
    openPurchaseModal,
    openPayoutModal,
    openActiveSessionGuard,
    openLoginModal,
    openPublicSignupTeaser,
    openBlockReasonModal,
    openReportAbuseModal,
    openUnsubscribeModal,
    openNextWaitModal,
  };
};

export default useAppModals;
