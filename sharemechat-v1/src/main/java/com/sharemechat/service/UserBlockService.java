package com.sharemechat.service;

import com.sharemechat.dto.UserBlockDTO;
import com.sharemechat.entity.User;
import com.sharemechat.entity.UserBlock;
import com.sharemechat.repository.UserBlockRepository;
import com.sharemechat.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class UserBlockService {

    private final UserBlockRepository userBlockRepository;
    private final UserRepository userRepository;

    public UserBlockService(UserBlockRepository userBlockRepository, UserRepository userRepository) {
        this.userBlockRepository = userBlockRepository;
        this.userRepository = userRepository;
    }

    /**
     * IMPORTANTE:
     * Asumo que el "username" del JWT/Spring Security es el email.
     * Si en tu proyecto usas otro identificador, cambia este método.
     */
    public User getCurrentUserOrThrow() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new IllegalStateException("No autenticado");
        }
        String username = auth.getName();
        Optional<User> u = userRepository.findByEmail(username);
        return u.orElseThrow(() -> new IllegalStateException("Usuario no encontrado para principal=" + username));
    }

    @Transactional
    public UserBlockDTO blockUser(Long blockedUserId, UserBlockDTO dto) {
        User me = getCurrentUserOrThrow();
        Long blockerId = me.getId();

        if (blockedUserId == null || blockedUserId <= 0) {
            throw new IllegalArgumentException("blockedUserId inválido");
        }
        if (blockerId.equals(blockedUserId)) {
            throw new IllegalArgumentException("No puedes bloquearte a ti mismo");
        }

        userRepository.findById(blockedUserId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario destino no existe"));

        String reason = dto != null ? dto.reason : null;

        UserBlock existing =
                userBlockRepository.findByBlockerUserIdAndBlockedUserId(blockerId, blockedUserId).orElse(null);

        if (existing != null) {
            if (reason != null && !reason.isBlank()) {
                existing.setReason(reason.trim());
                userBlockRepository.save(existing);
            }
            return toDto(existing);
        }

        UserBlock ub = new UserBlock();
        ub.setBlockerUserId(blockerId);
        ub.setBlockedUserId(blockedUserId);
        ub.setReason(reason != null ? reason.trim() : null);

        UserBlock saved = userBlockRepository.save(ub);
        return toDto(saved);
    }


    @Transactional
    public void unblockUser(Long blockedUserId) {
        User me = getCurrentUserOrThrow();
        Long blockerId = me.getId();

        if (blockedUserId == null || blockedUserId <= 0) return;

        userBlockRepository.deleteByBlockerUserIdAndBlockedUserId(blockerId, blockedUserId);
    }

    @Transactional(readOnly = true)
    public List<UserBlockDTO> listMyBlocks() {
        User me = getCurrentUserOrThrow();
        return userBlockRepository.findAllByBlockerUserIdOrderByCreatedAtDesc(me.getId())
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public boolean isBlockedBetween(Long a, Long b) {
        if (a == null || b == null) return false;
        if (a.equals(b)) return false;
        return userBlockRepository.existsBlockBetween(a, b);
    }

    private UserBlockDTO toDto(UserBlock ub) {
        return new UserBlockDTO(
                ub.getId(),
                ub.getBlockerUserId(),
                ub.getBlockedUserId(),
                ub.getReason(),
                ub.getCreatedAt()
        );
    }
}
