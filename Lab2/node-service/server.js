const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let items = {
    1: { id: 1, name: 'Laptop', price: 1200 },
    2: { id: 2, name: 'Mechanical Keyboard', price: 150 }
};
let nextId = 3;

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'node-service', timestamp: new Date().toISOString() });
});

// Асинхронна I/O операція (/io) — імітація затримки через setTimeout (не блокує Event Loop)
app.get('/io', (req, res) => {
    const delay = parseInt(req.query.delay) || 100; // за замовчуванням 100мс
    setTimeout(() => {
        res.status(200).json({
            service: 'node-service',
            type: 'I/O operation',
            delayMs: delay,
            timestamp: new Date().toISOString()
        });
    }, delay);
});

// Важка обчислювальна CPU операція (/cpu) — синхронний цикл, який блокує потоки Node.js
app.get('/cpu', (req, res) => {
    const iterations = parseInt(req.query.iterations) || 500000000; // велика кількість ітерацій
    let counter = 0;
    for (let i = 0; i < iterations; i++) {
        counter++;
    }
    res.status(200).json({
        service: 'node-service',
        type: 'CPU-bound operation',
        iterations: iterations,
        result: counter,
        timestamp: new Date().toISOString()
    });
});

// CRUD ендпойнти з Лабораторної 1
app.get('/items', (req, res) => {
    res.json(Object.values(items));
});

app.post('/items', (req, res) => {
    const { name, price } = req.body;
    if (!name || typeof price !== 'number') {
        return res.status(400).json({ error: 'Name and valid price are required' });
    }
    const newItem = { id: nextId++, name, price };
    items[newItem.id] = newItem;
    res.status(201).json(newItem);
});

app.listen(PORT, () => {
    console.log(`Node.js service is running on http://localhost:${PORT}`);
});