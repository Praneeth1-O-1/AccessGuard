// server.js
// Main Express server with security middleware

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { sessionMiddleware } = require('./utils/session');
const { initializeACL } = require('./utils/acl');

// Import routes
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const resourceRoutes = require('./routes/resources');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionMiddleware);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/resources', resourceRoutes);

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'AccessGuard API is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, async () => {
  console.log('\n========================================');
  console.log('🔐 AccessGuard Server Started');
  console.log('========================================');
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('========================================\n');
  
  // Initialize ACL on startup
  await initializeACL();
  
  console.log('✓ System ready\n');
  console.log('Security Features Active:');
  console.log('  ✓ Multi-Factor Authentication (Password + OTP)');
  console.log('  ✓ Access Control List (Role-based)');
  console.log('  ✓ Hybrid Encryption (RSA + AES-256)');
  console.log('  ✓ Password Hashing with Salt (bcrypt)');
  console.log('  ✓ Digital Signatures (RSA + SHA-256)');
  console.log('  ✓ Token Encoding (Base64 + QR Code)');
  console.log('\n========================================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});