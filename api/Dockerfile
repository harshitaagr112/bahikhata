FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/tally-api .

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/tally-api /tally-api
EXPOSE 8080
ENTRYPOINT ["/tally-api"]
