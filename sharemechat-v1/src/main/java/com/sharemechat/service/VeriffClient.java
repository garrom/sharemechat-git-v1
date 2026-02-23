package com.sharemechat.service;

import com.sharemechat.dto.VeriffCreateSessionResult;

public interface VeriffClient {

    VeriffCreateSessionResult createSession(Long userId, String email);
}
