DECLARE @constraintName SYSNAME;
DECLARE @sql NVARCHAR(MAX);

SELECT TOP 1 @constraintName = cc.name
FROM sys.check_constraints cc
JOIN sys.columns c
  ON c.object_id = cc.parent_object_id
WHERE cc.parent_object_id = OBJECT_ID('dbo.interview_sessions')
  AND c.name = 'status'
  AND cc.definition LIKE '%status%';

IF @constraintName IS NOT NULL
BEGIN
  SET @sql = N'ALTER TABLE dbo.interview_sessions DROP CONSTRAINT ' + QUOTENAME(@constraintName);
  EXEC sp_executesql @sql;
END;

ALTER TABLE dbo.interview_sessions
ADD CONSTRAINT CK_interview_sessions_status
CHECK (status IN ('CREATING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'));
