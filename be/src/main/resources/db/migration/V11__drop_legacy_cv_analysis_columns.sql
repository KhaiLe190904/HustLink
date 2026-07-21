IF COL_LENGTH('cvs', 'recommended_questions') IS NOT NULL
  ALTER TABLE cvs DROP COLUMN recommended_questions;

IF COL_LENGTH('cvs', 'analysis_status') IS NOT NULL
  ALTER TABLE cvs DROP COLUMN analysis_status;

IF COL_LENGTH('cvs', 'analysis_improvements') IS NOT NULL
  ALTER TABLE cvs DROP COLUMN analysis_improvements;

IF COL_LENGTH('cvs', 'analysis_strengths') IS NOT NULL
  ALTER TABLE cvs DROP COLUMN analysis_strengths;

IF COL_LENGTH('cvs', 'analysis_summary') IS NOT NULL
  ALTER TABLE cvs DROP COLUMN analysis_summary;

IF COL_LENGTH('cvs', 'extracted_skills') IS NOT NULL
  ALTER TABLE cvs DROP COLUMN extracted_skills;
