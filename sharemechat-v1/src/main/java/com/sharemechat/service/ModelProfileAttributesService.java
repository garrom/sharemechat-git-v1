package com.sharemechat.service;

import com.sharemechat.dto.ModelProfileAttributesDTO;
import com.sharemechat.entity.ModelProfileAttributes;
import com.sharemechat.repository.ModelProfileAttributesRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Set;

/**
 * Card 1 Fase 2: lectura/escritura de los datos físicos del modelo
 * (self-service). La autorización (que el actor sea el propio modelo) la
 * hace el controller; aquí solo se valida el contenido.
 *
 * <p>Los enums se guardan como código canónico en MAYÚSCULAS; el frontend
 * los traduce vía i18n. Un valor {@code null}/blank limpia el campo. Un
 * código no permitido o una altura fuera de rango lanza
 * {@link IllegalArgumentException} (el controller la mapea a 400).
 */
@Service
public class ModelProfileAttributesService {

    // Conjuntos canónicos permitidos (revisables; el label lo pone i18n).
    static final Set<String> SEX = Set.of("FEMALE", "MALE", "TRANS", "OTHER");
    static final Set<String> BUST = Set.of("SMALL", "MEDIUM", "LARGE", "XLARGE");
    static final Set<String> BUTT = Set.of("SMALL", "MEDIUM", "LARGE", "XLARGE");
    static final Set<String> BODY = Set.of("SLIM", "ATHLETIC", "AVERAGE", "CURVY", "BBW");
    static final int HEIGHT_MIN = 120;
    static final int HEIGHT_MAX = 220;

    private final ModelProfileAttributesRepository repository;

    public ModelProfileAttributesService(ModelProfileAttributesRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public ModelProfileAttributesDTO getForUser(Long userId) {
        return repository.findById(userId)
                .map(a -> new ModelProfileAttributesDTO(
                        a.getSex(), a.getBustSize(), a.getHeightCm(), a.getButtSize(), a.getBodyType()))
                .orElseGet(() -> new ModelProfileAttributesDTO(null, null, null, null, null));
    }

    @Transactional
    public ModelProfileAttributesDTO update(Long userId, ModelProfileAttributesDTO in) {
        String sex = validateCode("sex", in.sex(), SEX);
        String bust = validateCode("bustSize", in.bustSize(), BUST);
        String butt = validateCode("buttSize", in.buttSize(), BUTT);
        String body = validateCode("bodyType", in.bodyType(), BODY);
        Integer height = validateHeight(in.heightCm());

        ModelProfileAttributes entity = repository.findById(userId)
                .orElseGet(() -> {
                    ModelProfileAttributes x = new ModelProfileAttributes();
                    x.setUserId(userId);
                    return x;
                });
        entity.setSex(sex);
        entity.setBustSize(bust);
        entity.setHeightCm(height);
        entity.setButtSize(butt);
        entity.setBodyType(body);
        repository.save(entity);

        return new ModelProfileAttributesDTO(sex, bust, height, butt, body);
    }

    private static String validateCode(String field, String raw, Set<String> allowed) {
        if (raw == null) return null;
        String code = raw.trim().toUpperCase(Locale.ROOT);
        if (code.isEmpty()) return null;
        if (!allowed.contains(code)) {
            throw new IllegalArgumentException("Valor no permitido para " + field + ": " + raw);
        }
        return code;
    }

    private static Integer validateHeight(Integer height) {
        if (height == null) return null;
        if (height < HEIGHT_MIN || height > HEIGHT_MAX) {
            throw new IllegalArgumentException(
                    "Altura fuera de rango (" + HEIGHT_MIN + "-" + HEIGHT_MAX + " cm): " + height);
        }
        return height;
    }
}
