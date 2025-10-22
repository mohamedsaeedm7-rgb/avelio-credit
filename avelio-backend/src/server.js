require('dotenv').config();

const db = require('./config/db');
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Avelio API is running!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1', (req, res) => {
  res.json({
    success: true,
    version: '1.0.0',
    message: 'Avelio Credit-Lite API v1'
  });
});

// Import routes
const authRoutes = require('./routes/authRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const statsRoutes = require('./routes/statsRoutes');
const exportRoutes = require('./routes/exportRoutes');
const agencyRoutes = require('./routes/agencyRoutes');



// Use routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/receipts', receiptRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/receipts', receiptRoutes);
app.use('/api/v1/agencies', agencyRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('===========================================');
  console.log('🚀 Avelio Credit-Lite API Server');
  console.log('===========================================');
  console.log(`✅ Server running on: http://localhost:${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log('===========================================');
  
  // Test database connection after server starts
  db.testConnection().then(() => {
    console.log('===========================================');
  }).catch(err => {
    console.error('Database connection failed:', err.message);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});