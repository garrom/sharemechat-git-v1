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
     * Envuelve el cuerpo HTML del email con una cabecera con el logo
     * de marca. Estructura email-safe (tabla con role=presentation,
     * inline styles, sin CSS externo) compatible con la mayoria de
     * clientes mainstream (Gmail web/iOS/Android, Outlook desktop/365,
     * Apple Mail, Yahoo).
     */
    private static String wrapWithLogo(String innerHtml) {
        return """
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="background:#ffffff;">
                  <tr>
                    <td align="center" style="padding: 24px 16px 16px 16px;">
                      <img src="%s" width="172" height="18" alt="SharemeChat" style="display:block; max-width:172px; height:auto; border:0; outline:none; text-decoration:none;" />
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 24px 24px 24px; color:#0f172a; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6;">
                %s
                    </td>
                  </tr>
                </table>
                """.formatted(BRAND_LOGO_URL, innerHtml);
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
        String nickname = safeLabel(user);
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
            return new EmailContent("Bienvenido a SharemeChat", wrapWithLogo(body));
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
        return new EmailContent("Welcome to SharemeChat", wrapWithLogo(body));
    }

    public EmailContent renderUnsubscribe(User user) {
        String locale = localeResolver.resolve(user);
        String nickname = safeLabel(user);

        if ("es".equals(locale)) {
            return new EmailContent(
                    "Confirmacion de baja en SharemeChat",
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
                    "Recuperacion de contrasena",
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
        String displayName = (nickname != null && !nickname.isBlank()) ? nickname : safeLabel(user);
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
                        "Validacion de email para acceso interno",
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
                // Coming-soon ES: subject simple, sin diferenciacion por
                // userType (en PRELAUNCH no se diferencian funciones
                // todavia, todos esperan apertura).
                return new EmailContent(
                        "Confirma tu email en SharemeChat",
                        wrapWithLogo("""
                                <p>Hola %s, gracias por registrarte en SharemeChat.</p>
                                <p>Confirma tu email para completar tu registro.</p>
                                <p>Estamos ultimando los detalles y la aplicación estará disponible en breve; te avisaremos por email cuando puedas entrar.</p>
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
            return new EmailContent(
                    "Confirm your email on SharemeChat",
                    wrapWithLogo("""
                            <p>Hi %s, thanks for registering with SharemeChat.</p>
                            <p>Confirm your email to complete your registration.</p>
                            <p>We're finalizing the details and the app will be available soon; we'll email you when you can get in.</p>
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
        String displayName = safeLabel(user);
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
