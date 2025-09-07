package com.sharemechat.dto;

public record FavoriteListItemDTO(
        UserSummaryDTO user,   // el peer
        String status,         // active|inactive (siempre te devolveremos active)
        String invited,        // accepted|rejected|pending (TU vista)
        String direction       // "outbound" (lo invitaste tú) | "inbound" (te invitaron)
) {}
