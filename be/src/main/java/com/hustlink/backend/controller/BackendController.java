package com.hustlink.backend.controller;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@ControllerAdvice
public class BackendController {

  @ExceptionHandler
  public ResponseEntity<Map<String, String>> handleHttpMessageNotReadableException(
                                                                                   HttpMessageNotReadableException ex) {
    return ResponseEntity.badRequest().body(Map.of("message", "Required request body is missing"));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, String>> handleMethodArgumentNotValidException(
                                                                                   MethodArgumentNotValidException ex) {
    StringBuilder errorsMessage = new StringBuilder();
    ex.getBindingResult().getFieldErrors().forEach(error -> {
      errorsMessage.append(error.getField()).append(": ").append(error.getDefaultMessage()).append(": ");
    });
    return ResponseEntity.badRequest().body(Map.of("message", errorsMessage.toString()));
  }

  @ExceptionHandler(NoResourceFoundException.class)
  public ResponseEntity<Map<String, String>> handleNoResourceFoundException(NoResourceFoundException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<Map<String, String>> handleDataIntegrityViolationException(
                                                                                   DataIntegrityViolationException e) {
    if (e.getMessage().contains("Cannot insert duplicate key in object 'dbo.users'.")) {
      return ResponseEntity.badRequest().body(Map.of("message", "Email already exists, please use another email or login."));
    }
    return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, String>> handleException(Exception e) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", e.getMessage()));
  }
}
