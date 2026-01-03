package com.hustlink.backend.features.authentication.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AuthenticationRequestBody {

  @NotBlank(message = "Email is mandatory")
  @Email(message = "Email should be valid")
  @NotNull
  private String email;

  @NotBlank(message = "Password is mandatory")
  private String password;
}
