package com.hustlink.backend.features.jobs.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hustlink.backend.features.ai.embedding.VectorStoreClient;
import com.hustlink.backend.features.ai.repository.CVJobAnalysisRepository;
import com.hustlink.backend.features.ai.repository.InterviewSessionRepository;
import com.hustlink.backend.features.ai.service.CVParserService;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.model.UserRole;
import com.hustlink.backend.features.authentication.repository.UserRepository;
import com.hustlink.backend.features.companies.model.Company;
import com.hustlink.backend.features.companies.model.CompanyMember;
import com.hustlink.backend.features.companies.model.CompanyRole;
import com.hustlink.backend.features.companies.model.CompanyStatus;
import com.hustlink.backend.features.companies.repository.CompanyMemberRepository;
import com.hustlink.backend.features.companies.repository.CompanyRepository;
import com.hustlink.backend.features.jobs.dto.JobResponse;
import com.hustlink.backend.features.jobs.model.Job;
import com.hustlink.backend.features.jobs.model.JobStatus;
import com.hustlink.backend.features.jobs.model.JobType;
import com.hustlink.backend.features.jobs.model.WorkMode;
import com.hustlink.backend.features.jobs.repository.JobApplicationRepository;
import com.hustlink.backend.features.jobs.repository.JobRepository;
import com.hustlink.backend.features.jobs.repository.SavedJobRepository;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.options.LoadState;
import com.microsoft.playwright.options.WaitUntilState;
import jakarta.transaction.Transactional;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Slf4j
public class JobImportService {
  private static final String AUTOMATED_BLOCK_MESSAGE = "This job site is still blocking automated JD import. Try again later, use another JD URL, or upload JD PDF.";
  private static final String BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  private static final String IMPORTED_COMPANY_DESCRIPTION = "Imported from JD source. Pending admin review.";
  private static final String JOB_DESCRIPTION_COLLECTION = "job_description";
  private static final List<String> COMMON_SKILLS = List.of(
          "RESTful API", "REST API", "REST", "GraphQL", "gRPC", "WebSocket", "Microservices", "OAuth2", "JWT", "Swagger", "OpenAPI", "Java", "Spring", "Spring Boot", "Hibernate", "JPA", "Maven", "Gradle", "Kotlin", "Scala", "C#", ".NET", "ASP.NET Core", "Entity Framework", "Blazor", "C++", "Objective-C", "Swift", "PHP", "Laravel", "Symfony", "WordPress", "Drupal", "Magento", "Python", "Django", "Flask", "FastAPI", "Pandas", "NumPy", "Scikit-learn", "TensorFlow", "PyTorch", "Ruby", "Ruby on Rails", "Rails", "Rust", "Golang", "Elixir", "TypeScript", "JavaScript", "Node.js", "Express", "Express.js", "NestJS", "Next.js", "React", "ReactJS", "React 18", "React Native", "Redux", "Zustand", "Vue", "Vue.js", "Vue 2", "Vue 3", "Vuex", "Pinia", "Vue Router", "Nuxt", "Nuxt 3", "Angular", "RxJS", "Svelte", "jQuery", "Three.js", "Vite", "Webpack", "HTML5", "HTML", "CSS3", "CSS", "Tailwind CSS", "Tailwind", "Bootstrap", "Material UI", "Ant Design", "Radix UI", "SASS/SCSS", "SCSS", "SASS", "Responsive Design", "Clean code", "Custom Hooks", "SQL", "MySQL", "PostgreSQL", "SQL Server", "Oracle", "SQLite", "MariaDB", "MongoDB", "Redis", "Elasticsearch", "OpenSearch", "Firebase", "Supabase", "Docker", "Kubernetes", "Helm", "Terraform", "Ansible", "Jenkins", "GitHub Actions", "GitLab CI", "CI/CD", "Nginx", "AWS", "Azure", "GCP", "Linux", "Unix", "Bash", "PowerShell", "Git", "Postman", "Selenium", "Playwright", "Cypress", "Jest", "Vitest", "JUnit", "Mockito", "Flutter", "Android", "iOS", "Unity", "Unreal Engine", "Kafka", "RabbitMQ", "Apache Spark", "Hadoop", "Airflow", "dbt", "LLM", "LangChain", "Figma", "DevOps", "Agile", "Agile/Scrum", "Scrum", "GitHub Copilot");

  private final JobRepository jobRepository;
  private final JobApplicationRepository jobApplicationRepository;
  private final SavedJobRepository savedJobRepository;
  private final CVJobAnalysisRepository cvJobAnalysisRepository;
  private final InterviewSessionRepository interviewSessionRepository;
  private final CompanyRepository companyRepository;
  private final CompanyMemberRepository companyMemberRepository;
  private final UserRepository userRepository;
  private final CVParserService cvParserService;
  private final ObjectMapper objectMapper;
  private final VectorStoreClient vectorStoreClient;

  @Value("${jobs.import.playwright.headless:true}")
  private boolean playwrightHeadless;

  @Value("${jobs.import.playwright.channel:chrome}")
  private String playwrightChannel;

  @Value("${jobs.import.playwright.timeout-ms:45000}")
  private double playwrightTimeoutMs;

  @Transactional
  public JobResponse importFromUrl(String url, User user) {
    String normalizedUrl = normalizeUrl(url);
    validateAllowedJobUrl(normalizedUrl);

    String canonicalUrl = canonicalizeJobUrl(normalizedUrl);
    String platform = resolveSourcePlatform(canonicalUrl, "URL");
    String externalJobId = extractExternalJobId(canonicalUrl);
    Optional<Job> existingJob = findExistingImportedJob(platform, externalJobId, canonicalUrl);
    if (existingJob.isPresent() && isProcessedImportedJob(existingJob.get())) {
      return JobResponse.fromEntity(existingJob.get());
    }

    ImportedJobData data = renderAndParseJobPage(canonicalUrl);
    validateImportedJobData(data);
    if (existingJob.isPresent()) {
      Job job = updateImportedJob(existingJob.get(), data, "URL", canonicalUrl, platform, externalJobId, user);
      return JobResponse.fromEntity(job);
    }
    Job job = saveImportedJob(data, "URL", canonicalUrl, platform, externalJobId, user);
    return JobResponse.fromEntity(job);
  }

