// routes/bookings.js
// SECURITY: Booking routes with encryption, authorization, and digital signatures

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth, requirePermission, requireRole, PERMISSIONS } = require('../utils/acl');
const { hybridEncrypt, hybridDecrypt } = require('../utils/encryption');
const { signBookingApproval } = require('../utils/digitalSignature');
const { createEncodedToken } = require('../utils/encoding');

/**
 * BOOKING WORKFLOW:
 * 1. Student creates booking (data encrypted with AES+RSA)
 * 2. Faculty views and recommends booking
 * 3. Admin approves and signs booking (digital signature)
 * 4. System generates access token (Base64 + QR code)
 */

// Route: Create booking (Student only)
router.post('/create', requireAuth, requirePermission(PERMISSIONS.CREATE_BOOKING), async (req, res) => {
  try {
    const { resourceId, bookingDate, startTime, endTime, purpose } = req.body;
    const studentId = req.session.userId;
    
    // Validation
    if (!resourceId || !bookingDate || !startTime || !endTime || !purpose) {
      return res.status(400).json({
        success: false,
        error: 'All booking fields are required'
      });
    }
    
    // Check if resource exists
    const resourceCheck = await pool.query(
      'SELECT resource_id, resource_name FROM resources WHERE resource_id = $1',
      [resourceId]
    );
    
    if (resourceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found'
      });
    }
    
    // Get admin's public key for encryption
    const adminResult = await pool.query(
      "SELECT public_key FROM users WHERE role = 'admin' LIMIT 1"
    );
    
    if (adminResult.rows.length === 0 || !adminResult.rows[0].public_key) {
      return res.status(500).json({
        success: false,
        error: 'Admin encryption key not found'
      });
    }
    
    const adminPublicKey = adminResult.rows[0].public_key;
    
    // Prepare booking data for encryption
    const bookingData = {
      studentId,
      resourceId,
      bookingDate,
      startTime,
      endTime,
      purpose,
      timestamp: new Date().toISOString()
    };
    
    // Encrypt booking data using hybrid encryption (AES + RSA)
    const encrypted = hybridEncrypt(bookingData, adminPublicKey);
    
    // Insert booking into database
    const result = await pool.query(
      `INSERT INTO bookings 
       (student_id, resource_id, booking_date, start_time, end_time, purpose,
        encrypted_details, encrypted_aes_key, iv, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING booking_id`,
      [
        studentId,
        resourceId,
        bookingDate,
        startTime,
        endTime,
        purpose,
        encrypted.encryptedData,
        encrypted.encryptedAESKey,
        encrypted.iv
      ]
    );
    
    const bookingId = result.rows[0].booking_id;
    
    res.json({
      success: true,
      message: 'Booking created successfully (encrypted)',
      bookingId: bookingId,
      status: 'pending'
    });
    
  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking'
    });
  }
});

// Route: View own bookings (Student/Faculty/Admin)
router.get('/my-bookings', requireAuth, requirePermission(PERMISSIONS.VIEW_OWN_BOOKINGS), async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const result = await pool.query(
      `SELECT 
        b.booking_id, b.booking_date, b.start_time, b.end_time, 
        b.purpose, b.status, b.created_at,
        r.resource_name, r.resource_type,
        u.full_name as student_name
       FROM bookings b
       JOIN resources r ON b.resource_id = r.resource_id
       JOIN users u ON b.student_id = u.user_id
       WHERE b.student_id = $1
       ORDER BY b.booking_date DESC, b.start_time DESC`,
      [userId]
    );
    
    res.json({
      success: true,
      bookings: result.rows
    });
    
  } catch (error) {
    console.error('View bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
});

