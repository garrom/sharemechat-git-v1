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

    /**
     * Email al modelo tras decisión admin en AdminService.reviewModel
     * (cierre P15). Tono neutral pero cálido, coherente con el bucket
     * awaiting-admin documentado en didit-setup.md. action ∈ APPROVE/REJECT/REPEAT.
     * PENDING NO emite email (estado intermedio).
     */
    public EmailContent renderModelReviewDecision(User user, String action) {
        String locale = localeResolver.resolve(user);
        String displayName = htmlEscape(safeLabel(user));
        boolean approve = "APPROVE".equalsIgnoreCase(action);
        boolean repeat = "REPEAT".equalsIgnoreCase(action);

        if (repeat) {
            if ("es".equals(locale)) {
                return new EmailContent(
                        "Necesitamos repetir tu verificación",
                        wrapWithLogo("""
                                <p>Hola %s,</p>
                                <p>Algo no ha ido bien en la verificación de tu cuenta en <b>SharemeChat</b>. Por favor, inicia sesión y vuelve a iniciar el proceso de verificación de identidad desde tu panel.</p>
                                <p>Si tienes cualquier duda, contacta con nuestro equipo de soporte y te ayudamos.</p>
                                <p>Gracias,<br>El equipo de SharemeChat</p>
                                """.formatted(displayName))
                );
            }
            return new EmailContent(
                    "We need to repeat your verification",
                    wrapWithLogo("""
                            <p>Hello %s,</p>
                            <p>Something didn't go right with your <b>SharemeChat</b> account verification. Please log in and start the identity verification process again from your dashboard.</p>
                            <p>If you have any questions, contact our support team and we'll help.</p>
                            <p>Thanks,<br>The SharemeChat team</p>
                            """.formatted(displayName))
            );
        }

        if (approve) {
            if ("es".equals(locale)) {
                return new EmailContent(
                        "Tu cuenta de modelo ha sido aprobada",
                        wrapWithLogo("""
                                <p>Hola %s,</p>
                                <p>Hemos revisado tu verificación y tu cuenta de modelo en <b>SharemeChat</b> ha sido aprobada.</p>
                                <p>Ya puedes acceder a tu panel y empezar a operar en la plataforma.</p>
                                <p>Si tienes cualquier duda, escríbenos y te ayudamos.</p>
                                <p>Gracias por unirte a SharemeChat,<br>El equipo de SharemeChat</p>
                                """.formatted(displayName))
                );
            }
            return new EmailContent(
                    "Your model account has been approved",
                    wrapWithLogo("""
                            <p>Hello %s,</p>
                            <p>We've reviewed your verification and your <b>SharemeChat</b> model account has been approved.</p>
                            <p>You can now access your dashboard and start operating on the platform.</p>
                            <p>If you have any questions, get in touch and we'll help.</p>
                            <p>Thanks for joining SharemeChat,<br>The SharemeChat team</p>
                            """.formatted(displayName))
            );
        }

        if ("es".equals(locale)) {
            return new EmailContent(
                    "Tu verificación no ha sido aprobada",
                    wrapWithLogo("""
                            <p>Hola %s,</p>
                            <p>Hemos revisado tu solicitud para operar como modelo en <b>SharemeChat</b> y, tras evaluarla, no ha sido aprobada en esta ocasión.</p>
                            <p>Si crees que se trata de un error o quieres entender mejor la decisión, contacta con nuestro equipo de soporte y la revisaremos contigo.</p>
                            <p>Gracias por tu interés,<br>El equipo de SharemeChat</p>
                            """.formatted(displayName))
            );
        }
        return new EmailContent(
                "Your verification has not been approved",
                wrapWithLogo("""
                        <p>Hello %s,</p>
                        <p>We've reviewed your application to operate as a model on <b>SharemeChat</b> and, after evaluating it, it has not been approved on this occasion.</p>
                        <p>If you believe this is a mistake or want to better understand the decision, please contact our support team and we'll review it with you.</p>
                        <p>Thanks for your interest,<br>The SharemeChat team</p>
                        """.formatted(displayName))
        );
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
