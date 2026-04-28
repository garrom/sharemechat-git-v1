package com.sharemechat.config;

import com.sharemechat.handler.MatchingHandler;
import com.sharemechat.handler.MessagesWsHandler;
import com.sharemechat.security.ProductOperationalModeWsInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final MatchingHandler matchingHandler;
    private final MessagesWsHandler messagesWsHandler;
    private final ProductOperationalModeWsInterceptor productOperationalModeWsInterceptor;

    public WebSocketConfig(MatchingHandler matchingHandler,
                           MessagesWsHandler messagesWsHandler,
                           ProductOperationalModeWsInterceptor productOperationalModeWsInterceptor) {
        this.matchingHandler = matchingHandler;
        this.messagesWsHandler = messagesWsHandler;
        this.productOperationalModeWsInterceptor = productOperationalModeWsInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        String[] origins = {
                "https://test.sharemechat.com",
                "https://audit.sharemechat.com",
                "http://localhost:3000"
        };

        registry.addHandler(matchingHandler, "/match")
                .addInterceptors(productOperationalModeWsInterceptor)
                .setAllowedOriginPatterns(origins);

        registry.addHandler(messagesWsHandler, "/messages")
                .addInterceptors(productOperationalModeWsInterceptor)
                .setAllowedOriginPatterns(origins);
    }
}
