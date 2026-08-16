package com.sharemechat.util;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;

/**
 * Predicado compartido "es MODELO" para el gate modo-por-rol (ADR-009):
 * rol MODEL (escalada) o candidata (rol USER + userType FORM_MODEL).
 *
 * <p>Extraído para que las tres copias que lo evaluaban por separado
 * ({@code ProductOperationalModeFilter} REST, {@code ProductOperationalModeWsInterceptor}
 * WS y {@code UserController} /me) no puedan divergir: una divergencia de
 * este predicado tendría impacto de SEGURIDAD (un cliente colándose al modo
 * OPEN reservado al modelo, o una modelo tratada como cliente).
 *
 * <p>Fail-closed: {@code null} -&gt; {@code false}.
 */
public final class UserRoleUtils {

    private UserRoleUtils() {
    }

    public static boolean isModelOrCandidate(User user) {
        if (user == null) {
            return false;
        }
        String role = user.getRole();
        String userType = user.getUserType();
        return Constants.Roles.MODEL.equals(role)
                || (Constants.Roles.USER.equals(role) && Constants.UserTypes.FORM_MODEL.equals(userType));
    }
}
