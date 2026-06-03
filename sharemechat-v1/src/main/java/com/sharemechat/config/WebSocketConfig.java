package com.sharemechat.config;

import com.sharemechat.handler.MatchingHandler;
import com.sharemechat.handler.MessagesWsHandler;
import com.sharemechat.security.ModelContractWsInterceptor;
import com.sharemechat.security.ProductOperationalModeWsInterceptor;
import org.springframework.beans.factory.annotation.Value;
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
    private final ModelContractWsInterceptor modelContractWsInterceptor;
    private final String[] allowedOrigins;

    public WebSocketConfig(MatchingHandler matchingHandler,
                           MessagesWsHandler messagesWsHandler,
                           ProductOperationalModeWsInterceptor productOperationalModeWsInterceptor,
                           ModelContractWsInterceptor modelContractWsInterceptor,
                           @Value("${app.websocket.allowed-origins}") String[] allowedOrigins) {
        this.matchingHandler = matchingHandler;
        this.messagesWsHandler = messagesWsHandler;
        this.productOperationalModeWsInterceptor = productOperationalModeWsInterceptor;
        this.modelContractWsInterceptor = modelContractWsInterceptor;
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Orden de evaluación: Product Operational Mode primero (decide
        // si el producto admite tráfico en absoluto), ModelContract
        // segundo (decide si esta sesión concreta de un actor modelo
        // puede operar con la versión vigente del contrato).
        registry.addHandler(matchingHandler, "/match")
                .addInterceptors(productOperationalModeWsInterceptor, modelContractWsInterceptor)
                .setAllowedOriginPatterns(allowedOrigins);

        registry.addHandler(messagesWsHandler, "/messages")
                .addInterceptors(productOperationalModeWsInterceptor, modelContractWsInterceptor)
                .setAllowedOriginPatterns(allowedOrigins);
    }
}
