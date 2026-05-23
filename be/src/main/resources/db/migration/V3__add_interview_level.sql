ALTER TABLE interview_sessions ADD interview_level NVARCHAR(20) NOT NULL CONSTRAINT df_interview_sessions_level DEFAULT 'JUNIOR';
CREATE INDEX idx_interview_sessions_level ON interview_sessions(interview_level);
