package com.sharemechat.service;

import com.sharemechat.entity.User;
import com.sharemechat.exception.ForbiddenException;
import org.springframework.stereotype.Service;

@Service
public class ProductAccessGuardService {

    private static final String SUPPORT_ONLY_BACKOFFICE_MESSAGE = "El rol SUPPORT solo puede acceder al backoffice";

    public void requireNotSupport(User user) {
        if (user == null) {
            return;
        }

        if ("SUPPORT".equalsIgnoreCase(String.valueOf(user.getRole()))) {
            throw new ForbiddenException(SUPPORT_ONLY_BACKOFFICE_MESSAGE);
        }
    }
}