// Route: View all bookings (Faculty/Admin only)
router.get('/all', requireAuth, requirePermission(PERMISSIONS.VIEW_ALL_BOOKINGS), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        b.booking_id, b.booking_date, b.start_time, b.end_time, 
        b.purpose, b.status, b.faculty_recommendation, b.created_at,
        r.resource_name, r.resource_type,
        u.full_name as student_name, u.email as student_email,
        f.full_name as faculty_name,
        a.full_name as admin_name
       FROM bookings b
       JOIN resources r ON b.resource_id = r.resource_id
       JOIN users u ON b.student_id = u.user_id
       LEFT JOIN users f ON b.faculty_id = f.user_id
       LEFT JOIN users a ON b.admin_id = a.user_id
       ORDER BY 
         CASE b.status
           WHEN 'pending' THEN 1
           WHEN 'recommended' THEN 2
           WHEN 'approved' THEN 3
           ELSE 4
         END,
         b.booking_date DESC`
    );
    
    res.json({
      success: true,
      bookings: result.rows
    });
    
  } catch (error) {
    console.error('View all bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
});

// Route: Recommend booking (Faculty only)
router.post('/recommend/:bookingId', requireAuth, requirePermission(PERMISSIONS.RECOMMEND_BOOKING), async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { recommendation } = req.body;
    const facultyId = req.session.userId;
    
    if (!recommendation) {
      return res.status(400).json({
        success: false,
        error: 'Recommendation text is required'
      });
    }
    
    // Update booking
    const result = await pool.query(
      `UPDATE bookings 
       SET status = 'recommended', 
           faculty_id = $1, 
           faculty_recommendation = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $3 AND status = 'pending'
       RETURNING booking_id`,
      [facultyId, recommendation, bookingId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found or already processed'
      });
    }
    
    res.json({
      success: true,
      message: 'Booking recommended successfully'
    });
    
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recommend booking'
    });
  }
});

// Route: Approve booking (Admin only) - with digital signature
router.post('/approve/:bookingId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { bookingId } = req.params;
    const adminId = req.session.userId;
    
    // Get booking details
    const bookingResult = await pool.query(
      `SELECT b.*, u.full_name as student_name
       FROM bookings b
       JOIN users u ON b.student_id = u.user_id
       WHERE b.booking_id = $1`,
      [bookingId]
    );
    
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }
    
    const booking = bookingResult.rows[0];
    
    // Get admin's private key for signing
    const adminResult = await pool.query(
      'SELECT private_key FROM users WHERE user_id = $1',
      [adminId]
    );
    
    if (!adminResult.rows[0].private_key) {
      return res.status(500).json({
        success: false,
        error: 'Admin signing key not found'
      });
    }
    
    const adminPrivateKey = adminResult.rows[0].private_key;
    
    // Prepare booking data for signature
    const signatureData = {
      booking_id: booking.booking_id,
      student_id: booking.student_id,
      resource_id: booking.resource_id,
      booking_date: booking.booking_date,
      status: 'approved',
      admin_id: adminId,
      timestamp: new Date().toISOString()
    };
    
    // Create digital signature
    const { hash, signature } = signBookingApproval(signatureData, adminPrivateKey);
    
    // Generate access token (Base64 + QR code)
    const tokenData = {
      booking_id: booking.booking_id,
      student_id: booking.student_id,
      resource_id: booking.resource_id,
      booking_date: booking.booking_date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      data_hash: hash
    };
    
    const { base64Token, qrCode } = await createEncodedToken(tokenData);
    
    // Update booking with approval, signature, and token
    await pool.query(
      `UPDATE bookings 
       SET status = 'approved',
           admin_id = $1,
           data_hash = $2,
           digital_signature = $3,
           access_token = $4,
           qr_code_data = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $6`,
      [adminId, hash, signature, base64Token, qrCode, bookingId]
    );
    
    res.json({
      success: true,
      message: 'Booking approved and signed successfully',
      accessToken: base64Token,
      qrCode: qrCode,
      signature: {
        hash: hash,
        signature: signature.substring(0, 50) + '...' // Preview only
      }
    });
    
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve booking'
    });
  }
});

// Route: Reject booking (Admin only)
router.post('/reject/:bookingId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const adminId = req.session.userId;
    
    await pool.query(
      `UPDATE bookings 
       SET status = 'rejected',
           admin_id = $1,
           faculty_recommendation = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $3`,
      [adminId, reason || 'Rejected by admin', bookingId]
    );
    
    res.json({
      success: true,
      message: 'Booking rejected'
    });
    
  } catch (error) {
    console.error('Rejection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject booking'
    });
  }
});

// Route: Get booking details with decryption (Admin only)
router.get('/decrypt/:bookingId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { bookingId } = req.params;
    const adminId = req.session.userId;
    
    // Get booking with encrypted data
    const result = await pool.query(
      `SELECT encrypted_details, encrypted_aes_key, iv FROM bookings WHERE booking_id = $1`,
      [bookingId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }
    
    const booking = result.rows[0];
    
    // Get admin's private key for decryption
    const adminResult = await pool.query(
      'SELECT private_key FROM users WHERE user_id = $1',
      [adminId]
    );
    
    const adminPrivateKey = adminResult.rows[0].private_key;
    
    // Decrypt booking data
    const decrypted = hybridDecrypt({
      encryptedData: booking.encrypted_details,
      encryptedAESKey: booking.encrypted_aes_key,
      iv: booking.iv
    }, adminPrivateKey);
    
    res.json({
      success: true,
      message: 'Booking data decrypted successfully',
      decryptedData: decrypted
    });
    
  } catch (error) {
    console.error('Decryption error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to decrypt booking data'
    });
  }
});

// Route: Verify access token
router.post('/verify-token', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    const { decodeFromBase64, validateToken } = require('../utils/encoding');
    
    // Decode token
    const decoded = decodeFromBase64(token);
    
    if (!decoded.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token format'
      });
    }
    
    // Validate token
    const validation = validateToken(decoded.token);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason
      });
    }
    
    // Get booking details
    const booking = await pool.query(
      `SELECT b.*, r.resource_name, u.full_name as student_name
       FROM bookings b
       JOIN resources r ON b.resource_id = r.resource_id
       JOIN users u ON b.student_id = u.user_id
       WHERE b.booking_id = $1`,
      [decoded.token.booking_id]
    );
    
    if (booking.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }
    
    res.json({
      success: true,
      valid: true,
      booking: booking.rows[0],
      tokenDetails: decoded.token
    });
    
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Token verification failed'
    });
  }
});

module.exports = router;