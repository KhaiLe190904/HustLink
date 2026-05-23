package com.hustlink.backend.features.authentication.security;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.model.UserRole;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthorizationInterceptor implements HandlerInterceptor {

  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
    if (!(handler instanceof HandlerMethod handlerMethod)) {
      return true;
    }

    RequireRole requireRole = handlerMethod.getMethodAnnotation(RequireRole.class);
    if (requireRole == null) {
      requireRole = handlerMethod.getBeanType().getAnnotation(RequireRole.class);
    }
    if (requireRole == null) {
      return true;
    }

    Object authenticationUser = request.getAttribute("authenticationUser");
    if (!(authenticationUser instanceof User user)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
    }

    UserRole currentRole = user.getRole() == null ? UserRole.USER : user.getRole();
    boolean allowed = Arrays.stream(requireRole.value()).anyMatch(currentRole::equals);
    if (!allowed) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User does not have the required role.");
    }

    return true;
  }
}
