package com.hustlink.backend.features.messaging.dto;

public record MessageDto(
                         Long receiverId,
                         String content,
                         Long attachmentObjectId,
                         String attachmentKind,
                         Long sharedPostId) {
}
