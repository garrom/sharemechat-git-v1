package com.sharemechat.dto;

public record FavoriteListItemDTO(
        UserSummaryDTO user,   // el peer
        String status,         // active|inactive (tu vista)
        String invited,        // accepted|rejected|pending (tu vista)
        String direction,      // "outbound" | "inbound"
        String presence,       // "busy" | "online" | "offline"
        boolean blocked        // true si YO he bloqueado a este peer (para UI)
) {}
