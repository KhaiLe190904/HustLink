package com.hustlink.backend.features.ai.dto;

import com.hustlink.backend.features.ai.model.CVJobAnalysis;
import com.hustlink.backend.features.jobs.dto.JobResponse;
import java.time.LocalDateTime;
import java.util.List;

public record CVJobAnalysisResponse(
                                    Long id,
                                    Long cvId,
                                    String cvFileName,
                                    JobResponse job,
                                    Integer score,
                                    String status,
                                    String summary,
                                    List<String> strengths,
                                    List<String> improvements,
                                    List<String> extractedSkills,
                                    Integer matchScore,
                                    String matchBreakdown,
                                    String matchReasoning,
                                    LocalDateTime updatedAt
) {
  public static CVJobAnalysisResponse fromEntity(
                                                 CVJobAnalysis analysis, List<String> strengths, List<String> improvements, List<String> extractedSkills) {
    return new CVJobAnalysisResponse(
            analysis.getId(), analysis.getCv().getId(), analysis.getCv().getOriginalFileName(), JobResponse.fromEntity(analysis.getJob()), analysis.getScore(), analysis.getStatus().name(), analysis.getSummary(), strengths, improvements, extractedSkills, analysis.getMatchScore(), analysis.getMatchBreakdown(), analysis.getMatchReasoning(), analysis.getUpdatedAt());
  }
}
