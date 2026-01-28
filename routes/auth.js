const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const { createOTP, sendOTP, verifyOTP } = require('../utils/otp');
const { createSession, deleteSession } = require('../utils/session');
const pool = require('../config/database');

// ===============================
// STEP 1: Password authentication
// ===============================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT user_id, username, password_hash, role, email, full_name FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.json({ success: false, error: 'Invalid credentials' });
    }

    // 🔐 Generate OTP
    const otpResult = await createOTP(user.user_id);
    if (!otpResult.success) {
      return res.json({ success: false, error: 'OTP generation failed' });
    }

    // 📧 Simulate OTP (console)
    sendOTP(user, otpResult.otp);

    res.json({
      success: true,
      userId: user.user_id
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ===============================
// STEP 2: OTP verification
// ===============================
router.post('/verify-otp', async (req, res) => {
  const { userId, otp } = req.body;

  try {
    const result = await verifyOTP(userId, otp);

    if (!result.valid) {
      return res.json({ success: false, error: result.reason });
    }

    // ✅ Create DB-backed session
    const sessionId = await createSession(userId);

    // ✅ SET COOKIE (THIS FIXES REDIRECT ISSUE)
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      sameSite: 'lax'
    });

    res.json({ success: true });

  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ success: false, error: 'OTP verification failed' });
  }
});

// ===============================
// Auth status check
// ===============================
router.get('/status', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ authenticated: false });
  }

  try {
    const result = await pool.query(
      'SELECT user_id, full_name, role FROM users WHERE user_id = $1',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.json({ authenticated: false });
    }

    const user = result.rows[0];

    res.json({
      authenticated: true,
      user: {
        userId: user.user_id,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Status error:', err);
    res.json({ authenticated: false });
  }
});


// ===============================
// Logout
// ===============================
router.post('/logout', async (req, res) => {
  const sessionId = req.cookies.sessionId;

  if (sessionId) {
    await deleteSession(sessionId);
    res.clearCookie('sessionId');
  }

  res.json({ success: true });
});

module.exports = router;
