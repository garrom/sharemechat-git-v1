package com.sharemechat.service;

import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;

public class ModelService {

    private final ModelRepository modelRepository;

    @Autowired
    public ModelService(ModelRepository modelRepository) {
        this.modelRepository = modelRepository;
    }

    @Transactional
    public Model createModel(User user) {
        Model model = new Model();
        model.setUser(user);
       // LA LOGICA ESTÁ SIN COMPLETAR

        return modelRepository.save(model);
    }
}
