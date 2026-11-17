const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/ws');
let progressFramesReceived = 0;

ws.on('open', () => {
    console.log('[Client] Connected to server!');
    
    // Надсилаємо тестове повідомлення (пункт 7)
    ws.send(JSON.stringify({
        type: 'message',
        text: 'Hello from real-time client!'
    }));

    // Надсилаємо невалідне повідомлення для перевірки обробки помилок (пункт 8)
    ws.send('invalid-json-payload');
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    
    if (msg.type === 'progress') {
        progressFramesReceived++;
        if (progressFramesReceived % 100 === 0 || msg.percent === '100.0') {
            console.log(`[Real-Time Progress] ${msg.percent}% (${(msg.processed / 1024 / 1024).toFixed(1)} MB) | Errors found: ${msg.errorsFound}`);
        }
    } else {
        console.log('[Client Received]:', msg);
    }
});

ws.on('close', () => {
    console.log('[Client] Disconnected from server.');
});