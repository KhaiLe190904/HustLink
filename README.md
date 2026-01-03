# Run be
docker-compose up
./gradlew build -t-x test
./gradlew bootRun

# Run fe
npm install
npm run dev