  @Transactional
  public JobResponse importFromPdf(MultipartFile file, User user) {
    try {
      String text = cvParserService.extractTextFromPdf(file);
      if (text.isBlank()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not extract any text from this JD PDF.");
      }
      ImportedJobData data = parsePlainText(text, file.getOriginalFilename() == null ? "Imported JD" : file.getOriginalFilename());
      validateImportedJobData(data);
      Job job = saveImportedJob(data, "PDF", null, "PDF", null, user);
      return JobResponse.fromEntity(job);
    } catch (IOException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The uploaded JD PDF is not readable.", exception);
    }
  }

  @Transactional
  public JobResponse assignImportedJob(Long jobId, Long recruiterId) {
    Job job = jobRepository.findById(jobId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));
    User recruiter = userRepository.findById(recruiterId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter user not found"));
    if (recruiter.getRole() != UserRole.USER) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only regular users with no current role can be assigned as recruiter.");
    }
    if (companyMemberRepository.existsByUserId(recruiter.getId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This user is already linked to a company.");
    }
    recruiter.setRole(UserRole.RECRUITER);
    userRepository.save(recruiter);
    job.setAssignedRecruiter(recruiter);
    job.setPostedBy(recruiter);
    companyMemberRepository.findByCompanyIdAndUserId(job.getCompany().getId(), recruiter.getId()).ifPresentOrElse(
            member -> {
              member.setRole(CompanyRole.OWNER);
              companyMemberRepository.save(member);
            }, () -> companyMemberRepository.save(CompanyMember.builder().company(job.getCompany()).user(recruiter).role(CompanyRole.OWNER).build()));
    return JobResponse.fromEntity(jobRepository.save(job));
  }

  public java.util.List<JobResponse> getImportedJobs() {
    return jobRepository.findBySourceTypeIsNotNullOrderByCreatedAtDesc().stream().map(JobResponse::fromEntity).toList();
  }

