package com.sharemechat.content.publishing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests del pipeline Markdown -> HTML del CMS publico.
 *
 * Cubre:
 *  - Comportamiento ante input vacio / null / whitespace.
 *  - Conservacion de tags permitidos por la allowlist jsoup.
 *  - Eliminacion de tags fuera de la allowlist (h1/h4/img/script).
 *  - Sintaxis :::callout ... ::: introducida en la sub-pasada A
 *    de la Fase 1 del rediseno del blog.
 *  - Caveats aceptados v1: callout dentro de fenced code block,
 *    cualquier valor de class permitido en <div>.
 *  - Atributo enforced rel="nofollow noopener" en <a>.
 *
 * Estilo seguido: AgeGatePolicyServiceTest.
 * El servicio se instancia directamente y se invoca init() en @BeforeEach
 * (init() es package-private; este test vive en el mismo paquete).
 */
class MarkdownRendererServiceTest {

    private MarkdownRendererService service;

    @BeforeEach
    void setup() {
        service = new MarkdownRendererService();
        service.init();
    }

    @Test
    void renderEmptyMarkdownReturnsEmpty() {
        assertEquals("", service.renderMarkdownToSafeHtml(null));
        assertEquals("", service.renderMarkdownToSafeHtml(""));
        assertEquals("", service.renderMarkdownToSafeHtml("   "));
    }

    @Test
    void renderBasicMarkdownKeepsAllowedTags() {
        String md = "## Titulo\n\nParrafo con **bold** y *italic*.\n\n- item1\n- item2\n\n> cita\n";
        String html = service.renderMarkdownToSafeHtml(md);

        assertTrue(html.contains("<h2>Titulo</h2>"), "h2 should be preserved");
        assertTrue(html.contains("<p>"), "p should be preserved");
        assertTrue(html.contains("<strong>bold</strong>"), "strong should be preserved");
        assertTrue(html.contains("<em>italic</em>"), "em should be preserved");
        assertTrue(html.contains("<ul>"), "ul should be preserved");
        assertTrue(html.contains("<li>item1</li>"), "li item1 should be preserved");
        assertTrue(html.contains("<blockquote>"), "blockquote should be preserved");
    }

    @Test
    void renderH1AndH4AreStripped() {
        String md = "# H1 grande\n\n#### H4 chico\n";
        String html = service.renderMarkdownToSafeHtml(md);

        assertFalse(html.contains("<h1>"), "h1 must be stripped by jsoup allowlist");
        assertFalse(html.contains("<h4>"), "h4 must be stripped by jsoup allowlist");
    }

    @Test
    void renderImgTagIsStripped() {
        String md = "Antes ![alt](https://x.com/a.png) despues.";
        String html = service.renderMarkdownToSafeHtml(md);

        assertFalse(html.contains("<img"), "img must be stripped (not in allowlist)");
    }

    @Test
    void renderScriptInjectionIsStripped() {
        String md = "<script>alert(1)</script>\n\nParrafo normal.";
        String html = service.renderMarkdownToSafeHtml(md);

        assertFalse(html.toLowerCase().contains("<script"),
                "script tag must be stripped (case-insensitive)");
        assertFalse(html.contains("alert(1)"),
                "script body must not survive sanitization");
    }

    @Test
    void preprocessCalloutWithBodyRendersDivCallout() {
        String md = ":::callout\nTexto del aviso.\n:::";
        String html = service.renderMarkdownToSafeHtml(md);

        assertTrue(html.contains("<div class=\"callout\">"),
                "callout block must wrap content in div.callout");
        assertTrue(html.contains("<p>Texto del aviso.</p>"),
                "callout body must render as paragraph inside div");
    }

    @Test
    void preprocessCalloutWithH2InsideRendersDivWithH2() {
        String md = ":::callout\n## Etiqueta\nTexto.\n:::";
        String html = service.renderMarkdownToSafeHtml(md);

        assertTrue(html.contains("<div class=\"callout\">"),
                "callout block must wrap content in div.callout");
        assertTrue(html.contains("<h2>Etiqueta</h2>"),
                "h2 inside callout must render as h2");
        assertTrue(html.contains("<p>Texto.</p>"),
                "paragraph inside callout must render as paragraph");
    }

    @Test
    void preprocessCalloutUnclosedDoesNotCrashAndLeavesLiteral() {
        String md = ":::callout\nTexto sin cierre y nunca cierra.";
        String html = service.renderMarkdownToSafeHtml(md);

        // No exception thrown by reaching here.
        assertFalse(html.contains("<div class=\"callout\">"),
                "unclosed callout must NOT produce div.callout wrapper");
    }

    @Test
    void preprocessMultipleCalloutsEachWrappedIndependently() {
        String md = ":::callout\nUno\n:::\n\nMedio.\n\n:::callout\nDos\n:::";
        String html = service.renderMarkdownToSafeHtml(md);

        assertTrue(html.contains("Uno"), "first callout body must appear");
        assertTrue(html.contains("Dos"), "second callout body must appear");
        assertTrue(html.contains("Medio."), "text between callouts must survive");
        assertEquals(2, count(html, "<div class=\"callout\">"),
                "two independent callout wrappers expected");
    }

