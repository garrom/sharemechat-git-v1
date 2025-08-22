package com.sharemechat.service;

import com.sharemechat.dto.ModelDTO;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class ModelService {

    private final ModelRepository modelRepository;

    public ModelService(ModelRepository modelRepository) {
        this.modelRepository = modelRepository;
    }

    public ModelDTO getModelDTO(User user) {
        Model model = modelRepository.findByUser(user).orElse(null);
        if (model == null) {
            ModelDTO dto = new ModelDTO();
            dto.setUserId(user.getId());
            dto.setStreamingHours(BigDecimal.ZERO);
            dto.setSaldoActual(BigDecimal.ZERO);
            dto.setTotalIngresos(BigDecimal.ZERO);
            return dto;
        }
        return mapToDTO(model);
    }

    public ModelDTO mapToDTO(Model m) {
        ModelDTO dto = new ModelDTO();
        dto.setUserId(m.getUserId());
        dto.setStreamingHours(m.getStreamingHours() != null ? m.getStreamingHours() : BigDecimal.ZERO);
        dto.setSaldoActual(m.getSaldoActual() != null ? m.getSaldoActual() : BigDecimal.ZERO);
        dto.setTotalIngresos(m.getTotalIngresos() != null ? m.getTotalIngresos() : BigDecimal.ZERO);
        return dto;
    }
}
