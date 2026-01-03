# Run be
docker-compose up
./gradlew build -t-x test
./gradlew bootRun

# Run fe
npm install
npm run dev

# Format Code

## Format all code (Frontend + Backend)
```bash
# Windows
.\format.bat

# Linux/Mac
./format.sh
```

## Check formatting (without fixing)
```bash
# Windows
.\format-check.bat

# Linux/Mac
./format-check.sh
```

## Format individually

### Frontend
```bash
cd fe
npm run format          # Format code
npm run format:check     # Check formatting
```

### Backend
```bash
cd be
./gradlew spotlessApply  # Format code
./gradlew spotlessCheck  # Check formatting
```
