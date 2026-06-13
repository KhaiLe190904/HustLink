CREATE TABLE companies (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(200) NOT NULL UNIQUE,
    slug NVARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(MAX),
    website NVARCHAR(200),
    industry NVARCHAR(100),
    size NVARCHAR(50),
    headquarters NVARCHAR(100),
    logo_url NVARCHAR(255),
    cover_url NVARCHAR(255),
    logo_stored_object_id BIGINT,
    status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

CREATE TABLE company_members (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    company_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role NVARCHAR(20) NOT NULL,
    joined_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_company_members_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_company_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_company_user UNIQUE (company_id, user_id)
);
