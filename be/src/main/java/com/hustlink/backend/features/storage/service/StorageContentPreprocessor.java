package com.hustlink.backend.features.storage.service;

import com.hustlink.backend.features.storage.configuration.StorageProperties;
import com.hustlink.backend.features.storage.model.StorageScope;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import javax.imageio.ImageIO;
import lombok.RequiredArgsConstructor;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class StorageContentPreprocessor {
  private static final Set<StorageScope> VIDEO_SCOPES = Set.of(StorageScope.FEED_VIDEO, StorageScope.MESSAGE_VIDEO);
  private static final int IMAGE_MAX_DIMENSION = 1280;
  private static final float IMAGE_QUALITY = 0.28f;

  private final StorageProperties storageProperties;

  public PreparedUpload preprocess(MultipartFile file, StorageScope scope) throws IOException {
    byte[] originalBytes = file.getBytes();
    long originalSize = originalBytes.length;
    String originalContentType = file.getContentType() == null ? "application/octet-stream" : file.getContentType();

    validateSize(originalSize, file.getOriginalFilename());

    if (scope == StorageScope.CV || originalContentType.equals("application/pdf")) {
      return new PreparedUpload(originalBytes, originalContentType, false, originalSize, file.getOriginalFilename());
    }

    if (originalContentType.startsWith("image/")) {
      return optimizeImage(originalBytes, originalContentType, file.getOriginalFilename());
    }

    if (VIDEO_SCOPES.contains(scope) && originalContentType.startsWith("video/")) {
      return optimizeVideo(originalBytes, file.getOriginalFilename());
    }

    return new PreparedUpload(originalBytes, originalContentType, false, originalSize, file.getOriginalFilename());
  }

  private PreparedUpload optimizeImage(byte[] originalBytes, String originalContentType, String originalName) throws IOException {
    if (originalContentType.equals("image/gif") || originalContentType.equals("image/svg+xml")) {
      return new PreparedUpload(originalBytes, originalContentType, false, (long) originalBytes.length, originalName);
    }

    BufferedImage sourceImage = ImageIO.read(new ByteArrayInputStream(originalBytes));
    if (sourceImage == null) {
      return new PreparedUpload(originalBytes, originalContentType, false, (long) originalBytes.length, originalName);
    }

    BufferedImage normalizedImage = forceRgb(sourceImage);
    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
    Thumbnails.of(normalizedImage).size(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION).outputFormat("jpg").outputQuality(IMAGE_QUALITY).toOutputStream(outputStream);

    byte[] optimizedBytes = outputStream.toByteArray();
    if (optimizedBytes.length >= originalBytes.length) {
      return new PreparedUpload(originalBytes, originalContentType, false, (long) originalBytes.length, originalName);
    }

    String optimizedName = replaceExtension(originalName, ".jpg");
    return new PreparedUpload(optimizedBytes, "image/jpeg", true, (long) originalBytes.length, optimizedName);
  }

  private PreparedUpload optimizeVideo(byte[] originalBytes, String originalName) throws IOException {
    Path inputFile = Files.createTempFile("hustlink-video-in-", originalExtension(originalName, ".mp4"));
    Path outputFile = Files.createTempFile("hustlink-video-out-", ".mp4");
    try {
      Files.write(inputFile, originalBytes);

      List<String> command = List.of(
              storageProperties.ffmpegBinOrDefault(), "-y", "-i", inputFile.toString(), "-vf", "scale=min(%d\\,iw):-2".formatted(storageProperties.videoMaxWidthOrDefault()), "-c:v", "libx264", "-preset", "veryslow", "-crf", String.valueOf(storageProperties.videoCrfOrDefault()), "-movflags", "+faststart", "-c:a", "aac", "-b:a", storageProperties.videoAudioBitrateOrDefault(), outputFile.toString());

      Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
      process.getInputStream().transferTo(OutputStream.nullOutputStream());
      int exitCode;
      try {
        exitCode = process.waitFor();
      } catch (InterruptedException exception) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException("Video compression interrupted.", exception);
      }

      if (exitCode != 0 || !Files.exists(outputFile)) {
        throw new IllegalStateException("FFmpeg failed to compress the uploaded video.");
      }

      byte[] optimizedBytes = Files.readAllBytes(outputFile);
      if (optimizedBytes.length >= originalBytes.length) {
        return new PreparedUpload(originalBytes, "video/mp4", false, (long) originalBytes.length, replaceExtension(originalName, ".mp4"));
      }

      return new PreparedUpload(optimizedBytes, "video/mp4", true, (long) originalBytes.length, replaceExtension(originalName, ".mp4"));
    } finally {
      Files.deleteIfExists(inputFile);
      Files.deleteIfExists(outputFile);
    }
  }

  private void validateSize(long sizeInBytes, String fileName) {
    if (sizeInBytes > storageProperties.maxUploadSizeBytesOrDefault()) {
      throw new IllegalArgumentException(
              "File '%s' is too large. Maximum allowed size is 25MB.".formatted(fileName == null ? "upload" : fileName));
    }
  }

  private BufferedImage forceRgb(BufferedImage sourceImage) {
    BufferedImage rgbImage = new BufferedImage(sourceImage.getWidth(), sourceImage.getHeight(), BufferedImage.TYPE_INT_RGB);
    var graphics = rgbImage.createGraphics();
    graphics.setColor(Color.WHITE);
    graphics.fillRect(0, 0, sourceImage.getWidth(), sourceImage.getHeight());
    graphics.drawImage(sourceImage, 0, 0, null);
    graphics.dispose();
    return rgbImage;
  }

  private String replaceExtension(String originalName, String extension) {
    String base = originalName == null || originalName.isBlank() ? "file" : originalName;
    int dotIndex = base.lastIndexOf('.');
    return dotIndex >= 0 ? base.substring(0, dotIndex) + extension : base + extension;
  }

  private String originalExtension(String originalName, String fallback) {
    if (originalName == null || originalName.isBlank()) {
      return fallback;
    }
    int dotIndex = originalName.lastIndexOf('.');
    return dotIndex >= 0 ? originalName.substring(dotIndex) : fallback;
  }

  public record PreparedUpload(
                               byte[] bytes,
                               String contentType,
                               boolean optimized,
                               Long originalSizeInBytes,
                               String objectFileName) {
  }
}
