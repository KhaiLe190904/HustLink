CREATE TABLE interview_question_bank (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    question_text NVARCHAR(MAX) NOT NULL,
    target_position NVARCHAR(100) NOT NULL,
    level NVARCHAR(20) NOT NULL,
    category NVARCHAR(30) NOT NULL,
    difficulty NVARCHAR(20),
    source NVARCHAR(50),
    expected_points NVARCHAR(MAX),
    language_code NVARCHAR(10) NOT NULL,
    vector_id NVARCHAR(100) NOT NULL UNIQUE,
    indexed_at DATETIME2 NOT NULL
);

CREATE INDEX idx_iqb_position ON interview_question_bank(target_position);
CREATE INDEX idx_iqb_level ON interview_question_bank(level);
CREATE INDEX idx_iqb_language ON interview_question_bank(language_code);
