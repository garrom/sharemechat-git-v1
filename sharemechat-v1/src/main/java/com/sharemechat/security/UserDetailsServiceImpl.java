package com.sharemechat.security;

import com.sharemechat.constants.Constants;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.BackofficeAccessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BackofficeAccessService backofficeAccessService;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        com.sharemechat.entity.User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado: " + email));

        if (Boolean.TRUE.equals(user.getUnsubscribe())) {
            throw new UsernameNotFoundException("Cuenta no disponible");
        }

        String accountStatus = user.getAccountStatus();
        if (accountStatus == null || accountStatus.isBlank()) {
            accountStatus = Constants.AccountStatuses.ACTIVE;
        } else {
            accountStatus = accountStatus.trim().toUpperCase(Locale.ROOT);
        }

        if (!Constants.AccountStatuses.ACTIVE.equals(accountStatus)) {
            throw new UsernameNotFoundException("Cuenta suspendida o bloqueada");
        }

        BackofficeAccessService.BackofficeAccessProfile profile =
                backofficeAccessService.loadProfile(user.getId(), user.getRole());

        Set<SimpleGrantedAuthority> authorities = new LinkedHashSet<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_" + user.getRole()));
        for (String roleCode : profile.roles()) {
            authorities.add(new SimpleGrantedAuthority(BackofficeAuthorities.roleAuthority(roleCode)));
        }
        for (String permissionCode : profile.permissions()) {
            authorities.add(new SimpleGrantedAuthority(BackofficeAuthorities.permissionAuthority(permissionCode)));
        }

        return new User(
                user.getEmail(),
                user.getPassword(),
                authorities
        );
    }
}
