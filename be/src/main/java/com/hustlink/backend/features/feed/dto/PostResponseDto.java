package com.hustlink.backend.features.feed.dto;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.feed.model.Post;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class PostResponseDto {
  private Long id;
  private String content;
  private String picture;
  private List<String> mediaUrls;
  private User author;
  private LocalDateTime creationDate;
  private LocalDateTime updateDate;
  private int likesCount;
  private int commentsCount;
  private boolean likedByCurrentUser;
  private Double feedScore;
  private Map<String, Double> feedScoreBreakdown;

  public static PostResponseDto from(Post post, Long currentUserId) {
    return PostResponseDto.builder().id(post.getId()).content(post.getContent()).picture(post.getPicture()).mediaUrls(post.getMediaUrls()).author(post.getAuthor()).creationDate(post.getCreationDate()).updateDate(post.getUpdateDate()).likesCount(post.getLikes() != null ? post.getLikes().size() : 0).commentsCount(post.getComments() != null ? post.getComments().size() : 0).likedByCurrentUser(post.getLikes() != null && post.getLikes().stream().anyMatch(u -> u.getId().equals(currentUserId))).build();
  }

  public static PostResponseDto from(Post post, Long currentUserId, Double feedScore, Map<String, Double> feedScoreBreakdown) {
    return PostResponseDto.builder().id(post.getId()).content(post.getContent()).picture(post.getPicture()).mediaUrls(post.getMediaUrls()).author(post.getAuthor()).creationDate(post.getCreationDate()).updateDate(post.getUpdateDate()).likesCount(post.getLikes() != null ? post.getLikes().size() : 0).commentsCount(post.getComments() != null ? post.getComments().size() : 0).likedByCurrentUser(post.getLikes() != null && post.getLikes().stream().anyMatch(u -> u.getId().equals(currentUserId))).feedScore(feedScore).feedScoreBreakdown(feedScoreBreakdown).build();
  }

  public static PostResponseDto from(Post post, int likesCount, int commentsCount, boolean likedByCurrentUser, Double feedScore, Map<String, Double> feedScoreBreakdown) {
    return PostResponseDto.builder().id(post.getId()).content(post.getContent()).picture(post.getPicture()).mediaUrls(post.getMediaUrls()).author(post.getAuthor()).creationDate(post.getCreationDate()).updateDate(post.getUpdateDate()).likesCount(likesCount).commentsCount(commentsCount).likedByCurrentUser(likedByCurrentUser).feedScore(feedScore).feedScoreBreakdown(feedScoreBreakdown).build();
  }
}
