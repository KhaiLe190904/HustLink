ALTER TABLE jobs ADD source_type NVARCHAR(30);
ALTER TABLE jobs ADD source_url NVARCHAR(1000);
ALTER TABLE jobs ADD source_platform NVARCHAR(80);
ALTER TABLE jobs ADD external_job_id NVARCHAR(120);
ALTER TABLE jobs ADD raw_imported_content NVARCHAR(MAX);
ALTER TABLE jobs ADD imported_by_user_id BIGINT;
ALTER TABLE jobs ADD assigned_recruiter_id BIGINT;

ALTER TABLE jobs ADD CONSTRAINT fk_jobs_imported_by FOREIGN KEY (imported_by_user_id) REFERENCES users(id) ON DELETE NO ACTION;
ALTER TABLE jobs ADD CONSTRAINT fk_jobs_assigned_recruiter FOREIGN KEY (assigned_recruiter_id) REFERENCES users(id) ON DELETE NO ACTION;

CREATE TABLE cv_job_analyses (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    cv_id BIGINT NOT NULL,
    job_id BIGINT NOT NULL,
    score INT NOT NULL,
    summary NVARCHAR(MAX),
    strengths NVARCHAR(MAX),
    improvements NVARCHAR(MAX),
    extracted_skills NVARCHAR(MAX),
    match_score INT NOT NULL,
    match_breakdown NVARCHAR(MAX),
    match_reasoning NVARCHAR(MAX),
    job_snapshot NVARCHAR(MAX),
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_cv_job_analyses_cv FOREIGN KEY (cv_id) REFERENCES cvs(id) ON DELETE CASCADE,
    CONSTRAINT fk_cv_job_analyses_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    CONSTRAINT uq_cv_job_analysis UNIQUE (cv_id, job_id)
);

ALTER TABLE interview_sessions ADD job_id BIGINT;
ALTER TABLE interview_sessions ADD cv_job_analysis_id BIGINT;
ALTER TABLE interview_sessions ADD job_snapshot NVARCHAR(MAX);
ALTER TABLE interview_sessions ADD CONSTRAINT fk_interview_sessions_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE NO ACTION;
ALTER TABLE interview_sessions ADD CONSTRAINT fk_interview_sessions_cv_job_analysis FOREIGN KEY (cv_job_analysis_id) REFERENCES cv_job_analyses(id) ON DELETE NO ACTION;
