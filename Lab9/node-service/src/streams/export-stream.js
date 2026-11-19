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

    const dbReadable = new Readable({
        objectMode: true,
        read() {
            if (index >= total) {
                this.push(null);
                return;
            }
            const batch = allUsers.slice(index, index + batchSize);
            index += batch.length;
            wsManager.broadcast({ type: 'export_progress', processed: index, total });
            for (const user of batch) {
                this.push(user);
            }
        }
    });

    let isFirst = true;
    const csvTransform = new Transform({
        writableObjectMode: true,
        transform(user, encoding, callback) {
            let chunk = '';
            if (isFirst) {
                chunk += 'id,name,email,role,created_at\n';
                isFirst = false;
            }
            const created = user.created_at instanceof Date ? user.created_at.toISOString() : user.created_at;
            chunk += `${user.id},"${user.name}","${user.email}",${user.role},${created}\n`;
            callback(null, chunk);
        }
    });

    const fileWritable = fs.createWriteStream(exportPath);
    await pipelineAsync(dbReadable, csvTransform, fileWritable);

    return { filePath: exportPath, exportedCount: total };
}

module.exports = { exportUsersToCsv };