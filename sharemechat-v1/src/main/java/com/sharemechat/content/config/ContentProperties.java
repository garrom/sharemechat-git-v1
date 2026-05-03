package com.sharemechat.content.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ContentProperties {

    @Value("${content.public.index-enabled:false}")
    private boolean publicIndexEnabled;

    @Value("${content.ai-mode:MANUAL}")
    private String aiMode;

    @Value("${content.body.max-bytes:204800}")
    private long bodyMaxBytes;

    public boolean isPublicIndexEnabled() {
        return publicIndexEnabled;
    }

    public String getAiMode() {
        return aiMode;
    }

    public long getBodyMaxBytes() {
        return bodyMaxBytes;
    }
}
