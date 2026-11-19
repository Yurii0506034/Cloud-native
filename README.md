# Cloud Native — Release Stand (Labs 1–10)

Крос-технологічний серверний комплекс (Node.js + Go за Nginx reverse proxy) з обсерваційністю (Prometheus, Grafana, Jaeger), персистентністю (PostgreSQL, MongoDB) та навантажувальними артефактами.

## Швидкий запуск повного стенду (однією командою)

```bash
docker compose -f ./Lab10/docker-compose.yml up -d --build
docker compose -f ./Lab10/docker-compose.yml ps
```

## Ключові артефакти Лабораторної роботи №10

- Lab10/docker-compose.yml — повний реліз-стенд усіх сервісів та мережі моніторингу.
- Lab10/benchmarks/results.json — звіт навантажувального прогону k6.
- Lab10/benchmarks/ab-go-reports.txt та Lab10/benchmarks/ab-node-health.txt — консольні заміри ApacheBench (b).
- BENCHMARK_REPORT.md — підсумковий Observability & Benchmarking Report, мапінг тем 1–10 та Architecture Review.
