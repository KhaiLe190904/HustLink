package com.hustlink.backend.features.feed.dto;

import lombok.*;

@RequiredArgsConstructor
@Data
@AllArgsConstructor
@Builder
public class PostDto {
  private String content;
  private String picture = null;
}
