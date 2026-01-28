// utils/encryption.js
// SECURITY REQUIREMENT: Hybrid Encryption (RSA + AES)
// This module implements RSA key pair generation, AES encryption, and hybrid encryption

const crypto = require('crypto');

/**
 * HYBRID ENCRYPTION APPROACH:
 * 1. Generate RSA key pair (public/private) for asymmetric encryption
 * 2. Generate AES session key for symmetric encryption
 * 3. Encrypt data with AES (fast, for large data)
 * 4. Encrypt AES key with RSA public key (secure key exchange)
 * 5. To decrypt: use RSA private key to get AES key, then decrypt data
 */

// RSA Key Generation (2048-bit)
function generateRSAKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  return { publicKey, privateKey };
}

// AES-256 Encryption
function encryptWithAES(plaintext, aesKey) {
  // Generate random initialization vector (IV)
  const iv = crypto.randomBytes(16);
  
  // Create cipher using AES-256-CBC
  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  
  // Encrypt the plaintext
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Return IV + encrypted data (IV needed for decryption)
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted
  };
}

// AES-256 Decryption
function decryptWithAES(encryptedData, aesKey, iv) {
  // Create decipher
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    aesKey,
    Buffer.from(iv, 'hex')
  );
  
  // Decrypt the data
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// RSA Encryption (for AES key)
function encryptWithRSA(data, publicKey) {
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(data)
  );
  
  return encrypted.toString('base64');
}

// RSA Decryption (for AES key)
function decryptWithRSA(encryptedData, privateKey) {
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(encryptedData, 'base64')
  );
  
  return decrypted;
}

// HYBRID ENCRYPTION: Encrypt booking data
function hybridEncrypt(bookingData, publicKey) {
  // Step 1: Generate random AES key (256-bit = 32 bytes)
  const aesKey = crypto.randomBytes(32);
  
  // Step 2: Convert booking data to JSON string
  const dataString = JSON.stringify(bookingData);
  
  // Step 3: Encrypt data with AES
  const { iv, encryptedData } = encryptWithAES(dataString, aesKey);
  
  // Step 4: Encrypt AES key with RSA public key
  const encryptedAESKey = encryptWithRSA(aesKey, publicKey);
  
  // Return encrypted package
  return {
    encryptedData: encryptedData,
    iv: iv,
    encryptedAESKey: encryptedAESKey
  };
}

// HYBRID DECRYPTION: Decrypt booking data
function hybridDecrypt(encryptedPackage, privateKey) {
  try {
    // Step 1: Decrypt AES key using RSA private key
    const aesKey = decryptWithRSA(encryptedPackage.encryptedAESKey, privateKey);
    
    // Step 2: Decrypt data using AES key
    const decryptedString = decryptWithAES(
      encryptedPackage.encryptedData,
      aesKey,
      encryptedPackage.iv
    );
    
    // Step 3: Parse JSON back to object
    return JSON.parse(decryptedString);
  } catch (error) {
    throw new Error('Decryption failed: ' + error.message);
  }
}

module.exports = {
  generateRSAKeyPair,
  hybridEncrypt,
  hybridDecrypt,
  encryptWithRSA,
  decryptWithRSA
};