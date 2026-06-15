DECLARE @ConstraintName NVARCHAR(256);
SELECT @ConstraintName = name
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('dbo.content_reports')
  AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.content_reports'), 'reason', 'ColumnId');

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.content_reports DROP CONSTRAINT [' + @ConstraintName + ']');
END

ALTER TABLE dbo.content_reports ADD CONSTRAINT CK_content_reports_reason CHECK (reason IN ('SPAM', 'TOXICITY', 'HARASSMENT', 'SCAM', 'INAPPROPRIATE', 'OTHER'));
