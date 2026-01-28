// utils/digitalSignature.js
// SECURITY REQUIREMENT: Digital Signature using Hash
// This module implements digital signatures for data integrity and authenticity

const crypto = require('crypto');
const { sha256Hash } = require('./hashing');

/**
 * DIGITAL SIGNATURE APPROACH:
 * 1. Hash the booking data using SHA-256
 * 2. Sign the hash using admin's RSA private key
 * 3. Store signature with booking
 * 4. To verify: hash data again, decrypt signature with public key, compare hashes
 * 
 * This ensures:
 * - Integrity: Data hasn't been tampered with
 * - Authenticity: Data was approved by admin
 * - Non-repudiation: Admin cannot deny approval
 */

// Create digital signature
function createDigitalSignature(data, privateKey) {
  try {
    // Step 1: Convert data to string if it's an object
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Step 2: Create hash of the data
    const hash = sha256Hash(dataString);
    
    // Step 3: Sign the hash with private key
    const signature = crypto.sign('sha256', Buffer.from(hash), {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    });
    
    // Return both hash and signature
    return {
      hash: hash,
      signature: signature.toString('base64')
    };
  } catch (error) {
    throw new Error('Signature creation failed: ' + error.message);
  }
}

// Verify digital signature
function verifyDigitalSignature(data, signature, hash, publicKey) {
  try {
    // Step 1: Convert data to string
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Step 2: Calculate current hash of data
    const currentHash = sha256Hash(dataString);
    
    // Step 3: Compare hashes (integrity check)
    if (currentHash !== hash) {
      return {
        valid: false,
        reason: 'Data has been tampered with (hash mismatch)'
      };
    }
    
    // Step 4: Verify signature with public key
    const isValid = crypto.verify(
      'sha256',
      Buffer.from(hash),
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      },
      Buffer.from(signature, 'base64')
    );
    
    if (isValid) {
      return {
        valid: true,
        reason: 'Signature is valid - data is authentic and unmodified'
      };
    } else {
      return {
        valid: false,
        reason: 'Invalid signature - data may not be from authorized source'
      };
    }
  } catch (error) {
    return {
      valid: false,
      reason: 'Verification error: ' + error.message
    };
  }
}

// Create signature for booking approval
function signBookingApproval(bookingData, adminPrivateKey) {
  // Data to sign includes critical booking information
  const signatureData = {
    booking_id: bookingData.booking_id,
    student_id: bookingData.student_id,
    resource_id: bookingData.resource_id,
    booking_date: bookingData.booking_date,
    status: bookingData.status,
    approved_by: bookingData.admin_id,
    timestamp: new Date().toISOString()
  };
  
  return createDigitalSignature(signatureData, adminPrivateKey);
}

// Verify booking approval signature
function verifyBookingApproval(bookingData, signature, hash, adminPublicKey) {
  const signatureData = {
    booking_id: bookingData.booking_id,
    student_id: bookingData.student_id,
    resource_id: bookingData.resource_id,
    booking_date: bookingData.booking_date,
    status: bookingData.status,
    approved_by: bookingData.admin_id,
    timestamp: bookingData.timestamp
  };
  
  return verifyDigitalSignature(signatureData, signature, hash, adminPublicKey);
}

module.exports = {
  createDigitalSignature,
  verifyDigitalSignature,
  signBookingApproval,
  verifyBookingApproval
};