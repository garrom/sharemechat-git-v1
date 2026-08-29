package com.sharemechat.service;

import com.sharemechat.dto.ModelContractManifestDTO;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.security.MessageDigest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Guardián de integridad del contrato de modelo (endurecimiento 2026-06-04):
 * el SHA-256 del manifest debe corresponder al PDF real. Fail-secure: si no
 * coincide, no se sirve la versión. Sin este test, una regresión en
 * {@code ensureManifestMatchesPdf} permitiría aceptar un contrato cuyo texto
 * no corresponde al hash firmado.
 */
class ModelContractManifestServiceTest {

    private static final String BASE = "https://assets.test";
    private static final String MANIFEST_URL = BASE + "/legal/model_contract.manifest.json";
    private static final String PDF_URL = BASE + "/legal/model_contract.pdf";
    private static final String VERSION = "model_contract_v1_2026-08-04";

    private static String sha256Upper(byte[] data) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(data);
        StringBuilder sb = new StringBuilder(d.length * 2);
        for (byte b : d) sb.append(String.format("%02X", b));
        return sb.toString();
    }

    private static ModelContractManifestServiceHarness harness() {
        RestTemplate rt = mock(RestTemplate.class);
        ModelContractManifestService svc = new ModelContractManifestService(BASE);
        ReflectionTestUtils.setField(svc, "restTemplate", rt);
        return new ModelContractManifestServiceHarness(svc, rt);
    }

    private record ModelContractManifestServiceHarness(ModelContractManifestService svc, RestTemplate rt) {}

    private static ModelContractManifestDTO manifest(String version, String sha, String url) {
        ModelContractManifestDTO m = new ModelContractManifestDTO();
        m.setVersion(version);
        m.setSha256(sha);
        m.setUrl(url);
        return m;
    }

    @Test
    void devuelveManifestCuandoElShaCoincideConElPdf() throws Exception {
        var h = harness();
        byte[] pdf = "CONTENIDO-PDF-DEL-CONTRATO".getBytes();
        String sha = sha256Upper(pdf);
        when(h.rt().getForObject(MANIFEST_URL, ModelContractManifestDTO.class))
                .thenReturn(manifest(VERSION, sha, PDF_URL));
        when(h.rt().getForObject(PDF_URL, byte[].class)).thenReturn(pdf);

        ModelContractManifestDTO out = h.svc().getCurrent();

        assertThat(out.getVersion()).isEqualTo(VERSION);
        assertThat(out.getSha256()).isEqualTo(sha);

        // Segunda llamada: versión ya verificada -> no re-descarga el PDF.
        h.svc().getCurrent();
        verify(h.rt(), times(1)).getForObject(eq(PDF_URL), eq(byte[].class));
    }

    @Test
    void fallaSecureSiElShaDelManifestNoCoincideConElPdf() throws Exception {
        var h = harness();
        byte[] pdf = "PDF-REAL".getBytes();
        String shaDeOtroContenido = sha256Upper("PDF-DISTINTO".getBytes()); // formato válido, no casa
        when(h.rt().getForObject(MANIFEST_URL, ModelContractManifestDTO.class))
                .thenReturn(manifest(VERSION, shaDeOtroContenido, PDF_URL));
        when(h.rt().getForObject(PDF_URL, byte[].class)).thenReturn(pdf);

        assertThatThrownBy(() -> h.svc().getCurrent())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Integridad");
    }

    @Test
    void rechazaManifestNulo() {
        var h = harness();
        when(h.rt().getForObject(MANIFEST_URL, ModelContractManifestDTO.class)).thenReturn(null);
        assertThatThrownBy(() -> h.svc().getCurrent()).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rechazaVersionConFormatoInvalido() throws Exception {
        var h = harness();
        byte[] pdf = "x".getBytes();
        when(h.rt().getForObject(MANIFEST_URL, ModelContractManifestDTO.class))
                .thenReturn(manifest("v1-mal", sha256Upper(pdf), PDF_URL));
        assertThatThrownBy(() -> h.svc().getCurrent())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("version");
    }

    @Test
    void rechazaSha256ConFormatoInvalido() {
        var h = harness();
        when(h.rt().getForObject(MANIFEST_URL, ModelContractManifestDTO.class))
                .thenReturn(manifest(VERSION, "NO-ES-UN-SHA", PDF_URL));
        assertThatThrownBy(() -> h.svc().getCurrent())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("sha256");
    }

    @Test
    void rechazaUrlDistintaDeLaEsperada() throws Exception {
        var h = harness();
        byte[] pdf = "x".getBytes();
        when(h.rt().getForObject(MANIFEST_URL, ModelContractManifestDTO.class))
                .thenReturn(manifest(VERSION, sha256Upper(pdf), "https://otro.host/legal/model_contract.pdf"));
        assertThatThrownBy(() -> h.svc().getCurrent())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("url");
    }

    @Test
    void rechazaPdfVacio() throws Exception {
        var h = harness();
        when(h.rt().getForObject(MANIFEST_URL, ModelContractManifestDTO.class))
                .thenReturn(manifest(VERSION, sha256Upper(new byte[]{1}), PDF_URL));
        when(h.rt().getForObject(PDF_URL, byte[].class)).thenReturn(new byte[0]);
        assertThatThrownBy(() -> h.svc().getCurrent())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("vacío");
    }
}