    @Test
    void preprocessCalloutInsideCodeBlockIsCurrentlyTransformed() {
        // Caveat v1 documentado: el regex pre-flexmark no salta fenced code
        // blocks. Si el operador escribe ::: dentro de un bloque ```...```,
        // el preprocesado SI ocurre (el regex matchea ::: al inicio de linea
        // sin distinguir contexto), pero flexmark luego serializa todo el
        // contenido del fenced block como <pre><code> escapado. Resultado
        // visible: el HTML del div aparece como TEXTO ESCAPADO dentro del
        // bloque de codigo (&lt;div class="callout"&gt;...), no como callout
        // funcional. Esta asercion fija ese comportamiento.
        // Si v2 mejora la logica para saltar fenced regions, este test
        // cambia con el codigo.
        String md = "```\n:::callout\ntexto\n:::\n```";
        String html = service.renderMarkdownToSafeHtml(md);

        assertTrue(html.contains("<pre><code>"),
                "fenced code block must be preserved");
        assertTrue(html.contains("&lt;div class=\"callout\"&gt;"),
                "preprocessing did happen: div tag appears escaped inside code block");
        assertFalse(html.contains("<div class=\"callout\">"),
                "no real div.callout: the wrapper is inside the escaped code block, not active");
    }

    @Test
    void renderDivWithNonWhitelistedClassLosesClass() {
        // H4 (hardening Lote 2, 2026-06-08): el atributo class del <div>
        // queda limitado a la whitelist {callout}. Cualquier otro valor
        // se elimina; si tras filtrar no queda nada util, se quita el
        // atributo `class` por completo. El div como tag sigue
        // permitido (esta en la allowlist jsoup), solo cambia la
        // higiene de su atributo `class`.
        String md = "Antes\n\n<div class=\"evil-xss\">contenido</div>\n\nDespues.";
        String html = service.renderMarkdownToSafeHtml(md);

        assertFalse(html.contains("class=\"evil-xss\""),
                "non-whitelisted class must be stripped from div");
        assertTrue(html.contains("contenido"),
                "div content must remain after class strip");
    }

    @Test
    void renderDivWithCalloutClassIsPreserved() {
        // H4 whitelist: "callout" SI esta en la whitelist de clases para
        // <div>, asi que se conserva (este es el valor que emite el
        // preprocesador de :::callout).
        String md = ":::callout\nTexto.\n:::";
        String html = service.renderMarkdownToSafeHtml(md);

        assertTrue(html.contains("<div class=\"callout\">"),
                "callout class must be preserved on div generated by preprocessor");
    }

    @Test
    void renderCodeBlockLanguageClassIsPreserved() {
        // H4 whitelist: code/pre admiten class language-*. Flexmark emite
        // <pre><code class="language-js"> para fenced code blocks con
        // marcador de lenguaje; esa clase debe sobrevivir.
        String md = "```js\nconst a = 1;\n```";
        String html = service.renderMarkdownToSafeHtml(md);

        assertTrue(html.contains("class=\"language-js\""),
                "language-js class must be preserved on code element");
    }

    @Test
    void renderCodeBlockBogusClassIsStripped() {
        // H4 whitelist: cualquier class que NO match ^language-[A-Za-z0-9_+-]+$
        // se elimina. Probamos con HTML crudo `<code class="evil">`.
        String md = "Inline `code` y luego:\n\n<code class=\"evil\">x</code>";
        String html = service.renderMarkdownToSafeHtml(md);

        assertFalse(html.contains("class=\"evil\""),
                "non-language class on code must be stripped");
    }

    @Test
    void preprocessCalloutWithDivCloseInBodyIsNeutralized() {
        // H5 (hardening Lote 2, 2026-06-08): un `</div>` literal dentro
        // del cuerpo del callout cerraba prematuramente el wrapper. La
        // neutralizacion lo transforma en texto escapado.
        String md = ":::callout\nTexto con </div> en medio.\n:::";
        String html = service.renderMarkdownToSafeHtml(md);

        // El wrapper sigue siendo UNO solo (no se duplica por desbalance).
        assertEquals(1, count(html, "<div class=\"callout\">"),
                "wrapper callout must remain balanced exactly once");
        // El </div> literal del autor NO debe aparecer como tag activo
        // (no debe haber un cierre de div extra entre el de apertura y
        // el de cierre real del wrapper).
        // En la salida final el </div> aparece como texto (jsoup escapa).
        // Lo seguro es contar </div>: debe haber 1 (el del cierre del wrapper).
        assertEquals(1, count(html, "</div>"),
                "only one </div> closing tag must survive (the wrapper's)");
    }

    @Test
    void renderAnchorEnforcesNofollow() {
        String md = "[texto](https://x.com)";
        String html = service.renderMarkdownToSafeHtml(md);

        assertTrue(html.contains("rel=\"nofollow noopener\""),
                "anchor must always have enforced rel=\"nofollow noopener\"");
    }

    private int count(String haystack, String needle) {
        int n = 0;
        int i = 0;
        while ((i = haystack.indexOf(needle, i)) != -1) {
            n++;
            i += needle.length();
        }
        return n;
    }
}
