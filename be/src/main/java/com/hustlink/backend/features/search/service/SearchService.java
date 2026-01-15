package com.hustlink.backend.features.search.service;

import com.hustlink.backend.features.authentication.model.User;
import jakarta.persistence.EntityManager;
import org.hibernate.search.mapper.orm.Search;
import org.hibernate.search.mapper.orm.session.SearchSession;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SearchService {
  private final EntityManager entityManager;

  public SearchService(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  public List<User> searchUsers(String query) {
    SearchSession searchSession = Search.session(entityManager);

    return searchSession.search(User.class).where(f -> f.match().fields("firstName", "lastName", "position", "company").matching(query).fuzzy(2) // sẽ thêm ML vào đây còn hiện tại dùng như này
    ).fetchAllHits();
  }
}
