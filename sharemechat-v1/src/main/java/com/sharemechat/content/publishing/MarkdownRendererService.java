package com.sharemechat.content.publishing;

import com.vladsch.flexmark.html.HtmlRenderer;
import com.vladsch.flexmark.parser.Parser;
import com.vladsch.flexmark.util.ast.Node;
import com.vladsch.flexmark.util.data.MutableDataSet;
import jakarta.annotation.PostConstruct;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Convierte Markdown a HTML seguro para servir publicamente.
 *
 * Pipeline interno:
 *  1. Parser Flexmark (CommonMark + extensiones GFM minimas habilitadas
 *     implicitamente por Flexmark base).
 *  2. HtmlRenderer Flexmark.
 *  3. Sanitizacion jsoup con allowlist explicita: solo tags semanticos
 *     basicos para articulos editoriales. Sin scripts, iframes, styles
 *     inline, atributos JS, ni HTML inline pasado del Markdown.
 *
 * Stateless tras @PostConstruct. Sin dependencias de S3, BD ni dominio.
 * Reusable desde cualquier capa.
 *
 * Fase 4A: el output va al endpoint publico /api/public/content/articles/{slug}
 * directamente al frontend. No hay generacion de HTML estatico todavia.
 */
@Service
public class MarkdownRendererService {

    private Parser parser;
    private HtmlRenderer renderer;
    private Safelist safelist;

    private static final Pattern CALLOUT_PATTERN = Pattern.compile(
            "(?ms)^:::callout[ \\t]*\\R(.*?)\\R^:::[ \\t]*$"
    );

    // H5 (hardening Lote 2, 2026-06-08): neutraliza `</div>` literal
    // (case-insensitive) dentro del contenido del callout. Sin esto, un
    // autor que escriba `</div>` en el cuerpo cierra prematuramente el
    // wrapper <div class="callout">...</div>. jsoup balancea despues,
    // pero asi se elimina la fuente del desbalance. El `:::` dentro del
    // cuerpo NO requiere escape: el regex exige `^:::[ \\t]*$` (linea
    // entera), un `:::` en mitad de linea no matchea el cierre.
    private static final Pattern CALLOUT_DIV_CLOSE = Pattern.compile(
            "</\\s*div\\s*>", Pattern.CASE_INSENSITIVE
    );

    // H4 (hardening Lote 2, 2026-06-08): valores permitidos para el
    // atributo `class` en <code>/<pre> generados por flexmark para
    // resaltado de sintaxis (`language-js`, `language-bash`, etc.).
    private static final Pattern CLASS_LANGUAGE_PATTERN = Pattern.compile(
            "^language-[A-Za-z0-9_+\\-]+$"
    );
    private static final String CALLOUT_CLASS = "callout";

    @PostConstruct
    void init() {
        MutableDataSet options = new MutableDataSet();
        // Defaults razonables: parrafos separados por linea en blanco; saltos de
        // linea simples no producen <br>, dos espacios al final si.
        options.set(HtmlRenderer.SOFT_BREAK, "\n");
        options.set(HtmlRenderer.HARD_BREAK, "<br />\n");
        this.parser = Parser.builder(options).build();
        this.renderer = HtmlRenderer.builder(options).build();

        // Allowlist editorial minima Fase 4A. No incluye img/video/iframe.
        // Las imagenes se introducen en una fase posterior cuando exista
        // pipeline de upload/serving de assets.
        this.safelist = new Safelist()
                .addTags("h2", "h3", "p", "ul", "ol", "li",
                         "a", "strong", "em", "code", "pre", "blockquote", "hr", "br",
                         "div")
                .addAttributes("a", "href", "title")
                .addEnforcedAttribute("a", "rel", "nofollow noopener")
                .addProtocols("a", "href", "http", "https", "mailto")
                .addAttributes("code", "class")          // permite class="language-xxx"
                .addAttributes("pre", "class")
                .addAttributes("div", "class");          // permite <div class="callout"> (caveat: cualquier valor de class)
    }

