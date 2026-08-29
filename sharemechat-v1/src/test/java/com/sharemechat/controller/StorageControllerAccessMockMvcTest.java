package com.sharemechat.controller;

import com.sharemechat.entity.User;
import com.sharemechat.security.BackofficeAuthorities;
import com.sharemechat.service.BackofficeAccessService;
import com.sharemechat.service.BackofficeAccessService.BackofficeAccessProfile;
import com.sharemechat.service.ModelService;
import com.sharemechat.service.UserService;
import com.sharemechat.storage.StorageService;
import com.sharemechat.storage.StorageUrlCodec;
import com.sharemechat.storage.StoredFile;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.converter.ResourceHttpMessageConverter;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Autorización de servido de ficheros privados (GET /api/storage/content).
 * Invariante crítica anti-IDOR: los documentos de **verificación (KYC/identidad)**
 * solo los puede leer su dueño o el backoffice; NADIE más, aunque manipule el `ref`.
 */
class StorageControllerAccessMockMvcTest {

    private final StorageService storageService = mock(StorageService.class);
    private final StorageUrlCodec codec = mock(StorageUrlCodec.class);
    private final UserService userService = mock(UserService.class);
    private final ModelService modelService = mock(ModelService.class);
    private final BackofficeAccessService backoffice = mock(BackofficeAccessService.class);

    private MockMvc mockMvc() {
        StorageController c = new StorageController(storageService, codec, userService, modelService, backoffice);
        return MockMvcBuilders.standaloneSetup(c)
                .setMessageConverters(new ResourceHttpMessageConverter())
                .build();
    }

    private User user(long id, String role, String email) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        u.setEmail(email);
        return u;
    }

    private void stubAuthUser(User u) {
        when(userService.findByEmail(u.getEmail())).thenReturn(u);
        // Por defecto: NO backoffice (roles vacíos).
        when(backoffice.loadProfile(eq(u.getId()), anyString()))
                .thenReturn(new BackofficeAccessProfile(Set.of(), Set.of()));
    }

    private void stubStoredFileExists() {
        try {
            when(storageService.loadByKey(anyString()))
                    .thenReturn(new StoredFile(new ByteArrayResource(new byte[]{1, 2, 3}), "image/jpeg", 3L, "f.jpg"));
        } catch (Exception ignore) {
        }
    }

    // ---------- IDOR: documento de verificación (KYC) ----------

    @Test
    void clienteNoDuenoNoPuedeLeerDocumentoDeVerificacionDeOtro() throws Exception {
        User attacker = user(5L, "CLIENT", "attacker@x.com");
        stubAuthUser(attacker);
        when(codec.decodeKey("REF")).thenReturn("models/999/verification/dni.jpg"); // dueño 999, no 5

        mockMvc().perform(get("/api/storage/content").param("ref", "REF")
                        .principal(new TestingAuthenticationToken("attacker@x.com", null)))
                .andExpect(status().isForbidden());

        verify(storageService, never()).loadByKey(anyString()); // ni siquiera se carga el fichero
    }

    @Test
    void elDuenoSiPuedeLeerSuPropioDocumentoDeVerificacion() throws Exception {
        User owner = user(999L, "MODEL", "owner@x.com");
        stubAuthUser(owner);
        when(codec.decodeKey("REF")).thenReturn("models/999/verification/dni.jpg");
        stubStoredFileExists();

        mockMvc().perform(get("/api/storage/content").param("ref", "REF")
                        .principal(new TestingAuthenticationToken("owner@x.com", null)))
                .andExpect(status().isOk());
    }

    @Test
    void elBackofficeSiPuedeLeerCualquierDocumentoDeVerificacion() throws Exception {
        User admin = user(5L, "ADMIN", "admin@x.com");
        when(userService.findByEmail("admin@x.com")).thenReturn(admin);
        when(backoffice.loadProfile(eq(5L), anyString()))
                .thenReturn(new BackofficeAccessProfile(Set.of(BackofficeAuthorities.ROLE_ADMIN), Set.of()));
        when(codec.decodeKey("REF")).thenReturn("models/999/verification/dni.jpg");
        stubStoredFileExists();

        mockMvc().perform(get("/api/storage/content").param("ref", "REF")
                        .principal(new TestingAuthenticationToken("admin@x.com", null)))
                .andExpect(status().isOk());
    }

    // ---------- foto de perfil de cliente: no la puede leer otro cliente ----------

    @Test
    void unClienteNoPuedeLeerLaFotoDePerfilDeOtroCliente() throws Exception {
        User attacker = user(5L, "CLIENT", "c5@x.com");
        stubAuthUser(attacker);
        when(codec.decodeKey("REF")).thenReturn("clients/999/profile/pic.jpg");

        mockMvc().perform(get("/api/storage/content").param("ref", "REF")
                        .principal(new TestingAuthenticationToken("c5@x.com", null)))
                .andExpect(status().isForbidden());
    }

    @Test
    void unaModeloSiPuedeLeerLaFotoDePerfilDeUnCliente() throws Exception {
        User modelo = user(5L, "MODEL", "m5@x.com");
        stubAuthUser(modelo);
        when(codec.decodeKey("REF")).thenReturn("clients/999/profile/pic.jpg");
        stubStoredFileExists();

        mockMvc().perform(get("/api/storage/content").param("ref", "REF")
                        .principal(new TestingAuthenticationToken("m5@x.com", null)))
                .andExpect(status().isOk());
    }

    // ---------- guardas básicas ----------

    @Test
    void sinAutenticacionDevuelve401() throws Exception {
        when(codec.decodeKey("REF")).thenReturn("models/1/verification/dni.jpg");
        mockMvc().perform(get("/api/storage/content").param("ref", "REF"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refInvalidoDevuelve400() throws Exception {
        when(codec.decodeKey("BAD")).thenReturn("");
        mockMvc().perform(get("/api/storage/content").param("ref", "BAD")
                        .principal(new TestingAuthenticationToken("x@x.com", null)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void claveConFormatoDesconocidoNoDuenoDevuelve403() throws Exception {
        User u = user(5L, "CLIENT", "c@x.com");
        stubAuthUser(u);
        when(codec.decodeKey("REF")).thenReturn("random/path/no-owner.bin"); // no casa el patrón owner
        mockMvc().perform(get("/api/storage/content").param("ref", "REF")
                        .principal(new TestingAuthenticationToken("c@x.com", null)))
                .andExpect(status().isForbidden());
    }
}
