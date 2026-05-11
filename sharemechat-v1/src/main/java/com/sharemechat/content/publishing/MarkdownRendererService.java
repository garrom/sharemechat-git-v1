package com.sharemechat.content.publishing;

import com.vladsch.flexmark.html.HtmlRenderer;
import com.vladsch.flexmark.parser.Parser;
import com.vladsch.flexmark.util.ast.Node;
import com.vladsch.flexmark.util.data.MutableDataSet;
import jakarta.annotation.PostConstruct;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Service;

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
     * Caveat conocido v1: si la sintaxis aparece dentro de un fenced
     * code block, tambien se procesa. Limitacion documentada.
     *
     * Si falta el cierre :::, el bloque queda literal (no rompe).
     */
    private String preprocessCallouts(String markdown) {
        if (markdown == null || markdown.isEmpty()) return markdown;
        return CALLOUT_PATTERN.matcher(markdown)
                .replaceAll("<div class=\"callout\">\n\n$1\n\n</div>");
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
        return Jsoup.clean(rawHtml, safelist);
    }
}
