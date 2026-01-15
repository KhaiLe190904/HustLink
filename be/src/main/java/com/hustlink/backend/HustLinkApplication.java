package com.hustlink.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class HustLinkApplication {

  public static void main(String[] args) {
    SpringApplication.run(HustLinkApplication.class, args);
  }
}
