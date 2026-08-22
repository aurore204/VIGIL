FROM rust:1.77-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    pkg-config \
    libwebkit2gtk-4.1-dev \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libxdo-dev \
    file \
    wget \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

RUN cargo install tauri-cli --version "^2"

COPY client_web /build/client_web
RUN cd /build/client_web && npm install && npm run build

COPY client_desktop /build/client_desktop
RUN cd /build/client_desktop/src-tauri && cargo tauri build --bundles appimage

FROM debian:bookworm-slim

RUN mkdir -p /output
COPY --from=builder /build/client_desktop/src-tauri/target/release/bundle/appimage/*.AppImage /output/client.AppImage

CMD ["true"]