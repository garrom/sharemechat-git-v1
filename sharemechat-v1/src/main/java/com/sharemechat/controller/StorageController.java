package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.security.BackofficeAuthorities;
import com.sharemechat.service.BackofficeAccessService;
import com.sharemechat.service.ModelService;
import com.sharemechat.service.UserService;
import com.sharemechat.storage.StorageService;
import com.sharemechat.storage.StorageUrlCodec;
import com.sharemechat.storage.StoredFile;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.NoSuchFileException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/storage")
public class StorageController {

    private static final Pattern OWNER_KEY_PATTERN = Pattern.compile("^(?:.+/)?(models|clients)/(\\d+)/(profile|verification)(?:/.*)?$");

    private final StorageService storageService;
    private final StorageUrlCodec storageUrlCodec;
    private final UserService userService;
    private final ModelService modelService;
    private final BackofficeAccessService backofficeAccessService;

    public StorageController(StorageService storageService,
                             StorageUrlCodec storageUrlCodec,
                             UserService userService,
                             ModelService modelService,
                             BackofficeAccessService backofficeAccessService) {
        this.storageService = storageService;
        this.storageUrlCodec = storageUrlCodec;
        this.userService = userService;
        this.modelService = modelService;
        this.backofficeAccessService = backofficeAccessService;
    }

    @GetMapping("/content")
    public ResponseEntity<Resource> getContent(@RequestParam("ref") String ref,
                                               Authentication authentication) throws IOException {
        String storageKey = storageUrlCodec.decodeKey(ref);
        if (!StringUtils.hasText(storageKey)) {
            return ResponseEntity.badRequest().build();
        }

        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(401).build();
        }

        AccessScope accessScope = resolveAccessScope(storageKey);
        if (!canReadFile(user, accessScope)) {
            return ResponseEntity.status(403).build();
        }

        StoredFile storedFile;
        try {
            storedFile = storageService.loadByKey(storageKey);
        } catch (NoSuchFileException ex) {
            return ResponseEntity.notFound().build();
        }

        MediaType mediaType = resolveMediaType(storedFile.getContentType());

        ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, buildContentDisposition(storedFile.getFileName(), mediaType))
                .cacheControl(CacheControl.noStore());

        if (storedFile.getContentLength() != null && storedFile.getContentLength() >= 0) {
            builder.contentLength(storedFile.getContentLength());
        }

        return builder.body(storedFile.getResource());
    }

    private boolean canReadFile(User user, AccessScope accessScope) {
        if (user == null || accessScope == null) return false;
        if (isBackofficeUser(user)) {
            return true;
        }

        if (accessScope.ownerUserId() != null && accessScope.ownerUserId().equals(user.getId())) {
            return true;
        }

        return switch (accessScope.category()) {
            case MODEL_TEASER -> canReadModelTeaser(user);
            case MODEL_PROFILE -> canReadModelProfile(user);
            case CLIENT_PROFILE -> canReadClientProfile(user);
            case VERIFICATION, UNKNOWN -> false;
        };
    }

    private boolean canReadModelTeaser(User user) {
        String role = normalize(user.getRole());
        return Constants.Roles.USER.equals(role)
                || Constants.Roles.CLIENT.equals(role)
                || Constants.Roles.MODEL.equals(role);
    }

    private boolean canReadModelProfile(User user) {
        String role = normalize(user.getRole());
        return Constants.Roles.CLIENT.equals(role) || Constants.Roles.MODEL.equals(role);
    }

    private boolean canReadClientProfile(User user) {
        String role = normalize(user.getRole());
        return Constants.Roles.MODEL.equals(role);
    }

    private boolean isBackofficeUser(User user) {
        BackofficeAccessService.BackofficeAccessProfile profile =
                backofficeAccessService.loadProfile(user.getId(), user.getRole());
        if (profile == null || profile.roles() == null) {
            return false;
        }

        return profile.roles().contains(BackofficeAuthorities.ROLE_ADMIN)
                || profile.roles().contains(BackofficeAuthorities.ROLE_SUPPORT)
                || profile.roles().contains(BackofficeAuthorities.ROLE_AUDIT);
    }

    private AccessScope resolveAccessScope(String storageKey) {
        Matcher matcher = OWNER_KEY_PATTERN.matcher(storageKey);
        if (!matcher.matches()) {
            return new AccessScope(AccessCategory.UNKNOWN, null);
        }

        String ownerType = matcher.group(1);
        Long ownerUserId = Long.valueOf(matcher.group(2));
        String category = matcher.group(3);
        if ("profile".equals(category)) {
            if ("models".equals(ownerType)) {
                if (modelService.isAuthorizedTeaserStorageKey(ownerUserId, storageKey)) {
                    return new AccessScope(AccessCategory.MODEL_TEASER, ownerUserId);
                }
                return new AccessScope(AccessCategory.MODEL_PROFILE, ownerUserId);
            }
            if ("clients".equals(ownerType)) {
                return new AccessScope(AccessCategory.CLIENT_PROFILE, ownerUserId);
            }
            return new AccessScope(AccessCategory.UNKNOWN, ownerUserId);
        }
        return new AccessScope(AccessCategory.VERIFICATION, ownerUserId);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase();
    }

    private MediaType resolveMediaType(String contentType) {
        if (!StringUtils.hasText(contentType)) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
        try {
            return MediaType.parseMediaType(contentType);
        } catch (IllegalArgumentException ex) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    private String buildContentDisposition(String fileName, MediaType mediaType) {
        String safeName = StringUtils.hasText(fileName) ? fileName.replace("\"", "") : "file";
        if (mediaType.getType().equals("image") || mediaType.getType().equals("video") || MediaType.APPLICATION_PDF.includes(mediaType)) {
            return "inline; filename=\"" + safeName + "\"";
        }
        return "attachment; filename=\"" + safeName + "\"";
    }

    private enum AccessCategory {
        MODEL_TEASER,
        MODEL_PROFILE,
        CLIENT_PROFILE,
        VERIFICATION,
        UNKNOWN
    }

    private record AccessScope(AccessCategory category, Long ownerUserId) {}
}
