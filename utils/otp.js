// utils/otp.js
// SECURITY REQUIREMENT: Multi-Factor Authentication (MFA)
// This module implements OTP generation and verification

const crypto = require('crypto');
const pool = require('../config/database');

/**
 * OTP (One-Time Password) APPROACH:
 * 1. Generate 6-digit random OTP
 * 2. Store in database with expiration (5 minutes)
 * 3. Send to user (simulated via console/email)
 * 4. Verify OTP during login
 * 5. Mark as used after successful verification
 * 
 * This implements NIST SP 800-63-2 two-factor authentication
 */

// Generate 6-digit OTP
function generateOTP() {
  // Generate random 6-digit number
  const otp = crypto.randomInt(100000, 999999).toString();
  return otp;
}

// Store OTP in database
async function createOTP(userId) {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  
  try {
    const query = `
      INSERT INTO otp_codes (user_id, otp_code, expires_at)
      VALUES ($1, $2, $3)
      RETURNING otp_id, otp_code
    `;
    
    const result = await pool.query(query, [userId, otp, expiresAt]);
    
    return {
      success: true,
      otp: result.rows[0].otp_code,
      otpId: result.rows[0].otp_id
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Verify OTP
async function verifyOTP(userId, otpCode) {
  try {
    // Find valid OTP for user
    const query = `
      SELECT otp_id, otp_code, expires_at, is_used
      FROM otp_codes
      WHERE user_id = $1 
        AND otp_code = $2
        AND is_used = FALSE
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [userId, otpCode]);
    
    if (result.rows.length === 0) {
      return {
        valid: false,
        reason: 'Invalid or already used OTP'
      };
    }
    
    const otp = result.rows[0];
    
    // Check if OTP is expired
    const now = new Date();
    const expiresAt = new Date(otp.expires_at);
    
    if (now > expiresAt) {
      return {
        valid: false,
        reason: 'OTP has expired'
      };
    }
    
    // Mark OTP as used
    await pool.query(
      'UPDATE otp_codes SET is_used = TRUE WHERE otp_id = $1',
      [otp.otp_id]
    );
    
    return {
      valid: true,
      reason: 'OTP verified successfully'
    };
  } catch (error) {
    return {
      valid: false,
      reason: 'OTP verification failed: ' + error.message
    };
  }
}

// Simulate sending OTP (console output)
function sendOTP(user, otp) {
  console.log('\n========================================');
  console.log('📧 OTP EMAIL SIMULATION');
  console.log('========================================');
  console.log(`To: ${user.email}`);
  console.log(`Name: ${user.full_name}`);
  console.log(`OTP Code: ${otp}`);
  console.log(`Valid for: 5 minutes`);
  console.log('========================================\n');
  
  // In production, this would send actual email
  // Example: emailService.send(user.email, 'Your OTP', `Your code is: ${otp}`)
}

// Clean up expired OTPs (maintenance function)
async function cleanupExpiredOTPs() {
  try {
    const query = `
      DELETE FROM otp_codes
      WHERE expires_at < NOW() OR is_used = TRUE
    `;
    
    const result = await pool.query(query);
    console.log(`Cleaned up ${result.rowCount} expired/used OTPs`);
  } catch (error) {
    console.error('OTP cleanup failed:', error.message);
  }
}

module.exports = {
  generateOTP,
  createOTP,
  verifyOTP,
  sendOTP,
  cleanupExpiredOTPs
};