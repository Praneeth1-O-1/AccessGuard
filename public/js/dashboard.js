// dashboard.js - Dashboard logic

let currentUser = null;
let allBookings = [];
let currentFilter = 'all';

// Initialize dashboard
window.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const status = await checkAuthStatus();
    
    if (!status.authenticated) {
        window.location.href = '/';
        return;
    }
    
    currentUser = status.user;
    
    // Display user info
    document.getElementById('userInfo').textContent = 
        `${currentUser.fullName} (${currentUser.role})`;
    
    // Load appropriate view based on role
    loadDashboardView();
    
    // Load resources for create booking modal
    loadResources();
});

// Check authentication status
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status');
        return await response.json();
    } catch (error) {
        console.error('Status check error:', error);
        return { authenticated: false };
    }
}

// Load dashboard view based on role
async function loadDashboardView() {
    const role = currentUser.role;
    
    // Hide all views
    document.getElementById('studentView').style.display = 'none';
    document.getElementById('facultyView').style.display = 'none';
    document.getElementById('adminView').style.display = 'none';
    
    // Show appropriate view
    if (role === 'student') {
        document.getElementById('studentView').style.display = 'block';
        await loadMyBookings();
    } else if (role === 'faculty') {
        document.getElementById('facultyView').style.display = 'block';
        await loadAllBookings('facultyBookingsList');
    } else if (role === 'admin') {
        document.getElementById('adminView').style.display = 'block';
        await loadAllBookings('adminBookingsList');
    }
}

// Load my bookings (for students)
async function loadMyBookings() {
    try {
        const response = await fetch('/api/bookings/my-bookings');
        const data = await response.json();
        
        if (data.success) {
            displayBookings(data.bookings, 'bookingsList', 'student');
        }
    } catch (error) {
        console.error('Load bookings error:', error);
    }
}

// Load all bookings (for faculty and admin)
async function loadAllBookings(containerId) {
    try {
        const response = await fetch('/api/bookings/all');
        const data = await response.json();
        
        if (data.success) {
            allBookings = data.bookings;
            displayBookings(filterBookingsByStatus(allBookings), containerId, currentUser.role);
        }
    } catch (error) {
        console.error('Load bookings error:', error);
    }
}

// Filter bookings by status
function filterBookingsByStatus(bookings) {
    if (currentFilter === 'all') {
        return bookings;
    }
    return bookings.filter(b => b.status === currentFilter);
}

// Filter bookings (for admin)
function filterBookings(status) {
    currentFilter = status;
    
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Display filtered bookings
    displayBookings(filterBookingsByStatus(allBookings), 'adminBookingsList', 'admin');
}

