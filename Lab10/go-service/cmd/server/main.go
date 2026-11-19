package main

import (
    "context"
    "encoding/json"
    "log/slog"
    "math"
    "net/http"
    "os"
    "os/signal"
    "runtime"
    "strconv"
    "sync"
    "syscall"
    "time"

    "github.com/google/uuid"
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
    "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
    "go.opentelemetry.io/otel/propagation"
    "go.opentelemetry.io/otel/sdk/resource"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
    "go.opentelemetry.io/otel/trace"
    _ "go.uber.org/automaxprocs"
)

var (
    logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelInfo,
    })).With("service", "go-api")

    httpDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Help:    "Duration of HTTP requests in seconds",
            Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5},
        },
        []string{"method", "route", "status"},
    )
)

func init() {
    prometheus.MustRegister(httpDuration)
}

func initTracer(ctx context.Context) (*sdktrace.TracerProvider, error) {
    endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint == "" {
        endpoint = "jaeger:4318"
    }
    exporter, err := otlptracehttp.New(ctx,
        otlptracehttp.WithEndpoint(endpoint),
        otlptracehttp.WithInsecure(),
    )
    if err != nil {
        return nil, err
    }

    res, _ := resource.New(ctx,
        resource.WithAttributes(semconv.ServiceName("go-api")),
    )

    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(res),
    )
    otel.SetTracerProvider(tp)
    otel.SetTextMapPropagator(propagation.TraceContext{})
    return tp, nil
}

type statusRecorder struct {
    http.ResponseWriter
    status int
}

func (r *statusRecorder) WriteHeader(code int) {
    r.status = code
    r.ResponseWriter.WriteHeader(code)
}

func observabilityMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path == "/metrics" {
            next.ServeHTTP(w, r)
            return
        }
        start := time.Now()
        reqID := uuid.NewString()
        rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}

        spanCtx := trace.SpanContextFromContext(r.Context())
        traceID := ""
        if spanCtx.HasTraceID() {
            traceID = spanCtx.TraceID().String()
        }

        logger.Info("request in", "reqId", reqID, "trace_id", traceID, "method", r.Method, "url", r.URL.Path)

        next.ServeHTTP(rec, r)

        duration := time.Since(start).Seconds()
        httpDuration.WithLabelValues(r.Method, r.URL.Path, strconv.Itoa(rec.status)).Observe(duration)
        logger.Info("request out", "reqId", reqID, "trace_id", traceID, "status", rec.status)
    })
}

func heavyCPUChunk(iterations int) float64 {
    acc := 0.0
    for i := 1; i <= iterations; i++ {
        acc += math.Sqrt(float64(i)) * math.Sin(float64(i%97))
    }
    return acc
}

func runConcurrentCPU(workers, iterationsPerWorker int) float64 {
    if workers < 1 {
        workers = 1
    }
    var wg sync.WaitGroup
    partials := make([]float64, workers)

    for w := 0; w < workers; w++ {
        wg.Add(1)
        go func(idx int) {
            defer wg.Done()
            partials[idx] = heavyCPUChunk(iterationsPerWorker)
        }(w)
    }
    wg.Wait()

    var total float64
    for _, p := range partials {
        total += p
    }
    return total
}

// Pipeline: producer -> workers -> aggregator via channels with WaitGroup & context cancellation
func runPipeline(ctx context.Context, itemsCount, workerCount int) (int, int, error) {
    pCtx, cancel := context.WithCancel(ctx)
    defer cancel()

    jobs := make(chan int, 16)
    results := make(chan int, 16)

    // Producer
    go func() {
        defer close(jobs)
        for i := 1; i <= itemsCount; i++ {
            select {
            case <-pCtx.Done():
                return
            case jobs <- i:
            }
        }
    }()

    // Workers
    var wg sync.WaitGroup
    for w := 0; w < workerCount; w++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for job := range jobs {
                select {
                case <-pCtx.Done():
                    return
                case results <- job * 2:
                }
            }
        }()
    }

    // Close results once all workers finish
    go func() {
        wg.Wait()
        close(results)
    }()

    // Aggregator
    sum := 0
    processed := 0
    for val := range results {
        sum += val
        processed++
    }

    if err := pCtx.Err(); err != nil && err != context.Canceled {
        return processed, sum, err
    }
    return processed, sum, nil
}

func main() {
    ctx := context.Background()
    tp, err := initTracer(ctx)
    if err != nil {
        logger.Error("failed to init tracer", "err", err)
        os.Exit(1)
    }
    defer func() { _ = tp.Shutdown(ctx) }()

    tracer := otel.Tracer("go-api-service")
    mux := http.NewServeMux()

    mux.Handle("/metrics", promhttp.Handler())

    mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "go-api"})
    })

    mux.HandleFunc("/io", func(w http.ResponseWriter, r *http.Request) {
        _, span := tracer.Start(r.Context(), "go.io.simulated")
        defer span.End()

        timer := time.NewTimer(25 * time.Millisecond)
        defer timer.Stop()

        select {
        case <-r.Context().Done():
            http.Error(w, "request cancelled", http.StatusRequestTimeout)
            return
        case <-timer.C:
        }

        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]any{"mode": "io", "delay_ms": 25, "service": "go-api"})
    })

    mux.HandleFunc("/cpu", func(w http.ResponseWriter, r *http.Request) {
        _, span := tracer.Start(r.Context(), "go.cpu.goroutines")
        defer span.End()

        workers := runtime.NumCPU()
        val := runConcurrentCPU(workers, 150000)

        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]any{
            "mode":     "cpu",
            "workers":  workers,
            "computed": val,
            "service":  "go-api",
        })
    })

    mux.HandleFunc("/api/pipeline", func(w http.ResponseWriter, r *http.Request) {
        _, span := tracer.Start(r.Context(), "go.pipeline.run")
        defer span.End()

        processed, sum, pErr := runPipeline(r.Context(), 50, 4)
        if pErr != nil {
            http.Error(w, pErr.Error(), http.StatusInternalServerError)
            return
        }
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]any{
            "processed": processed,
            "sum":       sum,
            "service":   "go-api",
        })
    })

    mux.HandleFunc("/api/reports", func(w http.ResponseWriter, r *http.Request) {
        _, span := tracer.Start(r.Context(), "reports.generate")
        span.SetAttributes(attribute.String("op", "reports.generate"))
        defer span.End()

        hostname, _ := os.Hostname()
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]any{
            "report":   "System Metrics Summary",
            "instance": hostname,
            "pid":      os.Getpid(),
        })
    })

    handler := otelhttp.NewHandler(observabilityMiddleware(mux), "go-http-server")

    srv := &http.Server{
        Addr:    ":8080",
        Handler: handler,
    }

    go func() {
        logger.Info("server started", "port", 8080)
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            logger.Error("listen failed", "err", err)
            os.Exit(1)
        }
    }()

    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
    <-quit
    logger.Info("shutting down go service")

    shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    _ = srv.Shutdown(shutdownCtx)
}