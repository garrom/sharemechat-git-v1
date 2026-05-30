package com.sharemechat.service;

import com.sharemechat.entity.User;
import org.springframework.stereotype.Component;

@Component
public class EmailCopyRenderer {

    private final EmailLocaleResolver localeResolver;
    private final AssetRejectionReasonCopy assetRejectionReasonCopy;

    public EmailCopyRenderer(EmailLocaleResolver localeResolver,
                             AssetRejectionReasonCopy assetRejectionReasonCopy) {
        this.localeResolver = localeResolver;
        this.assetRejectionReasonCopy = assetRejectionReasonCopy;
    }

    public EmailContent renderWelcome(User user) {
        String locale = localeResolver.resolve(user);
        String nickname = safeLabel(user);

        if ("es".equals(locale)) {
            return new EmailContent(
                    "Bienvenido a SharemeChat",
                    """
                    <p>Hola %s,</p>
                    <p>Tu cuenta en <b>SharemeChat</b> se ha creado correctamente.</p>
                    <p>Ya puedes acceder a la plataforma.</p>
                    <p>Si no has creado esta cuenta, contacta con soporte.</p>
                    """.formatted(nickname)
            );
        }

        return new EmailContent(
                "Welcome to SharemeChat",
                """
                <p>Hello %s,</p>
                <p>Your <b>SharemeChat</b> account has been created successfully.</p>
                <p>You can now access the platform.</p>
                <p>If you did not create this account, please contact support.</p>
                """.formatted(nickname)
        );
    }

    public EmailContent renderUnsubscribe(User user) {
        String locale = localeResolver.resolve(user);
        String nickname = safeLabel(user);

        if ("es".equals(locale)) {
            return new EmailContent(
                    "Confirmacion de baja en SharemeChat",
                    """
                    <p>Hola %s,</p>

                    <p>Tu cuenta en <b>SharemeChat</b> ha sido dada de baja correctamente.</p>

                    <p>Si no has solicitado esta baja o crees que se trata de un error,
                    puedes contactar con nuestro equipo de soporte.</p>

                    <p>Gracias por haber utilizado SharemeChat.</p>
                    """.formatted(nickname)
            );
        }

        return new EmailContent(
                "SharemeChat account closure confirmation",
                """
                <p>Hello %s,</p>

                <p>Your <b>SharemeChat</b> account has been closed successfully.</p>

                <p>If you did not request this closure or believe this is a mistake,
                you can contact our support team.</p>

                <p>Thank you for using SharemeChat.</p>
                """.formatted(nickname)
        );
    }

    public EmailContent renderPasswordReset(User user, String link, int ttlMinutes) {
        String locale = localeResolver.resolve(user);
        String expiryText = formatExpiryText(locale, ttlMinutes);

        if ("es".equals(locale)) {
            return new EmailContent(
                    "Recuperacion de contrasena",
                    """
                    <p>Has solicitado restablecer tu contraseÃ±a.</p>
                    <p>Haz clic en el siguiente enlace para continuar:</p>
                    <p><a href="%s">%s</a></p>
                    <p>Este enlace caduca en %s.</p>
                    """.formatted(link, link, expiryText)
            );
        }

        return new EmailContent(
                "Password reset",
                """
                <p>You requested to reset your password.</p>
                <p>Click the following link to continue:</p>
                <p><a href="%s">%s</a></p>
                <p>This link expires in %s.</p>
                """.formatted(link, link, expiryText)
        );
    }

    public EmailContent renderVerification(User user, String context, String nickname, String link, int ttlMinutes) {
        String locale = localeResolver.resolve(user);
        String displayName = (nickname != null && !nickname.isBlank()) ? nickname : safeLabel(user);
        String expiryText = formatExpiryText(locale, ttlMinutes);
        String userType = String.valueOf(user != null ? user.getUserType() : "");

        if ("es".equals(locale)) {
            if ("BACKOFFICE".equalsIgnoreCase(context)) {
                return new EmailContent(
                        "Validacion de email para acceso interno",
                        """
                        <p>Hola %s,</p>
                        <p>Tu acceso interno a <b>SharemeChat Backoffice</b> ya esta preparado.</p>
                        <p>Antes de poder entrar, debes validar tu email:</p>
                        <p><a href="%s">%s</a></p>
                        <p>Este enlace caduca en %s.</p>
                        """.formatted(displayName, link, link, expiryText)
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
                    """
                    <p>Hola %s,</p>
                    <p>Tu cuenta en <b>SharemeChat</b> necesita validar el email para continuar.</p>
                    <p>%s</p>
                    <p><a href="%s">%s</a></p>
                    <p>Este enlace caduca en %s.</p>
                    """.formatted(displayName, reason, link, link, expiryText)
            );
        }

        if ("BACKOFFICE".equalsIgnoreCase(context)) {
            return new EmailContent(
                    "Email verification for internal access",
                    """
                    <p>Hello %s,</p>
                    <p>Your internal access to <b>SharemeChat Backoffice</b> is ready.</p>
                    <p>Before you can sign in, you must verify your email:</p>
                    <p><a href="%s">%s</a></p>
                    <p>This link expires in %s.</p>
                    """.formatted(displayName, link, link, expiryText)
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
                """
                <p>Hello %s,</p>
                <p>Your <b>SharemeChat</b> account needs email verification to continue.</p>
                <p>%s</p>
                <p><a href="%s">%s</a></p>
                <p>This link expires in %s.</p>
                """.formatted(displayName, reason, link, link, expiryText)
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
                    """
                    <p>Hola %s,</p>
                    <p>Tu %s de perfil no ha sido aprobada para publicación.</p>
                    <p><b>Motivo:</b> %s</p>
                    %s
                    %s
                    <p>Cuando tu nueva foto y tu nuevo vídeo estén aprobados, volverás a aparecer en el listado público.</p>
                    <p>Gracias,<br>El equipo de SharemeChat</p>
                    """.formatted(displayName, assetLabel, reasonLabel,
                            moderatorNoteFragment, profileLinkFragment)
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
                """
                <p>Hello %s,</p>
                <p>Your profile %s has not been approved for publication.</p>
                <p><b>Reason:</b> %s</p>
                %s
                %s
                <p>Once your new photo and video are approved, you will appear in the public listing again.</p>
                <p>Thanks,<br>The SharemeChat Team</p>
                """.formatted(displayName, assetLabelEn, reasonLabel,
                        moderatorNoteFragmentEn, profileLinkFragmentEn)
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
