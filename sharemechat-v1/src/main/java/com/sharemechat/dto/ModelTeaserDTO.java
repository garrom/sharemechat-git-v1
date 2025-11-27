package com.sharemechat.dto;

public class ModelTeaserDTO {

    private Long modelId;
    private String modelName;
    private String avatarUrl;
    private String videoUrl;

    public ModelTeaserDTO(Long modelId, String modelName, String avatarUrl, String videoUrl) {
        this.modelId = modelId;
        this.modelName = modelName;
        this.avatarUrl = avatarUrl;
        this.videoUrl = videoUrl;
    }

    public Long getModelId() {
        return modelId;
    }

    public String getModelName() {
        return modelName;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public String getVideoUrl() {
        return videoUrl;
    }
}
