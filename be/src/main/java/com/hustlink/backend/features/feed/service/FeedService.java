package com.hustlink.backend.features.feed.service;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.authentication.repository.UserRepository;
import com.hustlink.backend.features.feed.configuration.FeedRankingProperties;
import com.hustlink.backend.features.feed.dto.PostDto;
import com.hustlink.backend.features.feed.dto.PostResponseDto;
import com.hustlink.backend.features.feed.dto.ViewedPostsRequestDto;
import com.hustlink.backend.features.feed.model.Comment;
import com.hustlink.backend.features.feed.model.Post;
import com.hustlink.backend.features.feed.model.PostImpression;
import com.hustlink.backend.features.feed.repository.CommentRepository;
import com.hustlink.backend.features.feed.repository.PostImpressionRepository;
import com.hustlink.backend.features.feed.repository.PostRepository;
import com.hustlink.backend.features.networking.model.Connection;
import com.hustlink.backend.features.networking.model.Status;
import com.hustlink.backend.features.networking.repository.ConnectionRepository;
import com.hustlink.backend.features.notifications.service.NotificationService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FeedService {
  private final PostRepository postRepository;
  private final PostImpressionRepository postImpressionRepository;
  private final UserRepository userRepository;
  private final ConnectionRepository connectionRepository;
  private final CommentRepository commentRepository;
  private final FeedRankingProperties feedRankingProperties;

  private final NotificationService notificationService;

  public Post createPost(PostDto postDto, Long authorId) {
    User author = userRepository.findById(authorId).orElseThrow(() -> new IllegalArgumentException("User not found"));
    Post post = new Post(postDto.getContent(), author);
    List<String> mediaUrls = normalizeMediaUrls(postDto);
    post.setMediaUrls(mediaUrls);
    post.setPicture(mediaUrls.isEmpty() ? postDto.getPicture() : mediaUrls.get(0));
    return postRepository.save(post);
  }

  public Post editPost(Long postId, Long userId, PostDto postDto) {
    Post post = postRepository.findById(postId).orElseThrow(() -> new IllegalArgumentException("Post not found"));
    User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
    if (!post.getAuthor().equals(user)) {
      throw new IllegalArgumentException("You are not allowed to edit this post");
    }
    post.setContent(postDto.getContent());
    List<String> mediaUrls = normalizeMediaUrls(postDto);
    post.setMediaUrls(mediaUrls);
    post.setPicture(mediaUrls.isEmpty() ? postDto.getPicture() : mediaUrls.get(0));
    return postRepository.save(post);
  }

  public List<Post> getFeedPost(Long authenticatedUserId) {
    List<Connection> connections = connectionRepository.findByAuthorIdAndStatusOrRecipientIdAndStatus(
            authenticatedUserId, Status.ACCEPTED, authenticatedUserId, Status.ACCEPTED);

    Set<Long> connectedUserIds = connections.stream().map(connection -> connection.getAuthor().getId().equals(authenticatedUserId) ? connection.getRecipient().getId() : connection.getAuthor().getId()).collect(Collectors.toSet());

    return postRepository.findByAuthorIdInOrderByCreationDateDesc(connectedUserIds);
  }

  public List<Post> getAllPost() {
    return postRepository.findAllByOrderByCreationDateDesc();
  }

  public Post getPost(Long postId) {
    return postRepository.findById(postId).orElseThrow(() -> new IllegalArgumentException("Post not found"));
  }

  public void deletePost(Long postId, Long userId) {
    Post post = postRepository.findById(postId).orElseThrow(() -> new IllegalArgumentException("Post not found"));
    User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
    if (!post.getAuthor().equals(user)) {
      throw new IllegalArgumentException("You are not allowed to delete this post");
    }
    postRepository.delete(post);
  }

  public List<Post> getPostByUserId(Long userId) {
    return postRepository.findByAuthorId(userId);
  }

  public Post likePost(Long postId, Long userId) {
    Post post = postRepository.findById(postId).orElseThrow(() -> new IllegalArgumentException("Post not found"));
    User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
    if (post.getLikes().contains(user)) {
      post.getLikes().remove(user);
    } else {
      post.getLikes().add(user);
      notificationService.sendLikeNotification(user, post.getAuthor(), post.getId());
    }
    Post savedPost = postRepository.save(post);
    notificationService.sendLikeToPost(post.getId(), savedPost.getLikes());
    return savedPost;
  }

  public Comment addComment(Long postId, Long userId, String content) {
    Post post = postRepository.findById(postId).orElseThrow(() -> new IllegalArgumentException("Post not found"));
    User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
    Comment comment = commentRepository.save(new Comment(post, user, content));
    notificationService.sendCommentNotification(user, post.getAuthor(), post.getId());
    notificationService.sendCommentToPost(post.getId(), comment);
    return comment;
  }

  public void deleteComment(Long commentId, Long userId) {
    Comment comment = commentRepository.findById(commentId).orElseThrow(() -> new IllegalArgumentException("Comment not found"));
    User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
    if (!comment.getAuthor().equals(user)) {
      throw new IllegalArgumentException("User is not the author of the comment");
    }
    commentRepository.delete(comment);
    notificationService.sendDeleteCommentToPost(comment.getPost().getId(), comment);
  }

  public Comment editComment(Long commentId, Long userId, String content) {
    Comment comment = commentRepository.findById(commentId).orElseThrow(() -> new IllegalArgumentException("Comment not found"));
    User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
    if (!comment.getAuthor().equals(user)) {
      throw new IllegalArgumentException("You are not allowed to edit this comment");
    }
    comment.setContent(content);
    Comment savedComment = commentRepository.save(comment);
    notificationService.sendCommentToPost(savedComment.getPost().getId(), savedComment);
    return savedComment;
  }

  public List<Comment> getPostComments(Long postId) {
    Post post = postRepository.findById(postId).orElseThrow(() -> new IllegalArgumentException("Post not found"));
    return post.getComments();
  }

  public Set<User> getPostLikes(Long postId) {
    Post post = postRepository.findById(postId).orElseThrow(() -> new IllegalArgumentException("Post not found"));
    return post.getLikes();
  }

  @Transactional
  public Page<PostResponseDto> getFeedPostDto(Long authenticatedUserId, Pageable pageable) {
    Set<Long> connectedUserIds = getConnectedUserIds(authenticatedUserId);
    if (connectedUserIds.isEmpty()) {
      return Page.empty(pageable);
    }

    int virtualBatchPage = Math.max(0, pageable.getPageNumber());
    int requestedPageSize = pageable.getPageSize() > 0 ? pageable.getPageSize() : feedRankingProperties.batchSize();
    int pageSize = Math.max(1, requestedPageSize);
    int candidatePoolSize = Math.min(
            feedRankingProperties.maxCandidatePoolSize(), Math.max(feedRankingProperties.candidatePoolSize(), pageSize * 10));
    int candidateWindowPage = (virtualBatchPage * pageSize) / candidatePoolSize;
    int offsetInsideCandidateWindow = (virtualBatchPage * pageSize) % candidatePoolSize;

    Pageable candidateRequest = PageRequest.of(candidateWindowPage, candidatePoolSize);
    Page<Post> candidatePage = postRepository.findByAuthorIdInOrderByCreationDateDesc(connectedUserIds, candidateRequest);
    List<ScoredPost> rankedPosts = rankFeedPosts(authenticatedUserId, candidatePage.getContent(), candidatePoolSize);
    List<ScoredPost> pagedRankedPosts = rankedPosts.stream().skip(offsetInsideCandidateWindow).limit(pageSize).toList();

    markPostsAsServed(authenticatedUserId, pagedRankedPosts.stream().map(ScoredPost::post).toList());

    List<PostResponseDto> postDtos = pagedRankedPosts.stream().map(scoredPost -> PostResponseDto.from(
            scoredPost.post(), authenticatedUserId, scoredPost.score(), scoredPost.breakdown())).collect(Collectors.toList());

    boolean hasNextWithinWindow = offsetInsideCandidateWindow + pageSize < rankedPosts.size();
    long syntheticTotalElements = hasNextWithinWindow || candidatePage.hasNext() ? pageable.getOffset() + postDtos.size() + 1 : pageable.getOffset() + postDtos.size();

    return new PageImpl<>(postDtos, pageable, syntheticTotalElements);
  }

  public Page<PostResponseDto> getPostByUserIdDto(Long userId, Long currentUserId, Pageable pageable) {
    Page<Post> posts = postRepository.findByAuthorIdOrderByCreationDateDesc(userId, pageable);

    List<PostResponseDto> postDtos = posts.getContent().stream().map(post -> PostResponseDto.from(post, currentUserId)).collect(Collectors.toList());

    return new PageImpl<>(postDtos, pageable, posts.getTotalElements());
  }

  public Page<Comment> getPostComments(Long postId, Pageable pageable) {
    Post post = postRepository.findById(postId).orElseThrow(() -> new IllegalArgumentException("Post not found"));
    return commentRepository.findByPostOrderByCreationDateDesc(post, pageable);
  }

  public long getPostCommentsCount(Long postId) {
    Post post = postRepository.findById(postId).orElseThrow(() -> new IllegalArgumentException("Post not found"));
    return commentRepository.countByPost(post);
  }

  private List<String> normalizeMediaUrls(PostDto postDto) {
    List<String> mediaUrls = postDto.getMediaUrls() == null ? List.of() : postDto.getMediaUrls().stream().filter(url -> url != null && !url.isBlank()).distinct().limit(3).toList();

    if (!mediaUrls.isEmpty()) {
      return mediaUrls;
    }

    if (postDto.getPicture() != null && !postDto.getPicture().isBlank()) {
      return List.of(postDto.getPicture());
    }

    return List.of();
  }

  @Transactional
  public void markPostsAsViewed(Long authenticatedUserId, ViewedPostsRequestDto requestDto) {
    if (requestDto == null || requestDto.getPostIds() == null || requestDto.getPostIds().isEmpty()) {
      return;
    }

    List<Long> postIds = requestDto.getPostIds().stream().filter(id -> id != null).distinct().toList();
    if (postIds.isEmpty()) {
      return;
    }

    User user = userRepository.findById(authenticatedUserId).orElseThrow(() -> new IllegalArgumentException("User not found"));
    LocalDateTime now = LocalDateTime.now();
    List<PostImpression> impressions = new ArrayList<>(postImpressionRepository.findByUserIdAndPostIdIn(authenticatedUserId, postIds));
    Set<Long> existingPostIds = impressions.stream().map(impression -> impression.getPost().getId()).collect(Collectors.toSet());

    if (existingPostIds.size() != postIds.size()) {
      List<Post> posts = postRepository.findAllById(postIds);
      posts.stream().filter(post -> !existingPostIds.contains(post.getId())).map(post -> PostImpression.builder().user(user).post(post).servedAt(now).viewedAt(now).build()).forEach(impressions::add);
    }

    impressions.forEach(impression -> {
      if (impression.getViewedAt() == null) {
        impression.setViewedAt(now);
      }
    });

    postImpressionRepository.saveAll(impressions);
  }

  private Set<Long> getConnectedUserIds(Long authenticatedUserId) {
    List<Connection> connections = connectionRepository.findByAuthorIdAndStatusOrRecipientIdAndStatus(
            authenticatedUserId, Status.ACCEPTED, authenticatedUserId, Status.ACCEPTED);

    return connections.stream().map(connection -> connection.getAuthor().getId().equals(authenticatedUserId) ? connection.getRecipient().getId() : connection.getAuthor().getId()).collect(Collectors.toSet());
  }

  private void markPostsAsServed(Long authenticatedUserId, List<Post> posts) {
    if (posts.isEmpty()) {
      return;
    }

    User user = userRepository.findById(authenticatedUserId).orElseThrow(() -> new IllegalArgumentException("User not found"));
    LocalDateTime now = LocalDateTime.now();
    List<Long> postIds = posts.stream().map(Post::getId).toList();
    Map<Long, PostImpression> existingImpressions = postImpressionRepository.findByUserIdAndPostIdIn(authenticatedUserId, postIds).stream().collect(Collectors.toMap(impression -> impression.getPost().getId(), impression -> impression));

    List<PostImpression> impressionsToSave = posts.stream().map(post -> {
      PostImpression existingImpression = existingImpressions.get(post.getId());
      if (existingImpression != null) {
        existingImpression.setServedAt(now);
        return existingImpression;
      }

      return PostImpression.builder().user(user).post(post).servedAt(now).build();
    }).toList();

    postImpressionRepository.saveAll(impressionsToSave);
  }

  private List<ScoredPost> rankFeedPosts(Long authenticatedUserId, List<Post> candidatePosts, int pageSize) {
    if (candidatePosts.isEmpty()) {
      return List.of();
    }

    List<Long> postIds = candidatePosts.stream().map(Post::getId).toList();
    Set<Long> authorIds = candidatePosts.stream().map(post -> post.getAuthor().getId()).collect(Collectors.toSet());

    Map<Long, PostImpression> impressionsByPostId = postImpressionRepository.findByUserIdAndPostIdIn(authenticatedUserId, postIds).stream().collect(Collectors.toMap(impression -> impression.getPost().getId(), impression -> impression));
    Map<Long, Integer> engagementByPostId = buildEngagementByPostId(postIds);
    Map<Long, Integer> affinityByAuthorId = buildAffinityByAuthorId(authenticatedUserId, authorIds);

    List<ScoredPost> scoredPosts = candidatePosts.stream().map(post -> scorePost(post, impressionsByPostId.get(post.getId()), engagementByPostId, affinityByAuthorId)).sorted(Comparator.comparingDouble(ScoredPost::score).reversed().thenComparing((ScoredPost scoredPost) -> scoredPost.post().getCreationDate(), Comparator.reverseOrder()).thenComparing((ScoredPost scoredPost) -> scoredPost.post().getId(), Comparator.reverseOrder())).toList();

    return diversifyAuthors(scoredPosts, pageSize);
  }

  private Map<Long, Integer> buildEngagementByPostId(List<Long> postIds) {
    Map<Long, Integer> engagementByPostId = new HashMap<>();

    postRepository.countLikesForPostIds(postIds).forEach(result -> engagementByPostId.put(
            ((Number) result[0]).longValue(), ((Number) result[1]).intValue()));

    commentRepository.countCommentsForPostIds(postIds).forEach(result -> engagementByPostId.merge(
            ((Number) result[0]).longValue(), ((Number) result[1]).intValue(), Integer::sum));

    return engagementByPostId;
  }

  private Map<Long, Integer> buildAffinityByAuthorId(Long authenticatedUserId, Set<Long> authorIds) {
    Map<Long, Integer> affinityByAuthorId = new HashMap<>();
    if (authorIds.isEmpty()) {
      return affinityByAuthorId;
    }

    postRepository.countLikedPostsByUserForAuthors(authenticatedUserId, authorIds).forEach(result -> affinityByAuthorId.merge(
            ((Number) result[0]).longValue(), ((Number) result[1]).intValue(), Integer::sum));

    commentRepository.countCommentsByUserForAuthors(authenticatedUserId, authorIds).forEach(result -> affinityByAuthorId.merge(
            ((Number) result[0]).longValue(), ((Number) result[1]).intValue(), Integer::sum));

    return affinityByAuthorId;
  }

  private ScoredPost scorePost(
                               Post post, PostImpression impression, Map<Long, Integer> engagementByPostId, Map<Long, Integer> affinityByAuthorId) {
    LocalDateTime now = LocalDateTime.now();
    Map<String, Double> breakdown = new LinkedHashMap<>();

    if (post.getCreationDate() != null && post.getCreationDate().isAfter(now.minusHours(feedRankingProperties.freshWindowHours()))) {
      breakdown.put("veryFresh", feedRankingProperties.veryFreshPostScore());
    }

    if (affinityByAuthorId.getOrDefault(post.getAuthor().getId(), 0) > 0) {
      breakdown.put("authorAffinity", feedRankingProperties.authorAffinityScore());
    }

    if (engagementByPostId.getOrDefault(post.getId(), 0) >= feedRankingProperties.hotPostEngagementThreshold()) {
      breakdown.put("engagement", feedRankingProperties.engagementScore());
    }

    if (impression != null) {
      if (impression.getViewedAt() != null && impression.getViewedAt().isAfter(now.minusHours(feedRankingProperties.viewedWindowHours()))) {
        breakdown.put("recentlyViewedPenalty", -feedRankingProperties.recentlyViewedPenalty());
      } else
        if (impression.getViewedAt() == null && impression.getServedAt() != null && impression.getServedAt().isAfter(now.minusHours(feedRankingProperties.servedWindowHours()))) {
          breakdown.put("recentlyServedPenalty", -feedRankingProperties.recentlyServedPenalty());
        }
    }

    double score = breakdown.values().stream().mapToDouble(Double::doubleValue).sum();
    return new ScoredPost(post, score, breakdown);
  }

  private List<ScoredPost> diversifyAuthors(List<ScoredPost> scoredPosts, int limit) {
    List<ScoredPost> remainingPosts = new ArrayList<>(scoredPosts);
    List<ScoredPost> selectedPosts = new ArrayList<>();
    Long previousAuthorId = null;
    int sameAuthorStreak = 0;

    while (!remainingPosts.isEmpty() && selectedPosts.size() < limit) {
      Long currentPreviousAuthorId = previousAuthorId;
      int currentSameAuthorStreak = sameAuthorStreak;
      ScoredPost nextPost = remainingPosts.stream().max(Comparator.comparingDouble((ScoredPost scoredPost) -> applyAuthorStreakPenalty(scoredPost, currentPreviousAuthorId, currentSameAuthorStreak)).thenComparing(scoredPost -> scoredPost.post().getCreationDate(), Comparator.reverseOrder()).thenComparing(scoredPost -> scoredPost.post().getId(), Comparator.reverseOrder())).orElse(null);

      if (nextPost == null) {
        break;
      }

      remainingPosts.remove(nextPost);
      if (Objects.equals(previousAuthorId, nextPost.post().getAuthor().getId()) && sameAuthorStreak >= 1) {
        selectedPosts.add(nextPost.withAdjustment("sameAuthorStreakPenalty", -feedRankingProperties.sameAuthorStreakPenalty()));
      } else {
        selectedPosts.add(nextPost);
      }

      Long currentAuthorId = nextPost.post().getAuthor().getId();
      if (Objects.equals(previousAuthorId, currentAuthorId)) {
        sameAuthorStreak++;
      } else {
        previousAuthorId = currentAuthorId;
        sameAuthorStreak = 1;
      }
    }

    return selectedPosts;
  }

  private double applyAuthorStreakPenalty(ScoredPost scoredPost, Long previousAuthorId, int sameAuthorStreak) {
    if (previousAuthorId == null || !Objects.equals(previousAuthorId, scoredPost.post().getAuthor().getId()) || sameAuthorStreak < 1) {
      return scoredPost.score();
    }

    return scoredPost.score() - feedRankingProperties.sameAuthorStreakPenalty();
  }

  private record ScoredPost(Post post, double score, Map<String, Double> breakdown) {
    private ScoredPost withAdjustment(String key, double adjustment) {
      Map<String, Double> nextBreakdown = new LinkedHashMap<>(breakdown);
      nextBreakdown.put(key, adjustment);
      return new ScoredPost(post, score + adjustment, nextBreakdown);
    }
  }
}
