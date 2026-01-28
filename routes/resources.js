// routes/resources.js
// Resource management routes

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth, requirePermission, requireRole, PERMISSIONS } = require('../utils/acl');

// Route: Get all resources (All authenticated users)
router.get('/', requireAuth, requirePermission(PERMISSIONS.VIEW_RESOURCES), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT resource_id, resource_name, resource_type, description, capacity
       FROM resources
       ORDER BY resource_type, resource_name`
    );
    
    res.json({
      success: true,
      resources: result.rows
    });
    
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resources'
    });
  }
});

// Route: Get resource by ID
router.get('/:resourceId', requireAuth, async (req, res) => {
  try {
    const { resourceId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM resources WHERE resource_id = $1',
      [resourceId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found'
      });
    }
    
    res.json({
      success: true,
      resource: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get resource error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resource'
    });
  }
});

// Route: Create new resource (Admin only)
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { resourceName, resourceType, description, capacity } = req.body;
    
    if (!resourceName || !resourceType) {
      return res.status(400).json({
        success: false,
        error: 'Resource name and type are required'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO resources (resource_name, resource_type, description, capacity)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [resourceName, resourceType, description, capacity]
    );
    
    res.json({
      success: true,
      message: 'Resource created successfully',
      resource: result.rows[0]
    });
    
  } catch (error) {
    console.error('Create resource error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create resource'
    });
  }
});

// Route: Update resource (Admin only)
router.put('/:resourceId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { resourceName, resourceType, description, capacity } = req.body;
    
    const result = await pool.query(
      `UPDATE resources
       SET resource_name = COALESCE($1, resource_name),
           resource_type = COALESCE($2, resource_type),
           description = COALESCE($3, description),
           capacity = COALESCE($4, capacity)
       WHERE resource_id = $5
       RETURNING *`,
      [resourceName, resourceType, description, capacity, resourceId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Resource updated successfully',
      resource: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update resource error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update resource'
    });
  }
});

// Route: Delete resource (Admin only)
router.delete('/:resourceId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { resourceId } = req.params;
    
    const result = await pool.query(
      'DELETE FROM resources WHERE resource_id = $1 RETURNING resource_name',
      [resourceId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found'
      });
    }
    
    res.json({
      success: true,
      message: `Resource "${result.rows[0].resource_name}" deleted successfully`
    });
    
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete resource'
    });
  }
});

// Route: Get resource availability
router.get('/:resourceId/availability', requireAuth, async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date parameter is required'
      });
    }
    
    // Get all bookings for this resource on the given date
    const result = await pool.query(
      `SELECT booking_id, start_time, end_time, status
       FROM bookings
       WHERE resource_id = $1 
         AND booking_date = $2
         AND status IN ('pending', 'recommended', 'approved')
       ORDER BY start_time`,
      [resourceId, date]
    );
    
    res.json({
      success: true,
      date: date,
      bookings: result.rows
    });
    
  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check availability'
    });
  }
});

module.exports = router;