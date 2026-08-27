package com.sharemechat.facts;

import com.sharemechat.config.ProductOperationalProperties;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-061 "Facts as Code" — cierre de bucle del Motor 1 para el dominio product-modes.
 *
 * <p>Verifica que la fuente única {@code docs/_data/product-modes.yaml} (de la que se
 * genera la lista de modos en ADR-009 y otros docs) coincide EXACTAMENTE, y en orden,
 * con el enum {@link ProductOperationalProperties.Mode} que gobierna el sistema.
 *
 * <p>Si se añade, quita o renombra un modo en el enum y no en el YAML (o al revés),
 * este test falla. Es un unit test puro (sin Spring ni Docker): el ancla es el enum,
 * no la BD.
 */
class ProductModesSsotTest {

    @Test
    void yamlModesMatchModeEnumInOrder() {
        List<String> yamlCodes = loadYamlModeCodes();
        List<String> enumCodes = Arrays.stream(ProductOperationalProperties.Mode.values())
                .map(Enum::name)
                .toList();

        assertThat(yamlCodes)
                .as("los 'code' de product-modes.yaml deben coincidir (y en orden) con el enum "
                        + "ProductOperationalProperties.Mode; si difieren, el enum cambió y el YAML no, o al revés")
                .isEqualTo(enumCodes);
    }

    @SuppressWarnings("unchecked")
    private List<String> loadYamlModeCodes() {
        File yamlFile = locateYaml();
        Map<String, Object> root;
        try (InputStream in = new FileInputStream(yamlFile)) {
            root = new Yaml().load(in);
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo leer " + yamlFile.getAbsolutePath(), ex);
        }
        List<Map<String, Object>> rows = (List<Map<String, Object>>) root.get("modes");
        assertThat(rows).as("product-modes.yaml debe tener una lista 'modes' no vacía").isNotEmpty();

        List<String> codes = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            codes.add(String.valueOf(r.get("code")));
        }
        return codes;
    }

    private static File locateYaml() {
        String[] candidates = {
                "docs/_data/product-modes.yaml",
                "sharemechat-v1/docs/_data/product-modes.yaml",
                "../sharemechat-v1/docs/_data/product-modes.yaml",
        };
        for (String c : candidates) {
            File f = new File(c);
            if (f.isFile()) {
                return f;
            }
        }
        throw new IllegalStateException(
                "No se encontró product-modes.yaml (user.dir=" + System.getProperty("user.dir") + ")");
    }
}
