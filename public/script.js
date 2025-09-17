// Global variables
let cases = [];
let currentEditingCaseId = null;
let currentUser = null;
let authToken = null;

// DOM elements
const casesTableBody = document.getElementById('casesTableBody');
const newCaseModal = document.getElementById('newCaseModal');
const editCaseModal = document.getElementById('editCaseModal');
const viewCaseModal = document.getElementById('viewCaseModal');
const newCaseForm = document.getElementById('newCaseForm');
const editCaseForm = document.getElementById('editCaseForm');

// Stats elements
const totalCasesEl = document.getElementById('totalCases');
const openCasesEl = document.getElementById('openCases');
const overdueCasesEl = document.getElementById('overdueCases');
const resolvedCasesEl = document.getElementById('resolvedCases');

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // ตรวจสอบการล็อกอิน
    checkAuthentication();
    
    // Modal controls
    setupModalControls();
    
    // Form submissions
    newCaseForm.addEventListener('submit', handleNewCaseSubmit);
    editCaseForm.addEventListener('submit', handleEditCaseSubmit);
    
    // Button clicks
    document.getElementById('newCaseBtn').addEventListener('click', openNewCaseModal);
    document.getElementById('refreshBtn').addEventListener('click', loadCases);
    document.getElementById('cancelNewCase').addEventListener('click', closeNewCaseModal);
    document.getElementById('cancelEditCase').addEventListener('click', closeEditCaseModal);
    document.getElementById('closeViewCase').addEventListener('click', closeViewCaseModal);
    document.getElementById('editFromView').addEventListener('click', editFromView);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('adminPanelBtn').addEventListener('click', openAdminPanel);
    document.getElementById('cancelAssignSeverity').addEventListener('click', closeAssignSeverityModal);
    
    // Admin Panel
    setupAdminPanel();
    
    // Assign Severity Form
    document.getElementById('assignSeverityForm').addEventListener('submit', handleAssignSeveritySubmit);
});

// ตรวจสอบการล็อกอิน
async function checkAuthentication() {
    authToken = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (!authToken || !userData) {
        // ไม่ได้ล็อกอิน ไปหน้า login
        window.location.href = '/login';
        return;
    }
    
    try {
        // ตรวจสอบ token ว่ายังใช้ได้หรือไม่
        const response = await fetch('/api/me', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            // Token หมดอายุหรือไม่ถูกต้อง
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        currentUser = data.user;
        
        // แสดงข้อมูลผู้ใช้
        displayUserInfo();
        
        // โหลดข้อมูลเคส
        loadCases();
        
    } catch (error) {
        console.error('Authentication check failed:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
}

// แสดงข้อมูลผู้ใช้
function displayUserInfo() {
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const adminPanelBtn = document.getElementById('adminPanelBtn');
    const adminActionsHeader = document.getElementById('adminActionsHeader');
    
    userInfo.style.display = 'flex';
    userName.textContent = currentUser.full_name;
    userRole.textContent = currentUser.role === 'admin' ? 'Admin' : 'User';
    userRole.className = `role-badge ${currentUser.role}`;
    
    // แสดงปุ่ม Admin Panel และคอลัมน์ Admin สำหรับ Admin
    if (currentUser.role === 'admin') {
        adminPanelBtn.style.display = 'inline-flex';
        adminActionsHeader.style.display = 'table-cell';
    }
}

// ออกจากระบบ
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Setup modal controls
function setupModalControls() {
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === newCaseModal) {
            closeNewCaseModal();
        }
        if (event.target === editCaseModal) {
            closeEditCaseModal();
        }
        if (event.target === viewCaseModal) {
            closeViewCaseModal();
        }
        if (event.target === document.getElementById('adminModal')) {
            closeAdminPanel();
        }
        if (event.target === document.getElementById('assignSeverityModal')) {
            closeAssignSeverityModal();
        }
    });
    
    // Close modals with X button
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            modal.style.display = 'none';
        });
    });
}

// Load cases from API
async function loadCases() {
    try {
        showLoading();
        const response = await fetch('/api/cases', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) {
            if (response.status === 401) {
                // Token หมดอายุ
                logout();
                return;
            }
            throw new Error('ไม่สามารถโหลดข้อมูลได้');
        }
        cases = await response.json();
        renderCasesTable();
        updateStats();
    } catch (error) {
        console.error('Error loading cases:', error);
        showError('ไม่สามารถโหลดข้อมูลเคสได้: ' + error.message);
    }
}

// Show loading state
function showLoading() {
    casesTableBody.innerHTML = `
        <tr>
            <td colspan="8" class="loading">
                <i class="fas fa-spinner"></i>
                <br>กำลังโหลดข้อมูล...
            </td>
        </tr>
    `;
}

