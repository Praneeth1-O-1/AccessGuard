// utils/hashing.js
// SECURITY REQUIREMENT: Password Hashing with Salt
// This module implements secure password hashing using bcrypt

const bcrypt = require('bcrypt');
const crypto = require('crypto');

/**
 * PASSWORD HASHING APPROACH:
 * 1. Generate random salt (bcrypt handles this internally)
 * 2. Hash password with salt using bcrypt (industry standard)
 * 3. Store hash in database (never store plaintext passwords)
 * 4. For verification, bcrypt compares provided password with stored hash
 * 
 * Additional manual salt generation shown for educational purposes
 */

// Number of salt rounds (higher = more secure but slower)
const SALT_ROUNDS = 10;

// Hash password using bcrypt (includes automatic salt generation)
async function hashPassword(password) {
  try {
    // bcrypt automatically generates and includes salt in the hash
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    throw new Error('Password hashing failed: ' + error.message);
  }
}

// Verify password against stored hash
async function verifyPassword(password, storedHash) {
  try {
    // bcrypt extracts salt from hash and compares
    const isMatch = await bcrypt.compare(password, storedHash);
    return isMatch;
  } catch (error) {
    throw new Error('Password verification failed: ' + error.message);
  }
}

// Generate additional salt (for educational demonstration)
// In production, bcrypt's built-in salt is sufficient
function generateSalt(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

// Manual hash with SHA-256 and salt (educational purpose)
function manualHashWithSalt(password, salt) {
  // Combine password with salt
  const combined = password + salt;
  
  // Hash using SHA-256
  const hash = crypto.createHash('sha256')
    .update(combined)
    .digest('hex');
  
  return hash;
}

// Hash any data using SHA-256 (for digital signatures)
function sha256Hash(data) {
  const hash = crypto.createHash('sha256')
    .update(data)
    .digest('hex');
  return hash;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateSalt,
  manualHashWithSalt,
  sha256Hash
};