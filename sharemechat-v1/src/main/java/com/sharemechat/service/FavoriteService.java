package com.sharemechat.service;

import com.sharemechat.dto.UserSummaryDTO;
import com.sharemechat.entity.FavoriteClient;
import com.sharemechat.entity.FavoriteModel;
import com.sharemechat.entity.User;
import com.sharemechat.repository.FavoriteClientRepository;
import com.sharemechat.repository.FavoriteModelRepository;
import com.sharemechat.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class FavoriteService {

    private final FavoriteModelRepository favoriteModelRepo;
    private final FavoriteClientRepository favoriteClientRepo;
    private final UserRepository userRepository;

    public FavoriteService(FavoriteModelRepository favoriteModelRepo,
                           FavoriteClientRepository favoriteClientRepo,
                           UserRepository userRepository) {
        this.favoriteModelRepo = favoriteModelRepo;
        this.favoriteClientRepo = favoriteClientRepo;
        this.userRepository = userRepository;
    }

    // ===== CLIENT -> MODELS =====
    @Transactional
    public void addModelToClientFavorites(Long clientId, Long modelId) {
        if (Objects.equals(clientId, modelId)) {
            throw new IllegalArgumentException("No puedes agregarte a ti mismo como favorito.");
        }
        User client = requireUser(clientId);
        User model  = requireUser(modelId);

        ensureRole(client, "CLIENT");
        ensureRole(model,  "MODEL");

        if (!favoriteModelRepo.existsByClientIdAndModelId(clientId, modelId)) {
            favoriteModelRepo.save(new FavoriteModel(clientId, modelId));
        }
    }

    @Transactional
    public void removeModelFromClientFavorites(Long clientId, Long modelId) {
        favoriteModelRepo.deleteByClientIdAndModelId(clientId, modelId);
    }

    @Transactional(readOnly = true)
    public List<UserSummaryDTO> listClientFavoriteModels(Long clientId) {
        requireRole(clientId, "CLIENT");
        List<FavoriteModel> links = favoriteModelRepo.findAllByClientIdOrderByCreatedAtDesc(clientId);
        List<Long> modelIds = links.stream().map(FavoriteModel::getModelId).toList();

        if (modelIds.isEmpty()) return List.of();

        List<User> users = userRepository.findAllById(modelIds);
        Map<Long, User> byId = users.stream().collect(Collectors.toMap(User::getId, u -> u));

        // Respetar orden por created_at (del link)
        return links.stream()
                .map(l -> toSummary(byId.get(l.getModelId())))
                .filter(Objects::nonNull)
                .toList();
    }

    // ===== MODEL -> CLIENTS =====
    @Transactional
    public void addClientToModelFavorites(Long modelId, Long clientId) {
        if (Objects.equals(modelId, clientId)) {
            throw new IllegalArgumentException("No puedes agregarte a ti mismo como favorito.");
        }
        User model  = requireUser(modelId);
        User client = requireUser(clientId);

        ensureRole(model,  "MODEL");
        ensureRole(client, "CLIENT");

        if (!favoriteClientRepo.existsByModelIdAndClientId(modelId, clientId)) {
            favoriteClientRepo.save(new FavoriteClient(modelId, clientId));
        }
    }

    @Transactional
    public void removeClientFromModelFavorites(Long modelId, Long clientId) {
        favoriteClientRepo.deleteByModelIdAndClientId(modelId, clientId);
    }

    @Transactional(readOnly = true)
    public List<UserSummaryDTO> listModelFavoriteClients(Long modelId) {
        requireRole(modelId, "MODEL");
        List<FavoriteClient> links = favoriteClientRepo.findAllByModelIdOrderByCreatedAtDesc(modelId);
        List<Long> clientIds = links.stream().map(FavoriteClient::getClientId).toList();

        if (clientIds.isEmpty()) return List.of();

        List<User> users = userRepository.findAllById(clientIds);
        Map<Long, User> byId = users.stream().collect(Collectors.toMap(User::getId, u -> u));

        return links.stream()
                .map(l -> toSummary(byId.get(l.getClientId())))
                .filter(Objects::nonNull)
                .toList();
    }

    // ===== Helpers =====
    private User requireUser(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Usuario no encontrado: " + id));
    }

    private void ensureRole(User u, String required) {
        if (u.getRole() == null || !u.getRole().equalsIgnoreCase(required)) {
            throw new IllegalArgumentException("Rol inválido: se requiere " + required);
        }
    }

    private void requireRole(Long userId, String required) {
        ensureRole(requireUser(userId), required);
    }

    private UserSummaryDTO toSummary(User u) {
        if (u == null) return null;
        return new UserSummaryDTO(
                u.getId(),
                u.getNickname(),
                u.getProfilePic(),
                u.getRole(),
                u.getUserType()
        );
    }
}
