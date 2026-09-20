# Multi-Stage Build for KinBooks (Ultra-lightweight single container)

# 1. Build Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# 2. Build Backend
FROM golang:1.24-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Copy compiled web dist into web/dist so Echo can serve it
COPY --from=frontend-builder /app/web/dist ./web/dist
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /kinbooks ./cmd/server

# 3. Final Minimal Runtime Image (~30MB)
FROM alpine:3.21
WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata
ENV TZ=Asia/Seoul

# Create data directory for SQLite & uploads
RUN mkdir -p /app/data

COPY --from=backend-builder /kinbooks /app/kinbooks
COPY --from=frontend-builder /app/web/dist /app/web/dist

EXPOSE 8080
VOLUME ["/app/data"]

ENV DATA_DIR=/app/data
ENV DB_PATH=/app/data/kinbooks.db
ENV PORT=8080

CMD ["/app/kinbooks"]
