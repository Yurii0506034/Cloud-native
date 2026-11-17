 const streamService = require('../services/stream.service');
const wsManager = require('../ws/ws.server');

class StreamController {
    async startStreamProcessing(req, res) {
        try {
            const highWaterMark = parseInt(req.query.chunkSize) || 64 * 1024;
            
            // Повідомляємо WebSocket-клієнтів про старт
            wsManager.broadcast({ type: 'stream_started', chunkSize: highWaterMark });

            const result = await streamService.processFileWithProgress((progress) => {
                // Надсилаємо прогрес в реальному часі (з урахуванням WS Backpressure)
                wsManager.broadcast(progress);
            }, highWaterMark);

            // Повідомляємо про завершення
            wsManager.broadcast({ type: 'stream_completed', result });

            res.status(200).json({
                status: 'completed',
                metrics: result
            });
        } catch (err) {
            res.status(500).json({ error: 'stream_error', message: err.message });
        }
    }

    async testBackpressure(req, res) {
        try {
            const delayMs = parseInt(req.query.delay) || 5;
            const chunks = parseInt(req.query.chunks) || 200;

            // Запускаємо обидва сценарії для порівняння
            const scenarioA = await streamService.runBackpressureExperiment(false, delayMs, chunks);
            const scenarioB = await streamService.runBackpressureExperiment(true, delayMs, chunks);

            res.status(200).json({
                comparison: [scenarioA, scenarioB]
            });
        } catch (err) {
            res.status(500).json({ error: 'experiment_error', message: err.message });
        }
    }

    getWsClients(req, res) {
        res.status(200).json({
            activeClients: wsManager.getStats()
        });
    }
}

module.exports = new StreamController();