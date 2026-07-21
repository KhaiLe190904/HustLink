package com.hustlink.backend.features.storage.configuration;

import java.net.URI;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class StorageConfiguration {
  @Bean
  public S3Client s3Client(StorageProperties properties) {
    return S3Client.builder().endpointOverride(URI.create(properties.endpointOrDefault())).region(Region.of(properties.regionOrDefault())).credentialsProvider(StaticCredentialsProvider.create(
            AwsBasicCredentials.create(accessKeyOrDefault(properties), secretKeyOrDefault(properties)))).serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(properties.pathStyleAccess()).build()).build();
  }

  @Bean
  public S3Presigner s3Presigner(StorageProperties properties) {
    return S3Presigner.builder().endpointOverride(URI.create(properties.publicBaseUrlOrDefault())).region(Region.of(properties.regionOrDefault())).credentialsProvider(StaticCredentialsProvider.create(
            AwsBasicCredentials.create(accessKeyOrDefault(properties), secretKeyOrDefault(properties)))).serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(properties.pathStyleAccess()).build()).build();
  }

  private String accessKeyOrDefault(StorageProperties properties) {
    return properties.accessKey() == null || properties.accessKey().isBlank() ? "disabled-access-key" : properties.accessKey();
  }

  private String secretKeyOrDefault(StorageProperties properties) {
    return properties.secretKey() == null || properties.secretKey().isBlank() ? "disabled-secret-key" : properties.secretKey();
  }
}
