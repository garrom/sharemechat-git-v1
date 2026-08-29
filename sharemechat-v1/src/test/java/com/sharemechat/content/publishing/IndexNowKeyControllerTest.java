package com.sharemechat.content.publishing;

import com.sharemechat.config.IndexNowProperties;
import com.sharemechat.config.PublicSiteProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Cobertura del fichero de clave de IndexNow (ADR-062).
 *
 * <p>Dos invariantes que este test blinda:
 * <ul>
 *   <li><b>Solo el apex PROD acredita propiedad del dominio.</b> Mismo
 *       fail-closed que robots.txt y sitemap.xml (ADR-033): un entorno
 *       secundario que sirviera la clave estaria invitando a que le
 *       rastreen, justo lo contrario de lo que decide ese ADR.</li>
 *   <li><b>El endpoint no es un oraculo.</b> Cualquier nombre que no sea
 *       exactamente la clave devuelve 404, sin pistas.</li>
 * </ul>
 */
class IndexNowKeyControllerTest {

    private static final String KEY = "9bb7f3ea34ff3c920a64c259827b776d";

    private IndexNowKeyController controller(String baseUrl, String key, boolean enabled) {
        PublicSiteProperties site = new PublicSiteProperties();
        site.setBaseUrl(baseUrl);
        IndexNowProperties props = new IndexNowProperties();
        props.setKey(key);
        props.setEnabled(enabled);
        return new IndexNowKeyController(props, site);
    }

    @Test
    void prodApexServesTheKey() {
        ResponseEntity<String> resp = controller("https://sharemechat.com", KEY, true).indexNowKey(KEY);
        assertEquals(200, resp.getStatusCode().value());
        assertEquals(KEY, resp.getBody(), "el cuerpo debe ser la clave exacta, sin adornos");
    }

    @Test
    void servedEvenWhenSubmissionIsDisabled() {
        // enabled gobierna el ENVIO, no la acreditacion de propiedad. Si se
        // apagara la clave al desactivar el envio, reactivarlo obligaria a
        // esperar de nuevo a que el buscador revalidase el dominio.
        ResponseEntity<String> resp = controller("https://sharemechat.com", KEY, false).indexNowKey(KEY);
        assertEquals(200, resp.getStatusCode().value());
        assertEquals(KEY, resp.getBody());
    }

    @Test
    void nonProdEnvironmentsNeverServeTheKey() {
        for (String baseUrl : new String[]{
                "https://test.sharemechat.com",
                "https://audit.sharemechat.com",
                "https://www.sharemechat.com",
                "http://sharemechat.com",
                "https://otro-dominio.com",
                ""}) {
            ResponseEntity<String> resp = controller(baseUrl, KEY, true).indexNowKey(KEY);
            assertEquals(404, resp.getStatusCode().value(), "no debe servirse en " + baseUrl);
            assertNull(resp.getBody());
        }
    }

    @Test
    void wrongKeyNameIs404() {
        IndexNowKeyController c = controller("https://sharemechat.com", KEY, true);
        // Prefijo correcto pero incompleto: no debe filtrar que va por buen camino.
        assertEquals(404, c.indexNowKey("9bb7f3ea34ff3c920a64c259827b776").getStatusCode().value());
        assertEquals(404, c.indexNowKey("otra-clave-cualquiera").getStatusCode().value());
        // Sensible a mayusculas.
        assertEquals(404, c.indexNowKey(KEY.toUpperCase()).getStatusCode().value());
    }

    @Test
    void missingOrMalformedConfiguredKeyIs404() {
        assertEquals(404, controller("https://sharemechat.com", null, true).indexNowKey(KEY).getStatusCode().value());
        assertEquals(404, controller("https://sharemechat.com", "", true).indexNowKey(KEY).getStatusCode().value());
        // Demasiado corta para el protocolo (<8): se trata como ausente.
        assertEquals(404, controller("https://sharemechat.com", "corta", true).indexNowKey("corta").getStatusCode().value());
    }
}
