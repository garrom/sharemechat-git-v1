package com.sharemechat.content.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
public class ContentS3Config {

    @Value("${app.storage.s3.content.region:eu-central-1}")
    private String region;

    @Value("${app.storage.s3.content.private-bucket:}")
    private String privateBucket;

    @Value("${app.storage.s3.content.private-key-prefix:content}")
    private String privateKeyPrefix;

    @Bean(name = "contentS3Client", destroyMethod = "close")
    public S3Client contentS3Client() {
        String resolvedRegion = StringUtils.hasText(region) ? region : "eu-central-1";
        return S3Client.builder()
                .region(Region.of(resolvedRegion))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }

    public String getPrivateBucket() {
        return privateBucket;
    }

    public String getPrivateKeyPrefix() {
        return privateKeyPrefix;
    }

    public boolean isConfigured() {
        return StringUtils.hasText(privateBucket);
    }
}
