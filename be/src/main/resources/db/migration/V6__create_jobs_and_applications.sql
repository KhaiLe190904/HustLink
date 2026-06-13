CREATE TABLE jobs (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    company_id BIGINT NOT NULL,
    posted_by_user_id BIGINT NOT NULL,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    requirements NVARCHAR(MAX),
    responsibilities NVARCHAR(MAX),
    location NVARCHAR(100),
    job_type NVARCHAR(50),
    work_mode NVARCHAR(50),
    salary_min INT,
    salary_max INT,
    salary_currency NVARCHAR(3),
    experience_level NVARCHAR(50),
    status NVARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    published_at DATETIME2,
    closed_at DATETIME2,
    application_deadline DATETIME2,
    vector_id NVARCHAR(100),
    CONSTRAINT fk_jobs_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_jobs_user FOREIGN KEY (posted_by_user_id) REFERENCES users(id) ON DELETE NO ACTION
);

CREATE TABLE job_skills (
    job_id BIGINT NOT NULL,
    skill NVARCHAR(80) NOT NULL,
    CONSTRAINT fk_job_skills_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE job_applications (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    job_id BIGINT NOT NULL,
    applicant_id BIGINT NOT NULL,
    cv_id BIGINT NOT NULL,
    cover_letter NVARCHAR(MAX),
    match_score INT NOT NULL,
    match_breakdown NVARCHAR(MAX),
    match_reasoning NVARCHAR(MAX),
    status NVARCHAR(30) NOT NULL DEFAULT 'APPLIED',
    applied_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_job_apps_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    CONSTRAINT fk_job_apps_user FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE NO ACTION,
    CONSTRAINT fk_job_apps_cv FOREIGN KEY (cv_id) REFERENCES cvs(id) ON DELETE NO ACTION,
    CONSTRAINT uq_job_applicant UNIQUE (job_id, applicant_id)
);

CREATE TABLE saved_jobs (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    job_id BIGINT NOT NULL,
    saved_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_saved_jobs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_saved_jobs_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_job UNIQUE (user_id, job_id)
);
