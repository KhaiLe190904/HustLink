package com.hustlink.backend.features.storage.dto;

import com.hustlink.backend.features.storage.model.StorageScope;
import java.time.LocalDateTime;

public record StoredObjectResponse(
                                   Long id,
                                   StorageScope scope,
                                   String bucketName,
                                   String objectKey,
                                   String originalFileName,
                                   String contentType,
                                   Long sizeInBytes,
                                   boolean publicRead,
                                   String accessUrl,
                                   String apiPath,
                                   LocalDateTime uploadedAt) {
}
