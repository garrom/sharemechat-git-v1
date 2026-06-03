package com.sharemechat.security;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.service.ModelContractService;
import org.springframework.stereotype.Component;

/**
 * Comprobación única "el actor modelo ha aceptado la versión vigente
 * del Model Collaboration Agreement". Reutilizable por controllers REST,
 * interceptor de handshake WebSocket y servicios que disparen acciones
 * sensibles a tener el contrato vigente aceptado.
 *
 * <p>Diseño: separa "¿requiere el gate?" de "¿lo cumple?" para que cada
 * caller decida cómo reaccionar (devolver 403 REST, abortar handshake,
 * lanzar IllegalState, etc.). El gate solo emite el veredicto; no
 * comunica.
 *
 * <p>Política aplicada (ver auditoría flujo del contrato, lote de
 * endurecimiento 2026-06-03/04):
 * <ul>
 *   <li>USER + FORM_MODEL (onboarding): requiere contrato.</li>
 *   <li>role=MODEL (modelo ya aprobada): requiere contrato.</li>
 *   <li>Cualquier otro rol: NO requiere.</li>
 * </ul>
 *
 * <p>El cumplimiento se delega en {@link ModelContractService#isAccepted(Long)},
 * que compara con la versión vigente del manifest.
 */
@Component
public class ModelContractGate {

    private final ModelContractService modelContractService;

    public ModelContractGate(ModelContractService modelContractService) {
        this.modelContractService = modelContractService;
    }

    /**
     * @return {@code true} si el user es actor modelo (onboarding o
     *         role=MODEL) y por tanto debe haber aceptado la versión
     *         vigente del contrato.
     */
    public boolean requiresAcceptance(User u) {
        if (u == null) return false;
        return isOnboardingModel(u) || Constants.Roles.MODEL.equals(u.getRole());
    }

    /**
     * @return {@code true} si el user tiene una aceptación registrada
     *         para la versión vigente del manifest.
     */
    public boolean hasAcceptedCurrent(Long userId) {
        if (userId == null) return false;
        return modelContractService.isAccepted(userId);
    }

    /**
     * Comprobación combinada: {@code true} si el user requiere el gate
     * y NO lo cumple. Lo opuesto de "puede operar" para actores modelo.
     */
    public boolean isBlocked(User u) {
        return requiresAcceptance(u) && !hasAcceptedCurrent(u.getId());
    }

    private boolean isOnboardingModel(User u) {
        return Constants.Roles.USER.equals(u.getRole())
                && Constants.UserTypes.FORM_MODEL.equals(u.getUserType());
    }
}
