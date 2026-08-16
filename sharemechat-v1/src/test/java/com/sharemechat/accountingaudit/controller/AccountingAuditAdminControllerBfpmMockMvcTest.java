package com.sharemechat.accountingaudit.controller;

import com.sharemechat.accountingaudit.job.AccountingAuditJob;
import com.sharemechat.accountingaudit.repository.BalanceLedgerAuditRepository;
import com.sharemechat.accountingaudit.repository.BalanceLedgerAuditRepository.BfpmBonusFundingOrphanRow;
import com.sharemechat.accountingaudit.repository.BalanceLedgerAuditRepository.BfpmBonusGrantOrphanRow;
import com.sharemechat.accountingaudit.repository.BalanceLedgerAuditRepository.BfpmInvariantRow;
import com.sharemechat.accountingaudit.repository.BalanceLedgerAuditRepository.TotalPagosMismatchRow;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * BFPM Fase 4B-b — MockMvc del GET /api/admin/audit/bfpm-summary (ADR-012).
 * El controller delega todas las queries en {@link BalanceLedgerAuditRepository}
 * (mockeable), así que el test corre en local sin BD. Cubre invariante OK (Δ≈0)
 * e invariante rota (Δ fuera de epsilon 0.01) con huérfanos vivos. La seguridad
 * (ROLE_ADMIN) la garantiza SecurityConfig por matcher y no se ejercita aquí
 * (standaloneSetup no monta el filter chain).
 */
class AccountingAuditAdminControllerBfpmMockMvcTest {

    private AccountingAuditJob job;
    private BalanceLedgerAuditRepository repo;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        job = mock(AccountingAuditJob.class);
        repo = mock(BalanceLedgerAuditRepository.class);
        AccountingAuditAdminController controller = new AccountingAuditAdminController(job, repo);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    @DisplayName("GET /bfpm-summary: invariante cuadrada (Δ=0) -> invariantOk=true, sin anomalías")
    void bfpmSummaryInvariantOk() throws Exception {
        when(repo.getBfpmInvariantSummary()).thenReturn(new BfpmInvariantRow(
                new BigDecimal("6.00"), new BigDecimal("-6.00"), new BigDecimal("0.00")));
        when(repo.countBonusPairs()).thenReturn(3L);
        when(repo.findBonusGrantsWithoutFunding(anyInt())).thenReturn(List.of());
        when(repo.findBonusFundingsWithoutGrant(anyInt())).thenReturn(List.of());
        when(repo.findClientsTotalPagosVsIngresoMismatch(anyInt())).thenReturn(List.of());

        mockMvc.perform(get("/api/admin/audit/bfpm-summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sumBonusGrant").value(6.00))
                .andExpect(jsonPath("$.sumBonusFunding").value(-6.00))
                .andExpect(jsonPath("$.invariantDelta").value(0.00))
                .andExpect(jsonPath("$.invariantOk").value(true))
                .andExpect(jsonPath("$.bonusPairCount").value(3))
                .andExpect(jsonPath("$.grantsWithoutFunding").isArray())
                .andExpect(jsonPath("$.grantsWithoutFunding").isEmpty())
                .andExpect(jsonPath("$.fundingsWithoutGrant").isEmpty())
                .andExpect(jsonPath("$.totalPagosMismatch").isEmpty());
    }

    @Test
    @DisplayName("GET /bfpm-summary: Δ fuera de epsilon -> invariantOk=false + huérfano listado")
    void bfpmSummaryInvariantBroken() throws Exception {
        when(repo.getBfpmInvariantSummary()).thenReturn(new BfpmInvariantRow(
                new BigDecimal("6.50"), new BigDecimal("-6.00"), new BigDecimal("0.50")));
        when(repo.countBonusPairs()).thenReturn(4L);
        when(repo.findBonusGrantsWithoutFunding(anyInt())).thenReturn(List.of(
                new BfpmBonusGrantOrphanRow(101L, 42L, new BigDecimal("0.50"),
                        "BFPM bonus_grant pack=P20 order=abc")));
        when(repo.findBonusFundingsWithoutGrant(anyInt())).thenReturn(List.of());
        when(repo.findClientsTotalPagosVsIngresoMismatch(anyInt())).thenReturn(List.of(
                new TotalPagosMismatchRow(42L, new BigDecimal("20.00"),
                        new BigDecimal("18.00"), new BigDecimal("2.00"))));

        mockMvc.perform(get("/api/admin/audit/bfpm-summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invariantDelta").value(0.50))
                .andExpect(jsonPath("$.invariantOk").value(false))
                .andExpect(jsonPath("$.bonusPairCount").value(4))
                .andExpect(jsonPath("$.grantsWithoutFunding[0].transactionId").value(101))
                .andExpect(jsonPath("$.grantsWithoutFunding[0].userId").value(42))
                .andExpect(jsonPath("$.totalPagosMismatch[0].userId").value(42))
                .andExpect(jsonPath("$.totalPagosMismatch[0].delta").value(2.00));
    }

    @Test
    @DisplayName("GET /bfpm-summary: Δ negativo justo en el borde del epsilon (-0.01) -> invariantOk=true")
    void bfpmSummaryDeltaAtEpsilonBoundary() throws Exception {
        when(repo.getBfpmInvariantSummary()).thenReturn(new BfpmInvariantRow(
                new BigDecimal("6.00"), new BigDecimal("-6.01"), new BigDecimal("-0.01")));
        when(repo.countBonusPairs()).thenReturn(3L);
        when(repo.findBonusGrantsWithoutFunding(anyInt())).thenReturn(List.of());
        when(repo.findBonusFundingsWithoutGrant(anyInt())).thenReturn(List.of());
        when(repo.findClientsTotalPagosVsIngresoMismatch(anyInt())).thenReturn(List.of());

        mockMvc.perform(get("/api/admin/audit/bfpm-summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invariantOk").value(true));
    }
}
