package com.sharemechat.controller;

import com.sharemechat.config.WebRtcProperties;
import com.sharemechat.dto.WebRtcConfigResponseDTO;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/webrtc")
public class WebRtcConfigController {

    private final WebRtcProperties webRtcProperties;

    public WebRtcConfigController(WebRtcProperties webRtcProperties) {
        this.webRtcProperties = webRtcProperties;
    }

    @GetMapping("/config")
    public WebRtcConfigResponseDTO getConfig() {
        List<WebRtcConfigResponseDTO.IceServerDTO> iceServers = webRtcProperties.getIceServers().stream()
                .map(server -> {
                    List<String> urls = normalizeUrls(server.getUrls());
                    if (urls.isEmpty()) {
                        return null;
                    }
                    return new WebRtcConfigResponseDTO.IceServerDTO(
                            urls,
                            normalize(server.getUsername()),
                            normalize(server.getCredential())
                    );
                })
                .filter(server -> server != null)
                .toList();

        if (iceServers.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Configuracion WebRTC no disponible");
        }

        return new WebRtcConfigResponseDTO(iceServers);
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private List<String> normalizeUrls(List<String> values) {
        if (values == null || values.isEmpty()) {
            return Collections.emptyList();
        }
        return values.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();
    }
}
