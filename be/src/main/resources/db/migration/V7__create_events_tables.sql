CREATE TABLE events (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    organizer_id BIGINT NOT NULL,
    host_company_id BIGINT,
    type NVARCHAR(50) NOT NULL,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    start_at DATETIME2 NOT NULL,
    end_at DATETIME2 NOT NULL,
    mode NVARCHAR(50) NOT NULL,
    online_link NVARCHAR(500),
    venue NVARCHAR(255),
    city_code NVARCHAR(50),
    capacity INT,
    cover_image_url NVARCHAR(500),
    status NVARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_events_user FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_events_company FOREIGN KEY (host_company_id) REFERENCES companies(id) ON DELETE SET NULL
);

CREATE TABLE event_tags (
    event_id BIGINT NOT NULL,
    tag NVARCHAR(60) NOT NULL,
    CONSTRAINT fk_event_tags_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE event_rsvps (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    event_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    status NVARCHAR(20) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_event_rsvps_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_rsvps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION,
    CONSTRAINT uq_event_user UNIQUE (event_id, user_id)
);
