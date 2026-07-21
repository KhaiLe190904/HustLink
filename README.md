# HustLink

HustLink là nền tảng tuyển dụng trực tuyến giúp kết nối ứng viên với nhà tuyển dụng. Hệ thống hỗ trợ quản lý hồ sơ, đăng và tìm kiếm việc làm, ứng tuyển, nhắn tin, đồng thời tích hợp AI để phân tích CV, gợi ý công việc và mô phỏng phỏng vấn.

## Yêu cầu môi trường

- Java 21
- Node.js 20 trở lên
- Docker và Docker Compose

## Cài đặt và chạy dự án

### 1. Khởi động các dịch vụ phụ trợ

Các dịch vụ SQL Server, Qdrant và Unstructured được cấu hình trong `be/docker-compose.yml`.

```bash
cd be
docker compose up -d
```

Ở lần chạy đầu tiên, hãy tạo database `hust_link` trong SQL Server nếu database chưa tồn tại.

### 2. Chạy Backend

Backend mặc định chạy tại `http://localhost:8080`.

```bash
cd be

# Windows
./gradlew.bat bootRun

# Linux/macOS
./gradlew bootRun
```

Các thông tin kết nối database, Google OAuth, Gemini và dịch vụ email có thể được cấu hình trong `be/src/main/resources/application.properties` hoặc thông qua biến môi trường tương ứng.

### 3. Chạy Frontend

Tạo file `fe/.env` từ `fe/env.template`, sau đó cập nhật các giá trị cần thiết như `VITE_API_URL` và Google Client ID.

```bash
cd fe
npm install
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173`.

## Chạy bản production bằng Docker

Đảm bảo các biến môi trường production đã được cấu hình, sau đó chạy:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

## Kiểm tra và định dạng mã nguồn

```bash
# Frontend
cd fe
npm run build
npm run lint
npm run format:check

# Backend
cd be
./gradlew test
./gradlew spotlessApply
```

Hoặc định dạng toàn bộ dự án bằng `format.bat` trên Windows và `format.sh` trên Linux/macOS.
