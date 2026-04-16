package com.hustlink.backend.features.feed.controller;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.feed.dto.CommentDto;
import com.hustlink.backend.features.feed.dto.PostDto;
import com.hustlink.backend.features.feed.dto.PostResponseDto;
import com.hustlink.backend.features.feed.dto.ViewedPostsRequestDto;
import com.hustlink.backend.features.feed.model.Comment;
import com.hustlink.backend.features.feed.model.Post;
import com.hustlink.backend.features.feed.service.FeedService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/feed")
public class FeedController {
  private final FeedService feedService;

  @GetMapping("")
  public ResponseEntity<List<PostResponseDto>> getFeedPosts(@RequestAttribute("authenticationUser") User user) {
    List<Post> posts = feedService.getFeedPost(user.getId());
    return ResponseEntity.ok(posts.stream().map(post -> PostResponseDto.from(post, user.getId())).collect(Collectors.toList()));
  }

  @GetMapping("/paginated")
  public ResponseEntity<Page<PostResponseDto>> getFeedPostsPaginated(
                                                                     @RequestAttribute("authenticationUser") User user, @PageableDefault(size = 5) Pageable pageable) {
    return ResponseEntity.ok(feedService.getFeedPostDto(user.getId(), pageable));
  }

  @PostMapping("/impressions/viewed")
  public ResponseEntity<Void> markFeedPostsViewed(
                                                  @RequestAttribute("authenticationUser") User user, @RequestBody ViewedPostsRequestDto requestDto) {
    feedService.markPostsAsViewed(user.getId(), requestDto);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/posts")
  public ResponseEntity<List<Post>> getAllPost() {
    List<Post> posts = feedService.getAllPost();
    return ResponseEntity.ok(posts);
  }

  @PostMapping("/posts")
  public ResponseEntity<PostResponseDto> createPost(@RequestBody PostDto postDto, @RequestAttribute("authenticationUser") User user) {
    Post post = feedService.createPost(postDto, user.getId());
    return ResponseEntity.ok(PostResponseDto.from(post, user.getId()));
  }

  @PutMapping("/posts/{postId}")
  public ResponseEntity<PostResponseDto> editPost(@PathVariable Long postId, @RequestBody PostDto postDto, @RequestAttribute("authenticationUser") User user) {
    Post post = feedService.editPost(postId, user.getId(), postDto);
    return ResponseEntity.ok(PostResponseDto.from(post, user.getId()));
  }

  @GetMapping("/posts/{postId}")
  public ResponseEntity<PostResponseDto> getPost(@PathVariable Long postId, @RequestAttribute("authenticationUser") User user) {
    Post post = feedService.getPost(postId);
    return ResponseEntity.ok(PostResponseDto.from(post, user.getId()));
  }

  @DeleteMapping("/posts/{postId}")
  public ResponseEntity<Void> deletePost(@PathVariable Long postId, @RequestAttribute("authenticationUser") User user) {
    feedService.deletePost(postId, user.getId());
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/posts/user/{userId}")
  public ResponseEntity<List<PostResponseDto>> getPostByUserId(@PathVariable Long userId, @RequestAttribute("authenticationUser") User user) {
    List<Post> posts = feedService.getPostByUserId(userId);
    return ResponseEntity.ok(posts.stream().map(post -> PostResponseDto.from(post, user.getId())).collect(Collectors.toList()));
  }

  @GetMapping("/posts/user/{userId}/paginated")
  public ResponseEntity<Page<PostResponseDto>> getPostByUserIdPaginated(
                                                                        @RequestAttribute("authenticationUser") User user, @PathVariable Long userId, @PageableDefault(size = 20) Pageable pageable) {
    return ResponseEntity.ok(feedService.getPostByUserIdDto(userId, user.getId(), pageable));
  }

  @PutMapping("/posts/{postId}/like")
  public ResponseEntity<PostResponseDto> likePost(@PathVariable Long postId, @RequestAttribute("authenticationUser") User user) {
    Post post = feedService.likePost(postId, user.getId());
    return ResponseEntity.ok(PostResponseDto.from(post, user.getId()));
  }

  @GetMapping("/posts/{postId}/likes")
  public ResponseEntity<Set<User>> getPostLikes(@PathVariable Long postId) {
    Set<User> likes = feedService.getPostLikes(postId);
    return ResponseEntity.ok(likes);
  }

  @PostMapping("/posts/{postId}/comments")
  public ResponseEntity<Comment> addComment(@PathVariable Long postId, @RequestBody CommentDto commentDto, @RequestAttribute("authenticationUser") User user) {
    Comment comment = feedService.addComment(postId, user.getId(), commentDto.getContent());
    return ResponseEntity.ok(comment);
  }

  @GetMapping("/posts/{postId}/comments")
  public ResponseEntity<List<Comment>> getComments(@PathVariable Long postId) {
    List<Comment> comments = feedService.getPostComments(postId);
    return ResponseEntity.ok(comments);
  }

  @GetMapping("/posts/{postId}/comments/paginated")
  public ResponseEntity<Page<Comment>> getCommentsPaginated(
                                                            @PathVariable Long postId, @PageableDefault(size = 20) Pageable pageable) {
    return ResponseEntity.ok(feedService.getPostComments(postId, pageable));
  }

  @GetMapping("/posts/{postId}/comments/count")
  public ResponseEntity<Long> getCommentsCount(@PathVariable Long postId) {
    return ResponseEntity.ok(feedService.getPostCommentsCount(postId));
  }

  @DeleteMapping("/comments/{commentId}")
  public ResponseEntity<Void> deleteComment(@PathVariable Long commentId, @RequestAttribute("authenticationUser") User user) {
    feedService.deleteComment(commentId, user.getId());
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/comments/{commentId}")
  public ResponseEntity<Comment> editComment(@PathVariable Long commentId, @RequestBody CommentDto commentDto, @RequestAttribute("authenticationUser") User user) {
    Comment comment = feedService.editComment(commentId, user.getId(), commentDto.getContent());
    return ResponseEntity.ok(comment);
  }
}
