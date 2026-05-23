package com.hustlink.backend.features.ai.rag;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class PositionTaxonomy {
  private static final Map<String, List<String>> IT_POSITIONS = new LinkedHashMap<>();
  private static final Map<String, List<String>> STACK_ALIASES = new LinkedHashMap<>();

  static {
    registerPosition("software_engineer", "software engineer", "software developer", "developer", "programmer", "coder", "ky su phan mem", "lap trinh vien", "dev");
    registerPosition("frontend_developer", "frontend developer", "front end developer", "frontend engineer", "ui developer", "react developer", "vue developer", "angular developer", "lap trinh vien frontend", "dev frontend", "fe engineer");
    registerPosition("backend_developer", "backend developer", "back end developer", "backend engineer", "server side developer", "api developer", "nodejs developer", "java backend developer", "python backend developer", "golang developer", "lap trinh vien backend", "dev backend", "be engineer");
    registerPosition("fullstack_developer", "fullstack developer", "full stack developer", "fullstack engineer", "web developer", "lap trinh vien fullstack", "dev fullstack");
    registerPosition("mobile_developer", "mobile developer", "mobile engineer", "android developer", "ios developer", "flutter developer", "react native developer", "lap trinh vien mobile", "dev mobile");
    registerPosition("qa_engineer", "qa engineer", "quality assurance engineer", "software tester", "tester", "automation tester", "test engineer", "qc engineer", "kiem thu phan mem");
    registerPosition("devops_engineer", "devops engineer", "devops", "site reliability engineer", "sre", "platform engineer", "infrastructure engineer", "ky su devops");
    registerPosition("data_analyst", "data analyst", "business intelligence analyst", "bi analyst", "analytics analyst", "chuyen vien phan tich du lieu", "phan tich du lieu");
    registerPosition("data_engineer", "data engineer", "big data engineer", "etl developer", "etl engineer", "data pipeline engineer", "database engineer", "ky su du lieu");
    registerPosition("data_scientist", "data scientist", "machine learning scientist", "research scientist", "ai scientist", "nha khoa hoc du lieu");
    registerPosition("machine_learning_engineer", "machine learning engineer", "ml engineer", "ai engineer", "deep learning engineer", "nlp engineer", "computer vision engineer", "llm engineer", "genai engineer", "generative ai engineer");
    registerPosition("product_manager", "product manager", "product owner", "po", "technical product manager", "quan ly san pham");
    registerPosition("project_manager", "project manager", "technical project manager", "scrum master", "agile project manager", "delivery manager", "program manager");
    registerPosition("business_analyst", "business analyst", "it business analyst", "system analyst", "business system analyst", "phan tich nghiep vu");
    registerPosition("security_engineer", "security engineer", "cybersecurity engineer", "infosec engineer", "security analyst", "soc analyst", "pentester", "ethical hacker", "appsec engineer", "cloud security engineer");
    registerPosition("solution_architect", "solution architect", "software architect", "system architect", "technical architect");
    registerPosition("engineering_manager", "engineering manager", "software engineering manager", "development manager", "head of engineering", "vp engineering", "cto");
    registerPosition("internship_fresher", "intern", "internship", "software intern", "developer intern", "it intern", "fresher developer", "trainee developer", "fresher");

    registerStack("javascript", "javascript");
    registerStack("typescript", "typescript");
    registerStack("react", "react", "reactjs");
    registerStack("vue", "vue", "vuejs");
    registerStack("angular", "angular");
    registerStack("nodejs", "nodejs", "node.js");
    registerStack("java", "java");
    registerStack("spring", "spring", "spring boot");
    registerStack("php", "php");
    registerStack("laravel", "laravel");
    registerStack("python", "python");
    registerStack("django", "django");
    registerStack("flask", "flask");
    registerStack("fastapi", "fastapi");
    registerStack("golang", "golang", "go");
    registerStack("csharp", "c#", ".net", "dotnet");
    registerStack("kotlin", "kotlin");
    registerStack("swift", "swift");
    registerStack("flutter", "flutter");
    registerStack("react_native", "react native");
    registerStack("sql", "sql", "mysql", "postgresql", "mssql");
    registerStack("mongodb", "mongodb");
    registerStack("redis", "redis");
    registerStack("aws", "aws");
    registerStack("azure", "azure");
    registerStack("gcp", "gcp");
    registerStack("docker", "docker");
    registerStack("kubernetes", "kubernetes", "k8s");
    registerStack("terraform", "terraform");
    registerStack("jenkins", "jenkins");
    registerStack("github_actions", "github actions");
    registerStack("machine_learning", "machine learning", "ml");
    registerStack("nlp", "nlp");
    registerStack("computer_vision", "computer vision");
    registerStack("llm", "llm");
  }

  private PositionTaxonomy() {
  }

  public static PositionProfile parse(String rawPosition, List<String> stackHints) {
    String normalizedPosition = normalize(rawPosition);
    String canonical = detectPositionKey(normalizedPosition);
    Set<String> stacks = new LinkedHashSet<>(extractStacks(normalizedPosition));
    if (stackHints != null) {
      for (String hint : stackHints) {
        stacks.addAll(extractStacks(normalize(hint)));
      }
    }
    return new PositionProfile(canonical, normalizedPosition, stacks);
  }

  public static String canonicalLabel(String positionKey) {
    if (positionKey == null || positionKey.isBlank()) {
      return "";
    }
    return positionKey.trim().toLowerCase(Locale.ROOT);
  }

  private static String detectPositionKey(String normalizedPosition) {
    if (normalizedPosition.isBlank()) {
      return "unknown";
    }
    String bestKey = "unknown";
    int bestScore = 0;
    for (Map.Entry<String, List<String>> entry : IT_POSITIONS.entrySet()) {
      for (String alias : entry.getValue()) {
        String normalizedAlias = normalize(alias);
        if (normalizedAlias.isBlank()) {
          continue;
        }
        if (containsPhrase(normalizedPosition, normalizedAlias) && normalizedAlias.length() > bestScore) {
          bestKey = entry.getKey();
          bestScore = normalizedAlias.length();
        }
      }
    }
    return bestKey;
  }

  private static Set<String> extractStacks(String normalizedText) {
    Set<String> detected = new LinkedHashSet<>();
    if (normalizedText.isBlank()) {
      return detected;
    }
    for (Map.Entry<String, List<String>> entry : STACK_ALIASES.entrySet()) {
      for (String alias : entry.getValue()) {
        String normalizedAlias = normalize(alias);
        if (normalizedAlias.isBlank()) {
          continue;
        }
        if (containsPhrase(normalizedText, normalizedAlias)) {
          detected.add(entry.getKey());
          break;
        }
      }
    }
    return detected;
  }

  public static Set<String> sharedStacks(PositionProfile left, PositionProfile right) {
    Set<String> shared = new LinkedHashSet<>(left.stacks());
    shared.retainAll(right.stacks());
    return shared;
  }

  public static String normalize(String value) {
    if (value == null || value.isBlank()) {
      return "";
    }
    String ascii = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return ascii.toLowerCase(Locale.ROOT).replace("/", " ").replace("-", " ").replace("_", " ").replaceAll("[^a-z0-9.#+\\s]", " ").replaceAll("\\s+", " ").trim();
  }

  private static boolean containsPhrase(String normalizedText, String normalizedPhrase) {
    if (normalizedText.isBlank() || normalizedPhrase.isBlank()) {
      return false;
    }
    List<String> textTokens = List.of(normalizedText.split("\\s+"));
    List<String> phraseTokens = List.of(normalizedPhrase.split("\\s+"));
    if (textTokens.isEmpty() || phraseTokens.isEmpty() || phraseTokens.size() > textTokens.size()) {
      return false;
    }

    for (int start = 0; start <= textTokens.size() - phraseTokens.size(); start++) {
      boolean matches = true;
      for (int offset = 0; offset < phraseTokens.size(); offset++) {
        if (!textTokens.get(start + offset).equals(phraseTokens.get(offset))) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return true;
      }
    }
    return false;
  }

  private static void registerPosition(String key, String... aliases) {
    List<String> values = new ArrayList<>();
    for (String alias : aliases) {
      values.add(alias);
    }
    IT_POSITIONS.put(key, values);
  }

  private static void registerStack(String key, String... aliases) {
    List<String> values = new ArrayList<>();
    for (String alias : aliases) {
      values.add(alias);
    }
    STACK_ALIASES.put(key, values);
  }

  public record PositionProfile(String canonicalPosition, String normalizedPosition, Set<String> stacks) {
  }
}
