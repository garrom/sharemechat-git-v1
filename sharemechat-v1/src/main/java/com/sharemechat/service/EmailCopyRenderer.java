package com.sharemechat.service;

import com.sharemechat.config.ProductOperationalProperties;
import com.sharemechat.entity.User;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class EmailCopyRenderer {

    /**
     * URL del logo PNG email-safe (172x18 wordmark "SharemeChat" con C
     * en rojo, alpha-blend optimizado sobre fondo blanco). Se sirve
     * desde el CDN canonico de assets PROD (assets.sharemechat.com).
     * Los entornos AUDIT/TEST tendran el mismo path replicado en sus
     * respectivos buckets cuando sus distribuciones de assets queden
     * cableadas; mientras tanto los emails enviados desde AUDIT/TEST
     * apuntaran al mismo PROD CDN (el asset es publico y estable).
     */
    private static final String BRAND_LOGO_URL =
            "https://assets.sharemechat.com/brand/sharemechat-logo.png";

    /**
     * Imagen ilustrativa del estado coming-soon (PRELAUNCH). 600x400
     * JPEG progressive q85, derivado del mismo asset visual del
     * PreLaunchScreen frontend pero convertido de WebP a JPEG por
     * compatibilidad con clientes de email (Outlook desktop y otros
     * fallan al renderizar WebP). Alojada en
     * assets-sharemechat-prod/email/ (path durable, no afectado por
     * el sync --delete del bucket frontend-prod). Solo se inserta en
     * el cuerpo de bienvenida bajo PRELAUNCH; nunca en verificacion
     * ni en otras plantillas.
     */
    private static final String COMING_SOON_IMAGE_URL =
            "https://assets.sharemechat.com/email/coming-soon_v1.jpg";

    /**
     * Hero apaisado (1200x600 JPEG, tono de piel corregido) para el email de
     * REGISTRO con el marco de marca nuevo (cabecera logo + hero + boton CTA).
     * Alojado en assets-sharemechat-prod/email/ (path durable, servido por el
     * CDN publico assets.sharemechat.com para TEST/AUDIT/PROD). Solo se usa en
     * las plantillas de registro (verificacion), no en el resto de emails.
     */
    private static final String REGISTER_HERO_URL =
            "https://assets.sharemechat.com/email/register-hero_v1.jpg";

    private final EmailLocaleResolver localeResolver;
    private final AssetRejectionReasonCopy assetRejectionReasonCopy;
    private final ProductOperationalModeService operationalMode;

    public EmailCopyRenderer(EmailLocaleResolver localeResolver,
                             AssetRejectionReasonCopy assetRejectionReasonCopy,
                             ProductOperationalModeService operationalMode) {
        this.localeResolver = localeResolver;
        this.assetRejectionReasonCopy = assetRejectionReasonCopy;
        this.operationalMode = operationalMode;
    }

    /**
     * Envuelve el cuerpo HTML del email con el logo de marca en el PIE
     * (alineado a la izquierda, todas las plantillas en ambos modos
     * PRELAUNCH/OPEN). Estructura email-safe (tabla con
     * role=presentation, inline styles, sin CSS externo) compatible con
     * Gmail web/iOS/Android, Outlook desktop/365, Apple Mail, Yahoo.
     *
     * Maqueta v2 aprobada 2026-06-06: el logo se movio de cabecera
     * centrada a pie alineado izquierda.
     */
    private static String wrapWithLogo(String innerHtml) {
        return wrapWithLogoAndImage(innerHtml, null, null);
    }

    /**
     * Variante con imagen ilustrativa colocada entre el cuerpo y el
     * pie del logo (en este orden vertical: cuerpo / imagen / logo
     * izquierda). Pensada para la bienvenida coming-soon (PRELAUNCH).
     *
     * @param imageUrl  URL absoluta de la imagen ilustrativa (HTTPS).
     *                  Null o vacio = no se incluye bloque de imagen
     *                  (equivalente a {@link #wrapWithLogo(String)}).
     * @param imageAlt  Texto alternativo accesible para la imagen
     *                  (los clientes de email que bloquean imagenes
     *                  por defecto lo muestran en su lugar; el cuerpo
     *                  ya es autosuficiente sin la imagen).
     */
    private static String wrapWithLogoAndImage(String innerHtml,
                                               String imageUrl,
                                               String imageAlt) {
        String imageBlock = "";
        if (imageUrl != null && !imageUrl.isBlank()) {
            String safeAlt = imageAlt == null ? "" : imageAlt;
            imageBlock = """
                      <tr>
                        <td align="left" style="padding: 16px 24px 0 24px;">
                          <img src="%s" alt="%s" width="360" style="display:block; max-width:360px; height:auto; border:0; outline:none; text-decoration:none;" />
                        </td>
                      </tr>
                    """.formatted(imageUrl, safeAlt);
        }
        return """
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="background:#ffffff;">
                  <tr>
                    <td style="padding: 24px 24px 0 24px; color:#0f172a; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6;">
                %s
                    </td>
                  </tr>
                %s
                  <tr>
                    <td align="left" style="padding: 24px;">
                      <img src="%s" width="172" height="18" alt="SharemeChat" style="display:block; max-width:172px; height:auto; border:0; outline:none; text-decoration:none;" />
                    </td>
                  </tr>
                </table>
                """.formatted(innerHtml, imageBlock, BRAND_LOGO_URL);
    }

    // ------------------------------------------------------------------
    // Marco de marca para emails de REGISTRO (verificacion). Cabecera con
    // logo + filo rojo, hero opcional, boton CTA rojo "bulletproof" y pie
    // con identidad. Email-safe (tablas + estilos inline, sin CSS externo).
    // De momento SOLO lo usa renderVerification; el resto de emails siguen
    // con wrapWithLogo. Se construye con .replace() (no printf) para no
    // pelearse con los '%' de los estilos y del VML de Outlook.
    // ------------------------------------------------------------------

    /**
     * Boton CTA "bulletproof": VML (v:roundrect) para Outlook desktop/365 y
     * un &lt;a&gt; estilado para el resto. Rojo de marca. La URL y el label se
     * escapan HTML (la URL se usa como atributo href).
     */
    private String ctaButton(String url, String label) {
        String u = htmlEscape(url);
        String l = htmlEscape(label);
        String tpl = """
                <div style="margin:6px 0 26px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="__URL__" style="height:48px;v-text-anchor:middle;width:270px;" arcsize="18%" strokecolor="#ea1d1d" fillcolor="#ea1d1d">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">__LABEL__</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="__URL__" style="display:inline-block;background:#ea1d1d;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;line-height:1;padding:15px 32px;border-radius:9px;">__LABEL__</a>
                  <!--<![endif]-->
                </div>
                """;
        return tpl.replace("__URL__", u).replace("__LABEL__", l);
    }

    /**
     * Cuerpo estandar de un email de registro: titular + linea de apoyo +
     * boton CTA + enlace crudo como fallback + caducidad y aviso de seguridad.
     * {@code headline}/{@code subline} vienen ya como HTML (con el nickname ya
     * escapado). {@code link} se escapa aqui para el fallback y dentro de
     * {@link #ctaButton} para el href.
     */
    private String registrationBody(String headline, String subline, String ctaLabel,
                                    String link, String expiryText, boolean es) {
        String fbLabel = es ? "&iquest;El bot&oacute;n no funciona? Copia y pega este enlace:"
                            : "Button not working? Copy and paste this link:";
        String expiry  = es ? ("El enlace caduca en " + expiryText + ".")
                            : ("This link expires in " + expiryText + ".");
        String safety  = es ? " Si no te has registrado en SharemeChat, puedes ignorar este mensaje."
                            : " If you didn't sign up for SharemeChat, you can safely ignore this message.";
        String safeLink = htmlEscape(link);
        return "<h1 style=\"font-size:22px;font-weight:bold;margin:0 0 10px;color:#141820;line-height:1.25;\">" + headline + "</h1>"
             + "<p style=\"margin:0 0 24px;color:#42505f;font-size:15px;line-height:1.6;\">" + subline + "</p>"
             + ctaButton(link, ctaLabel)
             + "<p style=\"margin:0 0 8px;font-size:12.5px;color:#7a8798;\">" + fbLabel + "</p>"
             + "<p style=\"margin:0;font-size:12.5px;color:#5b6b7d;word-break:break-all;background:#f6f7f9;border:1px solid #eceef1;border-radius:8px;padding:10px 12px;font-family:Arial,Helvetica,sans-serif;\">" + safeLink + "</p>"
             + "<p style=\"margin:18px 0 0;font-size:12.5px;color:#8a95a3;line-height:1.55;\">" + expiry + safety + "</p>";
    }

    /**
     * Envuelve el cuerpo de un email de registro con el marco de marca:
     * caja centrada de 600px, cabecera (logo + filo rojo), hero opcional,
     * cuerpo y pie con identidad (empresa + soporte). {@code locale} solo
     * cambia el "Necesitas ayuda / Need help" del pie.
     */
    private String wrapRegistration(String bodyInner, boolean withHero, String locale) {
        boolean es = "es".equals(locale);
        String hero = withHero
                ? "<tr><td style=\"padding:0;font-size:0;line-height:0;\">"
                  + "<img src=\"" + REGISTER_HERO_URL + "\" width=\"600\" alt=\"SharemeChat\" style=\"display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;\" />"
                  + "</td></tr>"
                : "";
        String help = es ? "&iquest;Necesitas ayuda?" : "Need help?";
        String tpl = """
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f2eeee;">
                  <tr><td align="center" style="padding:24px 12px;">
                    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;">
                      <tr><td style="background:#ffffff;padding:20px 32px;border-bottom:3px solid #ea1d1d;">
                        <img src="__LOGO__" width="172" height="18" alt="SharemeChat" style="display:block;max-width:172px;height:auto;border:0;outline:none;text-decoration:none;" />
                      </td></tr>
                      __HERO__
                      <tr><td style="padding:32px 34px 8px;color:#1f2430;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.62;">
                        __BODY__
                      </td></tr>
                      <tr><td style="padding:22px 34px 28px;border-top:1px solid #eef0f2;background:#fbfbfc;font-family:Arial,Helvetica,sans-serif;">
                        <img src="__LOGO__" width="140" height="15" alt="SharemeChat" style="display:block;max-width:140px;height:auto;border:0;margin-bottom:8px;" />
                        <p style="margin:2px 0;font-size:12px;color:#8a95a3;">Shareme Technologies O&Uuml;</p>
                        <p style="margin:2px 0;font-size:12px;color:#8a95a3;">__HELP__ <a href="mailto:soporte@sharemechat.com" style="color:#6b7684;">soporte@sharemechat.com</a></p>
                      </td></tr>
                    </table>
                  </td></tr>
                </table>
                """;
        return tpl.replace("__LOGO__", BRAND_LOGO_URL)
                  .replace("__HERO__", hero)
                  .replace("__BODY__", bodyInner)
                  .replace("__HELP__", help);
    }

    /**
     * Devuelve true si el entorno opera en modo PRELAUNCH (coming-soon
     * publico). Los copys de bienvenida y verificacion adaptan su texto
     * al estado del producto en ese modo para evitar confundir al
     * usuario sugiriendo que la app esta abierta.
     */
    private boolean isPrelaunch() {
        return operationalMode.currentMode()
                == ProductOperationalProperties.Mode.PRELAUNCH;
    }

    public EmailContent renderWelcome(User user, String loginUrl) {
        String locale = localeResolver.resolve(user);
        // H2 sink (Lote 1): escapado HTML antes de inyectar en text blocks.
        String nickname = htmlEscape(safeLabel(user));
        boolean prelaunch = isPrelaunch();
        String userType = String.valueOf(user != null ? user.getUserType() : "");
        boolean isModel = "FORM_MODEL".equalsIgnoreCase(userType);

        if ("es".equals(locale)) {
            if (prelaunch) {
                // Variante COMING-SOON (PRELAUNCH): marco de marca con foto
                // (hero) + copy role-aware. Cliente: bono de bienvenida (sin
                // CTA). Modelo: invitacion a adelantar la verificacion, con
                // CTA al login (la modelo allowlisted verifica ya; ver
                // promo-100-primeros-clientes / gate PRELAUNCH).
                String opening = "¡Gracias por registrarte! En las próximas semanas te enviaremos un email con información más precisa sobre la fecha de apertura de la plataforma.";
                String body = isModel
                        ? welcomeBody(
                            "Bienvenida a SharemeChat",
                            opening,
                            verifBox("&#128737;&#65039; Adelanta tu verificación",
                                     "Ya puedes completar tu verificación de identidad, un proceso rápido y seguro. Es el estándar que garantiza que todas las modelos de SharemeChat están verificadas, y te deja lista para empezar el día que abramos, sin esperas."),
                            ctaButton(loginUrl, "Verificar mi identidad"),
                            true)
                        : welcomeBody(
                            "Ya eres de los primeros, " + nickname,
                            opening,
                            bonusBox("&#127881; Regalo de bienvenida",
                                     "Los <b>100 primeros clientes</b> reciben <b>10&euro; de bono</b>. Solo tienes que activar el modo premium y se sumarán a tu cuenta de forma automática."),
                            "",
                            true);
                return new EmailContent("Bienvenido a SharemeChat",
                        wrapRegistration(body, true, locale));
            }
            // Variante OPEN (estandar): copy original conservado (sin foto).
            String bodyOpen = """
                    <p>Hola %s,</p>
                    <p>Tu cuenta en <b>SharemeChat</b> se ha creado correctamente.</p>
                    <p>Ya puedes acceder a la plataforma.</p>
                    <p>Si no has creado esta cuenta, contacta con soporte.</p>
                    """.formatted(nickname);
            return new EmailContent("Bienvenido a SharemeChat", wrapWithLogo(bodyOpen));
        }

        if (prelaunch) {
            String opening = "Thanks for registering! Over the coming weeks we'll email you with more precise information about the platform's opening date.";
            String body = isModel
                    ? welcomeBody(
                        "Welcome to SharemeChat",
                        opening,
                        verifBox("&#128737;&#65039; Get your verification done early",
                                 "You can now complete your identity verification — a quick, secure process. It's the standard that guarantees every SharemeChat model is verified, and it leaves you ready to start the day we open, with no waiting."),
                        ctaButton(loginUrl, "Verify my identity"),
                        false)
                    : welcomeBody(
                        "You're one of the first, " + nickname,
                        opening,
                        bonusBox("&#127881; Welcome gift",
                                 "The <b>first 100 clients</b> get a <b>&euro;10 bonus</b>. Just activate premium mode and it will be added to your account automatically."),
                        "",
                        false);
            return new EmailContent("Welcome to SharemeChat",
                    wrapRegistration(body, true, locale));
        }
        // OPEN (estandar): copy original conservado (sin foto).
        String bodyOpenEn = """
                <p>Hello %s,</p>
                <p>Your <b>SharemeChat</b> account has been created successfully.</p>
                <p>You can now access the platform.</p>
                <p>If you did not create this account, please contact support.</p>
                """.formatted(nickname);
        return new EmailContent("Welcome to SharemeChat", wrapWithLogo(bodyOpenEn));
    }

    /**
     * Cuerpo de un email de BIENVENIDA (coming-soon): titular + linea de
     * apoyo + bloque destacado (bono cliente / verificacion modelo) + CTA
     * opcional + aviso de seguridad. A diferencia de {@link #registrationBody}
     * no lleva enlace-fallback ni caducidad: la bienvenida no verifica token.
     * {@code headline}/{@code lead}/{@code block}/{@code cta} vienen ya como
     * HTML (con el nickname ya escapado en el llamante).
     */
    private String welcomeBody(String headline, String lead, String block, String cta, boolean es) {
        String safety = es
                ? "Si no te has registrado en SharemeChat, puedes ignorar este mensaje."
                : "If you didn't sign up for SharemeChat, you can safely ignore this message.";
        StringBuilder sb = new StringBuilder();
        sb.append("<h1 style=\"font-size:22px;font-weight:bold;margin:0 0 10px;color:#141820;line-height:1.25;\">").append(headline).append("</h1>");
        sb.append("<p style=\"margin:0 0 22px;color:#42505f;font-size:15px;line-height:1.6;\">").append(lead).append("</p>");
        if (block != null && !block.isBlank()) sb.append(block);
        if (cta != null && !cta.isBlank()) sb.append(cta);
        sb.append("<p style=\"margin:6px 0 0;font-size:12.5px;color:#8a95a3;line-height:1.55;\">").append(safety).append("</p>");
        return sb.toString();
    }

    /** Caja destacada del bono de bienvenida (cliente). Email-safe (div + inline). */
    private String bonusBox(String title, String textHtml) {
        return "<div style=\"margin:4px 0 22px;background:#fff5f2;border:1px solid #f6d9cf;border-left:4px solid #ea1d1d;border-radius:10px;padding:16px 18px;\">"
             + "<p style=\"margin:0 0 4px;font-weight:bold;color:#141820;font-size:15px;\">" + title + "</p>"
             + "<p style=\"margin:0;color:#4b3a36;font-size:14px;line-height:1.55;\">" + textHtml + "</p>"
             + "</div>";
    }

    /** Caja destacada de verificacion de identidad (modelo). Email-safe (div + inline). */
    private String verifBox(String title, String textHtml) {
        return "<div style=\"margin:4px 0 22px;background:#f6f7f9;border:1px solid #e6e9ee;border-left:4px solid #141820;border-radius:10px;padding:16px 18px;\">"
             + "<p style=\"margin:0 0 4px;font-weight:bold;color:#141820;font-size:15px;\">" + title + "</p>"
             + "<p style=\"margin:0;color:#42505f;font-size:14px;line-height:1.55;\">" + textHtml + "</p>"
             + "</div>";
    }

    /**
     * H1 hardening Lote 2 (2026-06-08): notificacion al email YA
     * EXISTENTE cuando alguien intenta registrarse de nuevo con esa
     * direccion. El frontend recibe la misma respuesta de exito que
     * un alta nueva, asi que el atacante no puede distinguir.
     *
     * Copy aprobado por el operador. Locale = uiLocale del usuario
     * existente (mismo patron que el resto de plantillas). Incluye
     * enlaces a las paginas publicas de login y de recuperacion de
     * contrasena (no genera token de reset: el usuario lo solicita
     * desde la pagina si lo necesita).
     *
     * @param existingUser  cuenta YA EXISTENTE con ese email.
     * @param loginUrl      URL absoluta a la pagina de login del SPA.
     * @param forgotUrl     URL absoluta a la pagina de "olvide mi password".
     */
    public EmailContent renderAccountAlreadyExistsNotice(User existingUser,
                                                         String loginUrl,
                                                         String forgotUrl) {
        String locale = localeResolver.resolve(existingUser);
        // safeLabel + htmlEscape: defensa en profundidad heredada de Lote 1.
        String nickname = htmlEscape(safeLabel(existingUser));
        // Los URLs los pasa el llamante; los escapamos como atributo HTML
        // por seguridad (aunque vengan controlados por PublicSiteProperties).
        String safeLogin  = htmlEscape(loginUrl);
        String safeForgot = htmlEscape(forgotUrl);

        if ("es".equals(locale)) {
            String body = """
                    <p>Hola %s:</p>

                    <p>Hemos recibido un intento de registro con esta dirección, pero ya tienes una cuenta en <b>SharemeChat</b> — no necesitas crear otra.</p>

                    <p>Si has sido tú, solo tienes que <a href="%s">iniciar sesión</a>. ¿No recuerdas tu contraseña? Puedes <a href="%s">restablecerla desde aquí</a>.</p>

                    <p>Si no has sido tú, puedes ignorar este mensaje con tranquilidad: tu cuenta sigue segura y no se ha creado ninguna cuenta nueva.</p>

                    <p>— El equipo de SharemeChat</p>
                    """.formatted(nickname, safeLogin, safeForgot);
            return new EmailContent(
                    "¿Has intentado crear una cuenta en SharemeChat?",
                    wrapWithLogo(body)
            );
        }

        String bodyEn = """
                <p>Hi %s,</p>

                <p>We received a sign-up attempt using this email, but you already have a <b>SharemeChat</b> account — no need to create another one.</p>

                <p>If this was you, just <a href="%s">log in</a>. Forgot your password? You can <a href="%s">reset it from here</a>.</p>

                <p>If this wasn't you, you can safely ignore this email: your account is secure and no new account was created.</p>

                <p>— The SharemeChat team</p>
                """.formatted(nickname, safeLogin, safeForgot);
        return new EmailContent(
                "Did you try to create a SharemeChat account?",
                wrapWithLogo(bodyEn)
        );
    }

    public EmailContent renderUnsubscribe(User user) {
        String locale = localeResolver.resolve(user);
        // H2 sink (Lote 1): escapado HTML antes de inyectar en text blocks.
        String nickname = htmlEscape(safeLabel(user));

        if ("es".equals(locale)) {
            return new EmailContent(
                    "Confirmación de baja en SharemeChat",
                    wrapWithLogo("""
                            <p>Hola %s,</p>

                            <p>Tu cuenta en <b>SharemeChat</b> ha sido dada de baja correctamente.</p>

                            <p>Si no has solicitado esta baja o crees que se trata de un error,
                            puedes contactar con nuestro equipo de soporte.</p>

                            <p>Gracias por haber utilizado SharemeChat.</p>
                            """.formatted(nickname))
            );
        }

        return new EmailContent(
                "SharemeChat account closure confirmation",
                wrapWithLogo("""
                        <p>Hello %s,</p>

                        <p>Your <b>SharemeChat</b> account has been closed successfully.</p>

                        <p>If you did not request this closure or believe this is a mistake,
                        you can contact our support team.</p>

                        <p>Thank you for using SharemeChat.</p>
                        """.formatted(nickname))
        );
    }

    public EmailContent renderPasswordReset(User user, String link, int ttlMinutes) {
        String locale = localeResolver.resolve(user);
        String expiryText = formatExpiryText(locale, ttlMinutes);

        if ("es".equals(locale)) {
            return new EmailContent(
                    "Recuperación de contraseña",
                    wrapWithLogo("""
                            <p>Has solicitado restablecer tu contraseña.</p>
                            <p>Haz clic en el siguiente enlace para continuar:</p>
                            <p><a href="%s">%s</a></p>
                            <p>Este enlace caduca en %s.</p>
                            """.formatted(link, link, expiryText))
            );
        }

        return new EmailContent(
                "Password reset",
                wrapWithLogo("""
                        <p>You requested to reset your password.</p>
                        <p>Click the following link to continue:</p>
                        <p><a href="%s">%s</a></p>
                        <p>This link expires in %s.</p>
                        """.formatted(link, link, expiryText))
        );
    }

    public EmailContent renderVerification(User user, String context, String nickname, String link, int ttlMinutes) {
        String locale = localeResolver.resolve(user);
        // H2 sink (Lote 1): el `nickname` viene de un argumento externo
        // (call-sites: retry admin, EmailVerificationService); aplicamos
        // escapado HTML defensivo aunque el llamante pase algo limpio.
        String displayName = htmlEscape(
                (nickname != null && !nickname.isBlank()) ? nickname : safeLabel(user));
        String expiryText = formatExpiryText(locale, ttlMinutes);
        String userType = String.valueOf(user != null ? user.getUserType() : "");
        boolean prelaunch = isPrelaunch();
        // BACKOFFICE conserva el copy estandar tambien bajo PRELAUNCH:
        // los admin/support deben poder validar email y entrar al
        // backoffice incluso en coming-soon. El gate del producto NO
        // aplica al backoffice.
        boolean backoffice = "BACKOFFICE".equalsIgnoreCase(context);
        boolean masterInvite = "MASTER_MODEL_INVITATION".equalsIgnoreCase(context);
        // Invitacion Master prevalece sobre coming-soon: si el estudio
        // esta dando de alta modelos, deben recibir email aunque el
        // producto este en PRELAUNCH.
        boolean comingSoonCopy = prelaunch && !backoffice && !masterInvite;

        if ("es".equals(locale)) {
            if (backoffice) {
                return new EmailContent(
                        "Validación de email para acceso interno",
                        wrapWithLogo("""
                                <p>Hola %s,</p>
                                <p>Tu acceso interno a <b>SharemeChat Backoffice</b> ya esta preparado.</p>
                                <p>Antes de poder entrar, debes validar tu email:</p>
                                <p><a href="%s">%s</a></p>
                                <p>Este enlace caduca en %s.</p>
                                """.formatted(displayName, link, link, expiryText))
                );
            }

            if (masterInvite) {
                String body = registrationBody(
                        "Has sido invitada a SharemeChat",
                        "Hola " + displayName + ", te han dado de alta como modelo bajo una cuenta de estudio (Master). Elige tu contraseña personal para activar tu cuenta; después podrás completar tu perfil y la verificación de identidad de forma autónoma.",
                        "Activar mi cuenta", link, expiryText, true);
                return new EmailContent("Has sido invitada a SharemeChat",
                        wrapRegistration(body, false, locale));
            }

            if (comingSoonCopy) {
                String body = registrationBody(
                        "Confirma tu email",
                        "Ya casi está. Verifica tu correo para activar tu cuenta de <b>SharemeChat</b>.",
                        "Confirmar mi email", link, "24 horas", true);
                return new EmailContent("Confirma tu email en SharemeChat",
                        wrapRegistration(body, false, locale));
            }

            String subject = "Valida tu email en SharemeChat";
            String headline = "Confirma tu email";
            String subline = "Hola " + displayName + ", verifica tu correo para activar tu cuenta en <b>SharemeChat</b>.";
            String cta = "Confirmar mi email";
            if ("FORM_MODEL".equalsIgnoreCase(userType)) {
                subject = "Valida tu email para continuar el onboarding de modelo";
                headline = "Confirma tu email para continuar";
                subline = "Hola " + displayName + ", verifica tu correo y sigue con el onboarding de modelo: tu perfil y la verificación de identidad.";
                cta = "Confirmar y continuar";
            } else if ("FORM_CLIENT".equalsIgnoreCase(userType)) {
                subject = "Valida tu email para activar funciones premium";
                headline = "Confirma tu email";
                subline = "Hola " + displayName + ", ya casi está. Verifica tu correo para activar tu cuenta y desbloquear las funciones premium de <b>SharemeChat</b>.";
                cta = "Confirmar mi email";
            }

            return new EmailContent(
                    subject,
                    wrapRegistration(registrationBody(headline, subline, cta, link, expiryText, true), false, locale));
        }

        if (backoffice) {
            return new EmailContent(
                    "Email verification for internal access",
                    wrapWithLogo("""
                            <p>Hello %s,</p>
                            <p>Your internal access to <b>SharemeChat Backoffice</b> is ready.</p>
                            <p>Before you can sign in, you must verify your email:</p>
                            <p><a href="%s">%s</a></p>
                            <p>This link expires in %s.</p>
                            """.formatted(displayName, link, link, expiryText))
            );
        }

        if (masterInvite) {
            String body = registrationBody(
                    "You've been invited to SharemeChat",
                    "Hi " + displayName + ", you've been added as a model under a studio (Master) account. Choose your personal password to activate your account; then you can complete your profile and identity verification on your own.",
                    "Activate my account", link, expiryText, false);
            return new EmailContent("You have been invited to SharemeChat",
                    wrapRegistration(body, false, locale));
        }

        if (comingSoonCopy) {
            String body = registrationBody(
                    "Confirm your email",
                    "Almost there. Verify your email to activate your <b>SharemeChat</b> account.",
                    "Confirm my email", link, "24 hours", false);
            return new EmailContent("Confirm your email on SharemeChat",
                    wrapRegistration(body, false, locale));
        }

        String subject = "Verify your email in SharemeChat";
        String headline = "Confirm your email";
        String subline = "Hi " + displayName + ", verify your email to activate your <b>SharemeChat</b> account.";
        String cta = "Confirm my email";
        if ("FORM_MODEL".equalsIgnoreCase(userType)) {
            subject = "Verify your email to continue model onboarding";
            headline = "Confirm your email to continue";
            subline = "Hi " + displayName + ", verify your email and continue your model onboarding: your profile and identity verification.";
            cta = "Confirm and continue";
        } else if ("FORM_CLIENT".equalsIgnoreCase(userType)) {
            subject = "Verify your email to activate premium features";
            headline = "Confirm your email";
            subline = "Hi " + displayName + ", you're almost there. Verify your email to activate your account and unlock <b>SharemeChat</b> premium features.";
            cta = "Confirm my email";
        }

        return new EmailContent(
                subject,
                wrapRegistration(registrationBody(headline, subline, cta, link, expiryText, false), false, locale));
    }

    /**
     * Email al modelo cuando un admin/support rechaza su foto o vídeo de
     * perfil. El motivo se localiza vía
     * {@link AssetRejectionReasonCopy}; si el moderador adjunta texto
     * libre (siempre cuando el codigo es {@code OTHER}, opcional para
     * el resto), se incluye como nota adicional al final.
     *
     * @param user        destinatario (su {@code uiLocale} determina el idioma)
     * @param assetType   {@code "PIC"} o {@code "VIDEO"}
     * @param reasonCode  uno de los 10 codigos predefinidos + {@code OTHER}
     * @param reasonText  texto libre del moderador (opcional, salvo OTHER)
     * @param profileLink URL absoluta al perfil del modelo para resubir contenido
     */
    public EmailContent renderAssetRejection(User user,
                                             String assetType,
                                             String reasonCode,
                                             String reasonText,
                                             String profileLink) {
        String locale = localeResolver.resolve(user);
        // H2 sink (Lote 1): escapado HTML antes de inyectar en text blocks.
        String displayName = htmlEscape(safeLabel(user));
        String reasonLabel = assetRejectionReasonCopy.getLabel(reasonCode, locale);
        boolean hasReasonText = reasonText != null && !reasonText.isBlank();
        String safeProfileLink = (profileLink != null && !profileLink.isBlank()) ? profileLink : "";

        if ("es".equals(locale)) {
            String assetLabel = "VIDEO".equalsIgnoreCase(assetType) ? "vídeo" : "foto";
            String moderatorNoteFragment = hasReasonText
                    ? "<p><b>Detalle del moderador:</b> %s</p>".formatted(reasonText)
                    : "";
            String profileLinkFragment = safeProfileLink.isBlank()
                    ? ""
                    : "<p>Sube nuevo contenido desde tu perfil: <a href=\"%s\">%s</a></p>"
                            .formatted(safeProfileLink, safeProfileLink);

            return new EmailContent(
                    "[SharemeChat] Tu contenido de perfil requiere cambios",
                    wrapWithLogo("""
                            <p>Hola %s,</p>
                            <p>Tu %s de perfil no ha sido aprobada para publicación.</p>
                            <p><b>Motivo:</b> %s</p>
                            %s
                            %s
                            <p>Cuando tu nueva foto y tu nuevo vídeo estén aprobados, volverás a aparecer en el listado público.</p>
                            <p>Gracias,<br>El equipo de SharemeChat</p>
                            """.formatted(displayName, assetLabel, reasonLabel,
                                    moderatorNoteFragment, profileLinkFragment))
            );
        }

        // Default: EN
        String assetLabelEn = "VIDEO".equalsIgnoreCase(assetType) ? "video" : "photo";
        String moderatorNoteFragmentEn = hasReasonText
                ? "<p><b>Moderator note:</b> %s</p>".formatted(reasonText)
                : "";
        String profileLinkFragmentEn = safeProfileLink.isBlank()
                ? ""
                : "<p>Please upload new content from your profile: <a href=\"%s\">%s</a></p>"
                        .formatted(safeProfileLink, safeProfileLink);

        return new EmailContent(
                "[SharemeChat] Your profile content requires changes",
                wrapWithLogo("""
                        <p>Hello %s,</p>
                        <p>Your profile %s has not been approved for publication.</p>
                        <p><b>Reason:</b> %s</p>
                        %s
                        %s
                        <p>Once your new photo and video are approved, you will appear in the public listing again.</p>
                        <p>Thanks,<br>The SharemeChat Team</p>
                        """.formatted(displayName, assetLabelEn, reasonLabel,
                                moderatorNoteFragmentEn, profileLinkFragmentEn))
        );
    }

    /**
     * Email al modelo tras decisión admin en AdminService.reviewModel
     * (cierre P15). Tono neutral pero cálido, coherente con el bucket
     * awaiting-admin documentado en didit-setup.md. action ∈ APPROVE/REJECT/REPEAT.
     * PENDING NO emite email (estado intermedio).
     */
    public EmailContent renderModelReviewDecision(User user, String action, String loginUrl) {
        String locale = localeResolver.resolve(user);
        String displayName = htmlEscape(safeLabel(user));
        boolean approve = "APPROVE".equalsIgnoreCase(action);
        boolean repeat = "REPEAT".equalsIgnoreCase(action);
        boolean prelaunch = isPrelaunch();
        boolean es = "es".equals(locale);

        if (approve) {
            // Momento celebratorio -> marco de marca CON foto + CTA al panel.
            // Mode-aware: en PRELAUNCH no prometemos "empezar" (aun no hay
            // clientes); solo preparar perfil y esperar la apertura.
            if (es) {
                String lead = prelaunch
                        ? "Hola " + displayName + ", hemos revisado tu verificación y tu cuenta de modelo en <b>SharemeChat</b> ya está aprobada. Ya puedes acceder a tu panel y preparar tu perfil; te avisaremos en cuanto abramos la plataforma."
                        : "Hola " + displayName + ", hemos revisado tu verificación y tu cuenta de modelo en <b>SharemeChat</b> ya está aprobada. Ya puedes acceder a tu panel y empezar en la plataforma.";
                String body = reviewBody("¡Enhorabuena! Ya eres modelo verificada", lead,
                        ctaButton(loginUrl, "Acceder a mi panel"));
                return new EmailContent("Tu cuenta de modelo ha sido aprobada",
                        wrapRegistration(body, true, locale));
            }
            String lead = prelaunch
                    ? "Hi " + displayName + ", we've reviewed your verification and your <b>SharemeChat</b> model account is approved. You can now access your dashboard and set up your profile; we'll let you know as soon as the platform opens."
                    : "Hi " + displayName + ", we've reviewed your verification and your <b>SharemeChat</b> model account is approved. You can now access your dashboard and get started on the platform.";
            String body = reviewBody("Congratulations! You're now a verified model", lead,
                    ctaButton(loginUrl, "Go to my dashboard"));
            return new EmailContent("Your model account has been approved",
                    wrapRegistration(body, true, locale));
        }

        if (repeat) {
            // Marco de marca SIN foto (no es celebratorio) + CTA para reintentar.
            if (es) {
                String lead = "Hola " + displayName + ", algo no ha ido bien en la verificación de tu cuenta en <b>SharemeChat</b>. Accede a tu panel y vuelve a iniciar el proceso de verificación de identidad. Si tienes cualquier duda, escríbenos a soporte y te ayudamos.";
                String body = reviewBody("Necesitamos repetir tu verificación", lead,
                        ctaButton(loginUrl, "Acceder a mi panel"));
                return new EmailContent("Necesitamos repetir tu verificación",
                        wrapRegistration(body, false, locale));
            }
            String lead = "Hi " + displayName + ", something didn't go right with your <b>SharemeChat</b> account verification. Log in to your dashboard and start the identity verification again. If you have any questions, contact support and we'll help.";
            String body = reviewBody("We need to repeat your verification", lead,
                    ctaButton(loginUrl, "Go to my dashboard"));
            return new EmailContent("We need to repeat your verification",
                    wrapRegistration(body, false, locale));
        }

        // REJECT: sobrio, sin foto, sin CTA (una negativa no lleva boton ni hero).
        if (es) {
            String lead = "Hola " + displayName + ", hemos revisado tu solicitud para operar como modelo en <b>SharemeChat</b> y, tras evaluarla, no ha sido aprobada en esta ocasión. Si crees que se trata de un error o quieres entender mejor la decisión, contacta con nuestro equipo de soporte y la revisaremos contigo.";
            String body = reviewBody("Tu verificación no ha sido aprobada", lead, "");
            return new EmailContent("Tu verificación no ha sido aprobada",
                    wrapRegistration(body, false, locale));
        }
        String lead = "Hi " + displayName + ", we've reviewed your application to operate as a model on <b>SharemeChat</b> and, after evaluating it, it has not been approved on this occasion. If you believe this is a mistake or want to better understand the decision, please contact our support team and we'll review it with you.";
        String body = reviewBody("Your verification has not been approved", lead, "");
        return new EmailContent("Your verification has not been approved",
                wrapRegistration(body, false, locale));
    }

    /**
     * Cuerpo de un email de decisión de review de modelo (aprobada / repetir /
     * no aprobada): titular + un parrafo de apoyo + CTA opcional. {@code lead}
     * viene como HTML (nickname ya escapado). Sin foto: el hero lo decide el
     * wrapRegistration del llamante.
     */
    private String reviewBody(String headline, String lead, String cta) {
        StringBuilder sb = new StringBuilder();
        sb.append("<h1 style=\"font-size:22px;font-weight:bold;margin:0 0 10px;color:#141820;line-height:1.25;\">").append(headline).append("</h1>");
        sb.append("<p style=\"margin:0 0 24px;color:#42505f;font-size:15px;line-height:1.6;\">").append(lead).append("</p>");
        if (cta != null && !cta.isBlank()) sb.append(cta);
        return sb.toString();
    }

    // renderReferralMagicLink + renderReferralInvitation retirados el
    // 2026-07-24 junto con el resto del programa de afiliadas
    // ([ADR-052 §D11]). Las categorias correspondientes de EmailMessage
    // (REFERRAL_MAGIC_LINK, REFERRAL_INVITATION) tambien se retiraron.

    /**
     * Notificacion INTERNA al equipo cuando se completa un registro
     * publico. El destinatario es un buzon admin (admin+clientes@ o
     * admin+modelos@), no el usuario que se acaba de registrar. Copy en
     * ES fijo (destinatario interno hispanohablante); no depende del
     * ui_locale del usuario registrado.
     *
     * <p>Incluye los metadatos utiles para triage manual: nickname,
     * email, pais detectado, IP de registro, ui_locale, tipo (cliente/
     * modelo) y entorno actual (deducido del hint SPRING_PROFILES_ACTIVE).
     * El nickname y email se escapan HTML (defensa en profundidad, misma
     * politica que renderWelcome / renderAccountAlreadyExistsNotice).
     *
     * @param user            Usuario recien creado y ya persistido.
     * @param kindLabel       "cliente" o "modelo" (para el asunto y el
     *                        cuerpo). El caller decide segun user.userType.
     * @param envHint         "test"/"audit"/"prod"/"?" (para saber de
     *                        que entorno viene el aviso). Best-effort.
     */
    public EmailContent renderAdminNewRegistration(User user, String kindLabel, String envHint) {
        String nickname   = htmlEscape(safeLabel(user));
        String email      = htmlEscape(user != null && user.getEmail() != null ? user.getEmail() : "");
        String country    = htmlEscape(user != null && user.getCountryDetected() != null ? user.getCountryDetected() : "-");
        String ip         = htmlEscape(user != null && user.getRegistIp() != null ? user.getRegistIp() : "-");
        String uiLocale   = htmlEscape(user != null && user.getUiLocale() != null ? user.getUiLocale() : "-");
        String createdAt  = user != null && user.getCreatedAt() != null ? user.getCreatedAt().toString() : "-";
        String userId     = user != null && user.getId() != null ? user.getId().toString() : "-";
        String kind       = htmlEscape(kindLabel == null ? "-" : kindLabel);
        String env        = htmlEscape(envHint == null || envHint.isBlank() ? "?" : envHint);

        String subject = "[SharemeChat/" + envHint + "] Nuevo registro de " + kindLabel + " (" + safeLabel(user) + ")";

        String body = wrapWithLogo("""
                <p>Se ha completado un nuevo registro de <b>%s</b>.</p>
                <table role="presentation" cellpadding="4" cellspacing="0" border="0" style="border-collapse:collapse; font-family: Arial, Helvetica, sans-serif; font-size: 13px;">
                  <tr><td style="color:#64748b;">Entorno</td><td><b>%s</b></td></tr>
                  <tr><td style="color:#64748b;">userId</td><td>%s</td></tr>
                  <tr><td style="color:#64748b;">Nickname</td><td>%s</td></tr>
                  <tr><td style="color:#64748b;">Email</td><td>%s</td></tr>
                  <tr><td style="color:#64748b;">Pais detectado</td><td>%s</td></tr>
                  <tr><td style="color:#64748b;">IP registro</td><td>%s</td></tr>
                  <tr><td style="color:#64748b;">ui_locale</td><td>%s</td></tr>
                  <tr><td style="color:#64748b;">created_at</td><td>%s</td></tr>
                </table>
                <p style="color:#64748b; font-size:12px;">Notificacion automatica del backend. No responder.</p>
                """.formatted(kind, env, userId, nickname, email, country, ip, uiLocale, createdAt));

        return new EmailContent(subject, body);
    }

    private String safeLabel(User user) {
        if (user != null && user.getNickname() != null && !user.getNickname().isBlank()) {
            return user.getNickname().trim();
        }
        return user != null && user.getEmail() != null ? user.getEmail().trim() : "user";
    }

    /**
     * ADR-037 frente trial-sfw Bloque 3 Paso 2: aviso a la modelo cuando el
     * motor emite un ban automatico por infraccion CRITICAL en un stream
     * trial. Bilingue segun uiLocale. El copy explica motivo, duracion,
     * fecha fin y recuerda que puede seguir usando el resto de la app
     * (chat con soporte). Priority BEST_EFFORT en el caller: si falla el
     * envio, el ban ya esta persistido y la modelo lo vera al intentar
     * entrar al matching.
     *
     * @param model         Usuario modelo baneada.
     * @param banEndsAt     Fin del ban (formato ISO local).
     * @param minutes       Duracion total del ban en minutos.
     * @param manualReview  true si el ban requiere revision humana (5o+ strike).
     */
    public EmailContent renderModelStreamingBan(User model,
                                                LocalDateTime banEndsAt,
                                                long minutes,
                                                boolean manualReview) {
        String locale = localeResolver.resolve(model);
        String nickname = htmlEscape(safeLabel(model));
        String endsAtStr = htmlEscape(banEndsAt != null ? banEndsAt.toString() : "-");
        String durationStr = formatDuration(minutes, locale);

        if ("es".equals(locale)) {
            String reviewNote = manualReview
                    ? "<p>Este ban se ha marcado para <b>revisión manual</b> por el equipo. Recibirás una respuesta en breve.</p>"
                    : "";
            String subject = "[SharemeChat] Suspensión temporal del streaming";
            String body = wrapWithLogo("""
                    <p>Hola %s,</p>
                    <p>Nuestro sistema automático de moderación ha detectado contenido no permitido en un stream de prueba con un cliente Free. Por eso hemos suspendido temporalmente tu acceso al videochat.</p>
                    <table role="presentation" cellpadding="4" cellspacing="0" border="0" style="border-collapse:collapse; font-family: Arial, Helvetica, sans-serif; font-size: 13px;">
                      <tr><td style="color:#64748b;">Duración</td><td><b>%s</b></td></tr>
                      <tr><td style="color:#64748b;">Fin de la suspensión</td><td>%s</td></tr>
                    </table>
                    %s
                    <p>Durante la suspensión puedes seguir usando el resto de la aplicación (chat con soporte, ver tu perfil, historial, etc.). Solo el matching y las llamadas quedan bloqueados.</p>
                    <p>Recuerda que en la franja de prueba <b>no se permite contenido adulto</b> aunque sí esté permitido en los clientes Premium. Es una restricción legal y contractual.</p>
                    <p>Si crees que ha sido un error, contacta con soporte desde la app.</p>
                    """.formatted(nickname, durationStr, endsAtStr, reviewNote));
            return new EmailContent(subject, body);
        }

        String reviewNoteEn = manualReview
                ? "<p>This ban has been flagged for <b>manual review</b> by our team. You'll hear back from us shortly.</p>"
                : "";
        String subjectEn = "[SharemeChat] Temporary streaming suspension";
        String bodyEn = wrapWithLogo("""
                <p>Hi %s,</p>
                <p>Our automatic moderation system detected disallowed content during a trial session with a Free client. As a result, we have temporarily suspended your access to video chat.</p>
                <table role="presentation" cellpadding="4" cellspacing="0" border="0" style="border-collapse:collapse; font-family: Arial, Helvetica, sans-serif; font-size: 13px;">
                  <tr><td style="color:#64748b;">Duration</td><td><b>%s</b></td></tr>
                  <tr><td style="color:#64748b;">Suspension ends</td><td>%s</td></tr>
                </table>
                %s
                <p>During the suspension you can still use the rest of the app (support chat, profile, history, etc.). Only matching and calls are blocked.</p>
                <p>Please note that adult content <b>is not allowed during trial sessions</b>, even though it is allowed with Premium clients. This is a legal and contractual restriction.</p>
                <p>If you believe this was an error, contact support from within the app.</p>
                """.formatted(nickname, durationStr, endsAtStr, reviewNoteEn));
        return new EmailContent(subjectEn, bodyEn);
    }

    /**
     * ADR-037 frente trial-sfw Bloque 4: aviso a la modelo cuando un admin
     * levanta manualmente su ban tras revision (falso positivo o apelacion
     * aceptada). Bilingue segun uiLocale, tono conciliador y explicito.
     */
    public EmailContent renderModelStreamingBanLifted(User model) {
        String locale = localeResolver.resolve(model);
        String nickname = htmlEscape(safeLabel(model));

        if ("es".equals(locale)) {
            String subject = "[SharemeChat] Suspensión levantada";
            String body = wrapWithLogo("""
                    <p>Hola %s,</p>
                    <p>Hemos revisado la suspensión de streaming asociada a tu cuenta y la hemos <b>levantado</b>. Ya puedes volver a hacer videochat con normalidad.</p>
                    <p>Si tienes alguna duda o crees que hay algo más que aclarar, contacta con soporte desde la app.</p>
                    """.formatted(nickname));
            return new EmailContent(subject, body);
        }

        String subjectEn = "[SharemeChat] Streaming suspension lifted";
        String bodyEn = wrapWithLogo("""
                <p>Hi %s,</p>
                <p>We have reviewed the streaming suspension on your account and have <b>lifted</b> it. You can now resume video chatting normally.</p>
                <p>If you have any questions or something else to clarify, please contact support from within the app.</p>
                """.formatted(nickname));
        return new EmailContent(subjectEn, bodyEn);
    }

    /**
     * Formatea una duracion en minutos como texto humano segun locale.
     * 15 -> "15 minutos" / "15 minutes"; 60 -> "1 hora" / "1 hour"; etc.
     */
    private String formatDuration(long minutes, String locale) {
        boolean es = "es".equals(locale);
        if (minutes < 60) {
            return minutes + (es ? " minutos" : " minutes");
        }
        long hours = minutes / 60;
        long rem = minutes % 60;
        if (rem == 0) {
            if (hours == 1) return es ? "1 hora" : "1 hour";
            return hours + (es ? " horas" : " hours");
        }
        return hours + (es ? " h " : "h ") + rem + (es ? " min" : "min");
    }

    /**
     * ADR-037 Fase 5 Bloque 5 Paso 3: aviso interno al buzon admin
     * cuando el consumo Sightengine cruza por primera vez un umbral
     * configurado en un periodo (mes o dia). Buzon interno hispanohablante,
     * copy ES fijo sin i18n.
     *
     * @param envHint        "test"/"audit"/"prod"/"?" segun SPRING_PROFILES_ACTIVE.
     * @param periodTypeEs   "MES" o "DIA" (para el asunto y el cuerpo).
     * @param periodStart    Inicio de la ventana (primer dia del mes o dia natural).
     * @param planName       "FREE" / "STARTER" / "PRO" al momento del disparo.
     * @param quota          Cupo del plan para la ventana (monthlyQuota o dailyQuota).
     * @param operations     Ops consumidas al momento del disparo.
     * @param pct            % consumido al momento del disparo (1 decimal).
     * @param thresholdPct   Umbral concreto cruzado (60/85/95/80).
     */
    public EmailContent renderModerationQuotaAlert(String envHint,
                                                   String periodTypeEs,
                                                   String periodStart,
                                                   String planName,
                                                   long quota,
                                                   long operations,
                                                   String pct,
                                                   int thresholdPct) {
        String env = htmlEscape(envHint == null || envHint.isBlank() ? "?" : envHint);
        String type = htmlEscape(periodTypeEs);
        String period = htmlEscape(periodStart);
        String plan = htmlEscape(planName == null ? "-" : planName);

        String subject = "[SharemeChat/" + envHint + "] Consumo Sightengine "
                + periodTypeEs + ": " + thresholdPct + "% cruzado";

        String body = wrapWithLogo("""
                <p>Aviso automatico del monitor de consumo Sightengine.</p>
                <table role="presentation" cellpadding="4" cellspacing="0" border="0" style="border-collapse:collapse; font-family: Arial, Helvetica, sans-serif; font-size: 13px;">
                  <tr><td style="color:#64748b;">Entorno</td><td><b>%s</b></td></tr>
                  <tr><td style="color:#64748b;">Ventana</td><td>%s (desde %s)</td></tr>
                  <tr><td style="color:#64748b;">Plan actual</td><td>%s</td></tr>
                  <tr><td style="color:#64748b;">Cupo %s</td><td>%d ops</td></tr>
                  <tr><td style="color:#64748b;">Consumo actual</td><td>%d ops</td></tr>
                  <tr><td style="color:#64748b;">Porcentaje</td><td>%s%%</td></tr>
                  <tr><td style="color:#64748b;">Umbral cruzado</td><td><b>%d%%</b></td></tr>
                </table>
                <p>Este aviso se envia UNA sola vez por umbral y periodo. No volveras a
                recibir aviso del %d%% en este %s salvo cambio de periodo.</p>
                <p>Si el consumo alcanza el 100%%, Sightengine devolvera error, las
                sesiones de moderacion quedaran en DEGRADED y a los pocos minutos
                seran cortadas por el fail-closed-soft (ADR-036 bloque 3).</p>
                <p style="color:#64748b; font-size:12px;">Notificacion automatica del backend. No responder.</p>
                """.formatted(env, type, period, plan, type, quota, operations, pct, thresholdPct, thresholdPct, type));

        return new EmailContent(subject, body);
    }

    /**
     * Escapado HTML para fragmentos que se inyectan via .formatted() en
     * los cuerpos HTML de los emails (nickname, displayName, etc.).
     * H2 hardening Lote 1 (2026-06-08): aunque la validacion del
     * registro ya rechaza caracteres peligrosos en nickname nuevos,
     * existen cuentas previas con nicknames legados sin validar; y los
     * llamantes externos de renderVerification (TimedSampler, retries
     * admin, etc.) pueden pasar `nickname` por argumento sin garantia
     * de saneamiento. Defensa en profundidad: siempre escape antes de
     * inyectar en HTML.
     *
     * Escapado minimo conservador (no es full XSS-strict ni codifica
     * unicode entero, solo los 5 caracteres que rompen estructura HTML):
     * &, <, >, ", '.
     */
    private String htmlEscape(String s) {
        if (s == null || s.isEmpty()) return "";
        StringBuilder sb = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '&':  sb.append("&amp;");  break;
                case '<':  sb.append("&lt;");   break;
                case '>':  sb.append("&gt;");   break;
                case '"':  sb.append("&quot;"); break;
                case '\'': sb.append("&#39;");  break;
                default:   sb.append(c);
            }
        }
        return sb.toString();
    }

    private String formatExpiryText(String locale, int ttlMinutes) {
        boolean spanish = "es".equals(locale);

        if (ttlMinutes <= 0) {
            return spanish ? "unos minutos" : "a few minutes";
        }
        if (ttlMinutes % 1440 == 0) {
            int days = ttlMinutes / 1440;
            if (days == 1) {
                return spanish ? "24 horas" : "24 hours";
            }
            return spanish ? days + " dias" : days + " days";
        }
        if (ttlMinutes % 60 == 0) {
            int hours = ttlMinutes / 60;
            if (hours == 1) {
                return spanish ? "1 hora" : "1 hour";
            }
            return spanish ? hours + " horas" : hours + " hours";
        }
        if (ttlMinutes == 1) {
            return spanish ? "1 minuto" : "1 minute";
        }
        return spanish ? ttlMinutes + " minutos" : ttlMinutes + " minutes";
    }

    public record EmailContent(String subject, String body) {
    }
}
