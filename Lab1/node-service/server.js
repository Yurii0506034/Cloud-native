const express = require('express');
const app = express();
const PORT = 3000;

// Middleware для автоматичного парсингу JSON у тілі запиту
app.use(express.json());

// In-memory сховище (початкові дані)
let items = [
  { id: 1, name: 'Laptop', price: 1200 },
  { id: 2, name: 'Mechanical Keyboard', price: 150 }
];
let nextId = 3;

// 1. Health check ендпойнт
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'node-service',
    timestamp: new Date().toISOString()
  });
});

// 2. READ ALL — отримати всі елементи
app.get('/items', (req, res) => {
  res.status(200).json(items);
});

// 3. READ ONE — отримати елемент за ID
app.get('/items/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = items.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  res.status(200).json(item);
});

// 4. CREATE — створити новий елемент
app.post('/items', (req, res) => {
  const { name, price } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  const newItem = {
    id: nextId++,
    name,
    price
  };

  items.push(newItem);
  res.status(201).json(newItem);
});

// 5. UPDATE — оновити існуючий елемент
app.put('/items/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = items.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const { name, price } = req.body;
  if (name !== undefined) item.name = name;
  if (price !== undefined) item.price = price;

  res.status(200).json(item);
});

// 6. DELETE — видалити елемент
app.delete('/items/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = items.findIndex(i => i.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  items.splice(index, 1);
  res.status(204).send();
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Node.js service is running on http://localhost:${PORT}`);
});