package com.hustlink.backend.features.jobs.dto;

import com.hustlink.backend.features.jobs.model.JobType;
import com.hustlink.backend.features.jobs.model.WorkMode;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import java.util.Set;

public record JobRequest(
                         @NotBlank(message = "Title is required") String title,

                         @NotBlank(message = "Description is required") String description,

                         String requirements,
                         String responsibilities,
                         String location,
                         JobType jobType,
                         WorkMode workMode,
                         Integer salaryMin,
                         Integer salaryMax,
                         String salaryCurrency,
                         String experienceLevel,
                         Set<String> skills,
                         LocalDateTime applicationDeadline
) {
}
