package com.sharemechat.service;

import com.sharemechat.consent.ConsentState;
import com.sharemechat.dto.UserLanguageDTO;
import com.sharemechat.entity.User;
import com.sharemechat.entity.UserLanguage;
import com.sharemechat.repository.UserLanguageRepository;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Lógica i18n de {@link UserService} (Fases 1-3): validación/dedup/primario de
 * {@code updateUserLanguages}, sync Nivel A->B de {@code updateUiLocale}
 * ("idioma de un clic" solo si estaba en sync) y prioridad de
 * {@code detectPersonalLanguage}. Unit test con repos y servicios mockeados;
 * {@code mapToDTO} se ejecuta al final de los métodos públicos, por eso se
 * stubean {@code ageGatePolicyService} y {@code backofficeAccessService}.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserServiceI18nTest {

    @Mock UserRepository userRepository;
    @Mock UserLanguageRepository userLanguageRepository;
    @Mock AgeGatePolicyService ageGatePolicyService;
    @Mock BackofficeAccessService backofficeAccessService;

    @InjectMocks UserService userService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(7L);
        user.setEmail("u@x.com");
        user.setUiLocale("es");

        when(userRepository.findByEmail("u@x.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        // Dependencias que toca mapToDTO en los happy paths.
        when(ageGatePolicyService.resolve(any()))
                .thenReturn(new ConsentState(true, false, false, false, "v1"));
        when(backofficeAccessService.loadProfile(any(), any()))
                .thenReturn(new BackofficeAccessService.BackofficeAccessProfile(Set.of(), Set.of()));
        when(userLanguageRepository.findByUserIdOrderByPrimaryDescPreferenceWeightDescIdAsc(anyLong()))
                .thenReturn(List.of());
    }

    private UserLanguage ul(Long id, String code, boolean primary, int weight) {
        UserLanguage u = new UserLanguage();
        u.setId(id);
        u.setUserId(7L);
        u.setLangCode(code);
        u.setPrimary(primary);
        u.setPreferenceWeight(weight);
        return u;
    }

    // ---------- detectPersonalLanguage (prioridad) ----------

    @Test
    void detectPrefersAcceptLanguageFirstToken() {
        assertEquals("fr", userService.detectPersonalLanguage("fr-FR,en;q=0.8", "US", "en"));
    }

    @Test
    void detectFallsBackToCountryWhenAcceptLanguageUnusable() {
        assertEquals("mg", userService.detectPersonalLanguage("xx", "MG", "en"));
        assertEquals("mg", userService.detectPersonalLanguage(null, "MG", "en"));
    }

    @Test
    void detectFallsBackToUiLocaleThenEn() {
        assertEquals("de", userService.detectPersonalLanguage(null, null, "de"));
        assertEquals("de", userService.detectPersonalLanguage(null, "ZZ", "de"));
        assertEquals("en", userService.detectPersonalLanguage(null, null, null));
        assertEquals("en", userService.detectPersonalLanguage("  ", "ZZ", "xx"));
    }

    // ---------- updateUserLanguages: validación ----------

    @Test
    void updateLanguagesRejectsNullOrEmpty() {
        assertThrows(IllegalArgumentException.class, () -> userService.updateUserLanguages("u@x.com", null));
        assertThrows(IllegalArgumentException.class, () -> userService.updateUserLanguages("u@x.com", List.of()));
    }

    @Test
    void updateLanguagesRejectsUnsupportedCode() {
        assertThrows(IllegalArgumentException.class,
                () -> userService.updateUserLanguages("u@x.com", List.of(new UserLanguageDTO("xx", true, null))));
    }

    // ---------- updateUserLanguages: upsert/dedup/primario/borrado ----------

    @Test
    void updateLanguagesUpsertsWithDescendingWeightsAndMarkedPrimary() {
        when(userLanguageRepository.findByUserId(7L)).thenReturn(new ArrayList<>());

        userService.updateUserLanguages("u@x.com", List.of(
                new UserLanguageDTO("es", true, "native"),
                new UserLanguageDTO("en", false, null)));

        ArgumentCaptor<UserLanguage> cap = ArgumentCaptor.forClass(UserLanguage.class);
        verify(userLanguageRepository, times(2)).save(cap.capture());
        UserLanguage es = cap.getAllValues().stream().filter(l -> "es".equals(l.getLangCode())).findFirst().orElseThrow();
        UserLanguage en = cap.getAllValues().stream().filter(l -> "en".equals(l.getLangCode())).findFirst().orElseThrow();

        assertTrue(es.isPrimary());
        assertFalse(en.isPrimary());
        assertEquals(100, es.getPreferenceWeight());
        assertEquals(90, en.getPreferenceWeight());
        assertEquals(7L, es.getUserId());
    }

    @Test
    void updateLanguagesDedupesAndDefaultsPrimaryToFirst() {
        when(userLanguageRepository.findByUserId(7L)).thenReturn(new ArrayList<>());

        userService.updateUserLanguages("u@x.com", List.of(
                new UserLanguageDTO("en", false, null),
                new UserLanguageDTO("es", false, null),
                new UserLanguageDTO("en", false, null)));

        ArgumentCaptor<UserLanguage> cap = ArgumentCaptor.forClass(UserLanguage.class);
        verify(userLanguageRepository, times(2)).save(cap.capture()); // dedup: en una vez
        UserLanguage en = cap.getAllValues().stream().filter(l -> "en".equals(l.getLangCode())).findFirst().orElseThrow();
        assertTrue(en.isPrimary()); // ninguno marcado -> el primero (en)
    }

    @Test
    void updateLanguagesDeletesRemovedCodes() {
        UserLanguage fr = ul(1L, "fr", true, 100);
        when(userLanguageRepository.findByUserId(7L)).thenReturn(new ArrayList<>(List.of(fr)));

        userService.updateUserLanguages("u@x.com", List.of(new UserLanguageDTO("es", true, null)));

        verify(userLanguageRepository).delete(fr);
        ArgumentCaptor<UserLanguage> cap = ArgumentCaptor.forClass(UserLanguage.class);
        verify(userLanguageRepository, times(1)).save(cap.capture());
        assertTrue("es".equals(cap.getValue().getLangCode()) && cap.getValue().isPrimary());
    }

    // ---------- updateUiLocale: sync Nivel A->B ----------

    @Test
    void updateUiLocaleRejectsInvalid() {
        assertThrows(IllegalArgumentException.class, () -> userService.updateUiLocale("u@x.com", "xx"));
    }

    @Test
    void changingUiLocaleRenamesPrimaryWhenInSync() {
        UserLanguage esPrim = ul(1L, "es", true, 100);
        when(userLanguageRepository.findByUserId(7L)).thenReturn(new ArrayList<>(List.of(esPrim)));

        userService.updateUiLocale("u@x.com", "en");

        assertEquals("en", esPrim.getLangCode()); // primario renombrado a en
        verify(userLanguageRepository).save(esPrim);
    }

    @Test
    void changingUiLocaleRespectsDivergentPersonalLanguage() {
        UserLanguage mgPrim = ul(1L, "mg", true, 100);
        when(userLanguageRepository.findByUserId(7L)).thenReturn(new ArrayList<>(List.of(mgPrim)));

        userService.updateUiLocale("u@x.com", "en");

        assertEquals("mg", mgPrim.getLangCode()); // intacto: elección personal
        verify(userLanguageRepository, never()).save(any(UserLanguage.class));
    }

    @Test
    void changingUiLocaleMovesPrimaryFlagWhenTargetAlreadySpoken() {
        UserLanguage esPrim = ul(1L, "es", true, 100);
        UserLanguage enSec = ul(2L, "en", false, 90);
        when(userLanguageRepository.findByUserId(7L)).thenReturn(new ArrayList<>(List.of(esPrim, enSec)));

        userService.updateUiLocale("u@x.com", "en");

        assertFalse(esPrim.isPrimary());
        assertTrue(enSec.isPrimary());
        assertEquals("es", esPrim.getLangCode()); // no renombra: mueve el flag
        verify(userLanguageRepository).save(esPrim);
        verify(userLanguageRepository).save(enSec);
    }
}
