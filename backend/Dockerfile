FROM golang:1.24-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/backend ./cmd

FROM alpine:3.22

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /out/backend /app/backend
COPY internal/db/migrations /app/internal/db/migrations

ENV MIGRATIONS_PATH=/app/internal/db/migrations

EXPOSE 8080

CMD ["/app/backend"]