    /**
     * Pre-procesa la sintaxis :::callout ... ::: en el Markdown crudo
     * y la convierte en <div class="callout">...</div> antes de pasarla
     * a flexmark. Las lineas en blanco son criticas para que flexmark
     * parsee el contenido como Markdown dentro del div.
     *
     * H5 (hardening Lote 2, 2026-06-08): cualquier `</div>` literal
     * dentro del cuerpo del callout se neutraliza a `&lt;/div&gt;` antes
     * de generar el wrapper. Esto evita que el autor pueda cerrar
     * prematuramente el <div class="callout"> y que tags posteriores
     * queden fuera. jsoup balancea/limpia despues, asi que el daño
     * residual era bajo (no XSS), pero queda cerrado por construccion.
     *
     * Caveat conocido v1: si la sintaxis aparece dentro de un fenced
     * code block, tambien se procesa. Limitacion documentada.
     *
     * Si falta el cierre :::, el bloque queda literal (no rompe).
     */
    private String preprocessCallouts(String markdown) {
        if (markdown == null || markdown.isEmpty()) return markdown;
        return CALLOUT_PATTERN.matcher(markdown).replaceAll(match -> {
            String body = match.group(1);
            // Neutralizar cualquier </div> literal en el body.
            String sanitized = CALLOUT_DIV_CLOSE.matcher(body).replaceAll("&lt;/div&gt;");
            // Re-quoting necesario porque replaceAll(Function) interpreta
            // $ y \ del retorno como referencias. Matcher.quoteReplacement
            // los neutraliza.
            return java.util.regex.Matcher.quoteReplacement(
                    "<div class=\"callout\">\n\n" + sanitized + "\n\n</div>"
            );
        });
    }

    /**
     * Convierte Markdown crudo en HTML seguro listo para inyectar en cliente.
     * Devuelve "" para entrada nula o vacia.
     */
    public String renderMarkdownToSafeHtml(String markdown) {
        if (markdown == null || markdown.isBlank()) {
            return "";
        }
        Node document = parser.parse(preprocessCallouts(markdown));
        String rawHtml = renderer.render(document);
        if (rawHtml == null || rawHtml.isEmpty()) {
            return "";
        }
        String cleaned = Jsoup.clean(rawHtml, safelist);
        return filterClasses(cleaned);
    }

    /**
     * H4 (hardening Lote 2, 2026-06-08): jsoup permite el atributo
     * `class` con valor LIBRE en div/code/pre (no soporta whitelist de
     * valores nativa). Hacemos una pasada post-clean que conserva solo
     * los valores aceptados y elimina el resto:
     *
     *   - div  -> solo `callout` (generado por preprocessCallouts).
     *   - code/pre -> solo `language-*` (resaltado de sintaxis de
     *     flexmark, p. ej. `language-js`).
     *
     * Si tras filtrar no queda ninguna clase util, se elimina el
     * atributo `class` por completo. El resto de la estructura HTML
     * (tags, otros atributos, texto) no se altera.
     *
     * Reparseo con Jsoup.parseBodyFragment para no introducir
     * &lt;html&gt;/&lt;body&gt;; serializamos con `body().html()` que
     * devuelve un fragment limpio.
     */
    private String filterClasses(String html) {
        Document doc = Jsoup.parseBodyFragment(html);
        for (Element el : doc.body().getAllElements()) {
            if (!el.hasAttr("class")) continue;
            String tag = el.tagName();
            Set<String> kept = new LinkedHashSet<>();
            for (String c : el.classNames()) {
                if (c.isEmpty()) continue;
                if ("div".equals(tag) && CALLOUT_CLASS.equals(c)) {
                    kept.add(c);
                } else if (("code".equals(tag) || "pre".equals(tag))
                        && CLASS_LANGUAGE_PATTERN.matcher(c).matches()) {
                    kept.add(c);
                }
                // Cualquier otra combinacion (tag,clase) -> descartar.
            }
            if (kept.isEmpty()) {
                el.removeAttr("class");
            } else {
                el.attr("class", String.join(" ", kept));
            }
        }
        return doc.body().html();
    }
}