// Show error message
function showError(message) {
    casesTableBody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; color: #dc3545; padding: 20px;">
                <i class="fas fa-exclamation-triangle"></i>
                <br>${message}
            </td>
        </tr>
    `;
}

// Render cases table
function renderCasesTable() {
    if (cases.length === 0) {
        casesTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <br>ยังไม่มีเคสใดๆ
                    <br><small>คลิก "สร้างเคสใหม่" เพื่อเริ่มต้น</small>
                </td>
            </tr>
        `;
        return;
    }
    
    casesTableBody.innerHTML = cases.map(caseItem => `
        <tr>
            <td>
                <strong>${escapeHtml(caseItem.case_title)}</strong>
                <br><small style="color: #666;">ID: ${caseItem.id}</small>
            </td>
            <td>
                ${caseItem.severity ? 
                    `<span class="severity-badge severity-${caseItem.severity.toLowerCase()}">${caseItem.severity}</span>` :
                    '<span class="severity-badge" style="background: #f5f5f5; color: #999; border: 1px solid #ddd;">ยังไม่กำหนด</span>'
                }
            </td>
            <td>
                <span class="status-badge status-${caseItem.status.toLowerCase().replace(' ', '-')}">
                    ${caseItem.status}
                </span>
            </td>
            <td>${escapeHtml(caseItem.reported_by)}</td>
            <td>${formatDateTime(caseItem.created_at)}</td>
            <td>${caseItem.due_date ? formatDateTime(caseItem.due_date) : '-'}</td>
            <td>
                <span class="sla-status sla-${getSlaClass(caseItem.sla_status)}">
                    ${caseItem.sla_status || 'Pending Assignment'}
                </span>
            </td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-sm btn-secondary" onclick="viewCase(${caseItem.id})" title="ดูรายละเอียด">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="editCase(${caseItem.id})" title="แก้ไข">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
            ${currentUser.role === 'admin' ? `
            <td>
                <div style="display: flex; gap: 5px;">
                    ${!caseItem.severity ? `
                        <button class="btn btn-sm btn-primary" onclick="assignSeverity(${caseItem.id})" title="กำหนดระดับความรุนแรง">
                            <i class="fas fa-exclamation-triangle"></i>
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-info" onclick="assignSeverity(${caseItem.id})" title="เปลี่ยนระดับความรุนแรง">
                            <i class="fas fa-edit"></i>
                        </button>
                    `}
                </div>
            </td>
            ` : ''}
        </tr>
    `).join('');
}

// Get SLA CSS class
function getSlaClass(slaStatus) {
    if (!slaStatus) return 'pending';
    
    switch (slaStatus) {
        case 'Met SLA': return 'met';
        case 'Breached SLA': return 'breached';
        case 'OVERDUE': return 'overdue';
        case 'In Progress': return 'in-progress';
        case 'Pending Assignment': return 'pending';
        default: return 'pending';
    }
}

// Update statistics
function updateStats() {
    const total = cases.length;
    const open = cases.filter(c => c.status === 'Open').length;
    const overdue = cases.filter(c => c.sla_status === 'OVERDUE').length;
    const resolved = cases.filter(c => c.status === 'Resolved').length;
    
    totalCasesEl.textContent = total;
    openCasesEl.textContent = open;
    overdueCasesEl.textContent = overdue;
    resolvedCasesEl.textContent = resolved;
}

// Format date and time
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Open new case modal
function openNewCaseModal() {
    newCaseForm.reset();
    
    // กำหนดชื่อผู้แจ้งเป็นชื่อของ User ที่ล็อกอินอยู่
    if (currentUser) {
        document.getElementById('reportedBy').value = currentUser.full_name;
    }
    
    newCaseModal.style.display = 'block';
}

// Close new case modal
function closeNewCaseModal() {
    newCaseModal.style.display = 'none';
}

// Handle new case form submission
async function handleNewCaseSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(newCaseForm);
    const caseData = {
        case_title: formData.get('caseTitle'),
        problem_description: formData.get('problemDescription'),
        reported_by: formData.get('reportedBy')
    };
    
    try {
        const response = await fetch('/api/cases', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(caseData)
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            const error = await response.json();
            throw new Error(error.error || 'ไม่สามารถสร้างเคสได้');
        }
        
        closeNewCaseModal();
        loadCases();
        showSuccess('สร้างเคสใหม่สำเร็จ');
    } catch (error) {
        console.error('Error creating case:', error);
        showError('ไม่สามารถสร้างเคสได้: ' + error.message);
    }
}

