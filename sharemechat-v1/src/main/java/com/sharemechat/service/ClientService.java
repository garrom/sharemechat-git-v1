package com.sharemechat.service;

import com.sharemechat.dto.ClientDTO;
import com.sharemechat.entity.Client;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ClientRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class ClientService {

    private final ClientRepository clientRepository;

    public ClientService(ClientRepository clientRepository) {
        this.clientRepository = clientRepository;
    }

    public ClientDTO getClientDTO(User user) {
        Client client = clientRepository.findByUser(user).orElse(null);
        if (client == null) {

            ClientDTO dto = new ClientDTO();
            dto.setUserId(user.getId());
            dto.setStreamingHours(BigDecimal.ZERO);
            dto.setSaldoActual(BigDecimal.ZERO);
            dto.setTotalPagos(BigDecimal.ZERO);
            return dto;
        }
        return mapToDTO(client);
    }

    public ClientDTO mapToDTO(Client c) {
        ClientDTO dto = new ClientDTO();
        dto.setUserId(c.getUserId());
        dto.setStreamingHours(c.getStreamingHours() != null ? c.getStreamingHours() : BigDecimal.ZERO);
        dto.setSaldoActual(c.getSaldoActual() != null ? c.getSaldoActual() : BigDecimal.ZERO);
        dto.setTotalPagos(c.getTotalPagos() != null ? c.getTotalPagos() : BigDecimal.ZERO);
        return dto;
    }
}
