package com.sharemechat.controller;

import com.sharemechat.entity.Gift;
import com.sharemechat.repository.GiftRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/gifts")
public class GiftController {

    private final GiftRepository giftRepository;

    public GiftController(GiftRepository giftRepository) {
        this.giftRepository = giftRepository;
    }

    @GetMapping
    public List<Gift> getAllGifts() {
        return giftRepository.findAll();
    }
}
