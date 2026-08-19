package com.sharemechat.dto;

import java.util.List;

/**
 * Card 1 Fase C: ranking "Top modelos" por likes (vista entre modelos).
 *
 * <p>{@code entries} = top N ordenado por likes desc. {@code self} = la fila
 * de la modelo que consulta cuando queda FUERA del top (null si ya está en
 * {@code entries}; el frontend resalta su fila en ese caso).
 */
public record ModelRankingDTO(
        List<Entry> entries,
        Entry self
) {
    public record Entry(
            int rank,
            Long modelUserId,
            String nickname,
            long count,
            String badgeCode
    ) {}
}
