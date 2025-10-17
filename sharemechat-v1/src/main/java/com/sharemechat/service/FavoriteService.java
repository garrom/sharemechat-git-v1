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
import com.sharemechat.exception.AlreadyFavoritesException;
import com.sharemechat.exception.InvitationAlreadyPendingException;
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
        if (Objects.equals(clientId, modelId)) {
            throw new IllegalArgumentException("No puedes agregarte a ti mismo.");
        }
        User client = requireUser(clientId); ensureRole(client, "CLIENT");
        User model  = requireUser(modelId);  ensureRole(model,  "MODEL");

        // 1) Si ya están aceptados ambos lados, no recrear
        if (canUsersMessage(clientId, modelId)) {
            throw new AlreadyFavoritesException();
        }

        // 2) Cargar/crear filas
        FavoriteModel mine = favoriteModelRepo.findByClientIdAndModelId(clientId, modelId)
                .orElseGet(() -> new FavoriteModel(clientId, modelId));
        FavoriteClient peer = favoriteClientRepo.findByModelIdAndClientId(modelId, clientId)
                .orElseGet(() -> new FavoriteClient(modelId, clientId));

        String myInv   = Optional.ofNullable(mine.getInvited()).orElse("").toLowerCase();
        String myStat  = Optional.ofNullable(mine.getStatus()).orElse("").toLowerCase();
        String peerInv = Optional.ofNullable(peer.getInvited()).orElse("").toLowerCase();
        String peerSta = Optional.ofNullable(peer.getStatus()).orElse("").toLowerCase();

        // 3) Si YO ya envié (inactive/sent), no duplicar
        if ("inactive".equals(myStat) && "sent".equals(myInv)) {
            throw new InvitationAlreadyPendingException();
        }

        // 4) Si el peer YA me había invitado (yo tengo inactive/pending o el peer tiene inactive/sent) → fusionar a accepted
        boolean iAmPendingReceiver = "inactive".equals(myStat) && "pending".equals(myInv);
        boolean peerSentToMe       = "inactive".equals(peerSta) && "sent".equals(peerInv);
        if (iAmPendingReceiver || peerSentToMe) {
            mine.setStatus("active");
            mine.setInvited("accepted");
            favoriteModelRepo.save(mine);

            peer.setStatus("active");
            peer.setInvited("accepted");
            favoriteClientRepo.save(peer);
            return;
        }

        // 5) Caso normal: ambos INACTIVE; invitador=SENT, receptor=PENDING
        mine.setStatus("inactive");
        mine.setInvited("sent");
        favoriteModelRepo.save(mine);

        peer.setStatus("inactive");
        peer.setInvited("pending");
        favoriteClientRepo.save(peer);
    }



    // =================== MODELO -> CLIENTE ===================
    @Transactional
    public void addClientToModelFavorites(Long modelId, Long clientId) {
        if (Objects.equals(modelId, clientId)) {
            throw new IllegalArgumentException("No puedes agregarte a ti mismo.");
        }
        User model  = requireUser(modelId);  ensureRole(model,  "MODEL");
        User client = requireUser(clientId); ensureRole(client, "CLIENT");

        // 1) Si ya están aceptados ambos lados, no recrear
        if (canUsersMessage(modelId, clientId)) {
            throw new AlreadyFavoritesException();
        }

        // 2) Cargar/crear filas
        FavoriteClient mine = favoriteClientRepo.findByModelIdAndClientId(modelId, clientId)
                .orElseGet(() -> new FavoriteClient(modelId, clientId));
        FavoriteModel peer  = favoriteModelRepo.findByClientIdAndModelId(clientId, modelId)
                .orElseGet(() -> new FavoriteModel(clientId, modelId));

        String myInv   = Optional.ofNullable(mine.getInvited()).orElse("").toLowerCase();
        String myStat  = Optional.ofNullable(mine.getStatus()).orElse("").toLowerCase();
        String peerInv = Optional.ofNullable(peer.getInvited()).orElse("").toLowerCase();
        String peerSta = Optional.ofNullable(peer.getStatus()).orElse("").toLowerCase();

        // 3) Si YO ya envié (inactive/sent), no duplicar
        if ("inactive".equals(myStat) && "sent".equals(myInv)) {
            throw new InvitationAlreadyPendingException();
        }

        // 4) Si el peer YA me había invitado → fusionar a accepted
        boolean iAmPendingReceiver = "inactive".equals(myStat) && "pending".equals(myInv);
        boolean peerSentToMe       = "inactive".equals(peerSta) && "sent".equals(peerInv);
        if (iAmPendingReceiver || peerSentToMe) {
            mine.setStatus("active");
            mine.setInvited("accepted");
            favoriteClientRepo.save(mine);

            peer.setStatus("active");
            peer.setInvited("accepted");
            favoriteModelRepo.save(peer);
            return;
        }

        // 5) Caso normal: ambos INACTIVE; invitador=SENT, receptor=PENDING
        mine.setStatus("inactive");
        mine.setInvited("sent");
        favoriteClientRepo.save(mine);

        peer.setStatus("inactive");
        peer.setInvited("pending");
        favoriteModelRepo.save(peer);
    }


    @Transactional
    public void removeModelFromClientFavorites(Long clientId, Long modelId) {
        // Cliente → Modelo
        FavoriteModel mine = favoriteModelRepo.findByClientIdAndModelId(clientId, modelId)
                .orElseGet(() -> new FavoriteModel(clientId, modelId));
        mine.setStatus("inactive");
        mine.setInvited("rejected");
        favoriteModelRepo.save(mine);

        // Modelo → Cliente
        FavoriteClient peer = favoriteClientRepo.findByModelIdAndClientId(modelId, clientId)
                .orElseGet(() -> new FavoriteClient(modelId, clientId));
        peer.setStatus("inactive");
        peer.setInvited("rejected");
        favoriteClientRepo.save(peer);
    }


    @Transactional(readOnly = true)
    public List<FavoriteListItemDTO> listClientFavoritesMeta(Long clientId) {
        requireRole(clientId, "CLIENT");

        // Necesitas en el repo: findAllByClientIdAndStatusInOrderByCreatedAtDesc(Long, Collection<String>)
        List<FavoriteModel> links = favoriteModelRepo.findAllByClientIdAndStatusInOrderByCreatedAtDesc(
                clientId, List.of("active", "inactive")
        );
        if (links.isEmpty()) return List.of();

        // Filtrar rechazados
        List<FavoriteModel> visible = links.stream()
                .filter(l -> !"rejected".equalsIgnoreCase(l.getInvited()))
                .toList();

        if (visible.isEmpty()) return List.of();

        List<Long> modelIds = visible.stream().map(FavoriteModel::getModelId).toList();
        Map<Long, User> usersById = userRepository.findAllById(modelIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        return visible.stream().map(l -> {
            User u = usersById.get(l.getModelId());
            return new FavoriteListItemDTO(
                    toSummary(u),
                    l.getStatus(),
                    l.getInvited(),
                    "outbound"
            );
        }).toList();
    }


    @Transactional
    public void removeClientFromModelFavorites(Long modelId, Long clientId) {
        // Modelo → Cliente
        FavoriteClient mine = favoriteClientRepo.findByModelIdAndClientId(modelId, clientId)
                .orElseGet(() -> new FavoriteClient(modelId, clientId));
        mine.setStatus("inactive");
        mine.setInvited("rejected");
        favoriteClientRepo.save(mine);

        // Cliente → Modelo
        FavoriteModel peer = favoriteModelRepo.findByClientIdAndModelId(clientId, modelId)
                .orElseGet(() -> new FavoriteModel(clientId, modelId));
        peer.setStatus("inactive");
        peer.setInvited("rejected");
        favoriteModelRepo.save(peer);
    }


    @Transactional(readOnly = true)
    public List<FavoriteListItemDTO> listModelFavoritesMeta(Long modelId) {
        requireRole(modelId, "MODEL");

        // Necesitas en el repo: findAllByModelIdAndStatusInOrderByCreatedAtDesc(Long, Collection<String>)
        List<FavoriteClient> links = favoriteClientRepo.findAllByModelIdAndStatusInOrderByCreatedAtDesc(
                modelId, List.of("active", "inactive")
        );
        if (links.isEmpty()) return List.of();

        // Filtrar rechazados
        List<FavoriteClient> visible = links.stream()
                .filter(l -> !"rejected".equalsIgnoreCase(l.getInvited()))
                .toList();

        if (visible.isEmpty()) return List.of();

        List<Long> clientIds = visible.stream().map(FavoriteClient::getClientId).toList();
        Map<Long, User> usersById = userRepository.findAllById(clientIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        return visible.stream().map(l -> {
            User u = usersById.get(l.getClientId());
            return new FavoriteListItemDTO(
                    toSummary(u),
                    l.getStatus(),
                    l.getInvited(),
                    "outbound"
            );
        }).toList();
    }


    // =================== ACEPTAR / RECHAZAR (mi vista) ===================

    @Transactional
    public void acceptInvitation(Long meId, Long peerId) {
        User me   = requireUser(meId);
        User peer = requireUser(peerId);

        if ("CLIENT".equalsIgnoreCase(me.getRole()) && "MODEL".equalsIgnoreCase(peer.getRole())) {
            FavoriteModel mine = favoriteModelRepo.findByClientIdAndModelId(meId, peerId)
                    .orElseGet(() -> new FavoriteModel(meId, peerId));
            FavoriteClient other = favoriteClientRepo.findByModelIdAndClientId(peerId, meId)
                    .orElseGet(() -> new FavoriteClient(peerId, meId));

            mine.setStatus("active");
            mine.setInvited("accepted");
            favoriteModelRepo.save(mine);

            other.setStatus("active");
            other.setInvited("accepted");
            favoriteClientRepo.save(other);

        } else if ("MODEL".equalsIgnoreCase(me.getRole()) && "CLIENT".equalsIgnoreCase(peer.getRole())) {
            FavoriteClient mine = favoriteClientRepo.findByModelIdAndClientId(meId, peerId)
                    .orElseGet(() -> new FavoriteClient(meId, peerId));
            FavoriteModel other = favoriteModelRepo.findByClientIdAndModelId(peerId, meId)
                    .orElseGet(() -> new FavoriteModel(peerId, meId));

            mine.setStatus("active");
            mine.setInvited("accepted");
            favoriteClientRepo.save(mine);

            other.setStatus("active");
            other.setInvited("accepted");
            favoriteModelRepo.save(other);

        } else {
            throw new IllegalArgumentException("Roles inválidos para aceptar.");
        }
    }


    @Transactional
    public void rejectInvitation(Long meId, Long peerId) {
        User me   = requireUser(meId);
        User peer = requireUser(peerId);

        if ("CLIENT".equalsIgnoreCase(me.getRole()) && "MODEL".equalsIgnoreCase(peer.getRole())) {
            FavoriteModel mine = favoriteModelRepo.findByClientIdAndModelId(meId, peerId)
                    .orElseGet(() -> new FavoriteModel(meId, peerId));
            FavoriteClient other = favoriteClientRepo.findByModelIdAndClientId(peerId, meId)
                    .orElseGet(() -> new FavoriteClient(peerId, meId));

            mine.setStatus("inactive");
            mine.setInvited("rejected");
            favoriteModelRepo.save(mine);

            other.setStatus("inactive");
            other.setInvited("rejected");
            favoriteClientRepo.save(other);

        } else if ("MODEL".equalsIgnoreCase(me.getRole()) && "CLIENT".equalsIgnoreCase(peer.getRole())) {
            FavoriteClient mine = favoriteClientRepo.findByModelIdAndClientId(meId, peerId)
                    .orElseGet(() -> new FavoriteClient(meId, peerId));
            FavoriteModel other = favoriteModelRepo.findByClientIdAndModelId(peerId, meId)
                    .orElseGet(() -> new FavoriteModel(peerId, meId));

            mine.setStatus("inactive");
            mine.setInvited("rejected");
            favoriteClientRepo.save(mine);

            other.setStatus("inactive");
            other.setInvited("rejected");
            favoriteModelRepo.save(other);

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