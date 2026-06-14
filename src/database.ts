import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Load environment variables
const DB_HOST = process.env.DB_HOST || '';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || '';
const DB_PASSWORD = (process.env.DB_PASSWORD === 'none' || !process.env.DB_PASSWORD) ? '' : process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME || '';

export let isUsingRealMySQL = false;
let pool: mysql.Pool | null = null;

// Dual-mode in-memory/JSON store fallback for sandbox environments
const mockDb = {
  users: [
    {
      id: "u-admin",
      username: "admin",
      password_hash: bcrypt.hashSync("admin123", 10),
      role: "admin" as const,
      display_name_ar: "المدير العام",
      display_name_en: "General Manager",
      is_active: true,
      created_at: new Date()
    },
    {
      id: "u-eng1",
      username: "engineer",
      password_hash: bcrypt.hashSync("engineer123", 10),
      role: "engineer" as const,
      display_name_ar: "المهندس رامي",
      display_name_en: "Engineer Rami",
      is_active: true,
      created_at: new Date()
    },
    {
      id: "u-client1",
      username: "client1",
      password_hash: bcrypt.hashSync("client123", 10),
      role: "client" as const,
      display_name_ar: "أحمد بن علي",
      display_name_en: "Ahmed Bin Ali",
      is_active: true,
      created_at: new Date()
    }
  ],
  clients: [
    {
      id: "c-1",
      user_id: "u-client1",
      company_ar: "شركة أصول البناء للمقاولات",
      company_en: "Osool Building Contracting",
      email: "contact@osoolbuild.com",
      phone: "0501234567",
      created_at: new Date()
    }
  ],
  tickets: [
    {
      id: "TKT-3129",
      ticket_number: "TKT-3129",
      title: "تهيئة سيرفر سحابي مخصص لقاعدة البيانات والنسخ الاحتياطي",
      description: "طلب تهيئة سيرفر سحابي جديد على سحابة TLINK بمواصفات معالجة عالية لنقل نظام إدارة المستودعات والربط بقاعدة البيانات مع إعداد النسخ الاحتياطي التلقائي اليومي.",
      priority: "high" as const,
      status: "new" as const,
      client_user_id: "u-client1",
      assigned_engineer_id: null as string | null,
      rejection_reason: null as string | null,
      internal_notes: null as string | null,
      reporter_phone: "0501234567",
      rating_value: null as number | null,
      rating_feedback: null as string | null,
      created_at: new Date(),
      assigned_at: null as Date | null,
      closed_at: null as Date | null
    }
  ],
  comments: [] as any[],
  attachments: [] as any[],
  notifications: [
    {
      id: "not-1",
      target_user_id: "u-admin",
      message_ar: "بلاغ دعم فني جديد من شركة أصول البناء للمقاولات",
      message_en: "New technical support ticket from Osool Building Contracting",
      is_read: false,
      created_at: new Date()
    }
  ],
  auditLogs: [
    {
      id: "log-1",
      user_id: "u-admin",
      user_name: "General Manager",
      action_ar: "تم تهيئة النظام وبدء العمليات بنجاح",
      action_en: "System successfully initialized and booted up",
      created_at: new Date()
    }
  ]
};

// Check if credentials exist and attempt Connection pool creation
if (DB_HOST && DB_USER && DB_NAME) {
  try {
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    console.log("MySQL connection pool created successfully on host:", DB_HOST);
  } catch (err) {
    console.warn("Failed to construct MySQL pool. Operating in development fallback mode:", err);
  }
} else {
  console.warn("MySQL configuration parameters not complete. Operating in local sandbox simulation mode.");
}

export async function getDbConnection() {
  if (!pool) {
    throw new Error("MySQL Pool is not initialized");
  }
  return pool.getConnection();
}

// Global query helper
export async function executeQuery(sql: string, params: any[] = []): Promise<any> {
  if (isUsingRealMySQL && pool) {
    try {
      const [results] = await pool.execute(sql, params);
      return results;
    } catch (err) {
      console.error("Database query failed:", err);
      throw err;
    }
  } else {
    // If we're fallback-simulating, log query
    console.log(`[SQL Simulating] ${sql} with params:`, params);
    return simulateSql(sql, params);
  }
}

