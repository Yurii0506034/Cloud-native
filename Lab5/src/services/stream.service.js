const fs = require('fs');
const path = require('path');
const { Transform, Writable, pipeline } = require('stream');
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);

const INPUT_FILE = path.join(__dirname, '../../data/large-dataset.ndjson');
const OUTPUT_FILE = path.join(__dirname, '../../data/processed-errors.ndjson');

class StreamService {
    /**
     * Обробка великого файлу через Readable -> Transform -> Writable з передачею прогресу (для WebSockets)
     */
    async processFileWithProgress(onProgress, highWaterMark = 64 * 1024) {
        const stats = fs.statSync(INPUT_FILE);
        const totalBytes = stats.size;
        let processedBytes = 0;
        let errorLinesCount = 0;
        let totalLinesCount = 0;
        let leftover = '';

        const readStream = fs.createReadStream(INPUT_FILE, { highWaterMark });

        const filterTransform = new Transform({
            transform(chunk, encoding, callback) {
                processedBytes += chunk.length;
                const text = leftover + chunk.toString('utf8');
                const lines = text.split('\n');
                leftover = lines.pop(); // Зберігаємо неповний останній рядок

                let filteredOutput = '';
                for (const line of lines) {
                    if (!line.trim()) continue;
                    totalLinesCount++;
                    if (line.includes('"status":"ERROR"')) {
                        errorLinesCount++;
                        filteredOutput += line + '\n';
                    }
                }

                if (onProgress) {
                    onProgress({
                        type: 'progress',
                        processed: processedBytes,
                        total: totalBytes,
                        percent: ((processedBytes / totalBytes) * 100).toFixed(1),
                        errorsFound: errorLinesCount
                    });
                }

                callback(null, filteredOutput);
            },
            flush(callback) {
                if (leftover && leftover.includes('"status":"ERROR"')) {
                    errorLinesCount++;
                    this.push(leftover + '\n');
                }
                callback();
            }
        });

        const writeStream = fs.createWriteStream(OUTPUT_FILE);

        const startTime = Date.now();
        await pipelineAsync(readStream, filterTransform, writeStream);
        const durationMs = Date.now() - startTime;

        return {
            durationMs,
            totalBytes,
            totalLinesCount,
            errorLinesCount,
            peakMemoryMB: (process.memoryUsage().rss / 1024 / 1024).toFixed(2)
        };
    }

    /**
     * Тест Backpressure (Пункт 5): порівняння повільного споживача без контролю та з Backpressure
     */
    async runBackpressureExperiment(useBackpressure = true, chunkDelayMs = 5, limitChunks = 200) {
        let chunksProcessed = 0;
        let maxRssBytes = 0;
        const startTime = Date.now();

        const readStream = fs.createReadStream(INPUT_FILE, { highWaterMark: 64 * 1024 });

        return new Promise((resolve, reject) => {
            if (!useBackpressure) {
                // Сценарій A: Читаємо швидко через подію 'data' без паузи (ігноруємо повільного споживача)
                const pendingWrites = [];
                readStream.on('data', (chunk) => {
                    chunksProcessed++;
                    const currentRss = process.memoryUsage().rss;
                    if (currentRss > maxRssBytes) maxRssBytes = currentRss;

                    // Імітуємо повільний запис у пам'ять/чергу без зупинки readStream
                    const bufferCopy = Buffer.from(chunk);
                    const p = new Promise(res => setTimeout(() => {
                        bufferCopy.length; // утримуємо посилання в пам'яті до завершення таймера
                        res();
                    }, chunkDelayMs));
                    pendingWrites.push(p);

                    if (chunksProcessed >= limitChunks) {
                        readStream.destroy();
                    }
                });

                const finishScenarioA = async () => {
                    await Promise.all(pendingWrites);
                    resolve({
                        scenario: 'Scenario A (No Backpressure)',
                        chunksProcessed,
                        durationMs: Date.now() - startTime,
                        peakMemoryMB: (maxRssBytes / 1024 / 1024).toFixed(2)
                    });
                };

                readStream.on('close', finishScenarioA);
                readStream.on('end', finishScenarioA);
                readStream.on('error', reject);
            } else {
                // Сценарій B: Використовуємо Writable stream + pipe() (автоматичний Backpressure)
                const slowWritable = new Writable({
                    highWaterMark: 64 * 1024,
                    write(chunk, encoding, callback) {
                        chunksProcessed++;
                        const currentRss = process.memoryUsage().rss;
                        if (currentRss > maxRssBytes) maxRssBytes = currentRss;

                        if (chunksProcessed >= limitChunks) {
                            readStream.destroy();
                            callback();
                            return;
                        }

                        // Викликаємо callback ТІЛЬКИ після завершення повільної операції
                        setTimeout(callback, chunkDelayMs);
                    }
                });

                readStream.pipe(slowWritable);

                const finishScenarioB = () => {
                    resolve({
                        scenario: 'Scenario B (With Backpressure)',
                        chunksProcessed,
                        durationMs: Date.now() - startTime,
                        peakMemoryMB: (maxRssBytes / 1024 / 1024).toFixed(2)
                    });
                };

                slowWritable.on('finish', finishScenarioB);
                readStream.on('close', finishScenarioB);
                readStream.on('error', reject);
            }
        });
    }
}

module.exports = new StreamService();