package com.sharemechat.facts;

import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-061 "Facts as Code" — cierre de bucle del Motor 1 para el dominio product-flags.
 *
 * <p>Verifica que la fuente única {@code docs/_data/product-flags.yaml} (de la que se
 * genera la tabla de referencia de flags) coincide EXACTAMENTE con las líneas reales
 * {@code product.*=${ENV_VAR:default}} de {@code application.properties} (classpath).
 *
 * <p>Si se añade, cambia o elimina una flag {@code product.*} en application.properties
 * y no en el YAML (o al revés), este test falla. Unit test puro (sin Spring ni Docker):
 * el ancla es el fichero de propiedades, no la BD.
 */
class ProductFlagsSsotTest {

    // property = ${ENV_VAR:default}  (default puede ser vacío)
    private static final Pattern PROP_RE = Pattern.compile(
            "^(product\\.[\\w.\\-]+)\\s*=\\s*\\$\\{([A-Z0-9_]+):(.*)}\\s*$");

    private record Flag(String envVar, String def) {}

    @Test
    void yamlFlagsMatchApplicationProperties() {
        Map<String, Flag> fromProps = loadFlagsFromProperties();
        Map<String, Flag> fromYaml = loadFlagsFromYaml();

        assertThat(fromYaml.keySet())
                .as("el conjunto de flags product.* en product-flags.yaml vs application.properties "
                        + "(si difiere, se añadió/quitó una flag en un sitio y no en el otro)")
                .isEqualTo(fromProps.keySet());

        for (Map.Entry<String, Flag> e : fromYaml.entrySet()) {
            String prop = e.getKey();
            Flag y = e.getValue();
            Flag p = fromProps.get(prop);
            assertThat(y.envVar()).as(prop + " env_var").isEqualTo(p.envVar());
            assertThat(y.def()).as(prop + " default").isEqualTo(p.def());
        }
    }

    private Map<String, Flag> loadFlagsFromProperties() {
        Map<String, Flag> out = new LinkedHashMap<>();
        try (InputStream in = getClass().getResourceAsStream("/application.properties")) {
            assertThat(in).as("application.properties en el classpath de test").isNotNull();
            BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            String line;
            while ((line = br.readLine()) != null) {
                Matcher m = PROP_RE.matcher(line.trim());
                if (m.matches()) {
                    out.put(m.group(1), new Flag(m.group(2), m.group(3)));
                }
            }
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo leer application.properties", ex);
        }
        assertThat(out).as("debe haber flags product.* en application.properties").isNotEmpty();
        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Flag> loadFlagsFromYaml() {
        File yamlFile = locateYaml();
        Map<String, Object> root;
        try (InputStream in = new FileInputStream(yamlFile)) {
            root = new Yaml().load(in);
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo leer " + yamlFile.getAbsolutePath(), ex);
        }
        List<Map<String, Object>> rows = (List<Map<String, Object>>) root.get("flags");
        assertThat(rows).as("product-flags.yaml debe tener una lista 'flags' no vacía").isNotEmpty();

        Map<String, Flag> out = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            out.put(String.valueOf(r.get("property")),
                    new Flag(String.valueOf(r.get("env_var")), String.valueOf(r.get("default"))));
        }
        return out;
    }

    private static File locateYaml() {
        String[] candidates = {
                "docs/_data/product-flags.yaml",
                "sharemechat-v1/docs/_data/product-flags.yaml",
                "../sharemechat-v1/docs/_data/product-flags.yaml",
        };
        for (String c : candidates) {
            File f = new File(c);
            if (f.isFile()) {
                return f;
            }
        }
        throw new IllegalStateException(
                "No se encontró product-flags.yaml (user.dir=" + System.getProperty("user.dir") + ")");
    }
}
