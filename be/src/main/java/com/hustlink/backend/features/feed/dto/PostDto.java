package com.hustlink.backend.features.feed.dto;

import java.util.List;
import lombok.*;

@RequiredArgsConstructor
@Data
@AllArgsConstructor
@Builder
public class PostDto {
  private String content;
  private String picture = null;
  private List<String> mediaUrls = List.of();
}
