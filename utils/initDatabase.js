// utils/initDatabase.js
// Database initialization script - creates tables and seed data

const pool = require('../config/database');
const { hashPassword, generateSalt } = require('./hashing');
const { generateRSAKeyPair } = require('./encryption');

async function initializeDatabase() {
  try {
    console.log('Starting database initialization...\n');
    
    // Drop existing tables (for clean setup)
    console.log('Dropping existing tables...');
    await pool.query(`
      DROP TABLE IF EXISTS sessions CASCADE;
      DROP TABLE IF EXISTS otp_codes CASCADE;
      DROP TABLE IF EXISTS bookings CASCADE;
      DROP TABLE IF EXISTS resources CASCADE;
      DROP TABLE IF EXISTS acl_permissions CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    console.log('✓ Existing tables dropped\n');
    
    // Create Users table
    console.log('Creating users table...');
    await pool.query(`
      CREATE TABLE users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'faculty', 'admin')),
        email VARCHAR(100) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        public_key TEXT,
        private_key TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Users table created');
    
    // Create Resources table
    console.log('Creating resources table...');
    await pool.query(`
      CREATE TABLE resources (
        resource_id SERIAL PRIMARY KEY,
        resource_name VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        description TEXT,
        capacity INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Resources table created');
    
    // Create Bookings table
    console.log('Creating bookings table...');
    await pool.query(`
      CREATE TABLE bookings (
        booking_id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES users(user_id),
        resource_id INTEGER REFERENCES resources(resource_id),
        booking_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        purpose TEXT NOT NULL,
        encrypted_details TEXT,
        encrypted_aes_key TEXT,
        iv TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        faculty_id INTEGER REFERENCES users(user_id),
        faculty_recommendation TEXT,
        admin_id INTEGER REFERENCES users(user_id),
        data_hash VARCHAR(64),
        digital_signature TEXT,
        access_token TEXT,
        qr_code_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Bookings table created');
    
    // Create OTP table
    console.log('Creating otp_codes table...');
    await pool.query(`
      CREATE TABLE otp_codes (
        otp_id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(user_id),
        otp_code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ OTP codes table created');
    
    // Create Sessions table
    console.log('Creating sessions table...');
    await pool.query(`
      CREATE TABLE sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(user_id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `);
    console.log('✓ Sessions table created');
    
    // Create ACL Permissions table
    console.log('Creating acl_permissions table...');
    await pool.query(`
      CREATE TABLE acl_permissions (
        permission_id SERIAL PRIMARY KEY,
        role VARCHAR(20) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        can_create BOOLEAN DEFAULT FALSE,
        can_read BOOLEAN DEFAULT FALSE,
        can_update BOOLEAN DEFAULT FALSE,
        can_delete BOOLEAN DEFAULT FALSE,
        custom_permissions JSONB
      )
    `);
    console.log('✓ ACL permissions table created\n');
    
    // Insert seed data
    console.log('Inserting seed data...\n');
    
    // Generate admin RSA keys
    console.log('Generating RSA keys for admin...');
    const adminKeys = generateRSAKeyPair();
    console.log('✓ Admin RSA keys generated');
    
    // Create users
    console.log('Creating users...');
    const users = [
      {
        username: 'john_student',
        password: 'Student@123',
        role: 'student',
        email: 'john@university.edu',
        full_name: 'John Doe'
      },
      {
        username: 'sarah_student',
        password: 'Student@456',
        role: 'student',
        email: 'sarah@university.edu',
        full_name: 'Sarah Smith'
      },
      {
        username: 'prof_anderson',
        password: 'Faculty@123',
        role: 'faculty',
        email: 'anderson@university.edu',
        full_name: 'Prof. Robert Anderson'
      },
      {
        username: 'admin_wilson',
        password: 'Admin@123',
        role: 'admin',
        email: 'wilson@university.edu',
        full_name: 'Admin Michael Wilson',
        publicKey: adminKeys.publicKey,
        privateKey: adminKeys.privateKey
      }
    ];
    
    for (const user of users) {
      const passwordHash = await hashPassword(user.password);
      const salt = generateSalt();
      
      await pool.query(
        `INSERT INTO users (username, password_hash, salt, role, email, full_name, public_key, private_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user.username,
          passwordHash,
          salt,
          user.role,
          user.email,
          user.full_name,
          user.publicKey || null,
          user.privateKey || null
        ]
      );
      
      console.log(`✓ Created user: ${user.username} (${user.role})`);
    }
    
    // Create resources
    console.log('\nCreating resources...');
    const resources = [
      {
        name: 'Computer Lab A',
        type: 'lab',
        description: 'Advanced computing lab with 50 workstations',
        capacity: 50
      },
      {
        name: 'Seminar Hall 1',
        type: 'seminar_hall',
        description: 'Large seminar hall with projector and audio system',
        capacity: 200
      },
      {
        name: 'Conference Room B',
        type: 'seminar_hall',
        description: 'Medium-sized conference room for meetings',
        capacity: 30
      },
      {
        name: 'VR Equipment Set',
        type: 'equipment',
        description: 'Virtual Reality headsets and controllers (5 units)',
        capacity: 5
      },
      {
        name: 'Data Science Lab',
        type: 'lab',
        description: 'GPU cluster lab for ML/AI workloads',
        capacity: 25
      }
    ];
    
    for (const resource of resources) {
      await pool.query(
        `INSERT INTO resources (resource_name, resource_type, description, capacity)
         VALUES ($1, $2, $3, $4)`,
        [resource.name, resource.type, resource.description, resource.capacity]
      );
      
      console.log(`✓ Created resource: ${resource.name}`);
    }
    
    console.log('\n========================================');
    console.log('✓ Database initialized successfully!');
    console.log('========================================\n');
    
    console.log('TEST CREDENTIALS:');
    console.log('----------------------------------------');
    console.log('Student Account:');
    console.log('  Username: john_student');
    console.log('  Password: Student@123');
    console.log('');
    console.log('Faculty Account:');
    console.log('  Username: prof_anderson');
    console.log('  Password: Faculty@123');
    console.log('');
    console.log('Admin Account:');
    console.log('  Username: admin_wilson');
    console.log('  Password: Admin@123');
    console.log('----------------------------------------\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

// Run initialization
initializeDatabase();