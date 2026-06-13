package com.hustlink.backend.features.companies.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CompanyRegisterRequest(
                                     @NotBlank(message = "Tên công ty không được bỏ trống") @Size(max = 200) String name,

                                     @Size(max = 1000) String description,

                                     @Size(max = 200) String website,

                                     @Size(max = 100) String industry,

                                     @Size(max = 50) String size,

                                     @Size(max = 100) String headquarters
) {
}
