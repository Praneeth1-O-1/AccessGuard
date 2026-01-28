// utils/encoding.js
// SECURITY REQUIREMENT: Encoding & Decoding (Base64 + QR Code)
// This module implements token encoding for access tokens

const QRCode = require('qrcode');

/**
 * ENCODING APPROACH:
 * 1. Create access token with booking details
 * 2. Encode token as Base64 (text-safe encoding)
 * 3. Generate QR code for easy scanning
 * 4. Token includes: booking_id, user_id, timestamp, signature
 */

// Generate access token (plain object)
function generateAccessToken(bookingData) {
  const token = {
    booking_id: bookingData.booking_id,
    user_id: bookingData.student_id,
    resource_id: bookingData.resource_id,
    booking_date: bookingData.booking_date,
    start_time: bookingData.start_time,
    end_time: bookingData.end_time,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    signature_hash: bookingData.data_hash // Include signature for verification
  };
  
  return token;
}

// Encode token to Base64
function encodeToBase64(tokenObject) {
  // Convert object to JSON string
  const jsonString = JSON.stringify(tokenObject);
  
  // Encode to Base64
  const base64Encoded = Buffer.from(jsonString).toString('base64');
  
  return base64Encoded;
}

// Decode token from Base64
function decodeFromBase64(base64String) {
  try {
    // Decode from Base64
    const jsonString = Buffer.from(base64String, 'base64').toString('utf8');
    
    // Parse JSON back to object
    const tokenObject = JSON.parse(jsonString);
    
    return {
      success: true,
      token: tokenObject
    };
  } catch (error) {
    return {
      success: false,
      error: 'Invalid token format'
    };
  }
}

// Generate QR code from token
async function generateQRCode(tokenData) {
  try {
    // Convert token to Base64 first
    const base64Token = typeof tokenData === 'string' 
      ? tokenData 
      : encodeToBase64(tokenData);
    
    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(base64Token, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 300
    });
    
    return qrCodeDataURL;
  } catch (error) {
    throw new Error('QR code generation failed: ' + error.message);
  }
}

// Validate token (check expiration and structure)
function validateToken(tokenObject) {
  // Check if token has required fields
  const requiredFields = ['booking_id', 'user_id', 'issued_at', 'expires_at'];
  for (const field of requiredFields) {
    if (!tokenObject[field]) {
      return {
        valid: false,
        reason: `Missing required field: ${field}`
      };
    }
  }
  
  // Check if token is expired
  const expiresAt = new Date(tokenObject.expires_at);
  const now = new Date();
  
  if (now > expiresAt) {
    return {
      valid: false,
      reason: 'Token has expired'
    };
  }
  
  return {
    valid: true,
    reason: 'Token is valid'
  };
}

// Complete token generation process
async function createEncodedToken(bookingData) {
  // Step 1: Generate token object
  const token = generateAccessToken(bookingData);
  
  // Step 2: Encode to Base64
  const base64Token = encodeToBase64(token);
  
  // Step 3: Generate QR code
  const qrCode = await generateQRCode(base64Token);
  
  return {
    tokenObject: token,
    base64Token: base64Token,
    qrCode: qrCode
  };
}

module.exports = {
  generateAccessToken,
  encodeToBase64,
  decodeFromBase64,
  generateQRCode,
  validateToken,
  createEncodedToken
};