package com.sharemechat.config;

import com.sharemechat.handler.MatchingHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final MatchingHandler matchingHandler;

    public WebSocketConfig(MatchingHandler matchingHandler) {
        this.matchingHandler = matchingHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(matchingHandler, "/match")
                .setAllowedOrigins("https://test.sharemechat.com", "http://localhost:3000");
    }
}
