# Étape 1 : build
FROM rust:1-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY . .

ENV SQLX_OFFLINE=true

RUN cargo build --release

# Étape 2 : image finale, légère
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/vigil-server /app/vigil-server
COPY --from=builder /app/migrations /app/migrations

EXPOSE 8080

CMD ["/app/vigil-server"]