ALTER TABLE users ADD role NVARCHAR(20) NOT NULL CONSTRAINT df_users_role DEFAULT 'USER';
CREATE INDEX idx_users_role ON users(role);
