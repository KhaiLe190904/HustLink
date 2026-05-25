package com.hustlink.backend.features.ai.service;

import com.hustlink.backend.features.ai.dto.CVContextDebugResponse;
import com.hustlink.backend.features.ai.dto.CVSectionDebugResponse;
import com.hustlink.backend.features.ai.model.CV;
import com.hustlink.backend.features.ai.model.InterviewLevel;
import com.hustlink.backend.features.ai.rag.PositionTaxonomy;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class CVContextBuilder {
  private static final List<String> PRIORITIZED_CV_SECTIONS = List.of(
          "skills", "experience", "projects", "education", "certifications", "achievements");

  public String buildRetrievalQuery(CV cv, String jobPosition, InterviewLevel level) {
    String cvContext = buildStructuredCvContext(cv, 3200, 1200);
    return "Target position: %s\nTarget level: %s\nInterview scope: %s\nCandidate CV signals:\n%s".formatted(
            jobPosition, level.name(), profileHint(level), cvContext);
  }

  public String buildGenerationContext(CV cv, InterviewLevel level) {
    String structuredCvContext = buildStructuredCvContext(cv, 7000, 1600);
    return switch (level) {
      case INTERN -> """
              Candidate CV:
              %s

              Use the CV only to personalize technologies, projects, and domains.
              Do not infer seniority beyond INTERN from tool names or broad project exposure.
              """.formatted(trimToMaxChars(structuredCvContext, 2800));
      case FRESHER -> """
              Candidate CV:
              %s

              Use the CV to personalize stack and project examples.
              Keep questions within FRESHER expectations even if the CV mentions advanced tools.
              """.formatted(trimToMaxChars(structuredCvContext, 3800));
      case JUNIOR -> trimToMaxChars(structuredCvContext, 7000);
      case SENIOR -> trimToMaxChars(structuredCvContext, 12000);
    };
  }

  public CVContextDebugResponse debug(CV cv, String jobPosition, InterviewLevel level) {
    String extractedText = cv.getExtractedText() == null ? "" : cv.getExtractedText();
    String summary = cv.getAnalysisSummary() == null ? "" : cv.getAnalysisSummary();
    List<String> lines = splitLines(extractedText);
    boolean isMarkdown = extractedText.contains("## ");
    List<CVSectionDebugResponse> sections = PRIORITIZED_CV_SECTIONS.stream().map(sectionKey -> {
      String content = extractSectionBody(lines, sectionKey, 1200, isMarkdown);
      return new CVSectionDebugResponse(
              sectionKey, formatSectionLabel(sectionKey), !content.isBlank(), content.length(), content);
    }).toList();
    boolean hasAnySection = sections.stream().anyMatch(CVSectionDebugResponse::found);
    String fallbackExcerpt = hasAnySection ? "" : trimToMaxChars(cleanWhitespace(extractedText), 3200);
    String summaryBooster = summary.isBlank() ? "" : trimToMaxChars(cleanWhitespace(summary), 1200);
    return new CVContextDebugResponse(
            cv.getOriginalFileName(), extractedText.length(), !summary.isBlank(), sections, fallbackExcerpt, summaryBooster, buildRetrievalQuery(cv, jobPosition, level), buildGenerationContext(cv, level));
  }

  public String buildStructuredCvContext(CV cv, int extractedTextBudget, int summaryBudget) {
    String extractedText = cv.getExtractedText() == null ? "" : cv.getExtractedText();
    String summary = cv.getAnalysisSummary() == null ? "" : cv.getAnalysisSummary();
    String prioritizedSections = extractPrioritizedCvSections(extractedText, extractedTextBudget);
    String fallbackExcerpt = prioritizedSections.isBlank() ? trimToMaxChars(cleanWhitespace(extractedText), extractedTextBudget) : "";

    List<String> parts = new ArrayList<>();
    if (!prioritizedSections.isBlank()) {
      parts.add("Prioritized CV sections:\n" + prioritizedSections);
    }
    if (!fallbackExcerpt.isBlank()) {
      parts.add("CV excerpt:\n" + fallbackExcerpt);
    }
    if (!summary.isBlank()) {
      parts.add("Analysis summary booster:\n" + trimToMaxChars(cleanWhitespace(summary), summaryBudget));
    }
    return String.join("\n\n", parts);
  }

  private String extractPrioritizedCvSections(String text, int totalBudget) {
    List<String> lines = splitLines(text);
    if (lines.isEmpty()) {
      return "";
    }
    boolean isMarkdown = text.contains("## ");

    List<String> sections = new ArrayList<>();
    int remainingBudget = totalBudget;
    for (String sectionKey : PRIORITIZED_CV_SECTIONS) {
      String sectionBody = extractSectionBody(lines, sectionKey, Math.min(remainingBudget, 900), isMarkdown);
      if (sectionBody.isBlank()) {
        continue;
      }

      String label = formatSectionLabel(sectionKey);
      String rendered = label + ":\n" + sectionBody;
      if (rendered.length() > remainingBudget) {
        rendered = label + ":\n" + trimToMaxChars(sectionBody, Math.max(remainingBudget - label.length() - 2, 120));
      }
      if (!rendered.isBlank()) {
        sections.add(rendered);
        remainingBudget -= rendered.length() + 2;
      }
      if (remainingBudget <= 120) {
        break;
      }
    }

    return String.join("\n\n", sections);
  }

  private String extractSectionBody(List<String> lines, String sectionKey, int budget, boolean isMarkdown) {
    int startIndex = findSectionStart(lines, sectionKey, isMarkdown);
    if (startIndex < 0) {
      return "";
    }

    StringBuilder builder = new StringBuilder();
    for (int i = startIndex + 1; i < lines.size(); i++) {
      String line = lines.get(i);
      if (looksLikeSectionHeading(line, isMarkdown)) {
        break;
      }
      if (builder.length() > 0) {
        builder.append('\n');
      }
      builder.append(line);
      if (builder.length() >= budget) {
        break;
      }
    }
    return trimToMaxChars(cleanWhitespacePreserveLines(builder.toString()), budget);
  }

  private int findSectionStart(List<String> lines, String sectionKey, boolean isMarkdown) {
    for (int i = 0; i < lines.size(); i++) {
      if (isSectionHeading(lines.get(i), sectionKey, isMarkdown)) {
        return i;
      }
    }
    return -1;
  }

  private boolean looksLikeSectionHeading(String line, boolean isMarkdown) {
    for (String sectionKey : PRIORITIZED_CV_SECTIONS) {
      if (isSectionHeading(line, sectionKey, isMarkdown)) {
        return true;
      }
    }
    return false;
  }

  private boolean isSectionHeading(String line, String sectionKey, boolean isMarkdown) {
    // Nếu là định dạng Markdown của Unstructured, Heading bắt buộc phải bắt đầu bằng '#' hoặc '##'
    if (isMarkdown) {
      String trimmed = line.trim();
      if (!trimmed.startsWith("#") && !trimmed.startsWith("##")) {
        return false;
      }
    }

    String normalized = normalizeSectionLine(line);
    if (normalized.isBlank()) {
      return false;
    }
    return switch (sectionKey) {
      case "skills" ->
        matchesAny(normalized, "skills", "technical skills", "core skills", "technologies", "tech stack", "ky nang", "ki nang", "cong nghe");
      case "experience" ->
        matchesAny(normalized, "experience", "work experience", "employment history", "professional experience", "kinh nghiem", "kinh nghiem lam viec");
      case "projects" ->
        matchesAny(normalized, "projects", "project experience", "selected projects", "du an", "san pham");
      case "education" -> matchesAny(normalized, "education", "academic background", "hoc van", "qua trinh hoc tap");
      case "certifications" -> matchesAny(normalized, "certifications", "certificates", "chung chi");
      case "achievements" ->
        matchesAny(normalized, "achievements", "awards", "thanh tich", "danh hieu", "giai thuong", "danh hieu va giai thuong");
      default -> false;
    };
  }

  private boolean matchesAny(String normalized, String... candidates) {
    for (String candidate : candidates) {
      if (normalized.equals(candidate) || normalized.startsWith(candidate + " ")) {
        return true;
      }
    }
    return false;
  }

  private String normalizeSectionLine(String line) {
    if (line == null || line.isBlank()) {
      return "";
    }
    // Loại bỏ các ký hiệu tiêu đề Markdown ở đầu dòng (ví dụ: ## , - , * , • )
    String cleanLine = line.replaceAll("^[#\\-\\s\\*•]+", "").trim();
    return PositionTaxonomy.normalize(cleanLine).replaceAll("[^a-z0-9\\s]", " ").replaceAll("\\s+", " ").trim();
  }

  private List<String> splitLines(String text) {
    if (text == null || text.isBlank()) {
      return List.of();
    }
    return text.lines().map(String::trim).filter(line -> !line.isBlank()).toList();
  }

  private String cleanWhitespace(String text) {
    if (text == null || text.isBlank()) {
      return "";
    }
    return text.replaceAll("\\s+", " ").trim();
  }

  private String cleanWhitespacePreserveLines(String text) {
    if (text == null || text.isBlank()) {
      return "";
    }
    return text.lines().map(line -> line.replaceAll("\\s+", " ").trim()).filter(line -> !line.isBlank()).collect(Collectors.joining("\n"));
  }

  private String trimToMaxChars(String text, int maxChars) {
    if (text == null) {
      return "";
    }
    if (text.length() <= maxChars) {
      return text;
    }
    return text.substring(0, maxChars);
  }

  private String profileHint(InterviewLevel level) {
    return switch (level) {
      case INTERN -> "Focus on fundamentals, learning potential, and simple project explanation.";
      case FRESHER -> "Focus on fundamentals, practical understanding, and small project reasoning.";
      case JUNIOR -> "Focus on implementation detail, debugging, and practical backend trade-offs.";
      case SENIOR -> "Focus on architecture, ownership, trade-offs, and production thinking.";
    };
  }

  private String formatSectionLabel(String sectionKey) {
    return switch (sectionKey) {
      case "skills" -> "Skills";
      case "experience" -> "Experience";
      case "projects" -> "Projects";
      case "education" -> "Education";
      case "certifications" -> "Certifications";
      case "achievements" -> "Achievements";
      default -> sectionKey;
    };
  }
}
