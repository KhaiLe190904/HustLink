package com.hustlink.backend.features.storage.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "storage")
public record StorageProperties(
                                boolean enabled,
                                String endpoint,
                                String region,
                                String accessKey,
                                String secretKey,
                                boolean pathStyleAccess,
                                String publicBaseUrl,
                                String publicBucket,
                                String privateBucket,
                                String mediaBucket,
                                int presignExpirationMinutes,
                                long maxUploadSizeBytes,
                                String ffmpegBin,
                                int videoMaxWidth,
                                int videoCrf,
                                String videoAudioBitrate) {

  private static final String DEFAULT_STORAGE_ENDPOINT = "http://192.168.100.36:9000";
  private static final String FALLBACK_STORAGE_ENDPOINT = "https://s3-hustlink.lekhai.id.vn";

  public String endpointOrDefault() {
    return firstNonBlank(endpoint, DEFAULT_STORAGE_ENDPOINT, FALLBACK_STORAGE_ENDPOINT);
  }

  public String publicBaseUrlOrDefault() {
    return firstNonBlank(publicBaseUrl, FALLBACK_STORAGE_ENDPOINT);
  }

  public String regionOrDefault() {
    return isBlank(region) ? "us-east-1" : region;
  }

  public String publicBucketOrDefault() {
    return isBlank(publicBucket) ? "hustlink-public" : publicBucket;
  }

  public String privateBucketOrDefault() {
    return isBlank(privateBucket) ? "hustlink-private" : privateBucket;
  }

  public String mediaBucketOrDefault() {
    return isBlank(mediaBucket) ? "hustlink-media" : mediaBucket;
  }

  public int presignExpirationMinutesOrDefault() {
    return presignExpirationMinutes <= 0 ? 30 : presignExpirationMinutes;
  }

  public long maxUploadSizeBytesOrDefault() {
    return maxUploadSizeBytes <= 0 ? 25L * 1024 * 1024 : maxUploadSizeBytes;
  }

  public String ffmpegBinOrDefault() {
    return isBlank(ffmpegBin) ? "ffmpeg" : ffmpegBin;
  }

  public int videoMaxWidthOrDefault() {
    return videoMaxWidth <= 0 ? 1280 : videoMaxWidth;
  }

  public int videoCrfOrDefault() {
    return videoCrf <= 0 ? 32 : videoCrf;
  }

  public String videoAudioBitrateOrDefault() {
    return isBlank(videoAudioBitrate) ? "96k" : videoAudioBitrate;
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      if (!isBlank(value)) {
        return value;
      }
    }
    return "";
  }

  private boolean isBlank(String value) {
    return value == null || value.isBlank();
  }
}
