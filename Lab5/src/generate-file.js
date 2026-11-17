const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../data/large-dataset.ndjson');
const TARGET_SIZE_BYTES = 150 * 1024 * 1024; // 150 MB

async function generateLargeFile() {
    console.log(`Generating ~150 MB file at ${filePath}...`);
    const writeStream = fs.createWriteStream(filePath);
    let bytesWritten = 0;
    let id = 1;

    const startTime = Date.now();

    while (bytesWritten < TARGET_SIZE_BYTES) {
        const record = JSON.stringify({
            id: id++,
            timestamp: new Date().toISOString(),
            sensor: `sensor-${id % 10}`,
            value: (Math.random() * 100).toFixed(2),
            status: id % 20 === 0 ? 'ERROR' : 'OK'
        }) + '\n';

        bytesWritten += Buffer.byteLength(record);

        // Якщо внутрішній буфер заповнений, чекаємо подію 'drain' (Backpressure)
        if (!writeStream.write(record)) {
            await new Promise(resolve => writeStream.once('drain', resolve));
        }
    }

    writeStream.end();
    await new Promise(resolve => writeStream.on('finish', resolve));

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Done! Generated ${(bytesWritten / (1024 * 1024)).toFixed(2)} MB (${id - 1} lines) in ${duration}s`);
}

generateLargeFile().catch(console.error);