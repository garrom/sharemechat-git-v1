package com.sharemechat.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtUtil jwtUtil;
    private final UserDetailsServiceImpl userDetailsService;

    public SecurityConfig(JwtUtil jwtUtil, UserDetailsServiceImpl userDetailsService) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth

                        // PUBLIC
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/users/register/**","/api/auth/login","/api/auth/refresh","/api/auth/logout").permitAll()
                        .requestMatchers("/api/public/home/**").permitAll()


                        .requestMatchers(HttpMethod.GET, "/api/users/avatars/**").permitAll()

                        // STREAMS: ACK media (cliente o modelo)
                        .requestMatchers(HttpMethod.POST, "/api/streams/*/ack-media").hasAnyRole("CLIENT","MODEL")

                        // Eventos de consentimiento (guest)
                        .requestMatchers("/api/consent/**").permitAll()

                        // USERS
                        .requestMatchers("/api/users/**").authenticated()

                        // MODELS: documentos
                        .requestMatchers(HttpMethod.GET,    "/api/models/documents/me").hasAnyRole("USER","MODEL")
                        .requestMatchers(HttpMethod.POST,   "/api/models/documents").hasAnyRole("USER","MODEL")
                        .requestMatchers(HttpMethod.DELETE, "/api/models/documents").hasAnyRole("USER","MODEL")
                        .requestMatchers(HttpMethod.DELETE, "/api/models/documents/**").hasAnyRole("USER","MODEL")
                        .requestMatchers(HttpMethod.GET, "/api/models/teasers/**").hasAnyRole("USER","CLIENT","MODEL","ADMIN")

                        // CLIENTS: documentos
                        .requestMatchers(HttpMethod.GET,    "/api/clients/documents/me").hasRole("CLIENT")
                        .requestMatchers(HttpMethod.POST,   "/api/clients/documents").hasRole("CLIENT")
                        .requestMatchers(HttpMethod.DELETE, "/api/clients/documents").hasRole("CLIENT")
                        .requestMatchers(HttpMethod.DELETE, "/api/clients/documents/**").hasRole("CLIENT")
                        .requestMatchers(HttpMethod.GET, "/api/funnyplace/random").hasRole("CLIENT")

                        // ROLE-SCOPED APIs
                        .requestMatchers("/api/models/**").hasRole("MODEL")
                        .requestMatchers("/api/clients/**").hasRole("CLIENT")
                        .requestMatchers("/api/favorites/**").hasAnyRole("CLIENT","MODEL")

                        // Billing / PSP (CCBill)
                        .requestMatchers("/api/billing/ccbill/notify").permitAll()
                        .requestMatchers("/api/billing/ccbill/session").hasAnyRole("USER","CLIENT")

                        // Transactions
                        .requestMatchers("/api/transactions/payout").hasRole("MODEL")
                        .requestMatchers("/api/transactions/add-balance").hasRole("CLIENT")
                        .requestMatchers("/api/transactions/**").authenticated()

                        // Admin
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        // WS endpoints (Fase 2)
                        .requestMatchers("/messages/**").permitAll()
                        .requestMatchers("/match/**").permitAll()
                        .requestMatchers("/ws/**").permitAll()

                        // REST messages
                        .requestMatchers("/api/messages/**").authenticated()

                        .requestMatchers("/api/auth/password/forgot", "/api/auth/password/reset").permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(
                        new CookieJwtAuthenticationFilter(jwtUtil, userDetailsService),
                        UsernamePasswordAuthenticationFilter.class
                )
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                );

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOrigins(Arrays.asList(
                "https://www.test.sharemechat.com",
                "https://test.sharemechat.com",
                "http://localhost:3000"
        ));

        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}