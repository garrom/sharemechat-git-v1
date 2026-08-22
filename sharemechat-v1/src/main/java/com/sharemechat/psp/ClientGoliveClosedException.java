package com.sharemechat.psp;

/**
 * Fase B go-live: el primer pago de un usuario {@code role=USER} se rechaza
 * mientras la llave {@code product.golive.client.enabled} esta en false
 * (coming-soon). No se puede aceptar el pago con la app aun no disponible
 * (motivo legal). El controller la mapea a HTTP 503 {@code CLIENT_COMING_SOON}.
 *
 * Distinta de {@link PspException} (que es indisponibilidad del PSP): esta es
 * una decision de negocio de apertura, no un fallo del vendor.
 */
public class ClientGoliveClosedException extends RuntimeException {

    public ClientGoliveClosedException(String message) {
        super(message);
    }
}
