package com.sharemechat.master.service;

import com.sharemechat.entity.Model;
import com.sharemechat.master.entity.Master;
import com.sharemechat.master.entity.MasterModelSplit;
import com.sharemechat.master.repository.MasterModelSplitRepository;
import com.sharemechat.master.repository.MasterRepository;
import com.sharemechat.repository.ModelRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-056 Fase S7.b: tests unitarios del servicio de suspensión Master.
 * Cubre: happy suspend con cascade Model.master_user_id=NULL + cierre
 * MasterModelSplit vigentes; idempotencia (segundo suspend no-op);
 * reactivate happy; reactivate no-op si no suspendido; NO re-asignación
 * automática de modelos al reactivar; Master inexistente lanza
 * IllegalArgumentException.
 */
class MasterSuspensionServiceTest {

    private MasterRepository masterRepository;
    private ModelRepository modelRepository;
    private MasterModelSplitRepository splitRepository;
    private MasterSuspensionService svc;

    @BeforeEach
    void setUp() {
        masterRepository = mock(MasterRepository.class);
        modelRepository = mock(ModelRepository.class);
        splitRepository = mock(MasterModelSplitRepository.class);
        svc = new MasterSuspensionService(masterRepository, modelRepository, splitRepository);
    }

    // Helpers ---------------------------------------------------

    private Master activeMaster(long userId) {
        Master m = new Master();
        m.setUserId(userId);
        // suspendedAt null por defecto
        return m;
    }

    private Master suspendedMaster(long userId) {
        Master m = activeMaster(userId);
        m.setSuspendedAt(LocalDateTime.now().minusHours(2));
        m.setSuspendedByUserId(999L);
        m.setSuspensionReason("prev");
        return m;
    }

    private Model modelUnder(long modelUserId, long masterUserId) {
        Model mo = new Model();
        mo.setUserId(modelUserId);
        mo.setMasterUserId(masterUserId);
        return mo;
    }

    private MasterModelSplit split(long masterUserId, long modelUserId) {
        MasterModelSplit s = new MasterModelSplit();
        s.setMasterUserId(masterUserId);
        s.setModelUserId(modelUserId);
        s.setInternalSharePct(new BigDecimal("20"));
        // effectiveTo null → vigente
        return s;
    }

    // Suspend --------------------------------------------------

    @Test
    @DisplayName("suspend: happy path — setea suspended_at + libera modelos + cierra splits")
    void suspend_happy() {
        Master m = activeMaster(500L);
        when(masterRepository.findByUserId(500L)).thenReturn(Optional.of(m));
        when(modelRepository.findAllByMasterUserIdOrderByUserIdAsc(500L))
                .thenReturn(List.of(modelUnder(100L, 500L), modelUnder(101L, 500L)));
        when(splitRepository.findAllByMasterUserIdAndEffectiveToIsNullOrderByIdDesc(500L))
                .thenReturn(List.of(split(500L, 100L), split(500L, 101L)));

        Master result = svc.suspend(500L, 999L, "AML review pending");

        assertNotNull(result.getSuspendedAt());
        assertEquals(999L, result.getSuspendedByUserId());
        assertEquals("AML review pending", result.getSuspensionReason());

        // Modelos liberadas: setMasterUserId(null) + save().
        verify(modelRepository, times(2)).save(any(Model.class));
        // Splits cerrados: 2 saves con effectiveTo != null.
        verify(splitRepository, times(2)).save(any(MasterModelSplit.class));
        verify(masterRepository, times(1)).save(m);
    }

    @Test
    @DisplayName("suspend: trim del motivo y motivo blanco pasa a null")
    void suspend_trimsAndNullifiesBlankReason() {
        Master m = activeMaster(501L);
        when(masterRepository.findByUserId(501L)).thenReturn(Optional.of(m));
        when(modelRepository.findAllByMasterUserIdOrderByUserIdAsc(501L)).thenReturn(List.of());
        when(splitRepository.findAllByMasterUserIdAndEffectiveToIsNullOrderByIdDesc(501L)).thenReturn(List.of());

        svc.suspend(501L, 1L, "   ");
        assertNull(m.getSuspensionReason());

        m.setSuspendedAt(null); // reset para segundo suspend (ya no idempotente)
        m.setSuspendedByUserId(null);
        svc.suspend(501L, 1L, "  Reason with spaces  ");
        assertEquals("Reason with spaces", m.getSuspensionReason());
    }

    @Test
    @DisplayName("suspend: idempotente — Master ya suspendido no re-ejecuta cascade")
    void suspend_idempotentIfAlreadySuspended() {
        Master m = suspendedMaster(502L);
        when(masterRepository.findByUserId(502L)).thenReturn(Optional.of(m));

        LocalDateTime originalSuspendedAt = m.getSuspendedAt();
        Master result = svc.suspend(502L, 999L, "new reason ignored");

        assertSame(m, result);
        assertEquals(originalSuspendedAt, result.getSuspendedAt());
        assertEquals("prev", result.getSuspensionReason());

        // Nunca se llegó a las queries de cascade.
        verify(modelRepository, never()).findAllByMasterUserIdOrderByUserIdAsc(anyLong());
        verify(splitRepository, never()).findAllByMasterUserIdAndEffectiveToIsNullOrderByIdDesc(anyLong());
        verify(masterRepository, never()).save(any());
    }

    @Test
    @DisplayName("suspend: Master inexistente lanza IllegalArgumentException")
    void suspend_masterNotFound() {
        when(masterRepository.findByUserId(999L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class,
                () -> svc.suspend(999L, 1L, "any"));
    }

    // Reactivate -----------------------------------------------

    @Test
    @DisplayName("reactivate: happy — limpia suspended_at/by/reason, NO re-asigna modelos")
    void reactivate_happy() {
        Master m = suspendedMaster(503L);
        when(masterRepository.findByUserId(503L)).thenReturn(Optional.of(m));

        Master result = svc.reactivate(503L, 999L);

        assertNull(result.getSuspendedAt());
        assertNull(result.getSuspendedByUserId());
        assertNull(result.getSuspensionReason());
        verify(masterRepository, times(1)).save(m);

        // NO se tocan modelos ni splits al reactivar. Deuda: si el
        // Master quiere volver a onboardearlas, re-invita.
        verify(modelRepository, never()).save(any(Model.class));
        verify(splitRepository, never()).save(any(MasterModelSplit.class));
    }

    @Test
    @DisplayName("reactivate: no-op si Master no está suspendido")
    void reactivate_noopIfNotSuspended() {
        Master m = activeMaster(504L);
        when(masterRepository.findByUserId(504L)).thenReturn(Optional.of(m));

        Master result = svc.reactivate(504L, 999L);

        assertSame(m, result);
        assertNull(result.getSuspendedAt());
        verify(masterRepository, never()).save(any());
    }

    @Test
    @DisplayName("reactivate: Master inexistente lanza IllegalArgumentException")
    void reactivate_masterNotFound() {
        when(masterRepository.findByUserId(1234L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> svc.reactivate(1234L, 1L));
    }
}