  @Transactional
  public void deleteImportedJob(Long jobId) {
    Job job = jobRepository.findById(jobId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));
    if (job.getSourceType() == null || job.getSourceType().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only imported jobs can be deleted from this screen.");
    }
    if (jobApplicationRepository.existsByJobId(jobId)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "This imported job already has applications. Close it instead of deleting it.");
    }
    if (interviewSessionRepository.existsByJobId(jobId)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "This imported job already has mock interview history. Close it instead of deleting it.");
    }

    Company company = job.getCompany();
    Long companyId = company == null ? null : company.getId();

    savedJobRepository.deleteByJobId(jobId);
    cvJobAnalysisRepository.deleteByJobId(jobId);
    jobRepository.delete(job);
    jobRepository.flush();

    try {
      vectorStoreClient.delete(JOB_DESCRIPTION_COLLECTION, jobId.toString());
    } catch (Exception exception) {
      log.warn("Failed to delete imported job vector: {}", exception.getMessage());
    }

    if (companyId != null && shouldDeleteImportedCompany(company, companyId)) {
      companyMemberRepository.deleteAll(companyMemberRepository.findByCompanyId(companyId));
      companyRepository.delete(company);
    }
  }

  private Optional<Job> findExistingImportedJob(String platform, String externalJobId, String canonicalUrl) {
    if (externalJobId != null && !externalJobId.isBlank()) {
      Optional<Job> byExternalId = jobRepository.findFirstBySourcePlatformAndExternalJobId(platform, externalJobId);
      if (byExternalId.isPresent()) {
        return byExternalId;
      }
    }
    return jobRepository.findFirstBySourceUrl(canonicalUrl);
  }

  private Job saveImportedJob(ImportedJobData data, String sourceType, String sourceUrl, String sourcePlatform, String externalJobId, User user) {
    Company company = findOrCreateCompany(data.companyName());
    Job job = Job.builder().company(company).postedBy(user).title(blankToDefault(data.title(), "Imported JD")).description(blankToDefault(data.description(), data.rawText())).requirements(data.requirements()).responsibilities(data.responsibilities()).location(data.location()).jobType(data.jobType()).workMode(data.workMode()).salaryMin(data.salaryMin()).salaryMax(data.salaryMax()).salaryCurrency("VND").experienceLevel(data.experienceLevel()).skills(data.skills()).applicationDeadline(data.deadline()).status(JobStatus.DRAFT).build();
    job.setSourceType(sourceType);
    job.setSourceUrl(sourceUrl);
    job.setSourcePlatform(sourcePlatform);
    job.setExternalJobId(externalJobId);
    job.setRawImportedContent(data.rawText());
    job.setImportedBy(user);
    return jobRepository.save(job);
  }

  private Job updateImportedJob(Job job, ImportedJobData data, String sourceType, String sourceUrl, String sourcePlatform, String externalJobId, User user) {
    job.setCompany(findOrCreateCompany(data.companyName()));
    job.setTitle(blankToDefault(data.title(), job.getTitle()));
    job.setDescription(blankToDefault(data.description(), data.rawText()));
    job.setRequirements(data.requirements());
    job.setResponsibilities(data.responsibilities());
    job.setLocation(data.location());
    job.setJobType(data.jobType());
    job.setWorkMode(data.workMode());
    job.setSalaryMin(data.salaryMin());
    job.setSalaryMax(data.salaryMax());
    job.setSalaryCurrency("VND");
    job.setExperienceLevel(data.experienceLevel());
    job.setSkills(data.skills());
    job.setApplicationDeadline(data.deadline());
    job.setSourceType(sourceType);
    job.setSourceUrl(sourceUrl);
    job.setSourcePlatform(sourcePlatform);
    job.setExternalJobId(externalJobId);
    job.setRawImportedContent(data.rawText());
    if (job.getImportedBy() == null) {
      job.setImportedBy(user);
    }
    job.setStatus(JobStatus.DRAFT);
    return jobRepository.save(job);
  }

  private boolean isProcessedImportedJob(Job job) {
    return job.getStatus() != JobStatus.DRAFT || job.getAssignedRecruiter() != null;
  }

  private Company findOrCreateCompany(String companyName) {
    String normalizedName = blankToDefault(cleanCompanyName(companyName), "Imported Company");
    Optional<Company> existing = companyRepository.findByNameIgnoreCase(normalizedName);
    if (existing.isPresent()) {
      return existing.get();
    }
    String slug = uniqueSlug(normalizedName);
    Company company = Company.builder().name(normalizedName).slug(slug).description(IMPORTED_COMPANY_DESCRIPTION).status(CompanyStatus.PENDING).build();
    return companyRepository.save(company);
  }

  private boolean shouldDeleteImportedCompany(Company company, Long companyId) {
    if (company == null || companyId == null) {
      return false;
    }
    boolean importedShell = company.getStatus() == CompanyStatus.PENDING && IMPORTED_COMPANY_DESCRIPTION.equals(company.getDescription());
    return importedShell && jobRepository.countByCompanyId(companyId) == 0;
  }

  private ImportedJobData renderAndParseJobPage(String url) {
    try (Playwright playwright = Playwright.create()) {
      ResponseStatusException automatedBlock = null;
      PlaywrightException playwrightFailure = null;
      for (BrowserLaunchAttempt attempt : browserLaunchAttempts(url)) {
        try {
          return renderAndParseJobPageAttempt(playwright, url, attempt);
        } catch (ResponseStatusException exception) {
          if (!AUTOMATED_BLOCK_MESSAGE.equals(exception.getReason())) {
            throw exception;
          }
          automatedBlock = exception;
        } catch (PlaywrightException exception) {
          playwrightFailure = exception;
        }
      }
      if (automatedBlock != null) {
        throw automatedBlock;
      }
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not render this JD URL with Playwright. Make sure Chrome is installed or configure jobs.import.playwright.channel.", playwrightFailure);
    } catch (ResponseStatusException exception) {
      throw exception;
    } catch (PlaywrightException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not render this JD URL with Playwright. Make sure Chrome is installed or configure jobs.import.playwright.channel.", exception);
    }
  }

  private ImportedJobData renderAndParseJobPageAttempt(Playwright playwright, String url, BrowserLaunchAttempt attempt) {
    try (Browser browser = launchBrowser(playwright, attempt.args()); BrowserContext context = browser.newContext(new Browser.NewContextOptions().setUserAgent(BROWSER_USER_AGENT).setLocale("vi-VN").setTimezoneId("Asia/Ho_Chi_Minh").setViewportSize(1366, 900))) {
      context.setDefaultTimeout(playwrightTimeoutMs);
      applyBrowserFingerprintPatches(context);
      Page page = context.newPage();
      if (attempt.warmUpTopCv() && url.contains("topcv.vn")) {
        warmUpTopCvSession(page);
      }
      page.navigate(url, new Page.NavigateOptions().setWaitUntil(WaitUntilState.DOMCONTENTLOADED).setTimeout(playwrightTimeoutMs));
      try {
        page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(8000));
      } catch (PlaywrightException ignored) {
        // Some job sites keep analytics connections open; DOM content is enough for extraction.
      }
      String raw = safeBodyText(page);
      String html = page.content();
      log.info("JD import rendered url={} title='{}' bodyLength={} warmUpTopCv={} args={}", url, page.title(), raw.length(), attempt.warmUpTopCv(), attempt.args());
      if (isCloudflareBlock(page.title(), raw, html)) {
        log.warn("JD import detected Cloudflare block url={} title='{}' warmUpTopCv={} args={}", url, page.title(), attempt.warmUpTopCv(), attempt.args());
        if (isHardCloudflareBlock(raw, html) || !waitForCloudflareChallengeToClear(page)) {
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, AUTOMATED_BLOCK_MESSAGE);
        }
        raw = safeBodyText(page);
        html = page.content();
      }
      return parseRenderedPage(page, html, raw, url);
    }
  }

  private Browser launchBrowser(Playwright playwright, List<String> args) {
    BrowserType browserType = playwright.chromium();
    BrowserType.LaunchOptions launchOptions = new BrowserType.LaunchOptions().setHeadless(playwrightHeadless).setTimeout(playwrightTimeoutMs).setIgnoreDefaultArgs(List.of("--enable-automation"));
    if (!args.isEmpty()) {
      launchOptions.setArgs(args);
    }
    if (playwrightChannel != null && !playwrightChannel.isBlank()) {
      launchOptions.setChannel(playwrightChannel.trim());
    }
    try {
      return browserType.launch(launchOptions);
    } catch (PlaywrightException exception) {
      if (playwrightChannel == null || playwrightChannel.isBlank()) {
        throw exception;
      }
      BrowserType.LaunchOptions fallbackLaunchOptions = new BrowserType.LaunchOptions().setHeadless(playwrightHeadless).setTimeout(playwrightTimeoutMs).setIgnoreDefaultArgs(List.of("--enable-automation"));
      if (!args.isEmpty()) {
        fallbackLaunchOptions.setArgs(args);
      }
      return browserType.launch(fallbackLaunchOptions);
    }
  }

  private List<BrowserLaunchAttempt> browserLaunchAttempts(String url) {
    if (url.contains("topcv.vn")) {
      return List.of(
              new BrowserLaunchAttempt(List.of(), false), new BrowserLaunchAttempt(List.of(), true), new BrowserLaunchAttempt(List.of("--disable-blink-features=AutomationControlled"), false));
    }
    return List.of(new BrowserLaunchAttempt(List.of(), false));
  }

  private void warmUpTopCvSession(Page page) {
    try {
      page.navigate("https://www.topcv.vn", new Page.NavigateOptions().setWaitUntil(WaitUntilState.DOMCONTENTLOADED).setTimeout(playwrightTimeoutMs));
      page.waitForTimeout(1500);
      for (String selector : List.of("button:has-text('Chấp nhận tất cả')", "button:has-text('Đồng ý')", "#btn-accept-cookie", ".btn-accept-cookie")) {
        try {
          Locator button = page.locator(selector);
          if (button.count() > 0) {
            button.first().click(new Locator.ClickOptions().setTimeout(1500));
            break;
          }
        } catch (PlaywrightException ignored) {
          // Try the next cookie selector.
        }
      }
    } catch (PlaywrightException ignored) {
      // The direct detail attempt can still work even if homepage warm-up is flaky.
    }
  }

  private void applyBrowserFingerprintPatches(BrowserContext context) {
    context.addInitScript("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['vi-VN', 'vi', 'en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            window.chrome = window.chrome || { runtime: {} };
            """);
  }

  private ImportedJobData parseRenderedPage(Page page, String html, String raw, String url) {
    if (url.contains("topcv.vn")) {
      return parseTopCvRenderedPage(page, html, raw, url);
    }
    String title = cleanJobTitle(firstNonBlank(
            attributeFirst(page, "meta[property='og:title']", "content"), extractJsonStringAny(html, "job_title", "jobTitle", "title"), textFirst(page, "h1"), textFirst(page, "h2"), page.title()));
    String company = firstNonBlank(
            extractJsonStringAny(html, "company_name", "companyName", "company"), textFirst(page, "a[href*='brand']", "a[href*='cong-ty']", "a[href*='company']", "[class*='company'] a"), extractCompanyFromText(raw), extractDomain(url));
    String jobTypeText = firstNonBlank(
            textFirst(page, ".section-job-type .job-detail__info--section-content-value"), textFirst(page, ".section-working-form .job-detail__info--section-content-value"), topCvInfoValue(page, "hinh thuc"), extractJsonStringAny(html, "job_type", "jobType", "workingForm", "working_form"));
    String description = firstNonBlank(
            sectionTextAny(raw, new String[]{"Mô tả công việc", "Mô tả"}, new String[]{"Yêu cầu ứng viên", "Yêu cầu công việc", "Yêu cầu"}), htmlTextFromJsonAny(html, "job_description", "jobDescription", "description"));
    String requirements = firstNonBlank(
            sectionTextAny(raw, new String[]{"Yêu cầu ứng viên", "Yêu cầu công việc", "Yêu cầu"}, new String[]{"Quyền lợi được hưởng", "Quyền lợi", "Phúc lợi", "Địa điểm làm việc", "Cách thức ứng tuyển"}), htmlTextFromJsonAny(html, "job_requirement", "jobRequirement", "requirements"));
    String benefits = firstNonBlank(
            sectionTextAny(raw, new String[]{"Quyền lợi được hưởng", "Quyền lợi", "Phúc lợi"}, new String[]{"Địa điểm làm việc", "Cách thức ứng tuyển", "Hạn nộp hồ sơ"}), htmlTextFromJsonAny(html, "benefit", "benefits", "job_benefit", "jobBenefit"));
    String location = firstNonBlank(
            extractJsonStringAny(html, "location", "address", "job_location", "jobLocation", "cityNameVI"), extractAfterLabel(raw, "Địa điểm", "Kinh nghiệm"), extractAfterLabel(raw, "Location", "Salary"));
    Salary salary = firstSalary(parseSalary(extractAfterLabel(raw, "Mức lương", "Địa điểm")), parseSalary(raw), salaryFromJson(html));
    Set<String> skills = parseSkills(page, raw, html);
    LocalDateTime deadline = firstDate(
            parseDate(extractAfterLabel(raw, "Hạn nộp hồ sơ:", "Ứng tuyển")), parseDate(extractAfterLabel(raw, "Hạn nộp hồ sơ", "Ứng tuyển")), parseDate(extractJsonStringAny(html, "deadline", "expiredOn", "applicationDeadline")));
    return new ImportedJobData(
            title, company, description, requirements, benefits, location, salary.min(), salary.max(), inferExperience(firstNonBlank(requirements, raw)), deadline, skills, raw, firstNonNull(parseJobTypeLabel(jobTypeText), inferJobType(firstNonBlank(jobTypeText, title))), inferWorkMode(raw));
  }

  private ImportedJobData parseTopCvRenderedPage(Page page, String html, String raw, String url) {
    String title = cleanJobTitle(firstNonBlank(
            textFirst(page, "h1.job-detail__info--title"), attributeFirst(page, "meta[property='og:title']", "content"), extractJsonStringAny(html, "job_title", "jobTitle", "title"), textFirst(page, "h1"), page.title()));
    String company = firstNonBlank(
            topCvCompanyFromJsonLd(html), topCvCompanyFromMeta(page), textFirst(page, ".job-detail__box--right .company-name", ".box-employer-info .company-name", ".employer-title", "a[href*='/brand/'] span", "a[href*='/brand/']"), extractCompanyFromText(raw), extractDomain(url));
    String location = firstNonBlank(
            textFirst(page, ".section-location .job-detail__info--section-content-value a"), textFirst(page, ".section-location .job-detail__info--section-content-value"), extractAfterLabel(raw, "Địa điểm", "Kinh nghiệm"));
    String salaryText = firstNonBlank(
            textFirst(page, ".section-salary .job-detail__info--section-content-value"), topCvInfoValue(page, "muc luong"), extractAfterLabel(raw, "Mức lương", "Địa điểm"));
    String experience = firstNonBlank(
            textFirst(page, ".section-experience .job-detail__info--section-content-value"), topCvInfoValue(page, "kinh nghiem"), extractJsonStringAny(html, "experience", "experienceLabel", "jobExperience"), extractAfterLabel(raw, "Kinh nghiệm", "Cấp bậc"));
    String description = firstNonBlank(
            topCvSectionText(page, "mo ta"), sectionTextAny(raw, new String[]{"Mô tả công việc", "Mô tả"}, new String[]{"Yêu cầu ứng viên", "Yêu cầu"}));
    String requirements = firstNonBlank(
            topCvSectionText(page, "yeu cau"), sectionTextAny(raw, new String[]{"Yêu cầu ứng viên", "Yêu cầu công việc", "Yêu cầu"}, new String[]{"Quyền lợi được hưởng", "Quyền lợi", "Địa điểm làm việc"}));
    String benefits = firstNonBlank(
            topCvSectionText(page, "quyen loi"), sectionTextAny(raw, new String[]{"Quyền lợi được hưởng", "Quyền lợi"}, new String[]{"Địa điểm làm việc", "Cách thức ứng tuyển"}));
    Salary salary = firstSalary(parseSalary(salaryText), parseSalary(raw), salaryFromJson(html));
    Set<String> skills = parseSkillsFromText(String.join("\n", description, requirements));
    LocalDateTime deadline = firstDate(
            parseDate(extractAfterLabel(raw, "Hạn nộp hồ sơ:", "Ứng tuyển")), parseDate(extractAfterLabel(raw, "Hạn nộp hồ sơ", "Ứng tuyển")), parseDate(extractJsonStringAny(html, "deadline", "expiredOn", "applicationDeadline")));
    return new ImportedJobData(
            title, company, description, requirements, benefits, location, salary.min(), salary.max(), firstNonBlank(normalizeExperienceLabelStrict(experience), inferExperience(firstNonBlank(requirements, raw))), deadline, skills, raw, inferJobType(raw), inferWorkMode(raw));
  }

  private ImportedJobData parsePlainText(String text, String fallbackTitle) {
    String title = firstNonBlank(firstLine(text), fallbackTitle);
    String company = firstNonBlank(extractCompanyFromText(text), "Imported Company");
    String description = sectionTextAny(text, new String[]{"Mô tả công việc", "Mô tả"}, new String[]{"Yêu cầu ứng viên", "Yêu cầu công việc", "Yêu cầu"});
    String requirements = sectionTextAny(text, new String[]{"Yêu cầu ứng viên", "Yêu cầu công việc", "Yêu cầu"}, new String[]{"Quyền lợi được hưởng", "Quyền lợi", "Phúc lợi", "Địa điểm làm việc"});
    String benefits = sectionTextAny(text, new String[]{"Quyền lợi được hưởng", "Quyền lợi", "Phúc lợi"}, new String[]{"Địa điểm làm việc", "Cách thức ứng tuyển"});
    Salary salary = parseSalary(text);
    return new ImportedJobData(title, company, firstNonBlank(description, trim(text, 4000)), requirements, benefits, "", salary.min(), salary.max(), inferExperience(text), null, parseSkillsFromText(text), text, inferJobType(text), inferWorkMode(text));
  }

  private void validateImportedJobData(ImportedJobData data) {
    if (data == null || data.title() == null || data.title().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not detect job title from this URL.");
    }
    if ((data.description() == null || data.description().isBlank()) && (data.requirements() == null || data.requirements().isBlank())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not detect JD content from this URL.");
    }
  }

  private String safeBodyText(Page page) {
    try {
      return page.locator("body").innerText(new Locator.InnerTextOptions().setTimeout(5000)).trim();
    } catch (PlaywrightException exception) {
      return "";
    }
  }

  private boolean waitForCloudflareChallengeToClear(Page page) {
    long deadline = System.currentTimeMillis() + (long) playwrightTimeoutMs;
    while (System.currentTimeMillis() < deadline) {
      try {
        Thread.sleep(2000);
      } catch (InterruptedException exception) {
        Thread.currentThread().interrupt();
        return false;
      }
      String raw = safeBodyText(page);
      String html = page.content();
      if (!isCloudflareBlock(page.title(), raw, html)) {
        try {
          page.waitForLoadState(LoadState.DOMCONTENTLOADED, new Page.WaitForLoadStateOptions().setTimeout(3000));
        } catch (PlaywrightException ignored) {
          // Page can already be ready after the challenge redirects.
        }
        return true;
      }
    }
    return false;
  }

  private boolean isHardCloudflareBlock(String text, String html) {
    String combined = ((text == null ? "" : text) + "\n" + (html == null ? "" : html)).toLowerCase(Locale.ROOT);
    return combined.contains("sorry, you have been blocked") || combined.contains("you are unable to access topcv.vn");
  }

  private String textFirst(Page page, String... selectors) {
    for (String selector : selectors) {
      try {
        Locator locator = page.locator(selector).first();
        if (locator.count() > 0) {
          String text = locator.innerText(new Locator.InnerTextOptions().setTimeout(1000)).trim();
          if (!text.isBlank()) {
            return text;
          }
        }
      } catch (PlaywrightException ignored) {
        // Try the next selector.
      }
    }
    return "";
  }

  private String topCvCompanyFromJsonLd(String html) {
    Matcher matcher = Pattern.compile("\"hiringOrganization\"\\s*:\\s*\\{.*?\"name\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"", Pattern.DOTALL).matcher(html == null ? "" : html);
    if (matcher.find()) {
      return decodeJsonString(matcher.group(1)).trim();
    }
    return "";
  }

  private String topCvCompanyFromMeta(Page page) {
    String ogTitle = attributeFirst(page, "meta[property='og:title']", "content");
    Matcher titleMatcher = Pattern.compile("(?:tại|at)\\s+(.+?)(?:\\s*[-|]|$)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher(ogTitle == null ? "" : ogTitle);
    if (titleMatcher.find()) {
      return titleMatcher.group(1).trim().replaceAll("\\.$", "");
    }
    String ogDescription = attributeFirst(page, "meta[property='og:description']", "content");
    Matcher descMatcher = Pattern.compile("Công ty\\s+(.+?)\\s+tuyển", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher(ogDescription == null ? "" : ogDescription);
    return descMatcher.find() ? descMatcher.group(1).trim() : "";
  }

  private String topCvSectionText(Page page, String wantedHeadingKey) {
    try {
      Locator items = page.locator("div.job-description__item");
      int count = items.count();
      for (int i = 0; i < count; i++) {
        Locator item = items.nth(i);
        String heading = item.locator("h3").first().innerText(new Locator.InnerTextOptions().setTimeout(1000)).trim();
        if (!headingKey(heading).contains(wantedHeadingKey)) {
          continue;
        }
        Locator content = item.locator(".job-description__item--content").first();
        if (content.count() == 0) {
          continue;
        }
        String text = content.innerText(new Locator.InnerTextOptions().setTimeout(1500)).trim();
        if (!text.isBlank()) {
          return cleanupSectionText(text);
        }
      }
    } catch (PlaywrightException ignored) {
      // Fallback selectors below.
    }

    String fallbackSelector = switch (wantedHeadingKey) {
      case "yeu cau" -> ".job-detail-section.requirement .job-description__item--content";
      case "quyen loi" -> ".job-detail-section.benefit .job-description__item--content";
      default -> "div.job-description__item:not(.requirement):not(.benefit) .job-description__item--content";
    };
    return textFirst(page, fallbackSelector);
  }

  private String topCvInfoValue(Page page, String wantedHeadingKey) {
    try {
      Locator sections = page.locator(".job-detail__info--section, .job-detail__info--section-content, .job-detail__info--item");
      int count = sections.count();
      for (int i = 0; i < count; i++) {
        Locator section = sections.nth(i);
        String fullText = section.innerText(new Locator.InnerTextOptions().setTimeout(1000)).trim();
        if (!headingKey(fullText).contains(wantedHeadingKey)) {
          continue;
        }
        for (String selector : List.of(".job-detail__info--section-content-value", ".value", "a")) {
          String value = textFirst(section, selector);
          if (!value.isBlank() && !headingKey(value).contains(wantedHeadingKey)) {
            return value;
          }
        }
        return fullText.lines().map(String::trim).filter(line -> !line.isBlank() && !headingKey(line).contains(wantedHeadingKey)).findFirst().orElse("");
      }
    } catch (PlaywrightException ignored) {
      // Optional TopCV metadata block.
    }
    return "";
  }

  private void addTopCvSpecializationTags(Page page, Set<String> skills) {
    try {
      Locator groups = page.locator("div.job-tags__group");
      for (int i = 0; i < groups.count(); i++) {
        Locator group = groups.nth(i);
        String groupName = textFirst(group, ".job-tags__group-name");
        if (!headingKey(groupName).contains("chuyen mon")) {
          continue;
        }
        for (String tag : group.locator(".item").allInnerTexts()) {
          addSkill(skills, tag);
        }
      }
    } catch (PlaywrightException ignored) {
      // Tags are optional.
    }
  }

  private String headingKey(String text) {
    String normalized = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replace('đ', 'd').replaceAll("\\s+", " ").trim();
    return normalized;
  }

  private String textFirst(Locator root, String selector) {
    try {
      Locator locator = root.locator(selector).first();
      if (locator.count() == 0) {
        return "";
      }
      return locator.innerText(new Locator.InnerTextOptions().setTimeout(1000)).trim();
    } catch (PlaywrightException ignored) {
      return "";
    }
  }

  private String attributeFirst(Page page, String selector, String attribute) {
    try {
      Locator locator = page.locator(selector).first();
      if (locator.count() == 0) {
        return "";
      }
      String value = locator.getAttribute(attribute, new Locator.GetAttributeOptions().setTimeout(1000));
      return value == null ? "" : value.trim();
    } catch (PlaywrightException exception) {
      return "";
    }
  }

  private Set<String> parseSkills(Page page, String raw, String html) {
    Set<String> skills = new LinkedHashSet<>(parseSkillsFromText(raw));
    for (String selector : List.of("a[href*='ky-nang']", "a[href*='skill']", "a[href*='tag']", "[class*='skill']", "[class*='tag']")) {
      try {
        for (String text : page.locator(selector).allInnerTexts()) {
          addSkill(skills, text);
        }
      } catch (PlaywrightException ignored) {
        // Selector may not exist on the current site.
      }
    }
    Matcher matcher = Pattern.compile("\"skillName\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"").matcher(html == null ? "" : html);
    while (matcher.find()) {
      addSkill(skills, decodeJsonString(matcher.group(1)));
    }
    return skills;
  }

  private Set<String> parseSkillsFromText(String text) {
    Set<String> skills = new LinkedHashSet<>();
    String raw = text == null ? "" : text;
    for (String skill : COMMON_SKILLS) {
      if (containsSkill(raw, skill)) {
        addSkill(skills, skill);
      }
    }
    return skills;
  }

  private void addSkill(Set<String> skills, String value) {
    if (value == null) {
      return;
    }
    String normalized = value.replaceAll("\\s+", " ").trim();
    if (!normalized.isBlank() && normalized.length() <= 80 && !normalized.equalsIgnoreCase("kỹ năng")) {
      if (!isKnownSkill(normalized)) {
        return;
      }
      skills.add(normalized);
    }
  }

  private boolean isKnownSkill(String value) {
    String key = headingKey(value);
    return COMMON_SKILLS.stream().anyMatch(skill -> headingKey(skill).equals(key));
  }

  private boolean containsSkill(String text, String skill) {
    String raw = text == null ? "" : text;
    Pattern pattern = Pattern.compile("(?iu)(?<![\\p{L}\\p{N}_+#.])" + Pattern.quote(skill) + "(?![\\p{L}\\p{N}_+#.])");
    return pattern.matcher(raw).find();
  }

  private String sectionTextAny(String text, String[] startHeadings, String[] endHeadings) {
    String raw = text == null ? "" : text;
    String lower = raw.toLowerCase(Locale.ROOT);
    for (String startHeading : startHeadings) {
      int start = lower.indexOf(startHeading.toLowerCase(Locale.ROOT));
      if (start < 0) {
        continue;
      }
      int contentStart = start + startHeading.length();
      int end = -1;
      for (String endHeading : endHeadings) {
        int candidate = lower.indexOf(endHeading.toLowerCase(Locale.ROOT), contentStart);
        if (candidate >= 0 && (end < 0 || candidate < end)) {
          end = candidate;
        }
      }
      String result = end > contentStart ? raw.substring(contentStart, Math.min(end, raw.length())) : raw.substring(contentStart);
      result = cleanupSectionText(result);
      if (!result.isBlank()) {
        return result;
      }
    }
    return "";
  }

  private String cleanupSectionText(String text) {
    if (text == null) {
      return "";
    }
    return text.replaceAll("\\n{3,}", "\n\n").trim();
  }

  private Salary parseSalary(String text) {
    String raw = text == null ? "" : text.toLowerCase(Locale.ROOT);
    Matcher matcher = Pattern.compile("(\\d+)\\s*-\\s*(\\d+)\\s*(?:triệu|tr|m)").matcher(raw);
    if (matcher.find()) {
      return new Salary(Integer.parseInt(matcher.group(1)) * 1_000_000, Integer.parseInt(matcher.group(2)) * 1_000_000);
    }
    matcher = Pattern.compile("(?:upto|up to|đến|tới)\\s*(\\d+)\\s*(?:triệu|tr|m)").matcher(raw);
    if (matcher.find()) {
      return new Salary(null, Integer.parseInt(matcher.group(1)) * 1_000_000);
    }
    return new Salary(null, null);
  }

  private Salary salaryFromJson(String html) {
    Integer min = parseIntegerFieldAny(html, "salary_min", "salaryMin", "min_salary", "minSalary");
    Integer max = parseIntegerFieldAny(html, "salary_max", "salaryMax", "max_salary", "maxSalary");
    if ((min == null || min == 0) && (max == null || max == 0)) {
      return new Salary(null, null);
    }
    return new Salary(min == null || min == 0 ? null : normalizeSalaryAmount(min), max == null || max == 0 ? null : normalizeSalaryAmount(max));
  }

  private Integer normalizeSalaryAmount(Integer amount) {
    if (amount == null) {
      return null;
    }
    return amount < 1000 ? amount * 1_000_000 : amount;
  }

  private Integer parseIntegerFieldAny(String html, String... fieldNames) {
    for (String fieldName : fieldNames) {
      Matcher matcher = Pattern.compile("\"" + Pattern.quote(fieldName) + "\"\\s*:\\s*(\\d+)").matcher(html == null ? "" : html);
      if (matcher.find()) {
        return Integer.parseInt(matcher.group(1));
      }
    }
    return null;
  }

  private Salary firstSalary(Salary... salaries) {
    for (Salary salary : salaries) {
      if (salary != null && (salary.min() != null || salary.max() != null)) {
        return salary;
      }
    }
    return new Salary(null, null);
  }

  private LocalDateTime firstDate(LocalDateTime... dates) {
    for (LocalDateTime date : dates) {
      if (date != null) {
        return date;
      }
    }
    return null;
  }

  private LocalDateTime parseDate(String text) {
    String raw = text == null ? "" : text;
    Matcher matcher = Pattern.compile("(\\d{2}/\\d{2}/\\d{4})").matcher(raw);
    if (matcher.find()) {
      return LocalDate.parse(matcher.group(1), DateTimeFormatter.ofPattern("dd/MM/yyyy")).atTime(23, 59);
    }
    try {
      return OffsetDateTime.parse(raw.trim()).toLocalDateTime();
    } catch (Exception ignored) {
      return null;
    }
  }

  private String extractAfterLabel(String text, String startLabel, String endLabel) {
    String raw = text == null ? "" : text;
    String lower = raw.toLowerCase(Locale.ROOT);
    int start = lower.indexOf(startLabel.toLowerCase(Locale.ROOT));
    if (start < 0) {
      return "";
    }
    int end = lower.indexOf(endLabel.toLowerCase(Locale.ROOT), start + startLabel.length());
    String value = end > start ? raw.substring(start + startLabel.length(), Math.min(end, raw.length())) : raw.substring(start + startLabel.length());
    return value.trim();
  }

  private String extractCompanyFromText(String text) {
    Matcher matcher = Pattern.compile("(?i)(?:công ty|company)\\s+([\\p{L}\\p{N}\\s&.,'()\\-]{3,120})").matcher(text == null ? "" : text);
    return matcher.find() ? matcher.group(0).trim() : "";
  }

  private String extractExternalJobId(String url) {
    if (url == null) {
      return null;
    }
    Matcher matcher = Pattern.compile("j(\\d+)\\.html").matcher(url);
    if (matcher.find()) {
      return matcher.group(1);
    }
    matcher = Pattern.compile("/(\\d+)\\.html(?:\\?|$)").matcher(url);
    if (matcher.find()) {
      return matcher.group(1);
    }
    matcher = Pattern.compile("-(\\d+)-jv").matcher(url);
    return matcher.find() ? matcher.group(1) : null;
  }

  private String resolveSourcePlatform(String sourceUrl, String sourceType) {
    if (sourceUrl == null) {
      return sourceType;
    }
    if (sourceUrl.contains("topcv.vn")) {
      return "TOPCV";
    }
    return sourceType;
  }

  private String normalizeUrl(String url) {
    if (url == null || url.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "URL is required.");
    }
    String trimmed = url.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      trimmed = "https://" + trimmed;
    }
    return trimmed;
  }

  private void validateAllowedJobUrl(String url) {
    try {
      URI uri = new URI(url);
      String scheme = uri.getScheme();
      String host = uri.getHost();
      if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only HTTP/HTTPS JD URLs are supported.");
      }
      if (host == null || !isAllowedJobHost(host)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Currently only TopCV JD URLs are supported.");
      }
    } catch (URISyntaxException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid URL.");
    }
  }

  private boolean isAllowedJobHost(String host) {
    String normalizedHost = host == null ? "" : host.toLowerCase(Locale.ROOT);
    return isDomainOrSubdomain(normalizedHost, "topcv.vn");
  }

  private boolean isDomainOrSubdomain(String host, String domain) {
    return host.equals(domain) || host.endsWith("." + domain);
  }

  private boolean isCloudflareBlock(String title, String text, String html) {
    String normalizedTitle = title == null ? "" : title.toLowerCase(Locale.ROOT);
    String normalizedText = text == null ? "" : text.toLowerCase(Locale.ROOT);
    String normalizedHtml = html == null ? "" : html.toLowerCase(Locale.ROOT);
    return normalizedTitle.contains("attention required") || normalizedTitle.contains("just a moment") || isHardCloudflareBlock(normalizedText, normalizedHtml) || normalizedText.contains("checking if the site connection is secure") || normalizedHtml.contains("cf-browser-verification");
  }

  private String canonicalizeJobUrl(String url) {
    try {
      URI uri = new URI(url);
      String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
      String path = uri.getPath() == null || uri.getPath().isBlank() ? "/" : uri.getPath();
      if (path.length() > 1 && path.endsWith("/")) {
        path = path.substring(0, path.length() - 1);
      }
      return new URI(
              uri.getScheme().toLowerCase(Locale.ROOT), null, host, -1, path, null, null).toString();
    } catch (URISyntaxException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid URL.", exception);
    }
  }

  private String uniqueSlug(String name) {
    String base = name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9\\s-]", "").replaceAll("\\s+", "-").replaceAll("(^-|-$)", "");
    if (base.isBlank()) {
      base = "imported-company";
    }
    return base + "-" + System.currentTimeMillis();
  }

  private String extractDomain(String url) {
    return url.replaceFirst("^https?://", "").split("/")[0];
  }

  private String firstLine(String text) {
    if (text == null || text.isBlank()) {
      return "";
    }
    return text.lines().map(String::trim).filter(line -> !line.isBlank()).findFirst().orElse("");
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value.trim();
      }
    }
    return "";
  }

  private String blankToDefault(String value, String defaultValue) {
    return value == null || value.isBlank() ? defaultValue : value.trim();
  }

  private String trim(String text, int maxChars) {
    if (text == null) {
      return "";
    }
    return text.length() <= maxChars ? text : text.substring(0, maxChars);
  }

  private String cleanJobTitle(String title) {
    if (title == null) {
      return "";
    }
    return title.replaceFirst("(?i)\\s*[|-]\\s*TopCV.*$", "").replaceFirst("(?i)\\s*[|-]\\s*VietnamWorks.*$", "").replaceFirst("(?i)^Tuyển\\s+", "").trim();
  }

  private String cleanCompanyName(String companyName) {
    if (companyName == null) {
      return "";
    }
    return companyName.replaceAll("\\s+", " ").trim();
  }

  private String htmlTextFromJsonAny(String html, String... fieldNames) {
    String value = extractJsonStringAny(html, fieldNames);
    return value.isBlank() ? "" : stripHtml(value).trim();
  }

  private String extractJsonStringAny(String html, String... fieldNames) {
    for (String fieldName : fieldNames) {
      Matcher matcher = Pattern.compile("\"" + Pattern.quote(fieldName) + "\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"").matcher(html == null ? "" : html);
      if (matcher.find()) {
        String value = decodeJsonString(matcher.group(1));
        if (!value.isBlank()) {
          return value;
        }
      }
    }
    return "";
  }

  private String stripHtml(String value) {
    if (value == null) {
      return "";
    }
    return value.replaceAll("<[^>]+>", " ").replace("&nbsp;", " ").replace("&amp;", "&").replaceAll("\\s+", " ").trim();
  }

  private String decodeJsonString(String escapedValue) {
    if (escapedValue == null || escapedValue.isBlank()) {
      return "";
    }
    try {
      return objectMapper.readValue("\"" + escapedValue.replace("\"", "\\\"") + "\"", String.class);
    } catch (Exception ignored) {
      return escapedValue.replace("\\u003c", "<").replace("\\u003e", ">").replace("\\u0026", "&").replace("\\/", "/");
    }
  }

  private String inferExperience(String text) {
    String lower = text == null ? "" : text.toLowerCase(Locale.ROOT);
    if (lower.contains("không yêu cầu") || lower.contains("fresher")) {
      return "FRESHER";
    }
    if (lower.contains("intern") || lower.contains("thực tập")) {
      return "INTERN";
    }
    if (lower.contains("senior") || lower.contains("trên 5 năm")) {
      return "SENIOR";
    }
    if (lower.contains("lead") || lower.contains("trưởng nhóm")) {
      return "LEAD";
    }
    if (lower.contains("3 năm") || lower.contains("4 năm") || lower.contains("5 năm")) {
      return "MIDDLE";
    }
    return "JUNIOR";
  }

  private String normalizeExperienceLabel(String experience) {
    String lower = experience == null ? "" : experience.toLowerCase(Locale.ROOT);
    if (lower.isBlank()) {
      return "";
    }
    if (lower.contains("không yêu cầu") || lower.contains("fresher")) {
      return "FRESHER";
    }
    if (lower.contains("intern") || lower.contains("thực tập")) {
      return "INTERN";
    }
    if (lower.contains("senior") || lower.contains("trên 5")) {
      return "SENIOR";
    }
    if (lower.contains("lead") || lower.contains("trưởng")) {
      return "LEAD";
    }
    if (lower.contains("3") || lower.contains("4") || lower.contains("5")) {
      return "MIDDLE";
    }
    return "JUNIOR";
  }

  private JobType inferJobType(String text) {
    String lower = text == null ? "" : text.toLowerCase(Locale.ROOT);
    if (lower.contains("part-time") || lower.contains("bán thời gian")) {
      return JobType.PART_TIME;
    }
    if (lower.contains("internship") || lower.contains("thực tập")) {
      return JobType.INTERNSHIP;
    }
    if (lower.contains("contract") || lower.contains("hợp đồng")) {
      return JobType.CONTRACT;
    }
    return JobType.FULL_TIME;
  }

  private String normalizeExperienceLabelStrict(String experience) {
    String key = headingKey(experience);
    if (key.isBlank()) {
      return "";
    }
    if (key.contains("khong yeu cau") || key.contains("fresher")) {
      return "FRESHER";
    }
    if (key.contains("intern") || key.contains("thuc tap")) {
      return "INTERN";
    }
    if (key.contains("senior") || key.contains("tren 5")) {
      return "SENIOR";
    }
    if (key.contains("lead") || key.contains("truong")) {
      return "LEAD";
    }
    if (key.contains("3") || key.contains("4") || key.contains("5")) {
      return "MIDDLE";
    }
    return "JUNIOR";
  }

  private JobType parseJobTypeLabel(String text) {
    if (text == null || text.isBlank()) {
      return null;
    }
    String key = headingKey(text);
    if (key.contains("part-time") || key.contains("part time") || key.contains("ban thoi gian")) {
      return JobType.PART_TIME;
    }
    if (key.contains("internship") || key.contains("thuc tap")) {
      return JobType.INTERNSHIP;
    }
    if (key.contains("contract") || key.contains("hop dong")) {
      return JobType.CONTRACT;
    }
    if (key.contains("full-time") || key.contains("full time") || key.contains("toan thoi gian")) {
      return JobType.FULL_TIME;
    }
    return null;
  }

  private <T> T firstNonNull(T first, T second) {
    return first != null ? first : second;
  }

  private WorkMode inferWorkMode(String text) {
    String lower = text == null ? "" : text.toLowerCase(Locale.ROOT);
    if (lower.contains("hybrid")) {
      return WorkMode.HYBRID;
    }
    if (lower.contains("remote") || lower.contains("từ xa")) {
      return WorkMode.REMOTE;
    }
    return WorkMode.ON_SITE;
  }

  private record Salary(Integer min, Integer max) {
  }

  private record BrowserLaunchAttempt(List<String> args, boolean warmUpTopCv) {
  }

  private record ImportedJobData(
                                 String title,
                                 String companyName,
                                 String description,
                                 String requirements,
                                 String responsibilities,
                                 String location,
                                 Integer salaryMin,
                                 Integer salaryMax,
                                 String experienceLevel,
                                 LocalDateTime deadline,
                                 Set<String> skills,
                                 String rawText,
                                 JobType jobType,
                                 WorkMode workMode) {
  }
}
