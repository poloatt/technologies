import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 8080;

console.log('Puerto detectado:', port);
console.log('process.env.PORT:', process.env.PORT);

// CORS básico
app.use(cors({
  origin: ['https://foco.attadia.com', 'https://caja.attadia.com', 'https://atta.attadia.com', 'https://pulso.attadia.com'],
  credentials: true
}));

app.use(express.json());

// Health check ultra simple
app.get('/health', (req, res) => {
  console.log('Health check - ultra simple');
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Backend ultra simple funcionando',
    port: port,
    envPort: process.env.PORT
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Test exitoso',
    env: process.env.NODE_ENV,
    port: port,
    envPort: process.env.PORT
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor ultra simple iniciado en puerto ${port}`);
  console.log(`Escuchando en todas las interfaces: 0.0.0.0:${port}`);
}); 