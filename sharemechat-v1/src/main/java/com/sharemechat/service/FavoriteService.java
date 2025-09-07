package com.sharemechat.service;

import com.sharemechat.dto.FavoriteListItemDTO;
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


    // =================== CLIENTE -> MODELO ===================
    @Transactional
    public void addModelToClientFavorites(Long clientId, Long modelId) {
        if (Objects.equals(clientId, modelId)) throw new IllegalArgumentException("No puedes agregarte a ti mismo.");
        User client = requireUser(clientId); ensureRole(client, "CLIENT");
        User model  = requireUser(modelId);  ensureRole(model,  "MODEL");

        // Vista del CLIENTE (favorites_models)
        FavoriteModel mine = favoriteModelRepo.findByClientIdAndModelId(clientId, modelId)
                .orElseGet(() -> new FavoriteModel(clientId, modelId));
        mine.setStatus("active");
        mine.setInvited("accepted"); // el que invita lo considera aceptado en su vista
        favoriteModelRepo.save(mine);

        // Vista de la MODELO (favorites_clients)
        FavoriteClient peer = favoriteClientRepo.findByModelIdAndClientId(modelId, clientId)
                .orElseGet(() -> new FavoriteClient(modelId, clientId));

        // si existía rechazado/inactivo → reabrimos como pending
        peer.setStatus("active");
        peer.setInvited("pending");
        favoriteClientRepo.save(peer);
    }

    @Transactional
    public void removeModelFromClientFavorites(Long clientId, Long modelId) {
        // SOFT delete solo en MI vista
        favoriteModelRepo.findByClientIdAndModelId(clientId, modelId).ifPresent(f -> {
            f.setStatus("inactive");
            favoriteModelRepo.save(f);
        });
    }

    @Transactional(readOnly = true)
    public List<FavoriteListItemDTO> listClientFavoritesMeta(Long clientId) {
        requireRole(clientId, "CLIENT");
        List<FavoriteModel> links = favoriteModelRepo.findAllByClientIdAndStatusOrderByCreatedAtDesc(clientId, "active");
        if (links.isEmpty()) return List.of();

        List<Long> modelIds = links.stream().map(FavoriteModel::getModelId).toList();
        Map<Long, User> usersById = userRepository.findAllById(modelIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        return links.stream().map(l -> {
            User u = usersById.get(l.getModelId());
            return new FavoriteListItemDTO(
                    toSummary(u),
                    l.getStatus(),
                    l.getInvited(),
                    "outbound" // esta lista es "yo cliente → modelos"
            );
        }).toList();
    }

    // =================== MODELO -> CLIENTE ===================
    @Transactional
    public void addClientToModelFavorites(Long modelId, Long clientId) {
        if (Objects.equals(modelId, clientId)) throw new IllegalArgumentException("No puedes agregarte a ti mismo.");
        User model  = requireUser(modelId);  ensureRole(model,  "MODEL");
        User client = requireUser(clientId); ensureRole(client, "CLIENT");

        // Vista de la MODELO (favorites_clients)
        FavoriteClient mine = favoriteClientRepo.findByModelIdAndClientId(modelId, clientId)
                .orElseGet(() -> new FavoriteClient(modelId, clientId));
        mine.setStatus("active");
        mine.setInvited("accepted"); // el que invita lo considera aceptado en su vista
        favoriteClientRepo.save(mine);

        // Vista del CLIENTE (favorites_models)
        FavoriteModel peer = favoriteModelRepo.findByClientIdAndModelId(clientId, modelId)
                .orElseGet(() -> new FavoriteModel(clientId, modelId));
        peer.setStatus("active");
        peer.setInvited("pending");
        favoriteModelRepo.save(peer);
    }

    @Transactional
    public void removeClientFromModelFavorites(Long modelId, Long clientId) {
        favoriteClientRepo.findByModelIdAndClientId(modelId, clientId).ifPresent(f -> {
            f.setStatus("inactive"); // soft
            favoriteClientRepo.save(f);
        });
    }

    @Transactional(readOnly = true)
    public List<FavoriteListItemDTO> listModelFavoritesMeta(Long modelId) {
        requireRole(modelId, "MODEL");
        List<FavoriteClient> links = favoriteClientRepo.findAllByModelIdAndStatusOrderByCreatedAtDesc(modelId, "active");
        if (links.isEmpty()) return List.of();

        List<Long> clientIds = links.stream().map(FavoriteClient::getClientId).toList();
        Map<Long, User> usersById = userRepository.findAllById(clientIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        return links.stream().map(l -> {
            User u = usersById.get(l.getClientId());
            return new FavoriteListItemDTO(
                    toSummary(u),
                    l.getStatus(),
                    l.getInvited(),
                    "outbound" // modelo → clientes
            );
        }).toList();
    }

    // =================== ACEPTAR / RECHAZAR (mi vista) ===================
    @Transactional
    public void acceptInvitation(Long meId, Long peerId) {
        User me = requireUser(meId);
        User peer = requireUser(peerId);

        if ("CLIENT".equalsIgnoreCase(me.getRole()) && "MODEL".equalsIgnoreCase(peer.getRole())) {
            // cliente acepta invitación que le hizo la modelo → su fila está en favorites_models
            FavoriteModel mine = favoriteModelRepo.findByClientIdAndModelId(meId, peerId)
                    .orElseThrow(() -> new NoSuchElementException("No existe invitación"));
            mine.setStatus("active");
            mine.setInvited("accepted");
            favoriteModelRepo.save(mine);
        } else if ("MODEL".equalsIgnoreCase(me.getRole()) && "CLIENT".equalsIgnoreCase(peer.getRole())) {
            // modelo acepta invitación que le hizo el cliente → su fila está en favorites_clients
            FavoriteClient mine = favoriteClientRepo.findByModelIdAndClientId(meId, peerId)
                    .orElseThrow(() -> new NoSuchElementException("No existe invitación"));
            mine.setStatus("active");
            mine.setInvited("accepted");
            favoriteClientRepo.save(mine);
        } else {
            throw new IllegalArgumentException("Roles inválidos para aceptar.");
        }
    }

    @Transactional
    public void rejectInvitation(Long meId, Long peerId) {
        User me = requireUser(meId);
        User peer = requireUser(peerId);

        if ("CLIENT".equalsIgnoreCase(me.getRole()) && "MODEL".equalsIgnoreCase(peer.getRole())) {
            FavoriteModel mine = favoriteModelRepo.findByClientIdAndModelId(meId, peerId)
                    .orElseThrow(() -> new NoSuchElementException("No existe invitación"));
            mine.setStatus("active");    // mantener visible para poder re-invitar
            mine.setInvited("rejected");
            favoriteModelRepo.save(mine);
        } else if ("MODEL".equalsIgnoreCase(me.getRole()) && "CLIENT".equalsIgnoreCase(peer.getRole())) {
            FavoriteClient mine = favoriteClientRepo.findByModelIdAndClientId(meId, peerId)
                    .orElseThrow(() -> new NoSuchElementException("No existe invitación"));
            mine.setStatus("active");
            mine.setInvited("rejected");
            favoriteClientRepo.save(mine);
        } else {
            throw new IllegalArgumentException("Roles inválidos para rechazar.");
        }
    }

    /**
     * Devuelve true solo si AMBAS vistas del par (cliente→modelo y modelo→cliente)
     * están en status='active' e invited='accepted'.
     * Cualquier otro estado (pending/rejected/inactive o inexistente) bloquea el chat.
     */
    @Transactional(readOnly = true)
    public boolean canUsersMessage(Long aId, Long bId) {
        User a = requireUser(aId);
        User b = requireUser(bId);

        // Normalizamos para encontrar las DOS filas del par:
        // fila A->B en su tabla correspondiente y la fila "peer" B->A en la otra tabla
        if ("CLIENT".equalsIgnoreCase(a.getRole()) && "MODEL".equalsIgnoreCase(b.getRole())) {
            Optional<FavoriteModel> a2b = favoriteModelRepo.findByClientIdAndModelId(aId, bId);
            Optional<FavoriteClient> b2a = favoriteClientRepo.findByModelIdAndClientId(bId, aId);
            return isAcceptedActive(a2b.map(FavoriteModel::getStatus), a2b.map(FavoriteModel::getInvited))
                    && isAcceptedActive(b2a.map(FavoriteClient::getStatus), b2a.map(FavoriteClient::getInvited));
        }

        if ("MODEL".equalsIgnoreCase(a.getRole()) && "CLIENT".equalsIgnoreCase(b.getRole())) {
            Optional<FavoriteClient> a2b = favoriteClientRepo.findByModelIdAndClientId(aId, bId);
            Optional<FavoriteModel>  b2a = favoriteModelRepo.findByClientIdAndModelId(bId, aId);
            return isAcceptedActive(a2b.map(FavoriteClient::getStatus), a2b.map(FavoriteClient::getInvited))
                    && isAcceptedActive(b2a.map(FavoriteModel::getStatus),  b2a.map(FavoriteModel::getInvited));
        }

        // Si los roles no son CLIENT/MODEL, bloqueamos
        return false;
    }

    private boolean isAcceptedActive(Optional<String> statusOpt, Optional<String> invitedOpt) {
        return "active".equalsIgnoreCase(statusOpt.orElse(null))
                && "accepted".equalsIgnoreCase(invitedOpt.orElse(null));
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
    public boolean isModelInClientFavorites(Long clientId, Long modelId) {
        return favoriteModelRepo.existsByClientIdAndModelId(clientId, modelId);
    }

    public boolean isClientInModelFavorites(Long modelId, Long clientId) {
        return favoriteClientRepo.existsByModelIdAndClientId(modelId, clientId);
    }
}