package com.sharemechat.service;

import com.sharemechat.dto.ModelProfileAttributesDTO;
import com.sharemechat.entity.ModelProfileAttributes;
import com.sharemechat.repository.ModelProfileAttributesRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Card 1 Fase 2: validacion + upsert de datos fisicos del modelo.
 */
class ModelProfileAttributesServiceTest {

    private ModelProfileAttributesRepository repository;
    private ModelProfileAttributesService service;

    @BeforeEach
    void setUp() {
        repository = mock(ModelProfileAttributesRepository.class);
        service = new ModelProfileAttributesService(repository);
    }

    @Test
    void update_normalizaCodigosAMayusculasYGuarda() {
        when(repository.findById(7L)).thenReturn(Optional.empty());

        ModelProfileAttributesDTO in =
                new ModelProfileAttributesDTO("medium", 165, "large", "curvy");
        ModelProfileAttributesDTO out = service.update(7L, in);

        assertEquals("MEDIUM", out.bustSize());
        assertEquals(165, out.heightCm());
        assertEquals("LARGE", out.buttSize());
        assertEquals("CURVY", out.bodyType());

        ArgumentCaptor<ModelProfileAttributes> captor =
                ArgumentCaptor.forClass(ModelProfileAttributes.class);
        verify(repository).save(captor.capture());
        assertEquals(7L, captor.getValue().getUserId());
        assertEquals("MEDIUM", captor.getValue().getBustSize());
    }

    @Test
    void update_nullLimpiaCampos() {
        when(repository.findById(7L)).thenReturn(Optional.empty());
        ModelProfileAttributesDTO out =
                service.update(7L, new ModelProfileAttributesDTO("  ", null, null, null));
        assertNull(out.bustSize()); // blank -> null
        assertNull(out.heightCm());
    }

    @Test
    void update_rechazaCodigoNoPermitido() {
        assertThrows(IllegalArgumentException.class, () ->
                service.update(7L, new ModelProfileAttributesDTO(null, null, null, "alien")));
    }

    @Test
    void update_rechazaAlturaFueraDeRango() {
        assertThrows(IllegalArgumentException.class, () ->
                service.update(7L, new ModelProfileAttributesDTO(null, 300, null, null)));
        assertThrows(IllegalArgumentException.class, () ->
                service.update(7L, new ModelProfileAttributesDTO(null, 50, null, null)));
    }

    @Test
    void getForUser_devuelveVacioSiNoExiste() {
        when(repository.findById(9L)).thenReturn(Optional.empty());
        ModelProfileAttributesDTO out = service.getForUser(9L);
        assertNull(out.bustSize());
        assertNull(out.heightCm());
    }
}
