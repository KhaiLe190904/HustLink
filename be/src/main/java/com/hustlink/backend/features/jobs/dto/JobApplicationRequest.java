package com.hustlink.backend.features.jobs.dto;

import jakarta.validation.constraints.NotNull;

public record JobApplicationRequest(
                                    @NotNull(message = "CV ID is required") Long cvId,

                                    String coverLetter
) {
}
