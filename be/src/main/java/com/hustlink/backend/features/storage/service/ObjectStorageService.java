package com.hustlink.backend.features.storage.service;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.storage.model.StorageScope;
import com.hustlink.backend.features.storage.model.StoredObject;
import org.springframework.web.multipart.MultipartFile;

public interface ObjectStorageService {
  StoredObject upload(MultipartFile file, StorageScope scope, User uploadedBy, String ownerType, Long ownerId);

  String getAccessUrl(StoredObject storedObject);

  String getPublicPath(StoredObject storedObject);

  StoredObject getStoredObject(Long id);

  void assertCanAccess(User user, StoredObject storedObject);

  StoredObject assignOwner(StoredObject storedObject, String ownerType, Long ownerId);

  void delete(StoredObject storedObject);
}
