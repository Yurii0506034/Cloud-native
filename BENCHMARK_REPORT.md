# Observability & Benchmarking Report (Lab 10)

## 1. Архітектура стенду

Потік запитів у реліз-стенді `Lab10` проходить через публічний периметр **Nginx** (HTTP `80` -> `301` HTTPS `443`, TLS termination, security-заголовки) до гетерогенного бекенду (**3 репліки Node.js** для API/CRUD/Auth/подій та **Go-сервіс** у `distroless:nonroot` для звітів і конкурентних сценаріїв), спирається на **PostgreSQL** та **MongoDB** і експортує метрики, JSON-логи та OTLP-трейси в **Prometheus**, **Grafana** та **Jaeger**.

| Сервіс (`Lab10/docker-compose.yml`) | Роль у реліз-стенді | Пов'язані теми курсу (ЛР №1–10) |
| :--- | :--- | :--- |
| `nginx` (`nginx:1.27-alpine`) | Reverse proxy, SSL termination (`80 -> 301 -> 443`), балансування, кеш, security-заголовки | ЛР №8, ЛР №10 |
| `node-app-1..3` (`node:20-alpine` multi-stage + obfuscation) | Основний HTTP/API-сервіс (реєстрація, логін, CRUD користувачів, події, stream-експорт, `/io`, `/cpu`) | ЛР №1, №2, №4, №5, №6, №7, №9, №10 |
| `go-app` (`golang:1.26-alpine` -> `gcr.io/distroless/static-debian12:nonroot`, `-ldflags="-s -w" -trimpath`) | Високопродуктивний Go-сервіс (`/api/reports`, `/io`, `/cpu`, pipeline з `WaitGroup`/`context`/каналами) | ЛР №1, №2, №3, №7, №9, №10 |
| `postgres` (`postgres:16-alpine`) | Реляційне сховище (`healthcheck` увімкнено) | ЛР №6, ЛР №10 |
| `mongo` (`mongo:7`) | Документо-орієнтоване сховище для подій/аудиту (`healthcheck` увімкнено) | ЛР №6, ЛР №10 |
| `prometheus` (`prom/prometheus:latest`) | Збір метрик з `node-api`, `go-api`, `nginx-exporter` (`up = 1` для всіх таргетів) | ЛР №9, №10 |
| `grafana` (`grafana/grafana:latest`, порт `3001`) | Візуалізація золотих сигналів (RPS, Errors, p50/p95/p99, Saturation) | ЛР №9, №10 |
| `jaeger` (`jaegertracing/all-in-one:latest`, порти `4318`, `16686`) | Прийом OTLP HTTP трейсів (`node-api`, `go-api`) та кореляція з `trace_id` у логах | ЛР №9, №10 |
| `nginx-exporter` (`nginx/nginx-prometheus-exporter:1.3`) | Експорт метрик стану Nginx у Prometheus | ЛР №8, ЛР №9, №10 |

---

## 2. Золоті сигнали

Спостереження під час навантажувальних прогонів (`k6` та `ab`) фіксувалося через Prometheus (`http://localhost:9090`), Grafana (`http://localhost:3001`) і Jaeger (`http://localhost:16686`):

- **RPS**: На точковому прогоні `ab -n 2000 -c 50` Go-маршрут `/api/reports` досяг **5 407.38 req/s**, а Node-маршрут `/health` через пул реплік — **3 426.56 req/s**. У `k6` (драбина до `80 VUs` за `55s`, `35 883` ітерації / `71 766` запитів) сумарна інтенсивність склала **1 304.48 req/s**.
- **Errors**: У `ab` зафіксовано **0** невдалих запитів (`Failed requests: 0`) для обох стеків. У `k6` поріг `http_req_duration p(95) < 300 ms` виконано (`3.1 ms`), тоді як `http_req_failed` склав `50.00%` (`35 883 / 71 766`), оскільки маршрут `/health` на зовнішньому порту Nginx не замаплений у `location /` (`404`), тоді як `/api/reports` повертав `200`.
- **Latency (p50 / p95 / p99)**: За замірами `ab` (`n=2000, c=50`): Go `/api/reports` — `p50=9 ms`, `p95=12 ms`, `p99=15 ms`; Node `/health` — `p50=13 ms`, `p95=27 ms`, `p99=36 ms`. У `k6` загальний `p(95)` склав `3.1 ms` (для очікуваних відповідей `p(95)=4.43 ms`, `max=107.49 ms`).
- **Saturation**: На момент зняття метрик у Prometheus `go_goroutines` для `go-app:8080` становив **9** горутин (стабільний рівень без витоку горутин), а споживання RAM залишалося помірним (`11.13 MiB` у `go-app-1` та `35.84–38.74 MiB` у репліках `node-app-1..3`).

