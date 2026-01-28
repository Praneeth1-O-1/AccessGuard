// utils/session.js
// Session management for authenticated users

const crypto = require('crypto');
const pool = require('../config/database');

// Session duration (24 hours)
const SESSION_DURATION = 24 * 60 * 60 * 1000;

// Generate unique session ID
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

// Create new session
async function createSession(userId) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  
  try {
    await pool.query(
      `INSERT INTO sessions (session_id, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [sessionId, userId, expiresAt]
    );
    
    return sessionId;
  } catch (error) {
    throw new Error('Session creation failed: ' + error.message);
  }
}

// Validate session
async function validateSession(sessionId) {
  try {
    const result = await pool.query(
      `SELECT user_id, expires_at FROM sessions
       WHERE session_id = $1`,
      [sessionId]
    );
    
    if (result.rows.length === 0) {
      return { valid: false, reason: 'Session not found' };
    }
    
    const session = result.rows[0];
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (now > expiresAt) {
      // Delete expired session
      await pool.query('DELETE FROM sessions WHERE session_id = $1', [sessionId]);
      return { valid: false, reason: 'Session expired' };
    }
    
    return { 
      valid: true, 
      userId: session.user_id 
    };
  } catch (error) {
    return { valid: false, reason: 'Validation error' };
  }
}

// Delete session (logout)
async function deleteSession(sessionId) {
  try {
    await pool.query('DELETE FROM sessions WHERE session_id = $1', [sessionId]);
    return true;
  } catch (error) {
    return false;
  }
}

// Clean up expired sessions
async function cleanupExpiredSessions() {
  try {
    const result = await pool.query(
      'DELETE FROM sessions WHERE expires_at < NOW()'
    );
    console.log(`Cleaned up ${result.rowCount} expired sessions`);
  } catch (error) {
    console.error('Session cleanup failed:', error.message);
  }
}

// Session middleware
async function sessionMiddleware(req, res, next) {
  const sessionId = req.cookies.sessionId;
  
  if (!sessionId) {
    req.session = null;
    return next();
  }
  
  const validation = await validateSession(sessionId);
  
  if (validation.valid) {
    req.session = {
      sessionId: sessionId,
      userId: validation.userId
    };
  } else {
    req.session = null;
    res.clearCookie('sessionId');
  }
  
  next();
}

module.exports = {
  createSession,
  validateSession,
  deleteSession,
  cleanupExpiredSessions,
  sessionMiddleware
};