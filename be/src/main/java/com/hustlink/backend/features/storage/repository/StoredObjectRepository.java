package com.hustlink.backend.features.storage.repository;

import com.hustlink.backend.features.storage.model.StorageScope;
import com.hustlink.backend.features.storage.model.StoredObject;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoredObjectRepository extends JpaRepository<StoredObject, Long> {
  List<StoredObject> findByOwnerTypeAndOwnerId(String ownerType, Long ownerId);

  List<StoredObject> findByOwnerTypeAndOwnerIdIsNullAndUploadedByIdAndScopeIn(
          String ownerType, Long uploadedById, Collection<StorageScope> scopes);
}
