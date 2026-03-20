FROM oven/bun:1.3.11 AS builder

WORKDIR /app

# Install root workspace deps
COPY package.json bun.lock* ./
RUN bun install

# Build lvthn-web
COPY lvthn-web/ lvthn-web/
WORKDIR /app/lvthn-web
RUN bun install && bun run build.ts

# Build lvthn-chat client
WORKDIR /app
COPY lvthn-chat/ lvthn-chat/
WORKDIR /app/lvthn-chat
RUN bun install
WORKDIR /app/lvthn-chat/client
RUN bun run build.ts

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM oven/bun:1.3.11-slim

WORKDIR /app

# Server entrypoint
COPY server.ts ./

# Landing pages
COPY public/ public/

# Built demo HTML files
COPY --from=builder /app/lvthn-web/lvthn.html              public/lvthn.html
COPY --from=builder /app/lvthn-chat/client/lvthn-chat.html public/lvthn-chat.html

EXPOSE 8080

CMD ["bun", "run", "server.ts"]
