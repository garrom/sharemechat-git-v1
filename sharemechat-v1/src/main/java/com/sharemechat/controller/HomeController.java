package com.sharemechat.controller;

import com.sharemechat.dto.HomeFeaturedDTO;
import com.sharemechat.service.HomeFeaturedService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/public/home")
public class HomeController {

    private final HomeFeaturedService homeFeaturedService;

    public HomeController(HomeFeaturedService homeFeaturedService) {
        this.homeFeaturedService = homeFeaturedService;
    }

    @GetMapping("/featured")
    public ResponseEntity<List<HomeFeaturedDTO>> getFeaturedModels() {
        List<HomeFeaturedDTO> list = homeFeaturedService.getHomeFeatured();
        return ResponseEntity.ok(list);
    }
}
