package com.sharemechat.storage;

import org.springframework.core.io.Resource;

public class StoredFile {

    private final Resource resource;
    private final String contentType;
    private final Long contentLength;
    private final String fileName;

    public StoredFile(Resource resource, String contentType, Long contentLength, String fileName) {
        this.resource = resource;
        this.contentType = contentType;
        this.contentLength = contentLength;
        this.fileName = fileName;
    }

    public Resource getResource() {
        return resource;
    }

    public String getContentType() {
        return contentType;
    }

    public Long getContentLength() {
        return contentLength;
    }

    public String getFileName() {
        return fileName;
    }
}
