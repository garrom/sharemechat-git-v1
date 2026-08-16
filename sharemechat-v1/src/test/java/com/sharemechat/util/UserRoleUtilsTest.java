package com.sharemechat.util;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * ADR-059 — predicado compartido `isModelOrCandidate` extraído de las 3 copias
 * del gate modo-por-rol (ADR-009). Unit puro.
 */
class UserRoleUtilsTest {

    private User user(String role, String userType) {
        User u = new User();
        u.setRole(role);
        u.setUserType(userType);
        return u;
    }

    @Test
    void modelo_escalada_true() {
        assertTrue(UserRoleUtils.isModelOrCandidate(user(Constants.Roles.MODEL, null)));
    }

    @Test
    void candidata_userFormModel_true() {
        assertTrue(UserRoleUtils.isModelOrCandidate(user(Constants.Roles.USER, Constants.UserTypes.FORM_MODEL)));
    }

    @Test
    void cliente_userFormClient_false() {
        assertFalse(UserRoleUtils.isModelOrCandidate(user(Constants.Roles.USER, Constants.UserTypes.FORM_CLIENT)));
    }

    @Test
    void clientEscalado_false() {
        assertFalse(UserRoleUtils.isModelOrCandidate(user(Constants.Roles.CLIENT, null)));
    }

    @Test
    void master_false() {
        assertFalse(UserRoleUtils.isModelOrCandidate(user(Constants.Roles.MASTER, null)));
    }

    @Test
    void userSinUserType_false() {
        assertFalse(UserRoleUtils.isModelOrCandidate(user(Constants.Roles.USER, null)));
    }

    @Test
    void nullUser_false() {
        assertFalse(UserRoleUtils.isModelOrCandidate(null));
    }
}
