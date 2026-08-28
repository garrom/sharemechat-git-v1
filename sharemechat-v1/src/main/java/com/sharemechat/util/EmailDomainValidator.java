package com.sharemechat.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.naming.NameNotFoundException;
import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import java.util.Hashtable;

/**
 * Valida que el DOMINIO de un email exista (tiene registro MX o A en DNS).
 * Objetivo: cazar typos de dominio tipo "gmil.com" que hoy pasan la validación
 * de sintaxis, crean cuenta y luego el correo de verificación rebota en silencio
 * (el usuario ve "registro con éxito" pero nunca recibe el email).
 *
 * <p>Diseño deliberado:
 * <ul>
 *   <li><b>Fail-open</b>: solo rechaza cuando el DNS confirma que el dominio NO
 *       existe (NXDOMAIN) o no tiene ni MX ni A. Ante timeout/error de red devuelve
 *       válido, para no bloquear a usuarios legítimos por un fallo transitorio.</li>
 *   <li><b>Timeout corto</b> (3s, 1 reintento) para no colgar el registro.</li>
 *   <li>NO detecta typos en la parte local (buzón inexistente en dominio válido);
 *       eso solo lo caza el rebote real. Aquí cubrimos "el dominio no existe",
 *       que es el caso pedido.</li>
 * </ul>
 */
public final class EmailDomainValidator {

    private static final Logger log = LoggerFactory.getLogger(EmailDomainValidator.class);

    private EmailDomainValidator() {
    }

    /**
     * Extrae el dominio de un email en minúsculas, o null si el email no tiene
     * forma mínima válida (un '@' con dominio con al menos un punto).
     */
    static String extractDomain(String email) {
        if (email == null) {
            return null;
        }
        String e = email.trim();
        int at = e.lastIndexOf('@');
        if (at <= 0 || at == e.length() - 1) {
            return null;
        }
        String domain = e.substring(at + 1).toLowerCase();
        if (domain.isEmpty() || !domain.contains(".") || domain.startsWith(".") || domain.endsWith(".")) {
            return null;
        }
        return domain;
    }

    /**
     * @return true si el email tiene forma válida y su dominio resuelve (MX o A),
     *         o si el DNS falla de forma transitoria (fail-open). false solo cuando
     *         el email está malformado o el dominio NO existe / sin MX ni A.
     */
    public static boolean domainLikelyValid(String email) {
        String domain = extractDomain(email);
        if (domain == null) {
            return false;
        }
        Hashtable<String, String> env = new Hashtable<>();
        env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
        env.put("com.sun.jndi.dns.timeout.initial", "3000");
        env.put("com.sun.jndi.dns.timeout.retries", "1");

        DirContext ctx = null;
        try {
            ctx = new InitialDirContext(env);
            Attributes attrs = ctx.getAttributes(domain, new String[]{"MX", "A"});
            boolean resolves = attrs.get("MX") != null || attrs.get("A") != null;
            if (!resolves) {
                log.info("[EMAIL-DOMAIN] dominio sin MX ni A, rechazado: {}", domain);
            }
            return resolves;
        } catch (NameNotFoundException nx) {
            // NXDOMAIN: el dominio no existe. Rechazo con confianza.
            log.info("[EMAIL-DOMAIN] dominio inexistente (NXDOMAIN), rechazado: {}", domain);
            return false;
        } catch (Exception ex) {
            // Timeout / error de red / DNS no disponible: fail-open (no bloquear).
            log.warn("[EMAIL-DOMAIN] lookup DNS falló para '{}' ({}), se acepta (fail-open)",
                    domain, ex.getClass().getSimpleName());
            return true;
        } finally {
            if (ctx != null) {
                try {
                    ctx.close();
                } catch (Exception ignore) {
                    // no-op
                }
            }
        }
    }
}
