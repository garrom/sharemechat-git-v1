package com.sharemechat.dto;

public class HomeFeaturedDTO {

    private Long modelId;
    private String avatarUrl;
    private String videoUrl;
    private String sourceType;

    public HomeFeaturedDTO(Long modelId, String avatarUrl, String videoUrl, String sourceType) {
        this.modelId = modelId;
        this.avatarUrl = avatarUrl;
        this.videoUrl = videoUrl;
        this.sourceType = sourceType;
    }

    public Long getModelId() { return modelId; }
    public String getAvatarUrl() { return avatarUrl; }
    public String getVideoUrl() { return videoUrl; }
    public String getSourceType() { return sourceType; }
}