// View case details
async function viewCase(caseId) {
    try {
        const response = await fetch(`/api/cases/${caseId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            throw new Error('ไม่สามารถโหลดข้อมูลเคสได้');
        }
        const caseData = await response.json();
        
        const caseDetails = document.getElementById('caseDetails');
        caseDetails.innerHTML = `
            <div class="case-detail">
                <div class="case-detail-label">หัวข้อเคส</div>
                <div class="case-detail-value">${escapeHtml(caseData.case_title)}</div>
            </div>
            <div class="case-detail">
                <div class="case-detail-label">รายละเอียดปัญหา</div>
                <div class="case-detail-value">${escapeHtml(caseData.problem_description)}</div>
            </div>
            <div class="case-detail">
                <div class="case-detail-label">ผู้แจ้ง</div>
                <div class="case-detail-value">${escapeHtml(caseData.reported_by)}</div>
            </div>
            <div class="case-detail">
                <div class="case-detail-label">ระดับความรุนแรง</div>
                <div class="case-detail-value">
                    ${caseData.severity ? 
                        `<span class="severity-badge severity-${caseData.severity.toLowerCase()}">${caseData.severity}</span>` :
                        '<span class="severity-badge" style="background: #f5f5f5; color: #999; border: 1px solid #ddd;">ยังไม่กำหนด</span>'
                    }
                </div>
            </div>
            <div class="case-detail">
                <div class="case-detail-label">สถานะ</div>
                <div class="case-detail-value">
                    <span class="status-badge status-${caseData.status.toLowerCase().replace(' ', '-')}">
                        ${caseData.status}
                    </span>
                </div>
            </div>
            <div class="case-detail">
                <div class="case-detail-label">วันที่สร้าง</div>
                <div class="case-detail-value">${formatDateTime(caseData.created_at)}</div>
            </div>
            <div class="case-detail">
                <div class="case-detail-label">ครบกำหนด</div>
                <div class="case-detail-value">${caseData.due_date ? formatDateTime(caseData.due_date) : '-'}</div>
            </div>
            ${caseData.resolved_at ? `
            <div class="case-detail">
                <div class="case-detail-label">วันที่แก้ไข</div>
                <div class="case-detail-value">${formatDateTime(caseData.resolved_at)}</div>
            </div>
            ` : ''}
            ${caseData.solution_details ? `
            <div class="case-detail">
                <div class="case-detail-label">วิธีแก้ปัญหา</div>
                <div class="case-detail-value">${escapeHtml(caseData.solution_details)}</div>
            </div>
            ` : ''}
        `;
        
        currentEditingCaseId = caseId;
        viewCaseModal.style.display = 'block';
    } catch (error) {
        console.error('Error viewing case:', error);
        showError('ไม่สามารถดูรายละเอียดเคสได้: ' + error.message);
    }
}

// Close view case modal
function closeViewCaseModal() {
    viewCaseModal.style.display = 'none';
    currentEditingCaseId = null;
}

// Edit from view modal
function editFromView() {
    closeViewCaseModal();
    editCase(currentEditingCaseId);
}

// Edit case
async function editCase(caseId) {
    try {
        const response = await fetch(`/api/cases/${caseId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            throw new Error('ไม่สามารถโหลดข้อมูลเคสได้');
        }
        const caseData = await response.json();
        
        // Populate edit form
        document.getElementById('editCaseId').value = caseData.id;
        document.getElementById('editCaseTitle').value = caseData.case_title;
        document.getElementById('editProblemDescription').value = caseData.problem_description;
        document.getElementById('editReportedBy').value = caseData.reported_by;
        document.getElementById('editSeverity').value = caseData.severity || '';
        document.getElementById('editStatus').value = caseData.status;
        document.getElementById('editSolutionDetails').value = caseData.solution_details || '';
        
        currentEditingCaseId = caseId;
        editCaseModal.style.display = 'block';
    } catch (error) {
        console.error('Error loading case for edit:', error);
        showError('ไม่สามารถโหลดข้อมูลเคสได้: ' + error.message);
    }
}

// Close edit case modal
function closeEditCaseModal() {
    editCaseModal.style.display = 'none';
    currentEditingCaseId = null;
}

// Handle edit case form submission
async function handleEditCaseSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(editCaseForm);
    const caseId = formData.get('editCaseId');
    const updateData = {
        status: formData.get('status'),
        solution_details: formData.get('solutionDetails')
    };
    
    try {
        const response = await fetch(`/api/cases/${caseId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            const error = await response.json();
            throw new Error(error.error || 'ไม่สามารถอัปเดตเคสได้');
        }
        
        closeEditCaseModal();
        loadCases();
        showSuccess('อัปเดตเคสสำเร็จ');
    } catch (error) {
        console.error('Error updating case:', error);
        showError('ไม่สามารถอัปเดตเคสได้: ' + error.message);
    }
}

// Show success message
function showSuccess(message) {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
    `;
    successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(successDiv);
        }, 300);
    }, 3000);
}

