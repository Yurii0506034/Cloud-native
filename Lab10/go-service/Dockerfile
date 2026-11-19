FROM golang:1.26-alpine AS build
WORKDIR /app
COPY go.mod* go.sum* ./
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -ldflags="-s -w" -trimpath -o bin/app ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /app/bin/app /app/app
USER nonroot:nonroot
EXPOSE 8080
CMD ["/app/app"]