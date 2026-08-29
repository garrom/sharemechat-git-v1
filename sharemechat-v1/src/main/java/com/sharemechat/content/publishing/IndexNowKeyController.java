package com.sharemechat.content.publishing;

import com.sharemechat.config.IndexNowProperties;
import com.sharemechat.config.PublicSiteProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sirve el fichero de clave de IndexNow (ADR-062).
 *
 * <p>El protocolo demuestra la propiedad del dominio publicando en la raiz un
 * fichero de texto cuyo <b>nombre y contenido son la misma clave</b>. Debe
 * estar en la raiz: una clave en subdirectorio solo autorizaria las URLs de
 * ese subdirectorio, no el host entero.
 *
 * <p>Servirlo desde backend, y no como objeto del bucket, tiene dos motivos:
 * <ul>
 *   <li>La raiz del bucket es el destino del sync de despliegue de frontend.
 *       Un objeto suelto ahi depende de que ningun despliegue lo barra. Con
 *       el Custom Error Response convirtiendo el 403 de S3 en 200 + shell
 *       SPA, su desaparicion seria <b>silenciosa</b>: los envios pasarian a
 *       responder 403 sin que nada lo delatase.</li>
 *   <li>Aqui la clave queda bajo el mismo gate {@code isProdApex()} que
 *       {@code /robots.txt} y {@code /sitemap.xml}, en vez de estar publicada
 *       incondicionalmente.</li>
 * </ul>
 *
 * <p><b>Requisito de infraestructura:</b> la distribucion CloudFront debe
 * enrutar {@code /<clave>.txt} al origen del backend con una cache behavior,
 * igual que ya hace con {@code /sitemap.xml} y {@code /robots.txt}. Sin ella
 * la peticion cae al bucket y este controller no llega a ejecutarse. Al rotar
 * la clave hay que actualizar tambien esa behavior.
 *
 * <p>El patron del path exige 8 caracteres minimo, de modo que no puede
 * colisionar con {@code /robots.txt} (6 caracteres), que sirve
 * {@link SitemapController}.
 */
@RestController
public class IndexNowKeyController {

    private final IndexNowProperties props;
    private final PublicSiteProperties siteProperties;

    public IndexNowKeyController(IndexNowProperties props, PublicSiteProperties siteProperties) {
        this.props = props;
        this.siteProperties = siteProperties;
    }

    @GetMapping(value = "/{key:[a-zA-Z0-9-]{8,128}}.txt", produces = "text/plain; charset=UTF-8")
    public ResponseEntity<String> indexNowKey(@PathVariable("key") String key) {
        // Fuera del apex PROD no existe: ningun entorno secundario debe
        // acreditar propiedad del dominio ni invitar a que le rastreen.
        if (!siteProperties.isProdApex()) {
            return ResponseEntity.notFound().build();
        }
        if (!props.hasValidKey()) {
            return ResponseEntity.notFound().build();
        }
        // Comparacion sensible a mayusculas y en tiempo constante: no es un
        // secreto, pero tampoco hay motivo para convertir el endpoint en un
        // oraculo que confirme prefijos de la clave configurada.
        if (!java.security.MessageDigest.isEqual(
                key.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                props.getKey().getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
            return ResponseEntity.notFound().build();
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setCacheControl("public, max-age=3600");
        return ResponseEntity.ok().headers(headers).body(props.getKey());
    }
}
