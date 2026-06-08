package com.sharemechat.service;

import com.sharemechat.config.ProductOperationalProperties;
import com.sharemechat.entity.User;
import org.springframework.stereotype.Component;

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

    public EmailContent renderWelcome(User user) {
        String locale = localeResolver.resolve(user);
        // H2 sink (Lote 1): escapado HTML antes de inyectar en text blocks.
        String nickname = htmlEscape(safeLabel(user));
        boolean prelaunch = isPrelaunch();

        if ("es".equals(locale)) {
            String body = prelaunch
                    // Variante COMING-SOON (PRELAUNCH): la app aun no esta
                    // disponible para el usuario tras el registro; se le
                    // avisara por email cuando pueda entrar.
                    ? """
                      <p>Hola %s,</p>
                      <p>¡Bienvenido a <b>SharemeChat</b>! Gracias por registrarte en la aplicación.</p>
                      <p>Estamos ultimando los últimos detalles; te avisaremos por email en cuanto esté disponible.</p>
                      <p>Si no te registraste tú, contacta con soporte.</p>
                      """.formatted(nickname)
                    // Variante OPEN (estandar): copy original conservado.
                    : """
                      <p>Hola %s,</p>
                      <p>Tu cuenta en <b>SharemeChat</b> se ha creado correctamente.</p>
                      <p>Ya puedes acceder a la plataforma.</p>
                      <p>Si no has creado esta cuenta, contacta con soporte.</p>
                      """.formatted(nickname);
            // Solo bienvenida PRELAUNCH lleva la imagen coming-soon
            // (debajo del cuerpo, encima del pie del logo). OPEN no
            // la lleva.
            String wrapped = prelaunch
                    ? wrapWithLogoAndImage(body, COMING_SOON_IMAGE_URL, "SharemeChat - próximamente")
                    : wrapWithLogo(body);
            return new EmailContent("Bienvenido a SharemeChat", wrapped);
        }

        String body = prelaunch
                ? """
                  <p>Hi %s,</p>
                  <p>Welcome to <b>SharemeChat</b>! Thanks for registering with the app.</p>
                  <p>We're finalizing the last details; we'll email you as soon as it's available.</p>
                  <p>If you didn't sign up, contact support.</p>
                  """.formatted(nickname)
                : """
                  <p>Hello %s,</p>
                  <p>Your <b>SharemeChat</b> account has been created successfully.</p>
                  <p>You can now access the platform.</p>
                  <p>If you did not create this account, please contact support.</p>
                  """.formatted(nickname);
        String wrappedEn = prelaunch
                ? wrapWithLogoAndImage(body, COMING_SOON_IMAGE_URL, "SharemeChat - coming soon")
                : wrapWithLogo(body);
        return new EmailContent("Welcome to SharemeChat", wrappedEn);
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
                            <p>Has solicitado restablecer tu contraseÃ±a.</p>
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
        boolean comingSoonCopy = prelaunch && !backoffice;

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

            if (comingSoonCopy) {
                // Coming-soon ES (maqueta v2 2026-06-06): subject
                // simple, cuerpo simplificado en 4 parrafos cortos.
                // Saludo / instruccion / enlace / caducidad. Sin "gracias
                // por registrarte / disponible en breve / te avisaremos":
                // ese mensaje queda solo en la bienvenida para no
                // duplicar y mantener cada email enfocado.
                return new EmailContent(
                        "Confirma tu email en SharemeChat",
                        wrapWithLogo("""
                                <p>Hola %s,</p>
                                <p>Te has registrado en SharemeChat. Para validar tu cuenta, haz clic en este enlace:</p>
                                <p><a href="%s">%s</a></p>
                                <p>El enlace caduca en 24 horas.</p>
                                """.formatted(displayName, link, link))
                );
            }

            String subject = "Valida tu email en SharemeChat";
            String reason = "Despues de validarlo podras seguir con tu cuenta.";

            if ("FORM_MODEL".equalsIgnoreCase(userType)) {
                subject = "Valida tu email para continuar el onboarding de modelo";
                reason = "Despues de validarlo podras continuar con el onboarding de modelo.";
            } else if ("FORM_CLIENT".equalsIgnoreCase(userType)) {
                subject = "Valida tu email para activar funciones premium";
                reason = "Despues de validarlo podras activar la cuenta premium y completar el primer pago.";
            }

            return new EmailContent(
                    subject,
                    wrapWithLogo("""
                            <p>Hola %s,</p>
                            <p>Tu cuenta en <b>SharemeChat</b> necesita validar el email para continuar.</p>
                            <p>%s</p>
                            <p><a href="%s">%s</a></p>
                            <p>Este enlace caduca en %s.</p>
                            """.formatted(displayName, reason, link, link, expiryText))
            );
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

        if (comingSoonCopy) {
            // Coming-soon EN (maqueta v2 2026-06-06): subject simple,
            // cuerpo simplificado en 4 parrafos.
            return new EmailContent(
                    "Confirm your email on SharemeChat",
                    wrapWithLogo("""
                            <p>Hi %s,</p>
                            <p>You've registered with SharemeChat. To validate your account, click this link:</p>
                            <p><a href="%s">%s</a></p>
                            <p>This link expires in 24 hours.</p>
                            """.formatted(displayName, link, link))
            );
        }

        String subject = "Verify your email in SharemeChat";
        String reason = "After verifying it, you will be able to continue using your account.";

        if ("FORM_MODEL".equalsIgnoreCase(userType)) {
            subject = "Verify your email to continue model onboarding";
            reason = "After verifying it, you will be able to continue with the model onboarding flow.";
        } else if ("FORM_CLIENT".equalsIgnoreCase(userType)) {
            subject = "Verify your email to activate premium features";
            reason = "After verifying it, you will be able to activate the premium account and complete the first payment.";
        }

        return new EmailContent(
                subject,
                wrapWithLogo("""
                        <p>Hello %s,</p>
                        <p>Your <b>SharemeChat</b> account needs email verification to continue.</p>
                        <p>%s</p>
                        <p><a href="%s">%s</a></p>
                        <p>This link expires in %s.</p>
                        """.formatted(displayName, reason, link, link, expiryText))
        );
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

    private String safeLabel(User user) {
        if (user != null && user.getNickname() != null && !user.getNickname().isBlank()) {
            return user.getNickname().trim();
        }
        return user != null && user.getEmail() != null ? user.getEmail().trim() : "user";
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
