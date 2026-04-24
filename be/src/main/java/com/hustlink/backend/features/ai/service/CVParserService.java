package com.hustlink.backend.features.ai.service;

import java.io.IOException;
import java.io.InputStream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class CVParserService {
  public String extractTextFromPdf(MultipartFile file) throws IOException {
    try (InputStream inputStream = file.getInputStream(); PDDocument document = Loader.loadPDF(inputStream.readAllBytes())) {
      PDFTextStripper stripper = new PDFTextStripper();
      String text = stripper.getText(document);
      return text == null ? "" : text.trim();
    }
  }
}
