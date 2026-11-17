const fs = require('fs');
const path = require('path');
const { Readable, Transform, pipeline } = require('stream');
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);
const wsManager = require('../websocket/ws.server');

async function exportUsersToCsv(userRepository, batchSize = 50) {
    const allUsers = await userRepository.findAll();
    const total = allUsers.length;
    let index = 0;

    const exportPath = path.join(__dirname, '../../export.csv');

    // 1. Readable Stream (читання порціями/батчами)
    const dbReadable = new Readable({
        objectMode: true,
        read() {
            if (index >= total) {
                this.push(null);
                return;
            }
            const batch = allUsers.slice(index, index + batchSize);
            index += batch.length;
            
            // Транслюємо прогрес у реальному часі через WebSocket
            wsManager.broadcast({
                type: 'export_progress',
                processed: index,
                total
            });

            for (const user of batch) {
                this.push(user);
            }
        }
    });

    // 2. Transform Stream (перетворення об'єкта користувача у CSV-рядок)
    let isFirst = true;
    const csvTransform = new Transform({
        writableObjectMode: true,
        transform(user, encoding, callback) {
            let chunk = '';
            if (isFirst) {
                chunk += 'id,name,email,created_at\n';
                isFirst = false;
            }
            const created = user.created_at instanceof Date ? user.created_at.toISOString() : user.created_at;
            chunk += `${user.id},"${user.name}","${user.email}",${created}\n`;
            callback(null, chunk);
        }
    });

    // 3. Writable Stream (запис у файл)
    const fileWritable = fs.createWriteStream(exportPath);

    // Об'єднання через pipeline() з автоматичним контролем Backpressure
    await pipelineAsync(dbReadable, csvTransform, fileWritable);

    return {
        filePath: exportPath,
        exportedCount: total
    };
}

module.exports = { exportUsersToCsv };