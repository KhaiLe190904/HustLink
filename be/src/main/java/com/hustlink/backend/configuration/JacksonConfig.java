package com.hustlink.backend.configuration;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import java.io.IOException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

  @Bean
  public Jackson2ObjectMapperBuilderCustomizer jsonCustomizer() {
    return builder -> {
      builder.serializerByType(LocalDateTime.class, new JsonSerializer<LocalDateTime>() {
        @Override
        public void serialize(LocalDateTime value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
          if (value != null) {
            // Convert to ZonedDateTime using UTC timezone, then format with offset
            ZonedDateTime zonedDateTime = value.atZone(ZoneId.of("UTC"));
            gen.writeString(zonedDateTime.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
          }
        }
      });

      builder.deserializerByType(LocalDateTime.class, new JsonDeserializer<LocalDateTime>() {
        @Override
        public LocalDateTime deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
          String dateStr = p.getText();
          if (dateStr == null || dateStr.isBlank()) {
            return null;
          }
          try {
            if (dateStr.endsWith("Z") || dateStr.contains("+") || dateStr.lastIndexOf("-") > 10) {
              return Instant.parse(dateStr).atZone(ZoneId.of("UTC")).toLocalDateTime();
            }
            return LocalDateTime.parse(dateStr);
          } catch (Exception e) {
            return LocalDateTime.parse(dateStr);
          }
        }
      });
    };
  }
}
