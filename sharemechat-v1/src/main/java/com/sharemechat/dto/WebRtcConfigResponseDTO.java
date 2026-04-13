package com.sharemechat.dto;

import java.util.List;

public class WebRtcConfigResponseDTO {

    private final List<IceServerDTO> iceServers;

    public WebRtcConfigResponseDTO(List<IceServerDTO> iceServers) {
        this.iceServers = iceServers;
    }

    public List<IceServerDTO> getIceServers() {
        return iceServers;
    }

    public static class IceServerDTO {
        private final List<String> urls;
        private final String username;
        private final String credential;

        public IceServerDTO(List<String> urls, String username, String credential) {
            this.urls = urls;
            this.username = username;
            this.credential = credential;
        }

        public List<String> getUrls() {
            return urls;
        }

        public String getUsername() {
            return username;
        }

        public String getCredential() {
            return credential;
        }
    }
}
