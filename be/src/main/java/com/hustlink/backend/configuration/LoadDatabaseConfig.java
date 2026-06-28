package com.hustlink.backend.configuration;

import com.hustlink.backend.features.authentication.model.UserRole;
import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.repository.UserRepository;
import com.hustlink.backend.features.authentication.utils.Encoder;
import com.hustlink.backend.features.feed.model.Post;
import com.hustlink.backend.features.feed.repository.PostRepository;
import com.hustlink.backend.features.networking.model.Connection;
import com.hustlink.backend.features.networking.model.Status;
import com.hustlink.backend.features.networking.repository.ConnectionRepository;
import com.hustlink.backend.features.companies.model.Company;
import com.hustlink.backend.features.companies.model.CompanyMember;
import com.hustlink.backend.features.companies.model.CompanyRole;
import com.hustlink.backend.features.companies.model.CompanyStatus;
import com.hustlink.backend.features.companies.repository.CompanyMemberRepository;
import com.hustlink.backend.features.companies.repository.CompanyRepository;
import com.hustlink.backend.features.jobs.model.*;
import com.hustlink.backend.features.jobs.repository.JobApplicationRepository;
import com.hustlink.backend.features.jobs.repository.JobRepository;
import com.hustlink.backend.features.events.model.*;
import com.hustlink.backend.features.events.repository.EventRepository;
import com.hustlink.backend.features.events.repository.EventRsvpRepository;
import com.hustlink.backend.features.ai.model.CV;
import com.hustlink.backend.features.ai.repository.CVRepository;
import com.hustlink.backend.features.storage.model.StoredObject;
import com.hustlink.backend.features.storage.repository.StoredObjectRepository;

