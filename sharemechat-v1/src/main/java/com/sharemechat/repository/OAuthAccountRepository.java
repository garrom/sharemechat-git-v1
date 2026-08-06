package com.sharemechat.repository;

import com.sharemechat.entity.OAuthAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OAuthAccountRepository extends JpaRepository<OAuthAccount, Long> {

    /** Busca vinculacion activa (no revocada) por (provider, sub del provider). */
    Optional<OAuthAccount> findByProviderAndProviderUserIdAndRevokedAtIsNull(
            String provider, String providerUserId);

    /** Lista todas las vinculaciones activas de un user (para la vista
     *  "Cuentas vinculadas" del perfil). */
    List<OAuthAccount> findByUserIdAndRevokedAtIsNull(Long userId);

    /** True si el user ya tiene vinculacion activa con el provider indicado.
     *  Usado para prevenir doble link del mismo provider. */
    boolean existsByUserIdAndProviderAndRevokedAtIsNull(Long userId, String provider);

    /** Busca cualquier vinculacion (activa O revocada) por (provider, sub).
     *  Usada al re-vincular tras un unlink: la UNIQUE constraint fisica
     *  (provider, provider_user_id) rechaza INSERT nuevo, hay que reactivar
     *  la revocada. */
    Optional<OAuthAccount> findByProviderAndProviderUserId(
            String provider, String providerUserId);
}
