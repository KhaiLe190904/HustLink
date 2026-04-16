package com.hustlink.backend.features.storage.repository;

import com.hustlink.backend.features.storage.model.StoredObject;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoredObjectRepository extends JpaRepository<StoredObject, Long> {
}