import java.time.LocalDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class LoadDatabaseConfig {
  private static final int NUM_USERS = 50;
  private static final int MIN_POSTS_PER_USER = 5;
  private static final int MAX_POSTS_PER_USER = 30;
  private static final int MIN_CONNECTIONS_PER_USER = 2;
  private static final int MAX_CONNECTIONS_PER_USER = 10;
  private final Encoder encoder;
  private final Random random = new Random();

  private static final List<String> MOCK_ABOUTS = Arrays.asList(
          "Passionate software developer with a strong focus on building scalable web applications.", "Data scientist interested in machine learning, statistics, and data visualization.", "Product manager dedicated to designing products that users love and driving business growth.", "DevOps professional aiming to automate everything and streamline development lifecycles.", "Experienced HR specialist committed to cultivating positive workplace cultures.", "Creative frontend developer skilled in building responsive and interactive user interfaces.", "Dedicated backend engineer specialized in high-performance APIs and database tuning.", "Machine learning enthusiast focused on natural language processing and computer vision.", "Cloud architect with deep expertise in AWS, Kubernetes, and serverless architectures.", "Experienced system administrator passionate about network security and server performance.", "Database expert focused on query optimization and reliable database replication.", "Cybersecurity professional dedicated to secure coding practices and penetration testing.", "Detail-oriented QA engineer focused on automation testing and continuous integration.", "Technical leader who loves mentoring junior developers and architecting solid systems.", "Engineering manager focused on building collaborative teams and delivering quality software.", "Tech executive with a proven track record of scaling engineering organizations from scratch.", "Solutions architect skilled in translating business needs into reliable technical designs.", "Project manager with a passion for Agile methodologies and on-time project delivery.", "Experienced developer who loves open-source contributions and community building.", "Enthusiastic tech learner interested in compiler design and low-level programming."
  );

  private static final List<String> MOCK_EXPERIENCES = Arrays.asList(
          "Designed and implemented high-throughput REST APIs using Spring Boot and PostgreSQL.", "Conducted data analysis and trained deep learning models on large datasets using TensorFlow.", "Managed product roadmaps and coordinated cross-functional teams to launch 3 successful products.", "Built automated CI/CD pipelines using GitHub Actions, Docker, and Kubernetes on AWS.", "Managed full-cycle recruitment and onboarded over 50 new hires in a fast-paced environment.", "Developed responsive web applications with React, Redux, and Tailwind CSS.", "Optimized query performance and managed database migrations for millions of records.", "Implemented OAuth2 authentication and end-to-end security audits for financial software.", "Wrote automation test scripts using Selenium and JUnit, increasing test coverage by 40%.", "Led a team of 5 developers to rewrite a legacy microservice architecture.", "Designed and deployed multi-region cloud infrastructures with high availability.", "Configured secure firewalls and monitored intrusion detection systems for enterprise networks.", "Automated infrastructure provisioning using Terraform and Ansible.", "Developed native mobile applications for iOS and Android using React Native.", "Collaborated with UX designers to implement pixel-perfect user flows.", "Analyzed application performance bottlenecks and reduced API latency by 30%.", "Created training materials for agile best practices and Scrum implementation.", "Contributed to core open-source libraries and presented technical talks at conferences.", "Developed real-time chat systems using WebSockets and Redis Pub/Sub.", "Built and maintained internal developer tools to improve developer productivity."
  );

  private static final List<String> MOCK_DEGREES = Arrays.asList(
          "B.S. in Computer Science", "M.S. in Information Technology", "B.E. in Software Engineering", "B.S. in Data Science", "Bachelor of Computer Engineering", "B.S. in Cybersecurity", "B.E. in Telecommunication Engineering", "B.E. in Electronics", "Bachelor of Information Systems", "Master of Computer Science", "Bachelor of Science in Applied Mathematics"
  );

  private static final List<String> MOCK_SCHOOLS = Arrays.asList(
          "Hanoi University of Science and Technology (HUST)", "BK Holdings", "VNU University of Science", "Vietnam National University", "Posts and Telecommunications Institute of Technology", "National Economics University", "Foreign Trade University", "University of Engineering and Technology (VNU-UET)", "Da Nang University of Technology", "Ho Chi Minh City University of Technology"
  );

  private final CompanyRepository companyRepository;
  private final CompanyMemberRepository companyMemberRepository;
  private final JobRepository jobRepository;
  private final JobApplicationRepository jobApplicationRepository;
  private final EventRepository eventRepository;
  private final EventRsvpRepository eventRsvpRepository;
  private final CVRepository cvRepository;
  private final StoredObjectRepository storedObjectRepository;

  @Bean
  public CommandLineRunner initDatabase(UserRepository userRepository, PostRepository postRepository, ConnectionRepository connectionRepository) {
    return args -> {
      if (userRepository.count() > 0) {
        return;
      }

      List<User> users = createUsers(userRepository);
      createConnections(connectionRepository, users);
      createPosts(postRepository, users);
      List<Company> activeCompanies = createMockRecruitersAndCompanies(userRepository, users);
      List<Job> jobs = createMockJobs(userRepository, activeCompanies);
      List<CV> cvs = createMockCVs(users);
      createMockApplications(jobs, cvs);
      createMockEvents(userRepository, activeCompanies, users);
    };
  }

  private List<User> createUsers(UserRepository userRepository) {
    List<String> firstNames = Arrays.asList("An", "Anh", "Bao", "Chi", "Dung", "Giang", "Ha", "Hai", "Hieu", "Hoa", "Hung", "Khanh", "Lan", "Linh", "Long", "Mai", "Minh", "My", "Nam", "Ngoc", "Nhu", "Phong", "Phuc", "Quan", "Quang", "Son", "Thao", "Thanh", "Thanh", "Thao", "Thang", "Thu", "Thu", "Trang", "Trinh", "Trung", "Tu", "Tuan", "Tuyet", "Viet", "Vy", "Yen", "Kim", "Ngan", "Loc", "Tien", "Khoa", "Diem", "Kiet", "Tam");
    List<String> lastNames = Arrays.asList("Nguyen", "Tran", "Le", "Pham", "Hoang", "Huynh", "Phan", "Vu", "Vo", "Dang", "Bui", "Do", "Ho", "Ngo", "Duong", "Ly", "Thai", "Mai", "Ta", "To", "Cao", "Chu", "La", "Lam", "Quach", "Dinh", "Trinh", "Ha", "Tang", "Trieu", "Vuong", "Kieu", "Thach", "Doan", "Chau", "Luu", "Giap", "Truong", "Phung", "Quan", "Tong", "Ngoc", "Hua", "Son", "Ta", "Tu", "Vi", "Ninh", "Dam", "Phuc");

    List<String> companies = Arrays.asList("Google", "Microsoft", "Apple", "Amazon", "Meta", "Netflix", "Tesla", "Adobe", "X", "LinkedIn", "Spotify", "Uber", "Airbnb", "Salesforce", "Oracle", "IBM", "Intel", "Samsung", "Sony", "Docker", "Zoom", "Slack", "GitHub", "GitLab", "Redis", "MongoDB", "Orange", "Thales", "Capgemini", "Facebook", "EDF", "Algolia", "Zoho", "PayPal", "Paytm", "BnpParibas", "Fuji", "Canon", "Taiwan", "Yahoo", "Yelp", "Tencent", "Alibaba", "Tata", "Nvidia");

    List<String> positions = Arrays.asList("Software Engineer", "Data Scientist", "Product Manager", "DevOps Engineer", "HR Manager", "Full Stack Developer", "Frontend Developer", "Backend Developer", "Machine Learning Engineer", "Cloud Architect", "System Administrator", "Database Administrator", "Security Engineer", "QA Engineer", "Technical Lead", "Engineering Manager", "CTO", "VP of Engineering", "Solutions Architect", "Technical Project Manager");

    List<String> locations = Arrays.asList("San Francisco, US", "New York, US", "Seattle, US", "Boston, US", "Austin, US", "London, UK", "Berlin, DE", "Paris, FR", "Amsterdam, NL", "Stockholm, SE", "Tokyo, JP", "Singapore, SG", "Sydney, AU", "Toronto, CA", "Vancouver, CA", "Dubai, AE", "Dakar, SN", "Hanoi, Vietnam", "Seoul, KR", "Dienbien, Vietnam", "Mumbai, IN", "Shanghai, CN", "São Paulo, BR", "Mexico City, MX", "Dublin, IE");

    List<User> users = new ArrayList<>();
    for (int i = 0; i < NUM_USERS; i++) {
      String firstName = firstNames.get(random.nextInt(firstNames.size()));
      String lastName = lastNames.get(random.nextInt(lastNames.size()));
      String email = firstName.toLowerCase() + "." + lastName.toLowerCase() + i + "@gmail.com";
      String position = positions.get(random.nextInt(positions.size()));
      String company = companies.get(random.nextInt(companies.size()));
      String location = locations.get(random.nextInt(locations.size()));

      users.add(createUser(email, "12345678", firstName, lastName, position, company, location, null));
    }

    users.addAll(List.of(
            createUser("khai@gmail.com", "12345678", "Khai", "Le", positions.get(random.nextInt(positions.size())), companies.get(random.nextInt(companies.size())), locations.get(random.nextInt(locations.size())), null), createUser("hieu@gmail.com", "12345678", "Hieu", "Le", positions.get(random.nextInt(positions.size())), companies.get(random.nextInt(companies.size())), locations.get(random.nextInt(locations.size())), null), createUser("huy@gmail.com", "12345678", "Huy", "Nguyen", positions.get(random.nextInt(positions.size())), companies.get(random.nextInt(companies.size())), locations.get(random.nextInt(locations.size())), null)));

    return userRepository.saveAll(users);
  }

  private void createConnections(ConnectionRepository connectionRepository, List<User> users) {
    for (User user : users) {
      int numConnections = random.nextInt(MAX_CONNECTIONS_PER_USER - MIN_CONNECTIONS_PER_USER + 1) + MIN_CONNECTIONS_PER_USER;
      Set<User> userConnections = new HashSet<>();

      while (userConnections.size() < numConnections) {
        User recipient = users.get(random.nextInt(users.size()));
        if (!recipient.equals(user) && !userConnections.contains(recipient)) {
          userConnections.add(recipient);
          Connection connection = new Connection(user, recipient);
          connection.setStatus(Status.ACCEPTED);
          connectionRepository.save(connection);
        }
      }
    }
  }

  private void createPosts(PostRepository postRepository, List<User> users) {
    List<String> postTemplates = Arrays.asList("Excited to share that %s just launched a new feature!", "Great discussion about %s at today's team meeting.", "Looking forward to the upcoming %s conference!", "Just completed a certification in %s. Always learning!", "Proud to announce that our team at %s achieved a major milestone.", "Interesting article about the future of %s in tech.", "Sharing my thoughts on the latest developments in %s.", "Amazing workshop on %s today!", "Big announcement: We're hiring %s experts at %s!", "Reflecting on my journey as a %s at %s.", "Here's what I learned about %s this week.", "Exciting times ahead for %s technology!", "Just published an article about %s best practices.", "Grateful for the amazing %s team at %s.", "Innovation in %s is moving faster than ever!");

    List<String> topics = Arrays.asList("AI", "Machine Learning", "Cloud Computing", "DevOps", "Blockchain", "Cybersecurity", "Data Science", "IoT", "5G", "Quantum Computing", "AR/VR", "Digital Transformation", "Agile Development", "Remote Work", "Tech Leadership");

    for (User user : users) {
      int numPosts = random.nextInt(MAX_POSTS_PER_USER - MIN_POSTS_PER_USER + 1) + MIN_POSTS_PER_USER;

      for (int i = 0; i < numPosts; i++) {
        String template = postTemplates.get(random.nextInt(postTemplates.size()));
        String topic = topics.get(random.nextInt(topics.size()));
        String content = String.format(template, topic, user.getCompany());

        Post post = new Post(content, user);
        post.setLikes(generateLikes(users, random));

        postRepository.save(post);
      }
    }
  }

  private HashSet<User> generateLikes(List<User> users, Random random) {
    HashSet<User> likes = new HashSet<>();
    int maxLikes = Math.min(50, users.size() / 5); // Maximum 50 likes or 20% of users
    int likesCount = random.nextInt(maxLikes);

    while (likes.size() < likesCount) {
      likes.add(users.get(random.nextInt(users.size())));
    }
    return likes;
  }

  private String generateMockExperienceJson(String role, String company) {
    int startYear = 2020 + random.nextInt(3); // 2020 to 2022
    int startMonth = 1 + random.nextInt(12);
    boolean isPresent = random.nextBoolean();

    StringBuilder sb = new StringBuilder();
    sb.append("[{");
    sb.append("\"role\":\"").append(role).append("\",");
    sb.append("\"company\":\"").append(company).append("\",");
    sb.append("\"employmentType\":\"Full-time\",");
    sb.append("\"startYear\":").append(startYear).append(",");
    sb.append("\"startMonth\":").append(startMonth).append(",");

    if (isPresent) {
      sb.append("\"isPresent\":true,");
    } else {
      int endYear = startYear + 1 + random.nextInt(2); // 1 to 2 years later
      int endMonth = 1 + random.nextInt(12);
      sb.append("\"isPresent\":false,");
      sb.append("\"endYear\":").append(endYear).append(",");
      sb.append("\"endMonth\":").append(endMonth).append(",");
    }

    String description = MOCK_EXPERIENCES.get(random.nextInt(MOCK_EXPERIENCES.size()));
    sb.append("\"description\":\"").append(description).append("\"");
    sb.append("}]");
    return sb.toString();
  }

  private String generateMockEducationJson(String degree, String school) {
    int startYear = 2016 + random.nextInt(4); // 2016 to 2019
    int startMonth = 9;
    int endYear = startYear + 4;
    int endMonth = 6;

    return "[{" + "\"degree\":\"" + degree + "\"," + "\"school\":\"" + school + "\"," + "\"startYear\":" + startYear + "," + "\"startMonth\":" + startMonth + "," + "\"endYear\":" + endYear + "," + "\"endMonth\":" + endMonth + "}]";
  }

  private User createUser(String email, String password, String firstName, String lastName, String position, String company, String location, String profilePicture) {
    User user = new User(email, encoder.encode(password));
    user.setEmailVerified(true);
    user.setFirstName(firstName);
    user.setLastName(lastName);
    user.setPosition(position);
    user.setCompany(company);
    user.setLocationDisplay(location);
    user.setLocationKey(location.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", ""));
    if (profilePicture == null || profilePicture.isEmpty()) {
      String[] styles = {"avataaars", "lorelei", "adventurer", "fun-emoji", "big-smile", "notionists"};
      int styleIndex = (email.hashCode() & Integer.MAX_VALUE) % styles.length;
      profilePicture = "https://api.dicebear.com/10.x/" + styles[styleIndex] + "/svg?seed=" + email;
    }
    user.setProfilePicture(profilePicture);
    user.setAbout(MOCK_ABOUTS.get(random.nextInt(MOCK_ABOUTS.size())));
    user.setExperience(generateMockExperienceJson(position, company));

    String eduDegree = MOCK_DEGREES.get(random.nextInt(MOCK_DEGREES.size()));
    String eduSchool = MOCK_SCHOOLS.get(random.nextInt(MOCK_SCHOOLS.size()));
    user.setEducation(generateMockEducationJson(eduDegree, eduSchool));

    user.setRole(UserRole.USER);
    return user;
  }

  private List<Company> createMockRecruitersAndCompanies(UserRepository userRepository, List<User> users) {
    List<String> companyNames = Arrays.asList(
            "FPT Software", "Viettel Group", "VNG Corporation", "Rikkeisoft", "OneMount Group", "VinGroup", "Shopee Vietnam", "Grab Vietnam", "NashTech", "Bosch Vietnam"
    );

    List<String> companyLogos = Arrays.asList(
            "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150", "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/VNG_Corp._logo.svg/1280px-VNG_Corp._logo.svg.png", "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150", "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=150", "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=150", "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150", "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=150", "https://images.unsplash.com/photo-1497366216548-37526070297c?w=150", "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150"
    );

    List<Company> activeCompanies = new ArrayList<>();

    // 1. Tạo 10 Công ty ACTIVE
    for (int i = 0; i < companyNames.size(); i++) {
      String name = companyNames.get(i);
      String slug = name.toLowerCase().replaceAll("[^a-z0-9]+", "-");

      Company company = Company.builder().name(name).slug(slug).description("Chào mừng đến với " + name + ", một trong những tập đoàn công nghệ hàng đầu hoạt động tại Việt Nam. Chúng tôi cam kết mang lại giải pháp công nghệ tiên tiến nhất.").website("https://www." + slug + ".com.vn").industry("Information Technology").size("1000-5000").headquarters("Hanoi, Vietnam").logoUrl(companyLogos.get(i)).coverUrl("https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800").status(CompanyStatus.ACTIVE).build();

      Company saved = companyRepository.save(company);
      activeCompanies.add(saved);

      // Cập nhật ngẫu nhiên 1 user làm RECRUITER và OWNER của công ty này
      User recruiter = users.get(i);
      recruiter.setRole(UserRole.RECRUITER);
      recruiter.setCompany(name);
      userRepository.save(recruiter);

      CompanyMember member = CompanyMember.builder().company(saved).user(recruiter).role(CompanyRole.OWNER).build();
      companyMemberRepository.save(member);
    }

    // 2. Tạo 3 Công ty PENDING chờ duyệt
    List<String> pendingNames = Arrays.asList("HUST Tech Start", "BK Holdings", "SoICT Innovation Lab");
    for (int i = 0; i < pendingNames.size(); i++) {
      String name = pendingNames.get(i);
      String slug = name.toLowerCase().replaceAll("[^a-z0-9]+", "-");

      Company company = Company.builder().name(name).slug(slug).description("Dự án nghiên cứu khởi nghiệp công nghệ trực thuộc trường Đại học Bách Khoa Hà Nội.").website("https://www." + slug + ".hust.edu.vn").industry("Education & Research").size("10-50").headquarters("Tạ Quang Bửu, HUST, Hanoi").status(CompanyStatus.PENDING).build();

      Company saved = companyRepository.save(company);

      // Gán Owner là user thường (giữ nguyên role USER cho đến khi Admin duyệt)
      User owner = users.get(companyNames.size() + i);
      CompanyMember member = CompanyMember.builder().company(saved).user(owner).role(CompanyRole.OWNER).build();
      companyMemberRepository.save(member);
    }

    return activeCompanies;
  }

  private List<Job> createMockJobs(UserRepository userRepository, List<Company> companies) {
    List<String> jobTitles = Arrays.asList(
            "Java Backend Developer", "React Frontend Engineer", "DevOps Cloud Architect", "Python Machine Learning Engineer", "QA Automation Engineer", "Data Analyst", "Full Stack Web Developer", "Product Manager", "Mobile React Native Engineer"
    );

    List<Set<String>> jobSkills = Arrays.asList(
            new HashSet<>(Arrays.asList("Java", "Spring Boot", "SQL", "Hibernate")), new HashSet<>(Arrays.asList("JavaScript", "React", "HTML", "CSS", "TypeScript")), new HashSet<>(Arrays.asList("Docker", "Kubernetes", "AWS", "CI/CD", "Linux")), new HashSet<>(Arrays.asList("Python", "Machine Learning", "PyTorch", "NLP", "SQL")), new HashSet<>(Arrays.asList("Selenium", "Java", "TestNG", "Jenkins")), new HashSet<>(Arrays.asList("SQL", "Python", "Tableau", "PowerBI", "Excel")), new HashSet<>(Arrays.asList("JavaScript", "Node.js", "React", "MongoDB", "Express")), new HashSet<>(Arrays.asList("Agile", "Jira", "Product Roadmap", "Scrum")), new HashSet<>(Arrays.asList("React Native", "JavaScript", "iOS", "Android", "Redux"))
    );

    List<Job> jobs = new ArrayList<>();

    // Sinh khoảng 25 Job ngẫu nhiên cho các công ty hoạt động
    for (int i = 0; i < 25; i++) {
      Company company = companies.get(random.nextInt(companies.size()));
      int index = random.nextInt(jobTitles.size());
      String title = jobTitles.get(index);
      Set<String> skills = jobSkills.get(index);

      // Tìm recruiter tương ứng của công ty
      User recruiter = companyMemberRepository.findByCompanyId(company.getId()).stream().filter(cm -> cm.getRole() == CompanyRole.OWNER).map(CompanyMember::getUser).findFirst().orElse(companyMemberRepository.findByCompanyId(company.getId()).get(0).getUser());

      Job job = Job.builder().company(company).postedBy(recruiter).title(title).description("Chúng tôi đang tìm kiếm nhân sự tài năng đồng hành lâu dài. Công việc chính bao gồm phát triển hệ thống ổn định, tối ưu hóa hiệu năng, cộng tác làm việc theo quy trình Agile/Scrum. Yêu cầu có tinh thần chủ động cao.").requirements("- Kinh nghiệm làm việc thực tế.\n- Có hiểu biết tốt về kỹ năng chuyên môn: " + String.join(", ", skills) + ".\n- Có khả năng làm việc nhóm tốt.").responsibilities("- Tham gia thiết kế hệ thống phần mềm.\n- Viết code sạch, dễ bảo trì và tối ưu.\n- Phối hợp với đồng nghiệp QA và DevOps để hoàn thành dự án đúng hạn.").location(random.nextBoolean() ? "Hanoi, Vietnam" : "Ho Chi Minh City, Vietnam").jobType(random.nextBoolean() ? JobType.FULL_TIME : JobType.INTERNSHIP).workMode(random.nextBoolean() ? WorkMode.HYBRID : WorkMode.REMOTE).salaryMin(12000000 + random.nextInt(10) * 1000000).salaryMax(25000000 + random.nextInt(20) * 1000000).salaryCurrency("VND").experienceLevel(random.nextBoolean() ? "JUNIOR" : "MIDDLE").skills(skills).status(JobStatus.PUBLISHED).publishedAt(LocalDateTime.now().minusDays(random.nextInt(10))).vectorId(UUID.randomUUID().toString()).build();

      jobs.add(jobRepository.save(job));
    }

    return jobs;
  }

  private List<CV> createMockCVs(List<User> users) {
    List<CV> cvs = new ArrayList<>();
    // Sinh CV mẫu cho 5 ứng viên thường (vẫn là USER)
    int count = 0;
    for (User user : users) {
      if (user.getRole() == UserRole.USER) {
        StoredObject so = new StoredObject();
        so.setScope(com.hustlink.backend.features.storage.model.StorageScope.CV);
        so.setUploadedBy(user);
        so.setBucketName("hustlink-private");
        so.setObjectKey("cvs/mock_cv_" + user.getId() + ".pdf");
        so.setOriginalFileName("CV_" + user.getFirstName() + "_" + user.getLastName() + ".pdf");
        so.setContentType("application/pdf");
        so.setSizeInBytes(102400L);
        so.setOriginalSizeInBytes(102400L);
        so.setOptimized(false);
        so.setPublicRead(false);
        so.setOwnerType("USER_CV");
        so.setOwnerId(user.getId());
        so = storedObjectRepository.save(so);

        CV cv = new CV();
        cv.setUser(user);
        cv.setFileName(so.getObjectKey());
        cv.setOriginalFileName(so.getOriginalFileName());
        cv.setBucketName(so.getBucketName());
        cv.setObjectKey(so.getObjectKey());
        cv.setMimeType(so.getContentType());
        cv.setStoredObject(so);
        cv.setExtractedText("Họ và tên: " + user.getFirstName() + " " + user.getLastName() + "\n" + "Mục tiêu nghề nghiệp: Trở thành một kỹ sư phát triển phần mềm chuyên nghiệp.\n" + "Kỹ năng: Java, Python, Spring Boot, React, SQL, Git, Docker.\n" + "Kinh nghiệm làm việc: 2 năm làm việc thực tế với ngôn ngữ Java phát triển Web App.\n" + "Học vấn: Đại học Bách Khoa Hà Nội (HUST), chuyên ngành Khoa học Máy tính.");
        cv.setAnalysisScore(75 + random.nextInt(20));
        cv.setAnalysisSummary("Ứng viên tốt nghiệp HUST, có kỹ năng cơ bản tốt về Java và các kỹ năng phát triển phần mềm.");
        cv.setAnalysisStrengths("[\"Kỹ năng lập trình Java và Spring Boot vững\", \"Học vấn tốt từ trường đại học danh tiếng\", \"Có kiến thức cơ bản về Docker\"]");
        cv.setAnalysisImprovements("[\"Bổ sung kinh nghiệm làm việc với hệ thống Cloud\", \"Cần rèn luyện thêm kỹ năng giao tiếp tiếng Anh\"]");
        cv.setExtractedSkills("[\"Java\", \"Python\", \"Spring Boot\", \"React\", \"SQL\", \"Git\", \"Docker\"]");

        cvs.add(cvRepository.save(cv));
        count++;
        if (count >= 5) {
          break;
        }
      }
    }
    return cvs;
  }

  private void createMockApplications(List<Job> jobs, List<CV> cvs) {
    if (jobs.isEmpty() || cvs.isEmpty()) {
      return;
    }

    // Chọn ngẫu nhiên khoảng 10 Job và cho các ứng viên nộp đơn
    for (int i = 0; i < 15; i++) {
      Job job = jobs.get(random.nextInt(jobs.size()));
      CV cv = cvs.get(random.nextInt(cvs.size()));

      // Kiểm tra tránh trùng lặp ứng viên trong một Job
      if (jobApplicationRepository.existsByJobIdAndApplicantId(job.getId(), cv.getUser().getId())) {
        continue;
      }

      int score = 65 + random.nextInt(30);
      String breakdown = "{\"semantic\":" + (score - 5) + ",\"skills\":" + score + ",\"experience\":" + (score + 5) + ",\"keywords\":" + score + "}";
      String reasoning = "{\"reasons\":[\"Ứng viên có kiến thức chuyên môn Java/React rất tốt khớp với JD\",\"Tốt nghiệp trường top Bách Khoa phù hợp tiêu chí tuyển dụng\",\"Đã có dự án thực tế liên quan trực tiếp\"],\"gaps\":[\"Thiếu một số kinh nghiệm về DevOps như CI/CD trong JD\",\"Mức lương mong đợi có thể cao hơn ngân sách dự kiến\"]}";

      JobApplication application = JobApplication.builder().job(job).applicant(cv.getUser()).cv(cv).coverLetter("Kính gửi nhà tuyển dụng, tôi rất mong muốn được thử sức với cơ hội này để phát huy năng lực của mình.").matchScore(score).matchBreakdown(breakdown).matchReasoning(reasoning).status(random.nextBoolean() ? ApplicationStatus.APPLIED : ApplicationStatus.SHORTLISTED).build();

      jobApplicationRepository.save(application);
    }
  }

  private void createMockEvents(UserRepository userRepository, List<Company> companies, List<User> users) {
    List<String> eventTitles = Arrays.asList(
            "HUST Career Fair 2026 - Ngày hội Việc làm Công nghệ", "Workshop: AI & ChatGPT thế hệ mới ứng dụng thực tế", "Webinar: Road to Senior Software Engineer", "Networking Cafe: Trò chuyện cùng Nhà tuyển dụng", "BK TechDay: Triển lãm các dự án Nghiên cứu xuất sắc"
    );

    List<EventType> eventTypes = Arrays.asList(
            EventType.CAREER_FAIR, EventType.WORKSHOP, EventType.WEBINAR, EventType.NETWORKING, EventType.WORKSHOP
    );

    List<EventMode> eventModes = Arrays.asList(
            EventMode.OFFLINE, EventMode.HYBRID, EventMode.ONLINE, EventMode.OFFLINE, EventMode.OFFLINE
    );

    // Tạo 5 sự kiện ngẫu nhiên liên kết với các công ty chủ trì
    for (int i = 0; i < eventTitles.size(); i++) {
      Company company = companies.get(i);
      User organizer = companyMemberRepository.findByCompanyId(company.getId()).get(0).getUser();

      Event event = Event.builder().organizer(organizer).hostCompany(company).title(eventTitles.get(i)).description("Sự kiện hấp dẫn nhằm chia sẻ kinh nghiệm công nghệ, giải đáp thắc mắc tuyển dụng và định hướng lộ trình nghề nghiệp cho các bạn sinh viên HUST.").startAt(LocalDateTime.now().plusDays(2 + i)).endAt(LocalDateTime.now().plusDays(2 + i).plusHours(3)).type(eventTypes.get(i)).mode(eventModes.get(i)).venue("Hội trường C2, Đại học Bách Khoa Hà Nội").cityCode("HANOI").coverImageUrl("https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800").status(EventStatus.PUBLISHED).tags(new HashSet<>(Arrays.asList("Technology", "Career", "HUST"))).build();

      if (event.getMode() == EventMode.ONLINE || event.getMode() == EventMode.HYBRID) {
        event.setOnlineLink("https://zoom.us/j/hustlink-event-" + i);
      }

      Event savedEvent = eventRepository.save(event);

      // Thêm RSVP giả lập cho sự kiện
      for (int k = 0; k < 10; k++) {
        User attendee = users.get(random.nextInt(users.size()));
        if (!attendee.getId().equals(organizer.getId())) {
          EventRsvp rsvp = EventRsvp.builder().event(savedEvent).user(attendee).status(random.nextBoolean() ? RsvpStatus.GOING : RsvpStatus.INTERESTED).build();
          try {
            eventRsvpRepository.save(rsvp);
          } catch (Exception e) {
            // bỏ qua nếu trùng unique constraint
          }
        }
      }
    }
  }
}
