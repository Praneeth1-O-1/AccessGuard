// public/js/auth.js
// Frontend authentication logic (Password + OTP)

document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();
});

/* -------------------------------
   STEP 0: Check auth status
-------------------------------- */
async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();

    if (data.authenticated) {
      window.location.href = '/dashboard.html';
    }
  } catch (err) {
    console.error('Auth status check failed:', err);
  }
}

/* -------------------------------
   STEP 1: Password Login
-------------------------------- */
async function handlePasswordLogin(event) {
  event.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!data.success) {
      showError(data.error || 'Login failed');
      return;
    }

    // Move to OTP step
    document.getElementById('userId').value = data.userId;
    document.getElementById('passwordStep').style.display = 'none';
    document.getElementById('otpStep').style.display = 'block';
    clearError();

  } catch (err) {
    console.error('Login error:', err);
    showError('Server error. Try again.');
  }
}

/* -------------------------------
   STEP 2: OTP Verification
-------------------------------- */
async function handleOTPVerification(event) {
  event.preventDefault();

  const userId = document.getElementById('userId').value;
  const otp = document.getElementById('otp').value.trim();

  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, otp })
    });

    const data = await res.json();

    if (!data.success) {
      showError(data.error || 'Invalid OTP');
      return;
    }

    // Success → dashboard
    window.location.href = '/dashboard.html';

  } catch (err) {
    console.error('OTP error:', err);
    showError('OTP verification failed');
  }
}

/* -------------------------------
   Logout
-------------------------------- */
async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  } catch (err) {
    console.error('Logout error:', err);
  }
}

/* -------------------------------
   UI Helpers
-------------------------------- */
function showError(message) {
  const el = document.getElementById('authError');
  el.textContent = message;
  el.style.display = 'block';
}

function clearError() {
  const el = document.getElementById('authError');
  el.textContent = '';
  el.style.display = 'none';
}
