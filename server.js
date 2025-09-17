const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'it-troubleshooting-secret-key-2025';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// สร้างฐานข้อมูล SQLite
const db = new sqlite3.Database('./troubleshooting.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// สร้างตาราง troubleshooting_logs และ users
function initializeDatabase() {
    // สร้างตาราง users
    const createUsersTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;
    
    db.run(createUsersTableQuery, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            console.log('Table users created successfully');
            createDefaultUsers();
        }
    });
    
    // สร้างตาราง troubleshooting_logs
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS troubleshooting_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_title TEXT NOT NULL,
            problem_description TEXT NOT NULL,
            solution_details TEXT,
            reported_by TEXT NOT NULL,
            reported_by_user_id INTEGER,
            status TEXT NOT NULL DEFAULT 'Open',
            severity TEXT,
            assigned_by_user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            due_date DATETIME,
            resolved_at DATETIME,
            FOREIGN KEY (reported_by_user_id) REFERENCES users (id),
            FOREIGN KEY (assigned_by_user_id) REFERENCES users (id)
        )
    `;
    
    db.run(createTableQuery, (err) => {
        if (err) {
            console.error('Error creating troubleshooting_logs table:', err.message);
        } else {
            console.log('Table troubleshooting_logs created successfully');
            // ตรวจสอบและเพิ่มคอลัมน์ที่อาจขาดหายไป
            checkAndAddMissingColumns();
        }
    });
}

// ตรวจสอบและเพิ่มคอลัมน์ที่อาจขาดหายไป
function checkAndAddMissingColumns() {
    const columnsToCheck = [
        { name: 'reported_by_user_id', type: 'INTEGER' },
        { name: 'assigned_by_user_id', type: 'INTEGER' },
        { name: 'severity', type: 'TEXT' },
        { name: 'due_date', type: 'DATETIME' }
    ];
    
    columnsToCheck.forEach(column => {
        const checkColumnQuery = `PRAGMA table_info(troubleshooting_logs)`;
        db.all(checkColumnQuery, [], (err, rows) => {
            if (err) {
                console.error('Error checking table info:', err.message);
                return;
            }
            
            const columnExists = rows.some(row => row.name === column.name);
            if (!columnExists) {
                const addColumnQuery = `ALTER TABLE troubleshooting_logs ADD COLUMN ${column.name} ${column.type}`;
                db.run(addColumnQuery, (err) => {
                    if (err) {
                        console.error(`Error adding column ${column.name}:`, err.message);
                    } else {
                        console.log(`Column ${column.name} added successfully`);
                    }
                });
            }
        });
    });
}

// สร้างผู้ใช้เริ่มต้น
async function createDefaultUsers() {
    const defaultUsers = [
        {
            username: 'admin',
            password: 'admin123',
            full_name: 'ผู้ดูแลระบบ',
            role: 'admin'
        },
        {
            username: 'user1',
            password: 'user123',
            full_name: 'สมชาย ใจดี',
            role: 'user'
        },
        {
            username: 'user2',
            password: 'user123',
            full_name: 'สมหญิง รักงาน',
            role: 'user'
        }
    ];
    
    for (const user of defaultUsers) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        
        const checkUserQuery = 'SELECT id FROM users WHERE username = ?';
        db.get(checkUserQuery, [user.username], (err, row) => {
            if (err) {
                console.error('Error checking user:', err.message);
                return;
            }
            
            if (!row) {
                const insertUserQuery = `
                    INSERT INTO users (username, password, full_name, role)
                    VALUES (?, ?, ?, ?)
                `;
                
                db.run(insertUserQuery, [user.username, hashedPassword, user.full_name, user.role], (err) => {
                    if (err) {
                        console.error('Error creating default user:', err.message);
                    } else {
                        console.log(`Default user created: ${user.username} (${user.role})`);
                    }
                });
            }
        });
    }
}

// ฟังก์ชันคำนวณ due_date ตาม severity
function calculateDueDate(severity) {
    const now = new Date();
    const dueDate = new Date(now);
    
    switch (severity) {
        case 'Critical':
            dueDate.setDate(now.getDate() + 1);
            break;
        case 'Major':
            dueDate.setDate(now.getDate() + 3);
            break;
        case 'Minor':
            dueDate.setDate(now.getDate() + 7);
            break;
        default:
            dueDate.setDate(now.getDate() + 7);
    }
    
    return dueDate.toISOString();
}

// ฟังก์ชันคำนวณ SLA Status
function calculateSLAStatus(status, dueDate, resolvedAt) {
    const now = new Date();
    const due = new Date(dueDate);
    
    if (status === 'Resolved') {
        if (resolvedAt) {
            const resolved = new Date(resolvedAt);
            return resolved <= due ? 'Met SLA' : 'Breached SLA';
        }
        return 'Met SLA';
    } else {
        return now > due ? 'OVERDUE' : 'In Progress';
    }
}

// Middleware สำหรับตรวจสอบ JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'ไม่พบ token' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token ไม่ถูกต้อง' });
        }
        req.user = user;
        next();
    });
}

// Middleware สำหรับตรวจสอบสิทธิ์ Admin
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'ต้องมีสิทธิ์ Admin' });
    }
    next();
}

// API Routes

// หน้าหลัก
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// หน้า Login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// API สำหรับ Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }
    
    const query = 'SELECT * FROM users WHERE username = ?';
    db.get(query, [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
        }
        
        if (!user) {
            return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
        
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                full_name: user.full_name,
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            }
        });
    });
});

// API สำหรับตรวจสอบสถานะการล็อกอิน
app.get('/api/me', authenticateToken, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            full_name: req.user.full_name,
            role: req.user.role
        }
    });
});

// API สำหรับ Logout (client-side)
app.post('/api/logout', (req, res) => {
    res.json({ message: 'ออกจากระบบสำเร็จ' });
});

// ดึงข้อมูลเคสทั้งหมด (ต้องล็อกอิน)
app.get('/api/cases', authenticateToken, (req, res) => {
    const query = `
        SELECT *,
        CASE 
            WHEN severity IS NULL THEN 'Pending Assignment'
            WHEN status = 'Resolved' AND resolved_at IS NOT NULL AND resolved_at <= due_date THEN 'Met SLA'
            WHEN status = 'Resolved' AND resolved_at IS NOT NULL AND resolved_at > due_date THEN 'Breached SLA'
            WHEN status != 'Resolved' AND datetime('now') > due_date THEN 'OVERDUE'
            ELSE 'In Progress'
        END as sla_status
        FROM troubleshooting_logs 
        ORDER BY created_at DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// สร้างเคสใหม่ (ต้องล็อกอิน)
