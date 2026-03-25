package com.sharemechat.controller;

import com.sharemechat.dto.GiftPublicDTO;
import com.sharemechat.service.GiftService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/gifts")
public class GiftController {

    private final GiftService giftService;

    public GiftController(GiftService giftService) {
        this.giftService = giftService;
    }

    @GetMapping
    public List<GiftPublicDTO> getAllGifts() {
        return giftService.getPublicGifts();
    }
}