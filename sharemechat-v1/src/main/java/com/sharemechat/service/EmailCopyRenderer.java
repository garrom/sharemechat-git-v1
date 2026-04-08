package com.sharemechat.service;

import com.sharemechat.entity.User;
import org.springframework.stereotype.Component;

@Component
public class EmailCopyRenderer {

    private final EmailLocaleResolver localeResolver;

    public EmailCopyRenderer(EmailLocaleResolver localeResolver) {
        this.localeResolver = localeResolver;
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