---

## 3. Порівняльний бенчмарк Node.js vs Go

### Параметри стенду
- **Оточення**: Docker Compose (`Lab10`), хост із лімітом пам'яті в `docker stats` `7.724 GiB`, без жорстких `cpus`/`mem_limit` квот у `compose`-сервісах додатків.
- **Кількість реплік**: `node-app-1`, `node-app-2`, `node-app-3` (3 репліки Node.js), `go-app` (1 репліка Go у `distroless:nonroot`).
- **Версії стеків**: Node.js `20-alpine` (`pino`, `prom-client`, OpenTelemetry SDK), Go `1.26-alpine` (збірка в `distroless:nonroot` з `-ldflags="-s -w" -trimpath`).
- **Збережені артефакти**: `Lab10/benchmarks/results.json`, `Lab10/benchmarks/ab-go-reports.txt`, `Lab10/benchmarks/ab-node-health.txt`.

### Порівняльна таблиця (заміри `ab -n 2000 -c 50` та `docker stats`)

| Показник | Go (`go-app`, `/api/reports`) | Node.js (`node-app-1..3`, `/health`) | Примітка за результатами стенду |
| :--- | :--- | :--- | :--- |
| **RPS (`ab`, `n=2000, c=50`)** | **5 407.38 req/s** | **3 426.56 req/s** | Go дає вищу пропускну здатність навіть однією реплікою |
| **p50 (`ab`)** | **9 ms** | **13 ms** | Нижча базова затримка у Go |
| **p95 (`ab`)** | **12 ms** | **27 ms** | У Node `p95` у ~2.25 раза вищий під конкурентним пулом `c=50` |
| **p99 (`ab`)** | **15 ms** | **36 ms** | Хвіст затримок росте повільніше у Go (`15 ms` проти `36 ms`) |
| **RAM (`docker stats`)** | **11.13 MiB** (`go-app-1`) | **35.84–38.74 MiB** (на 1 репліку) | Distroless Go-бінарник споживає ~3.2–3.5× менше RAM |
| **CPU (`docker stats` на зрізі)** | **0.00%** (після прогону) | **0.69%–3.46%** (залежно від репліки) | Нерівномірність між репліками Node пов'язана з розподілом з'єднань |
| **Сигнал насичення** | `go_goroutines = 9` | Event loop / навантаження реплік | Запасу ресурсів вистачило без деградації черг під `c=50` |
| **Точка деградації** | Не досягнута до `c=50` (`5 407 req/s`, `p99=15 ms`) | Не досягнута до `c=50` (`3 426 req/s`, `p99=36 ms`) | Для виявлення точки зламу `p99` потрібні вищі рівні конкурентності (`c > 100–200`) |

---

## 4. Відмовостійкість (краш-тест)

Під час перевірки відмовостійкості було виконано зупинку репліки `lab10-node-app-2-1` і серію запитів `GET /api/users` через `https://localhost/api/users`:
- **Хронологія краш-тесту**:
  - `14:58:38.789` — ініційовано зупинку контейнера `lab10-node-app-2-1`.
  - `14:58:39.591` — контейнер `lab10-node-app-2-1` зупинено (~`0.80 s` на зупинку).
  - Під час недоступності `lab10-node-app-2-1` усі 5 послідовних запитів до `/api/users` повернули HTTP **`200`** (обслуговування продовжилося через інші репліки без переривання клієнтського потоку).
  - `14:58:43.275` — запущено контейнер `lab10-node-app-2-1` назад (~`3.68 s` між фіксацією зупинки та стартом відновлення).
- **Кореляція в логах і трейсах**: у JSON-логах `node-app-1-1` та `go-app-1` зафіксовано структуровані події `request in` / `request out` із `reqId` та `trace_id` (наприклад, `reqId: "f84e7c8b-9466-45cd-93d5-0b6221293c97"`, `trace_id: "ee69d659bc72989fbf7007da9245dd22"`).

---

## 5. Безпека