// Admin Panel Functions
function setupAdminPanel() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    // New user form
    document.getElementById('newUserForm').addEventListener('submit', handleNewUserSubmit);
}

function switchTab(tabName) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Load data for the selected tab
    if (tabName === 'users') {
        loadUsers();
    }
}

function openAdminPanel() {
    const adminModal = document.getElementById('adminModal');
    adminModal.style.display = 'block';
    loadUsers();
}

function closeAdminPanel() {
    const adminModal = document.getElementById('adminModal');
    adminModal.style.display = 'none';
}

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            if (response.status === 403) {
                showError('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
                return;
            }
            throw new Error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
        }
        
        const users = await response.json();
        renderUsersTable(users);
    } catch (error) {
        console.error('Error loading users:', error);
        showError('ไม่สามารถโหลดข้อมูลผู้ใช้ได้: ' + error.message);
    }
}

function renderUsersTable(users) {
    const usersTableBody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px; color: #666;">
                    ไม่มีข้อมูลผู้ใช้
                </td>
            </tr>
        `;
        return;
    }
    
    usersTableBody.innerHTML = users.map(user => `
        <tr>
            <td><strong>${escapeHtml(user.username)}</strong></td>
            <td>${escapeHtml(user.full_name)}</td>
            <td>
                <span class="role-badge ${user.role}">
                    ${user.role === 'admin' ? 'Admin' : 'User'}
                </span>
            </td>
            <td>${formatDateTime(user.created_at)}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})" 
                        ${user.id === currentUser.id ? 'disabled title="ไม่สามารถลบบัญชีตัวเองได้"' : ''}>
                    <i class="fas fa-trash"></i> ลบ
                </button>
            </td>
        </tr>
    `).join('');
}

async function handleNewUserSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const userData = {
        username: formData.get('username'),
        password: formData.get('password'),
        full_name: formData.get('full_name'),
        role: formData.get('role')
    };
    
    try {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            if (response.status === 403) {
                showError('คุณไม่มีสิทธิ์สร้างผู้ใช้ใหม่');
                return;
            }
            const error = await response.json();
            throw new Error(error.error || 'ไม่สามารถสร้างผู้ใช้ได้');
        }
        
        event.target.reset();
        loadUsers();
        showSuccess('สร้างผู้ใช้ใหม่สำเร็จ');
    } catch (error) {
        console.error('Error creating user:', error);
        showError('ไม่สามารถสร้างผู้ใช้ได้: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบผู้ใช้นี้?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            if (response.status === 403) {
                showError('คุณไม่มีสิทธิ์ลบผู้ใช้');
                return;
            }
            const error = await response.json();
            throw new Error(error.error || 'ไม่สามารถลบผู้ใช้ได้');
        }
        
        loadUsers();
        showSuccess('ลบผู้ใช้สำเร็จ');
    } catch (error) {
        console.error('Error deleting user:', error);
        showError('ไม่สามารถลบผู้ใช้ได้: ' + error.message);
    }
}

// Assign Severity Functions
async function assignSeverity(caseId) {
    try {
        const response = await fetch(`/api/cases/${caseId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            throw new Error('ไม่สามารถโหลดข้อมูลเคสได้');
        }
        
        const caseData = await response.json();
        
        // Populate assign severity form
        document.getElementById('assignSeverityCaseId').value = caseData.id;
        document.getElementById('assignSeverityTitle').value = caseData.case_title;
        document.getElementById('assignSeverityDescription').value = caseData.problem_description;
        document.getElementById('assignSeverity').value = caseData.severity || '';
        
        // Show modal
        document.getElementById('assignSeverityModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading case for severity assignment:', error);
        showError('ไม่สามารถโหลดข้อมูลเคสได้: ' + error.message);
    }
}

function closeAssignSeverityModal() {
    document.getElementById('assignSeverityModal').style.display = 'none';
}

async function handleAssignSeveritySubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const caseId = document.getElementById('assignSeverityCaseId').value;
    const severity = formData.get('severity');
    
    try {
        const response = await fetch(`/api/admin/cases/${caseId}/severity`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ severity })
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            if (response.status === 403) {
                showError('คุณไม่มีสิทธิ์กำหนดระดับความรุนแรง');
                return;
            }
            const error = await response.json();
            throw new Error(error.error || 'ไม่สามารถกำหนดระดับความรุนแรงได้');
        }
        
        closeAssignSeverityModal();
        loadCases();
        showSuccess('กำหนดระดับความรุนแรงสำเร็จ');
    } catch (error) {
        console.error('Error assigning severity:', error);
        showError('ไม่สามารถกำหนดระดับความรุนแรงได้: ' + error.message);
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
