IF COL_LENGTH('interview_question_bank', 'level') IS NULL
BEGIN
    ALTER TABLE interview_question_bank ADD level NVARCHAR(20) NOT NULL CONSTRAINT df_iqb_level DEFAULT 'JUNIOR';
END

IF COL_LENGTH('interview_question_bank', 'expected_points') IS NULL
BEGIN
    ALTER TABLE interview_question_bank ADD expected_points NVARCHAR(MAX) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_iqb_level' AND object_id = OBJECT_ID('interview_question_bank'))
BEGIN
    CREATE INDEX idx_iqb_level ON interview_question_bank(level);
END
