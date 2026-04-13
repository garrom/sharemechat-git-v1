package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "app.webrtc")
public class WebRtcProperties {

    private List<IceServerProperties> iceServers = new ArrayList<>();

    public List<IceServerProperties> getIceServers() {
        return iceServers;
    }

    public void setIceServers(List<IceServerProperties> iceServers) {
        this.iceServers = iceServers;
    }

    public static class IceServerProperties {
        private List<String> urls = new ArrayList<>();
        private String username;
        private String credential;

        public List<String> getUrls() {
            return urls;
        }

        public void setUrls(List<String> urls) {
            this.urls = urls;
        }

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getCredential() {
            return credential;
        }

        public void setCredential(String credential) {
            this.credential = credential;
        }
    }
}