// Display bookings
function displayBookings(bookings, containerId, role) {
    const container = document.getElementById(containerId);
    
    if (bookings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <p>No bookings found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = bookings.map(booking => createBookingCard(booking, role)).join('');
}

// Create booking card HTML
function createBookingCard(booking, role) {
    const statusClass = `status-${booking.status}`;
    const date = new Date(booking.booking_date).toLocaleDateString();
    
    let actions = '';
    
    if (role === 'faculty' && booking.status === 'pending') {
        actions = `
            <button onclick="showRecommendModal(${booking.booking_id})" class="btn-primary btn-small">
                Recommend
            </button>
        `;
    } else if (role === 'admin' && booking.status === 'recommended') {
        actions = `
            <button onclick="showApproveModal(${booking.booking_id})" class="btn-primary btn-small">
                Approve
            </button>
            <button onclick="rejectBooking(${booking.booking_id})" class="btn-secondary btn-small">
                Reject
            </button>
        `;
    } else if (booking.status === 'approved' && booking.access_token) {
        actions = `
            <button onclick="viewToken(${booking.booking_id})" class="btn-secondary btn-small">
                View Access Token
            </button>
        `;
    }
    
    return `
        <div class="booking-card">
            <div class="booking-header">
                <div>
                    <div class="booking-title">${booking.resource_name}</div>
                    <div class="booking-meta">${booking.student_name}</div>
                </div>
                <span class="status-badge ${statusClass}">${booking.status}</span>
            </div>
            <div class="booking-details">
                <div class="detail-item">
                    <strong>Date:</strong> ${date}
                </div>
                <div class="detail-item">
                    <strong>Time:</strong> ${booking.start_time} - ${booking.end_time}
                </div>
                <div class="detail-item">
                    <strong>Type:</strong> ${booking.resource_type}
                </div>
                ${booking.faculty_name ? `
                    <div class="detail-item">
                        <strong>Faculty:</strong> ${booking.faculty_name}
                    </div>
                ` : ''}
            </div>
            <div class="detail-item" style="margin-bottom: 16px;">
                <strong>Purpose:</strong> ${booking.purpose}
            </div>
            ${booking.faculty_recommendation ? `
                <div class="detail-item" style="margin-bottom: 16px;">
                    <strong>Recommendation:</strong> ${booking.faculty_recommendation}
                </div>
            ` : ''}
            ${actions ? `<div class="booking-actions">${actions}</div>` : ''}
        </div>
    `;
}

// Load resources for dropdown
async function loadResources() {
    try {
        const response = await fetch('/api/resources');
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('resourceId');
            select.innerHTML = '<option value="">Select a resource...</option>' +
                data.resources.map(r => 
                    `<option value="${r.resource_id}">${r.resource_name} (${r.resource_type})</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Load resources error:', error);
    }
}

// Show create booking modal
function showCreateBooking() {
    document.getElementById('createBookingModal').style.display = 'flex';
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bookingDate').setAttribute('min', today);
}

// Close create booking modal
function closeCreateBooking() {
    document.getElementById('createBookingModal').style.display = 'none';
    document.querySelector('#createBookingModal form').reset();
}

// Handle create booking
async function handleCreateBooking(event) {
    event.preventDefault();
    
    const formData = {
        resourceId: document.getElementById('resourceId').value,
        bookingDate: document.getElementById('bookingDate').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        purpose: document.getElementById('purpose').value
    };
    
    try {
        const response = await fetch('/api/bookings/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeCreateBooking();
            alert('Booking created successfully! Your data has been encrypted.');
            await loadMyBookings();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Create booking error:', error);
        alert('Network error. Please try again.');
    }
}

// Show recommend modal
async function showRecommendModal(bookingId) {
    const booking = allBookings.find(b => b.booking_id === bookingId);
    
    if (!booking) return;
    
    document.getElementById('recommendBookingId').value = bookingId;
    document.getElementById('recommendBookingDetails').innerHTML = `
        <div class="booking-details" style="margin-bottom: 24px;">
            <div class="detail-item"><strong>Student:</strong> ${booking.student_name}</div>
            <div class="detail-item"><strong>Resource:</strong> ${booking.resource_name}</div>
            <div class="detail-item"><strong>Date:</strong> ${new Date(booking.booking_date).toLocaleDateString()}</div>
            <div class="detail-item"><strong>Time:</strong> ${booking.start_time} - ${booking.end_time}</div>
        </div>
        <div class="detail-item" style="margin-bottom: 16px;">
            <strong>Purpose:</strong> ${booking.purpose}
        </div>
    `;
    
    document.getElementById('recommendModal').style.display = 'flex';
}

// Close recommend modal
function closeRecommendModal() {
    document.getElementById('recommendModal').style.display = 'none';
    document.querySelector('#recommendModal form').reset();
}

// Handle recommend
async function handleRecommend(event) {
    event.preventDefault();
    
    const bookingId = document.getElementById('recommendBookingId').value;
    const recommendation = document.getElementById('recommendation').value;
    
    try {
        const response = await fetch(`/api/bookings/recommend/${bookingId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recommendation })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeRecommendModal();
            alert('Booking recommended successfully!');
            await loadAllBookings('facultyBookingsList');
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Recommend error:', error);
        alert('Network error. Please try again.');
    }
}

// Show approve modal
async function showApproveModal(bookingId) {
    const booking = allBookings.find(b => b.booking_id === bookingId);
    
    if (!booking) return;
    
    document.getElementById('approveBookingId').value = bookingId;
    document.getElementById('approveBookingDetails').innerHTML = `
        <div class="booking-details" style="margin-bottom: 24px;">
            <div class="detail-item"><strong>Student:</strong> ${booking.student_name}</div>
            <div class="detail-item"><strong>Resource:</strong> ${booking.resource_name}</div>
            <div class="detail-item"><strong>Date:</strong> ${new Date(booking.booking_date).toLocaleDateString()}</div>
            <div class="detail-item"><strong>Time:</strong> ${booking.start_time} - ${booking.end_time}</div>
        </div>
        <div class="detail-item" style="margin-bottom: 16px;">
            <strong>Purpose:</strong> ${booking.purpose}
        </div>
        ${booking.faculty_recommendation ? `
            <div class="detail-item" style="margin-bottom: 16px;">
                <strong>Faculty Recommendation:</strong> ${booking.faculty_recommendation}
            </div>
        ` : ''}
    `;
    
    document.getElementById('approveModal').style.display = 'flex';
}

// Close approve modal
function closeApproveModal() {
    document.getElementById('approveModal').style.display = 'none';
}

// Handle approve
async function handleApprove() {
    const bookingId = document.getElementById('approveBookingId').value;
    
    try {
        const response = await fetch(`/api/bookings/approve/${bookingId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeApproveModal();
            
            // Show token modal
            showTokenDisplay(data);
            
            await loadAllBookings('adminBookingsList');
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Approve error:', error);
        alert('Network error. Please try again.');
    }
}

// Reject booking
async function rejectBooking(bookingId) {
    const reason = prompt('Enter rejection reason (optional):');
    
    if (reason === null) return; // User cancelled
    
    try {
        const response = await fetch(`/api/bookings/reject/${bookingId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Booking rejected');
            await loadAllBookings('adminBookingsList');
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Reject error:', error);
        alert('Network error. Please try again.');
    }
}

// Show token display
function showTokenDisplay(data) {
    document.getElementById('qrCodeDisplay').innerHTML = 
        `<img src="${data.qrCode}" alt="QR Code">`;
    document.getElementById('base64Token').textContent = data.accessToken;
    document.getElementById('signatureHash').textContent = data.signature.hash;
    document.getElementById('signatureValue').textContent = data.signature.signature;
    
    document.getElementById('tokenModal').style.display = 'flex';
}

// View token for approved booking
async function viewToken(bookingId) {
    const booking = allBookings.find(b => b.booking_id === bookingId);
    
    if (!booking || !booking.access_token) {
        alert('Token not available');
        return;
    }
    
    // Mock data for display (in production, fetch from server)
    showTokenDisplay({
        qrCode: booking.qr_code_data,
        accessToken: booking.access_token,
        signature: {
            hash: booking.data_hash || 'N/A',
            signature: (booking.digital_signature || 'N/A').substring(0, 50) + '...'
        }
    });
}

// Close token modal
function closeTokenModal() {
    document.getElementById('tokenModal').style.display = 'none';
}

// Copy token to clipboard
function copyToken() {
    const token = document.getElementById('base64Token').textContent;
    navigator.clipboard.writeText(token).then(() => {
        alert('Token copied to clipboard!');
    });
}

// Logout
async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST'
        });
        
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Close modal on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}