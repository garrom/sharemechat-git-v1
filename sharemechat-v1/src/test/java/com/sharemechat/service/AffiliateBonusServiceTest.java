package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Client;
import com.sharemechat.entity.PlatformBalance;
import com.sharemechat.entity.PlatformTransaction;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.ClientRepository;
import com.sharemechat.repository.PlatformBalanceRepository;
import com.sharemechat.repository.PlatformTransactionRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-049 Subpasada 2B: unit test de {@link AffiliateBonusService}.
 * Verifica: happy path (grant + funding + client saldo) + idempotencia
 * D23 + off por property=0.
 */
class AffiliateBonusServiceTest {

    private TransactionRepository transactionRepository;
    private BalanceRepository balanceRepository;
    private PlatformTransactionRepository platformTransactionRepository;
    private PlatformBalanceRepository platformBalanceRepository;
    private ClientRepository clientRepository;
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        transactionRepository = mock(TransactionRepository.class);
        balanceRepository = mock(BalanceRepository.class);
        platformTransactionRepository = mock(PlatformTransactionRepository.class);
        platformBalanceRepository = mock(PlatformBalanceRepository.class);
        clientRepository = mock(ClientRepository.class);
        userRepository = mock(UserRepository.class);
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));
        when(platformTransactionRepository.save(any(PlatformTransaction.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    private User makeUser(Long id) {
        User u = new User();
        u.setEmail("c@x.com");
        u.setRole(Constants.Roles.USER);
        try {
            Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return u;
    }

    @Test
    @DisplayName("Happy: crea REFERRAL_WELCOME_GRANT + REFERRAL_WELCOME_FUNDING + upsert Client.saldo")
    void grant_happy() {
        User client = makeUser(10L);
        when(userRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(client));
        when(transactionRepository.existsByUserIdAndOperationType(10L,
                Constants.OperationTypes.REFERRAL_WELCOME_GRANT)).thenReturn(false);
        when(balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(10L))
                .thenReturn(Optional.empty());
        when(platformBalanceRepository.findTopByOrderByTimestampDescIdDesc())
                .thenReturn(Optional.empty());
        when(clientRepository.findByUser(client)).thenReturn(Optional.empty());

        AffiliateBonusService svc = new AffiliateBonusService(
                transactionRepository, balanceRepository,
                platformTransactionRepository, platformBalanceRepository,
                clientRepository, userRepository,
                new BigDecimal("10.00"));

        boolean granted = svc.grantWelcomeBonusIfEligible(10L, 97L);
        assertTrue(granted, "Grant debe devolver true en happy path.");

        ArgumentCaptor<Transaction> txCap = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository, times(1)).save(txCap.capture());
        assertEquals(Constants.OperationTypes.REFERRAL_WELCOME_GRANT, txCap.getValue().getOperationType());
        assertEquals(new BigDecimal("10.00"), txCap.getValue().getAmount());

        ArgumentCaptor<PlatformTransaction> ptxCap = ArgumentCaptor.forClass(PlatformTransaction.class);
        verify(platformTransactionRepository, times(1)).save(ptxCap.capture());
        assertEquals(Constants.OperationTypes.REFERRAL_WELCOME_FUNDING, ptxCap.getValue().getOperationType());
        assertEquals(new BigDecimal("-10.00"), ptxCap.getValue().getAmount());

        ArgumentCaptor<Client> clientCap = ArgumentCaptor.forClass(Client.class);
        verify(clientRepository, times(1)).save(clientCap.capture());
        assertEquals(new BigDecimal("10.00"), clientCap.getValue().getSaldoActual());
    }

    @Test
    @DisplayName("Idempotencia D23: si ya existe REFERRAL_WELCOME_GRANT, salta y devuelve false sin tocar BD")
    void grant_idempotentSkip() {
        when(transactionRepository.existsByUserIdAndOperationType(10L,
                Constants.OperationTypes.REFERRAL_WELCOME_GRANT)).thenReturn(true);

        AffiliateBonusService svc = new AffiliateBonusService(
                transactionRepository, balanceRepository,
                platformTransactionRepository, platformBalanceRepository,
                clientRepository, userRepository,
                new BigDecimal("10.00"));

        assertFalse(svc.grantWelcomeBonusIfEligible(10L, 97L));
        verify(transactionRepository, never()).save(any(Transaction.class));
        verify(platformTransactionRepository, never()).save(any(PlatformTransaction.class));
        verify(clientRepository, never()).save(any(Client.class));
    }

    @Test
    @DisplayName("Bono apagado (property=0): no crea nada, devuelve false")
    void grant_disabledZero() {
        AffiliateBonusService svc = new AffiliateBonusService(
                transactionRepository, balanceRepository,
                platformTransactionRepository, platformBalanceRepository,
                clientRepository, userRepository,
                BigDecimal.ZERO);

        assertFalse(svc.grantWelcomeBonusIfEligible(10L, 97L));
        verify(transactionRepository, never()).existsByUserIdAndOperationType(any(), any());
        verify(transactionRepository, never()).save(any(Transaction.class));
    }
}
