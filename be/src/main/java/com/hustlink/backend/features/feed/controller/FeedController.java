package com.hustlink.backend.features.feed.controller;

import com.hustlink.backend.features.authentication.model.User;
import com.hustlink.backend.features.feed.dto.CommentDto;
import com.hustlink.backend.features.feed.dto.PostDto;
import com.hustlink.backend.features.feed.model.Comment;
import com.hustlink.backend.features.feed.model.Post;
import com.hustlink.backend.features.feed.service.FeedService;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/feed")
public class FeedController {
  private final FeedService feedService;

  @GetMapping("")
  public ResponseEntity<List<Post>> getFeedPosts(@RequestAttribute("authenticationUser") User user) {
    List<Post> posts = feedService.getFeedPost(user.getId());
    return ResponseEntity.ok(posts);
  }

  @GetMapping("/posts")
  public ResponseEntity<List<Post>> getAllPost() {
    List<Post> posts = feedService.getAllPost();
    return ResponseEntity.ok(posts);
  }

  @PostMapping("/posts")
  public ResponseEntity<Post> createPost(@RequestBody PostDto postDto, @RequestAttribute("authenticationUser") User user) {
    Post post = feedService.createPost(postDto, user.getId());
    return ResponseEntity.ok(post);
  }

  @PutMapping("/posts/{postId}")
  public ResponseEntity<Post> editPost(@PathVariable Long postId, @RequestBody PostDto postDto, @RequestAttribute("authenticationUser") User user) {
    Post post = feedService.editPost(postId, user.getId(), postDto);
    return ResponseEntity.ok(post);
  }

  @GetMapping("/posts/{postId}")
  public ResponseEntity<Post> getPost(@PathVariable Long postId) {
    Post post = feedService.getPost(postId);
    return ResponseEntity.ok(post);
  }

  @DeleteMapping("/posts/{postId}")
  public ResponseEntity<Void> deletePost(@PathVariable Long postId, @RequestAttribute("authenticationUser") User user) {
    feedService.deletePost(postId, user.getId());
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/posts/user/{userId}")
  public ResponseEntity<List<Post>> getPostByUserId(@PathVariable Long userId) {
    List<Post> posts = feedService.getPostByUserId(userId);
    return ResponseEntity.ok(posts);
  }

  @PutMapping("/posts/{postId}/like")
  public ResponseEntity<Post> likePost(@PathVariable Long postId, @RequestAttribute("authenticationUser") User user) {
    Post post = feedService.likePost(postId, user.getId());
    return ResponseEntity.ok(post);
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
