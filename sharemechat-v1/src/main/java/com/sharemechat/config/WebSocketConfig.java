package com.sharemechat.config;

import com.sharemechat.handler.MatchingHandler;
import com.sharemechat.handler.MessagesWsHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final MatchingHandler matchingHandler;
    private final MessagesWsHandler messagesWsHandler;

    public WebSocketConfig(MatchingHandler matchingHandler, MessagesWsHandler messagesWsHandler) {
        this.matchingHandler = matchingHandler;
        this.messagesWsHandler = messagesWsHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        String[] origins = { "https://test.sharemechat.com", "http://localhost:3000" };

        registry.addHandler(matchingHandler, "/match")
                .setAllowedOriginPatterns(origins);

        registry.addHandler(messagesWsHandler, "/messages")
                .setAllowedOriginPatterns(origins);
    }
}