- **Периметр та заголовки**: запит `http://localhost/health` повертає `301 Moved Permanently` на `https://localhost/health`; у відповідях присутній заголовок `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- **Негативні сценарії smoke-тесту**:
  - Запит до захищеного `/api/users` без токена -> **`401`**.
  - Спроба видалення користувача (`DELETE /api/users/1`) з роллю `user` -> **`403`**.
  - Запит до неіснуючого ID (`GET /api/users/9999`) -> **`404`**.
  - Невалідний JSON (`{"bad-json`) у `POST /api/auth/register` -> **`400`**.
- **Захист збірки**: Go-сервіс компілюється у `gcr.io/distroless/static-debian12:nonroot` із прапорами `-ldflags="-s -w" -trimpath` (видалення символьних таблиць і налагоджувальної інформації), а Node.js-сервіс проходить обфускацію на етапі multi-stage збірки.

---

## 6. Висновки

За числами власного стенду:
- **Go (`go-app`)** доцільний для маршрутів із високим RPS, жорсткими вимогами до хвостової затримки (`p99 = 15 ms` при `5 407.38 req/s` на `ab -n 2000 -c 50`), мінімальним споживанням пам'яті (`11.13 MiB`) і конкурентною обробкою задач через горутини та канали.
- **Node.js (`node-app-1..3`)** природно підходить для швидкої прикладкої логіки, CRUD/автентифікації, потокового експорту та горизонтального масштабування репліками (`3 426.56 req/s`, `p99 = 36 ms` на `ab`), але вимагає урахування вищого споживання RAM на репліку (`~36–39 MiB`) та узгодження маршрутів проксі/ендпоінтів у конфігурації Nginx і тестах.

---

## 7. Мапінг тем 1–10 на модулі стенду

| Тема / Лабораторна | Реалізований модуль / файл / конфігурація у `Lab10` |
| :--- | :--- |
| ЛР №1: Базові сервіси | `Lab10/node-service/src/app.js`, `Lab10/go-service/cmd/server/main.go` (`/health`, CRUD, in-memory стан) |
| ЛР №2: Моделі конкурентності | `Lab10/node-service/src/app.js` (`/io`, `/cpu`), `Lab10/go-service/cmd/server/main.go` (`/io`, `/cpu`, `runConcurrentCPU` на горутинах) |
| ЛР №3: Конкурентний pipeline | `Lab10/go-service/cmd/server/main.go` (`runPipeline`, `/api/pipeline`), `Lab10/go-service/cmd/server/pipeline_test.go` (`go test -race`) |
| ЛР №4: Багаторівнева архітектура | `Lab10/node-service/src/app.js` (валідація, обробка `400/404/409/500`, middleware логування та `trust proxy`) |
| ЛР №5: Real-time та Streams | `Lab10/node-service/src/app.js` (`/api/users/export` із backpressure/`drain`, реєстр подій `events`) |
| ЛР №6: Персистентність | `Lab10/docker-compose.yml` (`postgres`, `mongo` з healthcheck) |
| ЛР №7: Безпека та реліз-артефакти | `Lab10/node-service/Dockerfile` (multi-stage + обфускація), `Lab10/go-service/Dockerfile` (`distroless:nonroot`, `-s -w`), `Lab10/node-service/src/app.js` (`401`/`403`, заголовки) |
| ЛР №8: Масштабування та Nginx | `Lab10/nginx/nginx.conf`, `Lab10/docker-compose.yml` (`node-app-1..3`, `nginx`, `nginx-exporter`, `301 -> HTTPS`) |
| ЛР №9: Обсерваційність | `Lab10/node-service/src/logger.js`, `metrics.js`, `tracing.js`; `Lab10/go-service/cmd/server/main.go` (`slog`, `/metrics`, OTLP -> `jaeger`, `prometheus`, `grafana`) |
| ЛР №10: Фінальний реліз-стенд та звіт | `Lab10/docker-compose.yml`, `Lab10/benchmarks/*`, `BENCHMARK_REPORT.md` |

---

## 8. Architecture Review

- **Гетерогенна група за Nginx**: поєднання 3 реплік Node.js і сервісу Go за єдиним reverse proxy Nginx дозволяє розділити прикладні сценарії та високопродуктивні/конкурентні операції без нав'язування єдиного рантайму. Ціна рішення — складніша конфігурація маршрутизації та необхідність контролювати паритет роутів між проксі й сервісами.
- **Спостережуваність як обов'язковий контур**: інтеграція структурованих JSON-логів (`pino`/`slog`) із `reqId` та `trace_id`, метрик Prometheus і трейсів OpenTelemetry -> Jaeger дає прозору діагностику інцидентів, ціною невеликих накладних витрат на експорт телеметрії та утримання додаткових контейнерів моніторингу.
- **Безпека та мінімальна поверхня атаки**: `distroless:nonroot` і `-ldflags="-s -w"` для Go, обфускація коду Node.js та примусовий редирект на HTTPS зменшують ризики компрометації, водночас ускладнюючи відлагодження без символів і вимагаючи суворого контролю `.gitignore` для секретів та артефактів.