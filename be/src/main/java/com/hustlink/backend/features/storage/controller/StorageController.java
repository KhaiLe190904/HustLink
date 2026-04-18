package com.hustlink.backend.features.storage.controller;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.storage.dto.StoredObjectResponse;
import com.hustlink.backend.features.storage.model.StorageScope;
import com.hustlink.backend.features.storage.model.StoredObject;
import com.hustlink.backend.features.storage.service.ObjectStorageService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/storage")
public class StorageController {
  private final ObjectStorageService objectStorageService;

  @PostMapping("/upload")
  public ResponseEntity<StoredObjectResponse> uploadObject(
                                                           @RequestAttribute("authenticationUser") User user, @RequestParam("file") MultipartFile file, @RequestParam("scope") StorageScope scope, @RequestParam(value = "ownerType", required = false) String ownerType, @RequestParam(value = "ownerId", required = false) Long ownerId) {
    StoredObject storedObject = objectStorageService.upload(file, scope, user, ownerType, ownerId);
    return ResponseEntity.ok(toResponse(storedObject));
  }

  @GetMapping("/objects/{id}")
  public ResponseEntity<StoredObjectResponse> getObject(
                                                        @RequestAttribute("authenticationUser") User user, @PathVariable Long id) {
    StoredObject storedObject = objectStorageService.getStoredObject(id);
    objectStorageService.assertCanAccess(user, storedObject);
    return ResponseEntity.ok(toResponse(storedObject));
  }

  @GetMapping("/objects/{id}/download-url")
  public ResponseEntity<Map<String, String>> getDownloadUrl(
                                                            @RequestAttribute("authenticationUser") User user, @PathVariable Long id) {
    StoredObject storedObject = objectStorageService.getStoredObject(id);
    objectStorageService.assertCanAccess(user, storedObject);
    return ResponseEntity.ok(Map.of("url", objectStorageService.getAccessUrl(storedObject)));
  }

  @GetMapping("/public/{id}")
  public ResponseEntity<Void> redirectPublicObject(@PathVariable Long id) {
    StoredObject storedObject = objectStorageService.getStoredObject(id);
    if (!Boolean.TRUE.equals(storedObject.getPublicRead())) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, objectStorageService.getAccessUrl(storedObject)).build();
  }

  private StoredObjectResponse toResponse(StoredObject storedObject) {
    String accessUrl = objectStorageService.getAccessUrl(storedObject);
    String apiPath = objectStorageService.getPublicPath(storedObject);
    return new StoredObjectResponse(
            storedObject.getId(), storedObject.getScope(), storedObject.getBucketName(), storedObject.getObjectKey(), storedObject.getOriginalFileName(), storedObject.getContentType(), storedObject.getSizeInBytes(), storedObject.getPublicRead(), accessUrl, apiPath, storedObject.getUploadedAt());
  }
}
