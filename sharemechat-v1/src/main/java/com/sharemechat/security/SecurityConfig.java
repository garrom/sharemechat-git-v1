package com.sharemechat.security;

import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.ApiRateLimitService;
import com.sharemechat.service.ProductOperationalModeService;
import org.springframework.beans.factory.annotation.Value;
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
    private final ApiRateLimitService apiRateLimitService;
    private final ProductOperationalModeService productOperationalModeService;
    private final UserRepository userRepository;

    @Value("${auth.cookieDomain}")
    private String cookieDomain;

    @Value("${auth.secureCookies:true}")
    private boolean secureCookies;

    public SecurityConfig(
            JwtUtil jwtUtil,
            UserDetailsServiceImpl userDetailsService,
            ApiRateLimitService apiRateLimitService,
            ProductOperationalModeService productOperationalModeService,
            UserRepository userRepository
    ) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
        this.apiRateLimitService = apiRateLimitService;
        this.productOperationalModeService = productOperationalModeService;
        this.userRepository = userRepository;
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
                        .requestMatchers("/api/users/register/**", "/api/auth/login", "/api/auth/refresh", "/api/auth/logout", "/api/admin/auth/login").permitAll()
                        .requestMatchers("/api/email-verification/confirm").permitAll()
                        .requestMatchers("/api/public/home/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/public/content/**").permitAll()
                        // ADR-049 Subpasada 2B: landing publica y magic link del programa de afiliadas.
                        // POST /click, POST /magic-link, GET /link/consume. Sin auth (endpoints publicos
                        // llamados desde landing SPA + email links).
                        .requestMatchers("/api/public/affiliate/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/users/avatars/**").permitAll()

                        // SEO layer (Frente 2 sobre CMS Fase 4A): sitemap dinamico
                        // y robots.txt servidos sin auth para que crawlers los indexen.
                        // ADR-016 / D9: GET y HEAD ambos permitAll. Sin HEAD, crawlers
                        // que validan existencia con HEAD reciben 401 espurio.
                        .requestMatchers(HttpMethod.GET, "/sitemap.xml", "/robots.txt").permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/sitemap.xml", "/robots.txt").permitAll()

                        // STREAMS: ACK media (cliente o modelo)
                        .requestMatchers(HttpMethod.POST, "/api/streams/*/ack-media").hasAnyRole("CLIENT", "MODEL")

                        // STREAMS: ingest de frames del frente Moderacion IA (P2.1)
                        // Solo el modelo del stream emite frames; el controller refuerza
                        // ownership (stream.modelId == auth.userId).
                        .requestMatchers(HttpMethod.POST, "/api/streams/*/frames").hasRole("MODEL")

                        // STREAMING: liveness challenge (ADR-050 Fase B). Cualquier
                        // usuario autenticado (CLIENT o MODEL, incluye USER trial)
                        // puede iniciar y verificar su propio challenge. El controller
                        // valida ownership via auth.userId.
                        .requestMatchers("/api/streaming/liveness/**").authenticated()

                        // Consent
                        .requestMatchers(HttpMethod.POST, "/api/consent/accept").authenticated()
                        .requestMatchers("/api/consent/**").permitAll()

                        // USERS
                        .requestMatchers("/api/users/**").authenticated()

                        // ==========================
                        // MODELS - KYC (onboarding)
                        // ==========================
                        .requestMatchers(HttpMethod.GET, "/api/models/kyc/me").hasRole("USER")
                        .requestMatchers(HttpMethod.GET, "/api/models/kyc/entrypoint").hasRole("USER")
                        .requestMatchers(HttpMethod.POST, "/api/models/kyc").hasRole("USER")
                        .requestMatchers(HttpMethod.DELETE, "/api/models/kyc").hasRole("USER")

                        // ==========================
                        // MODELS - DOCUMENTS (ONBOARDING + MODEL)
                        // IMPORTANT: must be BEFORE "/api/models/**"
                        // ==========================
                        .requestMatchers(HttpMethod.GET, "/api/models/documents/me").hasAnyRole("USER", "MODEL")
                        .requestMatchers(HttpMethod.POST, "/api/models/documents").hasAnyRole("USER", "MODEL")
                        .requestMatchers(HttpMethod.DELETE, "/api/models/documents").hasAnyRole("USER", "MODEL")
                        .requestMatchers(HttpMethod.DELETE, "/api/models/documents/**").hasAnyRole("USER", "MODEL")

                        // Teasers
                        .requestMatchers(HttpMethod.GET, "/api/models/teasers/**").hasAnyRole("USER", "CLIENT", "MODEL", "ADMIN")

                        // ==========================
                        // MODEL ASSETS - Capa 2 multi-asset
                        // IMPORTANT: must be BEFORE "/api/models/**" catch-all (linea siguiente del bloque ROLE-SCOPED)
                        // ==========================
                        // Galería pública del modelo (vista cliente): cualquier usuario auth
                        .requestMatchers(HttpMethod.GET, "/api/models/*/assets").hasAnyRole("USER", "CLIENT", "MODEL", "ADMIN")
                        // Perfil público del modelo (modal "Ver perfil completo" desde favoritos del cliente)
                        .requestMatchers(HttpMethod.GET, "/api/models/*/public-profile").hasAnyRole("USER", "CLIENT", "MODEL", "ADMIN")
                        // Endpoints del propio modelo (USER onboarding + MODEL)
                        .requestMatchers("/api/me/assets/**").hasAnyRole("USER", "MODEL")
                        .requestMatchers(HttpMethod.GET, "/api/me/assets").hasAnyRole("USER", "MODEL")
                        .requestMatchers(HttpMethod.POST, "/api/me/assets").hasAnyRole("USER", "MODEL")

                        // ============================================================
                        // ADR-049 Subpasada 2A: sistema de afiliadas (endpoints del
                        // panel de la modelo). Van ANTES del catch-all /api/models/**
                        // porque son especificos del rol MODEL con guards internos
                        // adicionales (KYC APPROVED, cuenta no suspendida) que aplica
                        // AffiliateCodeService. El GET del panel y del QR estan
                        // disponibles siempre para MODEL; POST activate lo restringe
                        // el service.
                        // ============================================================
                        .requestMatchers(HttpMethod.POST, "/api/models/me/affiliate/activate").hasRole("MODEL")
                        .requestMatchers(HttpMethod.GET, "/api/models/me/affiliate").hasRole("MODEL")
                        .requestMatchers(HttpMethod.GET, "/api/models/me/affiliate/qr.svg").hasRole("MODEL")

                        // CLIENTS: documentos
                        .requestMatchers(HttpMethod.GET, "/api/clients/documents/me").hasRole("CLIENT")
                        .requestMatchers(HttpMethod.POST, "/api/clients/documents").hasRole("CLIENT")
                        .requestMatchers(HttpMethod.DELETE, "/api/clients/documents").hasRole("CLIENT")
                        .requestMatchers(HttpMethod.DELETE, "/api/clients/documents/**").hasRole("CLIENT")
                        .requestMatchers(HttpMethod.GET, "/api/funnyplace/random").hasRole("CLIENT")

                        // Billing / PSP — sin PSP activo (Lote 3, 2026-06-08).
                        // Cuando se active el siguiente PSP los matchers se
                        // anaden aqui con verificacion HMAC desde el primer
                        // commit.

                        // KYC (VERIFF)
                        .requestMatchers(HttpMethod.POST, "/api/kyc/veriff/start").hasRole("USER")
                        .requestMatchers(HttpMethod.POST, "/api/kyc/veriff/webhook").permitAll()

                        // KYC (DIDIT) - ADR-035 vendor unico Plan A. Sin
                        // wildcard /api/kyc/** intencional: cada endpoint
                        // se declara explicito para no abrir permitAll por
                        // descuido sobre un futuro /api/kyc/<algo>.
                        // Endpoints simetricos model/client desde V9; webhook
                        // unico compartido.
                        //
                        // Modelo: solo USER (onboarding, role MODEL no
                        // necesita re-verificar). Cliente: USER o CLIENT.
                        //
                        // Razon del USER en cliente: la verificacion de edad
                        // debe ocurrir ANTES de la primera recarga del
                        // monedero (ADR-029), y el role escala USER -> CLIENT
                        // precisamente en la primera recarga. Si exigieramos
                        // solo hasRole("CLIENT") aqui, el usuario quedaria
                        // atrapado en huevo-gallina (no puede verificar sin
                        // ser CLIENT, no puede ser CLIENT sin recargar, no
                        // puede recargar sin verificar).
                        //
                        // Razon del CLIENT en cliente: usuarios ya promocionados
                        // (post-recarga) deben poder re-iniciar la verificacion
                        // si caduca o si la sesion previa fallo. Sin esto, un
                        // CLIENT+FORM_CLIENT quedaria bloqueado por matcher
                        // aunque el KycSessionService.startDiditClientSession
                        // ya le acepta (caso real detectado el 2026-06-14 con
                        // demo+trial user id=88, ya promocionado a CLIENT en
                        // BD por flujos antiguos).
                        //
                        // La distincion FORM_MODEL vs FORM_CLIENT entre los
                        // dos endpoints la hace KycSessionService validando
                        // user.user_type al iniciar la sesion (rechazo claro
                        // con IllegalArgumentException si no encaja). Las
                        // tres capas (matcher Spring, service, Route frontend
                        // App.jsx /client-kyc) ahora estan alineadas en la
                        // misma semantica "USER o CLIENT con FORM_CLIENT".
                        .requestMatchers(HttpMethod.POST, "/api/kyc/didit/model/start").hasRole("USER")
                        .requestMatchers(HttpMethod.POST, "/api/kyc/didit/client/start").hasAnyRole("USER", "CLIENT")
                        .requestMatchers(HttpMethod.POST, "/api/kyc/didit/webhook").permitAll()
                        // Sub-frente A (2026-06-20): consulta de la última sesión KYC
                        // del user autenticado para gate del botón "Iniciar verificación"
                        // en DashboardUserModel. USER y CLIENT pueden tener sesiones
                        // (CLIENT por Age Estimation, USER por flujo modelo en curso).
                        .requestMatchers(HttpMethod.GET, "/api/kyc/sessions/me/latest").hasAnyRole("USER", "CLIENT")

                        // Webhook entrante de moderacion visual del streaming (ADR-036 / ADR-037).
                        // Firma HMAC se valida en el controller (no en filter chain), patron
                        // identico a /api/kyc/{veriff,didit}/webhook.
                        .requestMatchers(HttpMethod.POST, "/api/webhooks/moderation/*").permitAll()

                        // Transactions
                        .requestMatchers("/api/transactions/payout").hasRole("MODEL")
                        .requestMatchers("/api/transactions/add-balance").hasRole("CLIENT")
                        .requestMatchers("/api/transactions/**").authenticated()

                        // Backoffice SUPPORT Phase 1 + ADMIN compatibility
                        .requestMatchers(HttpMethod.GET, "/api/admin/models")
                        .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_MODELS_READ_LIST))
                        .requestMatchers(HttpMethod.POST, "/api/admin/model-checklist/{userId}")
                        .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_MODELS_UPDATE_CHECKLIST))
                        .requestMatchers(HttpMethod.GET, "/api/kyc/config/model-onboarding")
                        .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_MODELS_READ_KYC_MODE))
                        .requestMatchers(HttpMethod.GET, "/api/admin/moderation/reports")
                        .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_MODERATION_READ_REPORTS))
                        .requestMatchers(HttpMethod.GET, "/api/admin/moderation/reports/{id}")
                        .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_MODERATION_READ_REPORT_DETAIL))
                        .requestMatchers(HttpMethod.GET, "/api/admin/streams/active")
                        .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_STREAMS_READ_ACTIVE))
                        .requestMatchers(HttpMethod.GET, "/api/admin/streams/{id}")
                        .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_STREAMS_READ_DETAIL))
                        .requestMatchers(HttpMethod.GET, "/api/admin/stats/overview")
                        .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_STATS_READ_OVERVIEW))
                        .requestMatchers(HttpMethod.GET, "/api/admin/finance/top-models")
                        .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_FINANCE_READ_TOP_MODELS))
                        .requestMatchers(HttpMethod.GET, "/api/admin/finance/top-clients")
                        .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_FINANCE_READ_TOP_CLIENTS))
                        .requestMatchers(HttpMethod.GET, "/api/admin/finance/summary")
                        .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_FINANCE_READ_SUMMARY))

                        // ============================================================
                        // Capa 2 Fase 9 bugfix: moderación de assets — matchers
                        // específicos ANTES del catch-all /api/admin/**. Sin esto,
                        // SUPPORT y AUDIT recibían 403 al leer la cola porque el
                        // catch-all exigía ROLE_ADMIN. El gating fino del controller
                        // (canRead / canModerate / canRejectRetroactive) actúa como
                        // segunda barrera.
                        //
                        // IMPORTANTE: el matcher de /reject-retroactive va ANTES
                        // que el de /reject para mantener orden explícito (Spring
                        // evalúa en orden de declaración).
                        // ============================================================
                        .requestMatchers(HttpMethod.GET, "/api/admin/model-assets/**")
                        .hasAnyAuthority(
                                "ROLE_ADMIN",
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN),
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_SUPPORT),
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_AUDIT))
                        .requestMatchers(HttpMethod.POST, "/api/admin/model-assets/*/reject-retroactive")
                        .hasAnyAuthority(
                                "ROLE_ADMIN",
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN))
                        .requestMatchers(HttpMethod.POST,
                                "/api/admin/model-assets/*/approve",
                                "/api/admin/model-assets/*/reject")
                        .hasAnyAuthority(
                                "ROLE_ADMIN",
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN),
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_SUPPORT))

                        // ============================================================
                        // Frente Moderacion IA del streaming (ADR-030 / ADR-036 / ADR-037).
                        // Matchers especificos ANTES del catch-all /api/admin/** porque
                        // SUPPORT y AUDIT necesitan leer la cola; el catch-all exige
                        // ROLE_ADMIN. Calco de la leccion operativa Capa 1 de model-assets.
                        // Lectura: ADMIN + SUPPORT + AUDIT. Moderacion: ADMIN + SUPPORT.
                        // Config: ADMIN solo (cambio de active_mode es decision estructural;
                        // cae al catch-all sin matcher especifico).
                        // ============================================================
                        .requestMatchers(HttpMethod.GET,
                                "/api/admin/stream-moderation/queue",
                                "/api/admin/stream-moderation/queue/*",
                                "/api/admin/stream-moderation/stats",
                                "/api/admin/stream-moderation/sessions",
                                "/api/admin/stream-moderation/sessions/*")
                        .hasAnyAuthority(
                                "ROLE_ADMIN",
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN),
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_SUPPORT),
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_AUDIT))
                        .requestMatchers(HttpMethod.POST,
                                "/api/admin/stream-moderation/queue/*/approve",
                                "/api/admin/stream-moderation/queue/*/reject")
                        .hasAnyAuthority(
                                "ROLE_ADMIN",
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN),
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_SUPPORT))

                        // Product onboarding KYC config (read-only)
                        .requestMatchers(HttpMethod.GET, "/api/kyc/config/product/model-onboarding").hasRole("USER")

                        // ============================================================
                        // Sub-paquete Compliance Dashboard (DEC-CD-4). Matchers ANTES
                        // del catch-all /api/admin/** porque AUDIT necesita acceso al
                        // dashboard ejecutivo y al drill-down (gap E opcion b: el rol
                        // AUDIT existe exactamente para esto). Calco del patron de
                        // stream-moderation. Acceso a evidence S3 via signed URL
                        // tambien restringido al permiso, con audit log per-request.
                        // ============================================================
                        .requestMatchers(HttpMethod.GET, "/api/admin/compliance/**")
                        .hasAnyAuthority(
                                "ROLE_ADMIN",
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN),
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_AUDIT),
                                BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_COMPLIANCE_DASHBOARD_VIEW))

                        // Admin
                        .requestMatchers("/api/admin/**")
                        .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN))

                        // WS endpoints
                        .requestMatchers("/messages/**").permitAll()
                        .requestMatchers("/match/**").permitAll()
                        .requestMatchers("/ws/**").permitAll()

                        // REST
                        .requestMatchers(HttpMethod.GET, "/api/webrtc/config").authenticated()
                        .requestMatchers("/api/messages/**").authenticated()
                        .requestMatchers("/api/reports/**").authenticated()

                        // Sub-paquete Complaints workflow (Opcion B). Canal publico
                        // anonimo: POST sin auth + rate limit IP via ApiRateLimitService.
                        // GET /admin/complaints* protegido con permisos backoffice.
                        .requestMatchers(HttpMethod.POST, "/api/public/complaints").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/admin/complaints")
                            .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_COMPLAINTS_READ_LIST))
                        .requestMatchers(HttpMethod.GET, "/api/admin/complaints/stats")
                            .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_COMPLAINTS_READ_LIST))
                        .requestMatchers(HttpMethod.GET, "/api/admin/complaints/{id}")
                            .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_COMPLAINTS_READ_DETAIL))
                        .requestMatchers(HttpMethod.POST, "/api/admin/complaints/{id}/review")
                            .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_COMPLAINTS_REVIEW))
                        .requestMatchers(HttpMethod.POST, "/api/admin/complaints/{id}/escalate")
                            .hasAnyAuthority("ROLE_ADMIN", BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_COMPLAINTS_REVIEW))
                        .requestMatchers("/api/auth/password/forgot", "/api/auth/password/reset").permitAll()

                        // Sub-paquete Chat Soporte LLM Fase B.1 (DEC-CS-7):
                        // endpoint autenticado disponible para cualquier rol logueado
                        // (USER / CLIENT / MODEL / ADMIN). El bot NO expone endpoints
                        // publicos y no requiere PERM backoffice.
                        .requestMatchers(HttpMethod.POST, "/api/support/**").authenticated()

                        // ============================================================
                        // Frente B.3.1 - Panel Soporte Humano (ADR-046).
                        // Matchers ANTES del catch-all /api/admin/** porque
                        // ROLE_SUPPORT necesita atender el chat. Granularidad fina:
                        // - chat_handle: operaciones sobre conversaciones (ROLE_SUPPORT
                        //   lo hereda por defecto via SUPPORT_PHASE1_PERMISSIONS).
                        // - profile_manage: CRUD de profiles y grants (opt-in).
                        // ADMIN mantiene acceso por matcher explicito ROLE_ADMIN,
                        // simetrico al patron stream-moderation.
                        // ============================================================
                        .requestMatchers("/api/admin/support/profiles/*/grants",
                                        "/api/admin/support/profiles/*/grants/*")
                        .hasAnyAuthority(
                                "ROLE_ADMIN",
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN),
                                BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_SUPPORT_PROFILE_MANAGE))
                        .requestMatchers(HttpMethod.GET, "/api/admin/support/profiles/mine")
                        .hasAnyAuthority(
                                "ROLE_ADMIN",
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN),
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_SUPPORT),
                                BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_SUPPORT_CHAT_HANDLE))
                        .requestMatchers("/api/admin/support/profiles",
                                        "/api/admin/support/profiles/*")
                        .hasAnyAuthority(
                                "ROLE_ADMIN",
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN),
                                BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_SUPPORT_PROFILE_MANAGE))
                        .requestMatchers("/api/admin/support/**")
                        .hasAnyAuthority(
                                "ROLE_ADMIN",
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN),
                                BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_SUPPORT),
                                BackofficeAuthorities.permissionAuthority(BackofficeAuthorities.PERM_SUPPORT_CHAT_HANDLE))

                        // ROLE-SCOPED APIs (AL FINAL, para no pisar endpoints específicos)
                        .requestMatchers("/api/models/**").hasRole("MODEL")
                        .requestMatchers("/api/clients/**").hasRole("CLIENT")
                        .requestMatchers("/api/favorites/**").hasAnyRole("CLIENT", "MODEL")

                        .anyRequest().authenticated()
                )
                .addFilterBefore(
                        new ApiRateLimitFilter(apiRateLimitService),
                        UsernamePasswordAuthenticationFilter.class
                )
                .addFilterBefore(
                        new CookieJwtAuthenticationFilter(jwtUtil, userDetailsService),
                        UsernamePasswordAuthenticationFilter.class
                )
                .addFilterAfter(
                        new ProductOperationalModeFilter(productOperationalModeService, jwtUtil, cookieDomain, secureCookies),
                        CookieJwtAuthenticationFilter.class
                )
                // Email verification gate total (2026-06-15): bloquea con
                // 403 EMAIL_NOT_VERIFIED toda request autenticada de un
                // user con email_verified_at=NULL salvo whitelist minima.
                // Se registra DESPUES de ProductOperationalModeFilter para
                // que el modo PRELAUNCH/MAINTENANCE se evalue primero (el
                // 503 de modo restrictivo predomina sobre el 403 de email).
                .addFilterAfter(
                        new EmailVerifiedFilter(userRepository),
                        ProductOperationalModeFilter.class
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

    /**
     * CORS allowed origins inyectados desde {@code app.cors.allowed-origins}
     * (CSV). La lista cubre las tres superficies (producto/admin/assets) de
     * los tres entornos (TEST/AUDIT/PROD) mas localhost. Paquete 10.A.5.
     */
    @org.springframework.beans.factory.annotation.Value("${app.cors.allowed-origins}")
    private String[] corsAllowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOrigins(Arrays.asList(corsAllowedOrigins));

        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
