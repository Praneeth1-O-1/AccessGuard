// utils/acl.js
// SECURITY REQUIREMENT: Authorization using Access Control List (ACL)
// This module implements role-based access control with permission matrix

const pool = require('../config/database');

/**
 * ACCESS CONTROL MATRIX:
 * 
 * Role       | Create Booking | View Own | View All | Recommend | Approve | Manage Resources
 * -----------|----------------|----------|----------|-----------|---------|------------------
 * Student    | ✓              | ✓        | ✗        | ✗         | ✗       | ✗
 * Faculty    | ✗              | ✓        | ✓        | ✓         | ✗       | ✗
 * Admin      | ✓              | ✓        | ✓        | ✓         | ✓       | ✓
 * 
 * This implements role-based access control (RBAC)
 */

// Permission definitions
const PERMISSIONS = {
  // Booking permissions
  CREATE_BOOKING: 'create_booking',
  VIEW_OWN_BOOKINGS: 'view_own_bookings',
  VIEW_ALL_BOOKINGS: 'view_all_bookings',
  RECOMMEND_BOOKING: 'recommend_booking',
  APPROVE_BOOKING: 'approve_booking',
  REJECT_BOOKING: 'reject_booking',
  
  // Resource permissions
  VIEW_RESOURCES: 'view_resources',
  MANAGE_RESOURCES: 'manage_resources',
  
  // User permissions
  VIEW_USERS: 'view_users',
  MANAGE_USERS: 'manage_users',
};

// Role-based permission matrix
const ROLE_PERMISSIONS = {
  student: [
    PERMISSIONS.CREATE_BOOKING,
    PERMISSIONS.VIEW_OWN_BOOKINGS,
    PERMISSIONS.VIEW_RESOURCES,
  ],
  
  faculty: [
    PERMISSIONS.VIEW_OWN_BOOKINGS,
    PERMISSIONS.VIEW_ALL_BOOKINGS,
    PERMISSIONS.RECOMMEND_BOOKING,
    PERMISSIONS.VIEW_RESOURCES,
    PERMISSIONS.VIEW_USERS,
  ],
  
  admin: [
    PERMISSIONS.CREATE_BOOKING,
    PERMISSIONS.VIEW_OWN_BOOKINGS,
    PERMISSIONS.VIEW_ALL_BOOKINGS,
    PERMISSIONS.RECOMMEND_BOOKING,
    PERMISSIONS.APPROVE_BOOKING,
    PERMISSIONS.REJECT_BOOKING,
    PERMISSIONS.VIEW_RESOURCES,
    PERMISSIONS.MANAGE_RESOURCES,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.MANAGE_USERS,
  ],
};

// Check if user has permission
function hasPermission(userRole, permission) {
  if (!ROLE_PERMISSIONS[userRole]) {
    return false;
  }
  
  return ROLE_PERMISSIONS[userRole].includes(permission);
}

// Check multiple permissions (user must have ALL)
function hasAllPermissions(userRole, permissions) {
  return permissions.every(permission => hasPermission(userRole, permission));
}

// Check multiple permissions (user must have ANY)
function hasAnyPermission(userRole, permissions) {
  return permissions.some(permission => hasPermission(userRole, permission));
}

// Middleware: Require authentication
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
}

// Middleware: Require specific permission
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.session || !req.session.userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      
      // Get user role from database
      const result = await pool.query(
        'SELECT role FROM users WHERE user_id = $1',
        [req.session.userId]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }
      
      const userRole = result.rows[0].role;
      
      // Check permission
      if (!hasPermission(userRole, permission)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          required: permission,
          userRole: userRole
        });
      }
      
      // Store role in request for later use
      req.userRole = userRole;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Authorization check failed'
      });
    }
  };
}

// Middleware: Require specific role
function requireRole(allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      
      const result = await pool.query(
        'SELECT role FROM users WHERE user_id = $1',
        [req.session.userId]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }
      
      const userRole = result.rows[0].role;
      
      // Check if user role is in allowed roles
      const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      
      if (!rolesArray.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied for your role',
          requiredRoles: rolesArray,
          userRole: userRole
        });
      }
      
      req.userRole = userRole;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Authorization check failed'
      });
    }
  };
}

// Get all permissions for a role
function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

// Initialize ACL permissions in database
async function initializeACL() {
  try {
    // Insert permission definitions for each role
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const customPermissions = {
        permissions: permissions
      };
      
      await pool.query(
        `INSERT INTO acl_permissions (role, resource_type, can_create, can_read, can_update, can_delete, custom_permissions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [
          role,
          'booking',
          permissions.includes(PERMISSIONS.CREATE_BOOKING),
          permissions.includes(PERMISSIONS.VIEW_ALL_BOOKINGS) || permissions.includes(PERMISSIONS.VIEW_OWN_BOOKINGS),
          permissions.includes(PERMISSIONS.RECOMMEND_BOOKING) || permissions.includes(PERMISSIONS.APPROVE_BOOKING),
          permissions.includes(PERMISSIONS.REJECT_BOOKING),
          JSON.stringify(customPermissions)
        ]
      );
    }
    
    console.log('✓ ACL permissions initialized');
  } catch (error) {
    console.error('ACL initialization failed:', error.message);
  }
}

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  requireAuth,
  requirePermission,
  requireRole,
  getRolePermissions,
  initializeACL
};