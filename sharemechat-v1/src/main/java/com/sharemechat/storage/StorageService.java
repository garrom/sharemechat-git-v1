package com.sharemechat.storage;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

public interface StorageService {
    String store(MultipartFile file, String keyPrefix) throws IOException;

    void deleteByPublicUrl(String publicUrl) throws IOException;

    StoredFile loadByKey(String storageKey) throws IOException;
}
