ALTER TABLE cv_job_analyses ALTER COLUMN score INT NULL;
ALTER TABLE cv_job_analyses ALTER COLUMN match_score INT NULL;

ALTER TABLE cv_job_analyses ADD status NVARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
    CONSTRAINT CK_cv_job_analyses_status CHECK (status IN ('PENDING', 'ANALYZING', 'COMPLETED', 'FAILED'));
