package com.hustlink.backend.features.authentication.repository;

import com.hustlink.backend.features.authentication.model.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
  Optional<User> findByEmail(String email);

  List<User> findAllByIdNot(Long id);
}