app.post('/api/cases', authenticateToken, (req, res) => {
    const { case_title, problem_description, reported_by } = req.body;
    
    if (!case_title || !problem_description) {
        return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }
    
    // ใช้ชื่อจาก User ที่ล็อกอินเป็นผู้แจ้ง
    const reportedByName = reported_by || req.user.full_name;
    
    const query = `
        INSERT INTO troubleshooting_logs 
        (case_title, problem_description, reported_by, reported_by_user_id)
        VALUES (?, ?, ?, ?)
    `;
    
    db.run(query, [case_title, problem_description, reportedByName, req.user.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: 'สร้างเคสสำเร็จ' });
    });
});

// อัปเดตเคส (ต้องล็อกอิน)
app.put('/api/cases/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { status, solution_details } = req.body;
    
    let query, params;
    
    if (status === 'Resolved') {
        query = `
            UPDATE troubleshooting_logs 
            SET status = ?, solution_details = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        params = [status, solution_details, id];
    } else {
        query = `
            UPDATE troubleshooting_logs 
            SET status = ?, solution_details = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        params = [status, solution_details, id];
    }
    
    db.run(query, params, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'ไม่พบเคสที่ต้องการแก้ไข' });
            return;
        }
        res.json({ message: 'อัปเดตเคสสำเร็จ' });
    });
});

// ดึงข้อมูลเคสเดียว (ต้องล็อกอิน)
app.get('/api/cases/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    const query = 'SELECT * FROM troubleshooting_logs WHERE id = ?';
    
    db.get(query, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'ไม่พบเคสที่ต้องการ' });
            return;
        }
        res.json(row);
    });
});

// API สำหรับ Admin - จัดการผู้ใช้
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    const query = 'SELECT id, username, full_name, role, created_at FROM users ORDER BY created_at DESC';
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// API สำหรับ Admin - สร้างผู้ใช้ใหม่
app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    const { username, password, full_name, role } = req.body;
    
    if (!username || !password || !full_name || !role) {
        return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }
    
    if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Role ต้องเป็น admin หรือ user' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const query = `
            INSERT INTO users (username, password, full_name, role)
            VALUES (?, ?, ?, ?)
        `;
        
        db.run(query, [username, hashedPassword, full_name, role], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    res.status(400).json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
                } else {
                    res.status(500).json({ error: err.message });
                }
                return;
            }
            res.json({ id: this.lastID, message: 'สร้างผู้ใช้สำเร็จ' });
        });
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้ารหัสรหัสผ่าน' });
    }
});

// API สำหรับ Admin - ลบผู้ใช้
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    // ไม่ให้ลบบัญชีตัวเอง
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'ไม่สามารถลบบัญชีตัวเองได้' });
    }
    
    const query = 'DELETE FROM users WHERE id = ?';
    
    db.run(query, [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'ไม่พบผู้ใช้ที่ต้องการลบ' });
            return;
        }
        res.json({ message: 'ลบผู้ใช้สำเร็จ' });
    });
});

// API สำหรับ Admin - กำหนดระดับความรุนแรง
app.put('/api/admin/cases/:id/severity', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { severity } = req.body;
    
    if (!severity || !['Critical', 'Major', 'Minor'].includes(severity)) {
        return res.status(400).json({ error: 'ระดับความรุนแรงต้องเป็น Critical, Major หรือ Minor' });
    }
    
    const dueDate = calculateDueDate(severity);
    
    const query = `
        UPDATE troubleshooting_logs 
        SET severity = ?, due_date = ?, assigned_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    
    db.run(query, [severity, dueDate, req.user.id, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'ไม่พบเคสที่ต้องการอัปเดต' });
            return;
        }
        res.json({ message: 'กำหนดระดับความรุนแรงสำเร็จ' });
    });
});

// เริ่มต้นเซิร์ฟเวอร์
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// ปิดการเชื่อมต่อฐานข้อมูลเมื่อปิดเซิร์ฟเวอร์
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});