// Function to initialize MySQL tables and insert seeded values
export async function initializeDatabase() {
  if (!pool) {
    console.log("No MySQL connection configured. Safe fallback state loaded.");
    return;
  }

  try {
    // Test connection
    const conn = await pool.getConnection();
    conn.release();
    isUsingRealMySQL = true;
    console.log("Successfully connected to MySQL database. Initializing tables...");

    // Create Tables sequentially if not exists
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`Users\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`username\` VARCHAR(191) NOT NULL UNIQUE,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`role\` ENUM('admin', 'engineer', 'client') NOT NULL,
        \`display_name_ar\` VARCHAR(255) NOT NULL,
        \`display_name_en\` VARCHAR(255) NOT NULL,
        \`is_active\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_users_username\` (\`username\`),
        INDEX \`idx_users_role\` (\`role\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`Clients\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`user_id\` VARCHAR(36) NOT NULL UNIQUE,
        \`company_ar\` VARCHAR(255) NOT NULL,
        \`company_en\` VARCHAR(255) NOT NULL,
        \`email\` VARCHAR(191) NOT NULL,
        \`phone\` VARCHAR(50) NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_clients_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`Users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`Tickets\` (
        \`id\` VARCHAR(50) NOT NULL,
        \`ticket_number\` VARCHAR(50) NULL UNIQUE,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NOT NULL,
        \`priority\` ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
        \`status\` ENUM('new', 'accepted', 'in_progress', 'pending_client', 'closed') NOT NULL DEFAULT 'new',
        \`client_user_id\` VARCHAR(36) NOT NULL,
        \`assigned_engineer_id\` VARCHAR(36) NULL,
        \`rejection_reason\` TEXT NULL,
        \`internal_notes\` TEXT NULL,
        \`reporter_phone\` VARCHAR(50) NOT NULL,
        \`rating_value\` INT NULL,
        \`rating_feedback\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`assigned_at\` TIMESTAMP NULL DEFAULT NULL,
        \`closed_at\` TIMESTAMP NULL DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_tickets_client\` FOREIGN KEY (\`client_user_id\`) REFERENCES \`Users\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_tickets_engineer\` FOREIGN KEY (\`assigned_engineer_id\`) REFERENCES \`Users\` (\`id\`) ON DELETE SET NULL,
        INDEX \`idx_tickets_status\` (\`status\`),
        INDEX \`idx_tickets_priority\` (\`priority\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`TicketComments\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`ticket_id\` VARCHAR(50) NOT NULL,
        \`user_id\` VARCHAR(36) NOT NULL,
        \`comment_text\` TEXT NOT NULL,
        \`is_internal\` BOOLEAN DEFAULT FALSE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_comments_ticket\` FOREIGN KEY (\`ticket_id\`) REFERENCES \`Tickets\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_comments_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`Users\` (\`id\`) ON DELETE CASCADE,
        INDEX \`idx_comments_ticket\` (\`ticket_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`TicketAttachments\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`ticket_id\` VARCHAR(50) NOT NULL,
        \`file_name\` VARCHAR(255) NOT NULL,
        \`file_path\` LONGTEXT NOT NULL,
        \`uploaded_by\` VARCHAR(255) NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_attachments_ticket\` FOREIGN KEY (\`ticket_id\`) REFERENCES \`Tickets\` (\`id\`) ON DELETE CASCADE,
        INDEX \`idx_attachments_ticket\` (\`ticket_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`Notifications\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`target_user_id\` VARCHAR(36) NOT NULL,
        \`message_ar\` VARCHAR(255) NOT NULL,
        \`message_en\` VARCHAR(255) NOT NULL,
        \`is_read\` BOOLEAN DEFAULT FALSE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_notifications_user\` FOREIGN KEY (\`target_user_id\`) REFERENCES \`Users\` (\`id\`) ON DELETE CASCADE,
        INDEX \`idx_notifications_user\` (\`target_user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`AuditLogs\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`user_id\` VARCHAR(36) NOT NULL,
        \`user_name\` VARCHAR(255) NOT NULL,
        \`action_ar\` VARCHAR(255) NOT NULL,
        \`action_en\` VARCHAR(255) NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_audit_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`Users\` (\`id\`) ON DELETE CASCADE,
        INDEX \`idx_audit_created\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check if users exist. If not, seed initial profiles
    const usersCountResult = await executeQuery("SELECT COUNT(*) as count FROM Users");
    const count = usersCountResult[0]?.count || 0;

    if (count === 0) {
      console.log("Users table is empty. Seeding default roles...");

      // Seeds
      const adminPassHash = bcrypt.hashSync("admin123", 10);
      const engPassHash = bcrypt.hashSync("engineer123", 10);
      const clientPassHash = bcrypt.hashSync("client123", 10);

      // Insert Admin user
      await executeQuery(
        "INSERT INTO Users (id, username, password_hash, role, display_name_ar, display_name_en, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["u-admin", "admin", adminPassHash, "admin", "المدير العام", "General Manager", true]
      );

      // Insert Engineer user
      await executeQuery(
        "INSERT INTO Users (id, username, password_hash, role, display_name_ar, display_name_en, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["u-eng1", "engineer", engPassHash, "engineer", "المهندس رامي", "Engineer Rami", true]
      );

      // Insert Client user
      await executeQuery(
        "INSERT INTO Users (id, username, password_hash, role, display_name_ar, display_name_en, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["u-client1", "client1", clientPassHash, "client", "أحمد بن علي", "Ahmed Bin Ali", true]
      );

      // Create Client Profile associated
      await executeQuery(
        "INSERT INTO Clients (id, user_id, company_ar, company_en, email, phone) VALUES (?, ?, ?, ?, ?, ?)",
        ["c-1", "u-client1", "شركة أصول البناء للمقاولات", "Osool Building Contracting", "contact@osoolbuild.com", "0501234567"]
      );

      // Initial ticket seed
      await executeQuery(
        "INSERT INTO Tickets (id, ticket_number, title, description, priority, status, client_user_id, reporter_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["TKT-3129", "TKT-3129", "تهيئة سيرفر سحابي مخصص لقاعدة البيانات والنسخ الاحتياطي", "طلب تهيئة سيرفر سحابي جديد على سحابة TLINK بمواصفات معالجة عالية لنقل نظام إدارة المستودعات والربط بقاعدة البيانات مع إعداد النسخ الاحتياطي التلقائي اليومي.", "high", "new", "u-client1", "0501234567"]
      );

      // Initial notification seed
      await executeQuery(
        "INSERT INTO Notifications (id, target_user_id, message_ar, message_en, is_read) VALUES (?, ?, ?, ?, ?)",
        ["not-1", "u-admin", "بلاغ دعم فني جديد من شركة أصول البناء للمقاولات", "New technical support ticket from Osool Building Contracting", false]
      );

      // Initial audit seed
      await executeQuery(
        "INSERT INTO AuditLogs (id, user_id, user_name, action_ar, action_en) VALUES (?, ?, ?, ?, ?)",
        ["log-1", "u-admin", "General Manager", "تم تهيئة النظام وبدء العمليات بنجاح", "System successfully initialized and booted up"]
      );

      console.log("Seeding complete!");
    } else {
      console.log("Database already seeded with", count, "users.");
    }
  } catch (err) {
    console.error("Database connection was refused. Active fallback simulation on.");
    isUsingRealMySQL = false;
  }
}

// In-Memory fallback implementation to bypass MySQL connection issues in dev sandbox
function simulateSql(sql: string, params: any[]): any {
  const sqlLower = sql.trim().toLowerCase();

  // Simple Router to parse simulation
  if (sqlLower.startsWith("select count(*)")) {
    return [{ count: mockDb.users.length }];
  }
  if (sqlLower.startsWith("select") && sqlLower.includes("from users")) {
    if (sqlLower.includes("where username =")) {
      const u = params[0];
      const match = mockDb.users.find(x => x.username.toLowerCase() === u.toLowerCase());
      return match ? [match] : [];
    }
    if (sqlLower.includes("where id =")) {
      const id = params[0];
      const match = mockDb.users.find(x => x.id === id);
      return match ? [match] : [];
    }
    if (sqlLower.includes("role = 'engineer'")) {
      return mockDb.users.filter(x => x.role === "engineer");
    }
    return mockDb.users;
  }

  if (sqlLower.startsWith("select") && sqlLower.includes("from clients")) {
    if (sqlLower.includes("where username =")) {
      const u = params[0];
      const match = mockDb.clients.find(x => x.company_en.toLowerCase() === u.toLowerCase()); // or similar
      return match ? [match] : [];
    }
    if (sqlLower.includes("where user_id =")) {
      const uid = params[0];
      const match = mockDb.clients.find(x => x.user_id === uid);
      return match ? [match] : [];
    }
    return mockDb.clients;
  }

  if (sqlLower.startsWith("select") && sqlLower.includes("from tickets")) {
    if (sqlLower.includes("where client_user_id =")) {
      const uid = params[0];
      return mockDb.tickets.filter(x => x.client_user_id === uid);
    }
    if (sqlLower.includes("where id =")) {
      const id = params[0];
      const match = mockDb.tickets.find(x => x.id === id);
      return match ? [match] : [];
    }
    return mockDb.tickets;
  }

  if (sqlLower.startsWith("select") && sqlLower.includes("from auditlogs")) {
    return mockDb.auditLogs;
  }

  if (sqlLower.startsWith("select") && sqlLower.includes("from notifications")) {
    if (sqlLower.includes("where target_user_id =")) {
      const target = params[0];
      return mockDb.notifications.filter(x => x.target_user_id === target);
    }
    return mockDb.notifications;
  }

  if (sqlLower.startsWith("insert into users")) {
    const [id, username, password_hash, role, display_name_ar, display_name_en, is_active] = params;
    const newUser = { id, username, password_hash, role, display_name_ar, display_name_en, is_active: is_active ?? true, created_at: new Date() };
    mockDb.users.push(newUser);
    return { insertId: id };
  }

  if (sqlLower.startsWith("insert into clients")) {
    const [id, user_id, company_ar, company_en, email, phone] = params;
    const newClient = { id, user_id, company_ar, company_en, email, phone, created_at: new Date() };
    mockDb.clients.push(newClient);
    return { insertId: id };
  }

  if (sqlLower.startsWith("insert into tickets")) {
    const [id, ticket_number, title, description, priority, status, client_user_id, reporter_phone] = params;
    const newTicket = {
      id,
      ticket_number,
      title,
      description,
      priority: priority || 'medium',
      status: status || 'new',
      client_user_id,
      assigned_engineer_id: null,
      rejection_reason: null,
      internal_notes: null,
      reporter_phone,
      rating_value: null,
      rating_feedback: null,
      created_at: new Date(),
      assigned_at: null,
      closed_at: null
    };
    mockDb.tickets.unshift(newTicket);
    return { insertId: id };
  }

  if (sqlLower.startsWith("insert into ticketcomments")) {
    const [id, ticket_id, user_id, comment_text, is_internal] = params;
    const newComment = { id, ticket_id, user_id, comment_text, is_internal : is_internal ?? false, created_at: new Date() };
    mockDb.comments.push(newComment);
    return { insertId: id };
  }

  if (sqlLower.startsWith("insert into ticketattachments")) {
    const [id, ticket_id, file_name, file_path, uploaded_by] = params;
    const newAttachment = { id, ticket_id, file_name, file_path, uploaded_by, created_at: new Date() };
    mockDb.attachments.push(newAttachment);
    return { insertId: id };
  }

  if (sqlLower.startsWith("insert into notifications")) {
    const [id, target_user_id, message_ar, message_en, is_read] = params;
    const newNot = { id, target_user_id, message_ar, message_en, is_read: is_read ?? false, created_at: new Date() };
    mockDb.notifications.unshift(newNot);
    return { insertId: id };
  }

  if (sqlLower.startsWith("insert into auditlogs")) {
    const [id, user_id, user_name, action_ar, action_en] = params;
    const newLog = { id, user_id, user_name, action_ar, action_en, created_at: new Date() };
    mockDb.auditLogs.unshift(newLog);
    return { insertId: id };
  }

  if (sqlLower.startsWith("update users")) {
    const id = params[params.length - 1]; // standard pattern
    const user = mockDb.users.find(u => u.id === id);
    if (user) {
      if (sqlLower.includes("display_name_ar = ?")) user.display_name_ar = params[0];
      if (sqlLower.includes("display_name_en = ?")) user.display_name_en = params[1];
      if (sqlLower.includes("password_hash = ?")) user.password_hash = params[2];
      if (sqlLower.includes("is_active = ?")) user.is_active = params[0];
    }
    return { affectedRows: 1 };
  }

  if (sqlLower.startsWith("update clients")) {
    // Basic selector
    const company_ar = params[0];
    const company_en = params[1];
    const email = params[2];
    const phone = params[3];
    const user_id = params[params.length - 1];
    const client = mockDb.clients.find(c => c.user_id === user_id);
    if (client) {
      client.company_ar = company_ar;
      client.company_en = company_en;
      client.email = email;
      client.phone = phone;
    }
    return { affectedRows: 1 };
  }

  if (sqlLower.startsWith("update tickets")) {
    const ticketId = params[params.length - 1];
    const t = mockDb.tickets.find(x => x.id === ticketId);
    if (t) {
      if (sqlLower.includes("status = ?")) {
        const status = params[0];
        (t as any).status = status;
        if (status === 'closed') {
          (t as any).closed_at = new Date();
        }
      }
      if (sqlLower.includes("assigned_engineer_id = ?")) {
        (t as any).assigned_engineer_id = params[0];
        (t as any).assigned_at = new Date();
      }
      if (sqlLower.includes("rating_value = ?")) {
        (t as any).rating_value = params[0];
        (t as any).rating_feedback = params[1];
      }
      if (sqlLower.includes("rejection_reason = ?")) {
        (t as any).rejection_reason = params[0];
      }
      if (sqlLower.includes("internal_notes = ?")) {
        (t as any).internal_notes = params[0];
      }
    }
    return { affectedRows: 1 };
  }

  if (sqlLower.startsWith("update notifications")) {
    if (sqlLower.includes("is_read = ?")) {
      const target = params[params.length - 1];
      mockDb.notifications.forEach(n => {
        if (n.target_user_id === target) {
          n.is_read = true;
        }
      });
    }
    return { affectedRows: 1 };
  }

  return [];
}
