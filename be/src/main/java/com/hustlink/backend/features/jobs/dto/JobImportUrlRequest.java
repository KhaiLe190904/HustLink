package com.hustlink.backend.features.jobs.dto;

import jakarta.validation.constraints.NotBlank;

public record JobImportUrlRequest(@NotBlank(message = "URL is required") String url) {
}
