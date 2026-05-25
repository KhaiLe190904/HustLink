package com.hustlink.backend.features.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;

@Service
@Slf4j
@RequiredArgsConstructor
public class CVParserService {

  private final RestTemplate restTemplate;
  private final ObjectMapper objectMapper;

  @Value("${unstructured.api.url:http://localhost:8000/general/v0/general}")
  private String unstructuredApiUrl;

  @Value("${unstructured.api.enabled:false}")
  private boolean unstructuredApiEnabled;

  public String extractTextFromPdf(MultipartFile file) throws IOException {
    if (unstructuredApiEnabled) {
      try {
        log.info("Attempting to parse PDF using Unstructured API: {}", unstructuredApiUrl);
        return parseWithUnstructured(file);
      } catch (Exception e) {
        log.warn("Unstructured API parsing failed, falling back to local PDFBox parser. Error: {}", e.getMessage());
      }
    }
    return extractTextLocal(file);
  }

  private String parseWithUnstructured(MultipartFile file) throws IOException {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.MULTIPART_FORM_DATA);

    MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
    ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
      @Override
      public String getFilename() {
        return file.getOriginalFilename() != null ? file.getOriginalFilename() : "cv.pdf";
      }
    };
    body.add("files", fileResource);
    body.add("strategy", "hi_res");
    body.add("languages", new String[]{"vie", "eng"});

    HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
    ResponseEntity<String> response = restTemplate.postForEntity(unstructuredApiUrl, requestEntity, String.class);

    if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
      return convertElementsToMarkdown(response.getBody());
    } else {
      throw new IOException("Unstructured API returned non-OK status: " + response.getStatusCode());
    }
  }

  private String convertElementsToMarkdown(String jsonResponse) throws IOException {
    try {
      JsonNode root = objectMapper.readTree(jsonResponse);
      if (!root.isArray()) {
        throw new IOException("Unstructured API response is not a valid JSON array.");
      }

      StringBuilder markdown = new StringBuilder();
      for (JsonNode element : root) {
        String type = element.path("type").asText("");
        String text = element.path("text").asText("").trim();

        if (text.isEmpty()) {
          continue;
        }

        // Lọc bỏ Header, Footer, PageBreak
        if ("Header".equals(type) || "Footer".equals(type) || "PageBreak".equals(type)) {
          continue;
        }

        switch (type) {
          case "Title":
            markdown.append("\n\n## ").append(text).append("\n\n");
            break;
          case "ListItem":
            markdown.append("- ").append(text).append("\n");
            break;
          case "Table":
            markdown.append("\n").append(text).append("\n");
            break;
          default:
            markdown.append(text).append("\n\n");
            break;
        }
      }
      return markdown.toString().replaceAll("\\n{3,}", "\n\n").trim();
    } catch (Exception e) {
      log.error("Failed to convert Unstructured JSON to Markdown", e);
      throw new IOException("Failed to convert Unstructured JSON to Markdown", e);
    }
  }

  private String extractTextLocal(MultipartFile file) throws IOException {
    log.info("Extracting text locally using PDFBox TextStripper");
    try (InputStream inputStream = file.getInputStream(); RandomAccessReadBuffer buffer = new RandomAccessReadBuffer(inputStream); PDDocument document = Loader.loadPDF(buffer)) {
      PDFTextStripper stripper = new PDFTextStripper();
      String text = stripper.getText(document);
      return text == null ? "" : text.trim();
    }
  }
}
