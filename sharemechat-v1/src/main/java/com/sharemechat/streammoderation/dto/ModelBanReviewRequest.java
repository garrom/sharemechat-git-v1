package com.sharemechat.streammoderation.dto;

/**
 * ADR-037 frente trial-sfw Bloque 4: body opcional de las acciones
 * admin sobre un ban (lift / keep). {@code note} es texto libre que
 * el admin puede dejar para auditoria futura (por ahora no se persiste,
 * solo se logea; reservado para columna en model_moderation_bans si
 * se decide en frente posterior).
 */
public record ModelBanReviewRequest(String note) {}
