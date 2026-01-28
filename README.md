## AccessGuard

### Secure Resource Access Management System

AccessGuard is a secure, role-based resource access management system designed for academic environments.
It demonstrates **authentication, authorization, encryption, digital signatures, and secure token handling** in compliance with cybersecurity best practices.

---

## Project Overview

The system allows students to request access to institutional resources, which are reviewed by faculty and finally approved or rejected by administrators.
Security is enforced at every stage using modern cryptographic and access control mechanisms.

---

## User Roles

| Role        | Responsibilities                                          |
| ----------- | --------------------------------------------------------- |
| **Student** | Create booking requests for resources                     |
| **Faculty** | Review and recommend student booking requests             |
| **Admin**   | Approve or reject bookings and issue secure access tokens |

---

## Security Features Implemented

### Authentication

* Username & password login
* Passwords hashed using **bcrypt**
* **Multi-Factor Authentication (MFA)** using time-bound OTP

### Session Management

* Custom **database-backed sessions**
* Secure session ID stored in HTTP-only cookies
* Automatic session validation and cleanup

### Authorization

* **Access Control List (ACL)** based authorization
* Role-based permission enforcement
* Least-privilege access model

### Encryption

* **Hybrid Encryption**

  * AES-256 for data encryption
  * RSA for key protection
* Booking details are encrypted before storage

### Digital Signatures

* SHA-256 hashing
* RSA digital signatures
* Ensures data integrity and authenticity for approved bookings

### Token Encoding

* Access tokens encoded using **Base64**
* QR Code generation for secure and portable access
* Token verification supported

---

## Booking Workflow

1. **Student** creates a booking request
   → Booking data is encrypted and stored with status `pending`

2. **Faculty** reviews and recommends the booking
   → Status changes to `recommended`

3. **Admin** approves or rejects the booking

   * On approval:

     * Digital signature generated
     * Secure access token issued
     * QR code generated
   * On rejection:

     * Status set to `rejected`

---

## 🖥️ Technology Stack

### Frontend

* HTML5
* CSS3 (Minimalist UI)
* Vanilla JavaScript

### Backend

* Node.js
* Express.js

### Database

* PostgreSQL

### Security & Crypto

* Node.js `crypto` module
* bcrypt
* RSA + AES encryption
* SHA-256 hashing

---

## 📂 Project Structure

```
AccessGuard/
│
├── public/
│   ├── index.html
│   ├── dashboard.html
│   └── js/
│       ├── auth.js
│       └── dashboard.js
│
├── routes/
│   ├── auth.js
│   ├── bookings.js
│   └── resources.js
│
├── utils/
│   ├── acl.js
│   ├── otp.js
│   ├── session.js
│   ├── encryption.js
│   ├── digitalSignature.js
│   └── encoding.js
│
├── config/
│   └── database.js
│
├── server.js
└── README.md
```

---

##  How to Run the Project

### 1️⃣ Install dependencies

```bash
npm install
```

### 2️⃣ Configure database

* Create PostgreSQL database
* Update credentials in `config/database.js`
* Ensure required tables exist (`users`, `bookings`, `sessions`, etc.)

### 3️⃣ Start the server

```bash
npm start
```

### 4️⃣ Access the application

```
http://localhost:3000
```

---

## 🧪 Sample Credentials (For Testing)

| Role    | Username |
| ------- | -------- |
| Student | student1 |
| Faculty | faculty1 |
| Admin   | admin1   |

*(Passwords are securely hashed in the database)*

