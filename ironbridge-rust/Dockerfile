# Build stage
FROM rust:1.75-alpine AS builder

# Install build dependencies
RUN apk add --no-cache musl-dev

WORKDIR /app

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Create a dummy main.rs to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies (this layer will be cached)
RUN cargo build --release && rm -rf src

# Copy actual source code
COPY src ./src
COPY tests ./tests

# Touch main.rs to force rebuild of our code
RUN touch src/main.rs

# Build the actual binary
RUN cargo build --release --bin ironbridge

# Runtime stage
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache ca-certificates

# Create non-root user
RUN addgroup -g 1000 ironbridge && \
    adduser -u 1000 -G ironbridge -s /bin/sh -D ironbridge

# Copy binary from builder
COPY --from=builder /app/target/release/ironbridge /usr/local/bin/ironbridge

# Create data directory
RUN mkdir -p /data && chown ironbridge:ironbridge /data

# Switch to non-root user
USER ironbridge

# Set working directory
WORKDIR /data

# Default environment
ENV IRONBRIDGE_DATABASE_PATH=/data/ironbridge.db

# OpenTelemetry (override at runtime via docker run -e)
ENV OTEL_EXPORTER_OTLP_ENDPOINT=""
ENV OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
ENV OTEL_EXPORTER_OTLP_HEADERS=""
ENV OTEL_SERVICE_NAME="ironbridge-cli"

# Expose API port
EXPOSE 8787

# Default command
CMD ["ironbridge", "api", "serve", "--host", "0.0.0.0"]
