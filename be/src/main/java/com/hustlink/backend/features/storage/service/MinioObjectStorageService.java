package com.hustlink.backend.features.storage.service;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.storage.configuration.StorageProperties;
import com.hustlink.backend.features.storage.model.StorageScope;
import com.hustlink.backend.features.storage.model.StoredObject;
import com.hustlink.backend.features.storage.repository.StoredObjectRepository;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.BucketAlreadyExistsException;
import software.amazon.awssdk.services.s3.model.BucketAlreadyOwnedByYouException;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

@Service
@RequiredArgsConstructor
public class MinioObjectStorageService implements ObjectStorageService {
  private static final Set<StorageScope> PUBLIC_SCOPES = Set.of(
          StorageScope.PROFILE_IMAGE, StorageScope.PROFILE_COVER, StorageScope.FEED_IMAGE, StorageScope.FEED_VIDEO);

  private final S3Client s3Client;
  private final S3Presigner s3Presigner;
  private final StoredObjectRepository storedObjectRepository;
  private final StorageProperties storageProperties;
  private final StorageContentPreprocessor storageContentPreprocessor;

  @Override
  public StoredObject upload(
                             MultipartFile file, StorageScope scope, User uploadedBy, String ownerType, Long ownerId) {
    ensureConfigured();
    if (file.isEmpty()) {
      throw new IllegalArgumentException("Uploaded file is empty.");
    }

    String bucketName = resolveBucket(scope);
    ensureBucketExists(bucketName);

    String originalName = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();

    try {
      StorageContentPreprocessor.PreparedUpload preparedUpload = storageContentPreprocessor.preprocess(file, scope);
      String objectKey = buildObjectKey(scope, ownerId, preparedUpload.objectFileName());
      PutObjectRequest request = PutObjectRequest.builder().bucket(bucketName).key(objectKey).contentType(preparedUpload.contentType()).build();

      s3Client.putObject(request, RequestBody.fromBytes(preparedUpload.bytes()));

      StoredObject storedObject = new StoredObject();
      storedObject.setScope(scope);
      storedObject.setUploadedBy(uploadedBy);
      storedObject.setBucketName(bucketName);
      storedObject.setObjectKey(objectKey);
      storedObject.setOriginalFileName(originalName);
      storedObject.setContentType(preparedUpload.contentType());
      storedObject.setSizeInBytes((long) preparedUpload.bytes().length);
      storedObject.setOriginalSizeInBytes(preparedUpload.originalSizeInBytes());
      storedObject.setOptimized(preparedUpload.optimized());
      storedObject.setPublicRead(isPublicScope(scope));
      storedObject.setOwnerType(ownerType);
      storedObject.setOwnerId(ownerId);
      return storedObjectRepository.save(storedObject);
    } catch (IOException exception) {
      throw new IllegalStateException("Failed to read uploaded file.", exception);
    }
  }

  @Override
  public String getAccessUrl(StoredObject storedObject) {
    return storedObject.getPublicRead() ? buildPublicUrl(storedObject) : buildPresignedUrl(storedObject);
  }

  @Override
  public String getPublicPath(StoredObject storedObject) {
    if (!storedObject.getPublicRead()) {
      return null;
    }
    return "public/" + storedObject.getId();
  }

  @Override
  public StoredObject getStoredObject(Long id) {
    return storedObjectRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Stored object not found."));
  }

  private void ensureConfigured() {
    if (!storageProperties.enabled() || isBlank(storageProperties.endpoint()) || isBlank(storageProperties.accessKey()) || isBlank(storageProperties.secretKey())) {
      throw new IllegalStateException("Object storage is not configured. Please set the MinIO storage properties.");
    }
  }

  private String resolveBucket(StorageScope scope) {
    return switch (scope) {
      case PROFILE_IMAGE, PROFILE_COVER, FEED_IMAGE, FEED_VIDEO -> storageProperties.publicBucketOrDefault();
      case FEED_FILE -> storageProperties.mediaBucketOrDefault();
      case CV, MESSAGE_IMAGE, MESSAGE_FILE, MESSAGE_VIDEO -> storageProperties.privateBucketOrDefault();
    };
  }

  private boolean isPublicScope(StorageScope scope) {
    return PUBLIC_SCOPES.contains(scope);
  }

  private String buildObjectKey(StorageScope scope, Long ownerId, String originalName) {
    String safeName = originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
    String ownerSegment = ownerId == null ? "unassigned" : ownerId.toString();
    return "%s/%s/%s-%s".formatted(
            scope.name().toLowerCase(), ownerSegment, UUID.randomUUID(), safeName);
  }

  private void ensureBucketExists(String bucketName) {
    try {
      s3Client.headBucket(HeadBucketRequest.builder().bucket(bucketName).build());
    } catch (NoSuchBucketException exception) {
      createBucket(bucketName);
    } catch (Exception exception) {
      String message = exception.getMessage() == null ? "" : exception.getMessage();
      if (message.contains("Not Found") || message.contains("404")) {
        createBucket(bucketName);
        return;
      }
      throw exception;
    }
  }

  private void createBucket(String bucketName) {
    try {
      s3Client.createBucket(CreateBucketRequest.builder().bucket(bucketName).build());
    } catch (BucketAlreadyOwnedByYouException | BucketAlreadyExistsException ignored) {
    }
  }

  private String buildPublicUrl(StoredObject storedObject) {
    String baseUrl = !isBlank(storageProperties.publicBaseUrl()) ? storageProperties.publicBaseUrl() : storageProperties.endpoint();
    return appendPath(baseUrl, storedObject.getBucketName(), storedObject.getObjectKey());
  }

  private String buildPresignedUrl(StoredObject storedObject) {
    GetObjectRequest getObjectRequest = GetObjectRequest.builder().bucket(storedObject.getBucketName()).key(storedObject.getObjectKey()).build();

    PresignedGetObjectRequest presignedRequest = s3Presigner.presignGetObject(
            GetObjectPresignRequest.builder().signatureDuration(Duration.ofMinutes(storageProperties.presignExpirationMinutesOrDefault())).getObjectRequest(getObjectRequest).build());
    return presignedRequest.url().toString();
  }

  private String appendPath(String baseUrl, String bucketName, String objectKey) {
    String sanitizedBase = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    URI uri = URI.create(sanitizedBase);
    String encodedKey = UriUtils.encodePath(objectKey, java.nio.charset.StandardCharsets.UTF_8);
    if (storageProperties.pathStyleAccess()) {
      return "%s/%s/%s".formatted(uri.toString(), bucketName, encodedKey);
    }
    return "%s://%s.%s/%s".formatted(uri.getScheme(), bucketName, uri.getHost(), encodedKey);
  }

  private boolean isBlank(String value) {
    return value == null || value.isBlank();
  }
}
