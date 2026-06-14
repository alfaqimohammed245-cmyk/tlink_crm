import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeDatabase, executeQuery, isUsingRealMySQL } from "./src/database.ts";
import { hashPassword, comparePassword, generateToken } from "./src/auth.ts";
import { authenticateUser, AuthenticatedRequest } from "./src/middleware/authMiddleware.ts";

// Helper function to extract a neat formatted ticket list with comments and attachments
async function getTicketsWithCommentsAndAttachments(userId: string | undefined, isStaff: boolean) {
  let query = `
    SELECT 
      t.*,
      cu.display_name_ar AS client_display_name_ar,
      cu.display_name_en AS client_display_name_en,
      c.company_ar AS client_company_ar,
      c.company_en AS client_company_en,
      eu.display_name_ar AS engineer_display_name_ar,
      eu.display_name_en AS engineer_display_name_en
    FROM Tickets t
    JOIN Users cu ON t.client_user_id = cu.id
    LEFT JOIN Clients c ON t.client_user_id = c.user_id
    LEFT JOIN Users eu ON t.assigned_engineer_id = eu.id
  `;
  let params: any[] = [];
  if (!isStaff && userId) {
    query += " WHERE t.client_user_id = ?";
    params.push(userId);
  }
  query += " ORDER BY t.created_at DESC";

  const rows = await executeQuery(query, params);
  const tickets: any[] = [];

  for (const row of rows) {
    // Load nested comments inside separate normalized table
    const commentsRows = await executeQuery(`
      SELECT c.*, u.display_name_en, u.display_name_ar, u.role
      FROM TicketComments c
      JOIN Users u ON c.user_id = u.id
      WHERE c.ticket_id = ?
      ORDER BY c.created_at ASC
    `, [row.id]);

    const comments = commentsRows.map((co: any) => ({
      id: co.id,
      userId: co.user_id,
      userName: co.display_name_en || co.display_name_ar,
      userRole: co.role,
      commentText: co.comment_text,
      createdAt: co.created_at,
      isInternal: co.is_internal === 1 || co.is_internal === true
    }));

    // Load nested attachments inside separate normalized table
    const attachmentRows = await executeQuery(`
      SELECT * FROM TicketAttachments WHERE ticket_id = ? ORDER BY created_at ASC
    `, [row.id]);

    const attachments = attachmentRows.map((att: any) => ({
      id: att.id,
      fileName: att.file_name,
      fileData: att.file_path, // Mapping file_path from DB to fileData for frontend state
      uploadedBy: att.uploaded_by,
      createdAt: att.created_at
    }));

    tickets.push({
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      createdAt: row.created_at,
      clientUserId: row.client_user_id,
      clientNameAr: row.client_company_ar || row.client_display_name_ar,
      clientNameEn: row.client_company_en || row.client_display_name_en,
      reporterPhone: row.reporter_phone,
      rejectionReason: row.rejection_reason || undefined,
      internalNotes: row.internal_notes || undefined,
      assignedEngineerId: row.assigned_engineer_id || undefined,
      assignedEngineerName: row.engineer_display_name_en || row.engineer_display_name_ar || undefined,
      assignedAt: row.assigned_at || undefined,
      closedByEngineerId: row.status === "closed" ? row.assigned_engineer_id || undefined : undefined,
      closedByEngineerName: row.status === "closed" ? (row.engineer_display_name_en || row.engineer_display_name_ar || undefined) : undefined,
      closedAt: row.closed_at || undefined,
      ratingValue: row.rating_value !== null ? row.rating_value : undefined,
      ratingFeedback: row.rating_feedback || undefined,
      comments,
      attachments
    });
  }

  return tickets;
}

// Function to log an audit activity in the SQL DB
async function writeAuditLog(userId: string, userName: string, actionAr: string, actionEn: string) {
  try {
    const logId = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await executeQuery(
      "INSERT INTO AuditLogs (id, user_id, user_name, action_ar, action_en) VALUES (?, ?, ?, ?, ?)",
      [logId, userId, userName, actionAr, actionEn]
    );
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

// Function to trigger notifications in the SQL DB
async function writeNotification(targetUserId: string, messageAr: string, messageEn: string) {
  try {
    const notId = `not-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await executeQuery(
      "INSERT INTO Notifications (id, target_user_id, message_ar, message_en, is_read) VALUES (?, ?, ?, ?, ?)",
      [notId, targetUserId, messageAr, messageEn, false]
    );
  } catch (err) {
    console.error("Failed to write notification:", err);
  }
}

async function startServer() {
  // Initialize SQL schema tables & default seed inputs
  await initializeDatabase();

  const app = express();
  const PORT = 3000;

  // Set limits higher for diagnostic screens/base64 attachments
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Auth: Log in
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    try {
      // Find user from database
      const userRows = await executeQuery("SELECT * FROM Users WHERE username = ?", [username]);
      if (!userRows || userRows.length === 0) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const dbUser = userRows[0];
      const match = await comparePassword(password, dbUser.password_hash);
      if (!match) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const isActive = dbUser.is_active === 1 || dbUser.is_active === true;
      if (!isActive) {
        if (dbUser.role === "engineer") {
          return res.status(403).json({ error: "(TLINK error) Your engineer account is temporarily suspended" });
        }
        return res.status(403).json({ error: "User profile inactive. Please consult administration." });
      }

      // Check if client and whether they are active in client profiles
      if (dbUser.role === "client") {
        const clientProfileRows = await executeQuery("SELECT * FROM Clients WHERE user_id = ?", [dbUser.id]);
        if (clientProfileRows && clientProfileRows.length > 0) {
          const clientProf = clientProfileRows[0];
          // Since client status is tied directly to user account, check if active
          if (!isActive) {
            return res.status(403).json({ error: "Account suspended. Please consult administration." });
          }
        }
      }

      // Generate actual secure JSON Web Token
      const token = generateToken({
        id: dbUser.id,
        username: dbUser.username,
        role: dbUser.role
      });

      // Maintain exact camelCase compatibility for React frontend
      const frontendUser = {
        id: dbUser.id,
        username: dbUser.username,
        role: dbUser.role,
        displayNameAr: dbUser.display_name_ar,
        displayNameEn: dbUser.display_name_en,
        isActive: isActive
      };

      return res.json({ token, user: frontendUser });
    } catch (err: any) {
      console.error("Login route error:", err);
      return res.status(500).json({ error: "Internal authentication error" });
    }
  });

  // Auth: Get current profile details
  app.get("/api/auth/me", authenticateUser, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // Tickets: Get ticket queue
  app.get("/api/tickets", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    try {
      const isStaff = user.role === "admin" || user.role === "engineer";
      const tickets = await getTicketsWithCommentsAndAttachments(user.id, isStaff);
      res.json({ tickets });
    } catch (err: any) {
      console.error("Get tickets error:", err);
      res.status(500).json({ error: "Failed to retrieve support queue" });
    }
  });

  // Tickets: Create new ticket
  app.post("/api/tickets/create", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    if (user.role !== "client") {
      return res.status(403).json({ error: "Only registered clients can initiate technical incidents" });
    }

    const { title, description, priority, attachment, reporterPhone } = req.body;
    if (!title || !description || !reporterPhone) {
      return res.status(400).json({ error: "Subject, Description, and Reporter Phone parameters are mandatory" });
    }

    try {
      // Find client details to register names
      const clientProfileRows = await executeQuery("SELECT * FROM Clients WHERE user_id = ?", [user.id]);
      const clientProfile = clientProfileRows[0];
      const clientNameAr = clientProfile ? clientProfile.company_ar : user.displayNameAr;
      const clientNameEn = clientProfile ? clientProfile.company_en : user.displayNameEn;

      const ticketId = `TKT-${Math.floor(Math.random() * 8999 + 1000)}`;

      // Insert new ticket
      await executeQuery(
        `INSERT INTO Tickets (id, ticket_number, title, description, priority, status, client_user_id, reporter_phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ticketId, ticketId, title, description, priority || "medium", "new", user.id, reporterPhone]
      );

      // Handle Attachment
      if (attachment && attachment.fileName && attachment.fileData) {
        const attId = `att-${Date.now()}-${Math.floor(Math.random() * 100)}`;
        await executeQuery(
          "INSERT INTO TicketAttachments (id, ticket_id, file_name, file_path, uploaded_by) VALUES (?, ?, ?, ?, ?)",
          [attId, ticketId, attachment.fileName, attachment.fileData, user.displayNameEn || user.displayNameAr]
        );
      }

      // Log actions & create alerts
      await writeAuditLog(user.id, user.displayNameEn, `إنشاء بلاغ دعم فني جديد بعنوان: ${title}`, `Initiated support incident: ${title}`);
      await writeNotification("u-admin", `بلاغ دعم فني جديد: "${title}" من ${clientNameAr}`, `New incident logged: "${title}" by ${clientNameEn}`);

      // Return fully loaded single ticket structure
      const userTickets = await getTicketsWithCommentsAndAttachments(user.id, false);
      const insertedTicket = userTickets.find((t) => t.id === ticketId);

      res.json({ ticket: insertedTicket });
    } catch (err: any) {
      console.error("Create ticket error:", err);
      res.status(500).json({ error: "Failed to log technical incident" });
    }
  });

  // Tickets: Upload attachment directly
  app.post("/api/tickets/upload-attachment", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { ticketId, fileName, fileData } = req.body;

    if (!ticketId || !fileName || !fileData) {
      return res.status(400).json({ error: "Missing required attachment transaction parameters" });
    }

    try {
      const ticketRows = await executeQuery("SELECT * FROM Tickets WHERE id = ?", [ticketId]);
      if (!ticketRows || ticketRows.length === 0) {
        return res.status(404).json({ error: "Target technical ticket not found in database" });
      }

      const ticket = ticketRows[0];

      // Access checks
      if (user.role !== "admin" && ticket.client_user_id !== user.id) {
        return res.status(403).json({ error: "Privileged action - access denied to target incident" });
      }

      const attId = `att-${Date.now()}-${Math.floor(Math.random() * 100)}`;
      const uploadedByName = user.role === "admin" ? user.displayNameEn : user.displayNameAr;

      await executeQuery(
        "INSERT INTO TicketAttachments (id, ticket_id, file_name, file_path, uploaded_by) VALUES (?, ?, ?, ?, ?)",
        [attId, ticketId, fileName, fileData, uploadedByName]
      );

      await writeAuditLog(user.id, user.displayNameEn, `تم رفع ملف مرفق (${fileName}) للبلاغ رقم ${ticketId}`, `Attached diagnostic asset (${fileName}) to ticket ${ticketId}`);

      res.json({
        success: true,
        attachment: {
          id: attId,
          fileName,
          fileData,
          uploadedBy: uploadedByName,
          createdAt: new Date().toISOString()
        }
      });
    } catch (err: any) {
      console.error("Upload attachment error:", err);
      res.status(500).json({ error: "Failed to store asset" });
    }
  });

  // Tickets: Add response comment/message
  app.post("/api/tickets/add-comment", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { ticketId, commentText, isInternal } = req.body;

    if (!ticketId || !commentText) {
      return res.status(400).json({ error: "Comment text and ticket signature are required" });
    }

    try {
      const ticketRows = await executeQuery("SELECT * FROM Tickets WHERE id = ?", [ticketId]);
      if (!ticketRows || ticketRows.length === 0) {
        return res.status(404).json({ error: "Specified technical ticket not found" });
      }

      const ticket = ticketRows[0];

      // Access verification
      if (user.role !== "admin" && user.role !== "engineer" && ticket.client_user_id !== user.id) {
        return res.status(403).json({ error: "Access denied to target incident metadata" });
      }

      const isInternalFinal = (user.role === "admin" || user.role === "engineer") ? !!isInternal : false;
      const commId = `comm-${Date.now()}-${Math.floor(Math.random() * 100)}`;

      await executeQuery(
        "INSERT INTO TicketComments (id, ticket_id, user_id, comment_text, is_internal) VALUES (?, ?, ?, ?, ?)",
        [commId, ticketId, user.id, commentText, isInternalFinal]
      );

      // Create proper alerts based on comment recipient
      if (!isInternalFinal) {
        if (user.role === "admin" || user.role === "engineer") {
          // Notify Client user
          await writeNotification(
            ticket.client_user_id,
            `رد جديد من الدعم الفني على بلاغكم: "${ticket.title}"`,
            `Support engineer response posted on your ticket: "${ticket.title}"`
          );
        } else {
          // Notify Admin
          await writeNotification(
            "u-admin",
            `رد جديد من العميل على البلاغ رقم: ${ticket.id}`,
            `New client response logged on ticket: ${ticket.id}`
          );
        }
      }

      await writeAuditLog(user.id, user.displayNameEn, `تم تدوين ${isInternalFinal ? "ملاحظة سرية" : "رد علني"} على البلاغ رقم ${ticketId}`, `Registered ${isInternalFinal ? "internal supervisor memo" : "public interaction item"} on ticket ${ticketId}`);

      res.json({
        success: true,
        comment: {
          id: commId,
          userId: user.id,
          userName: user.role === "admin" ? user.displayNameEn : user.displayNameAr,
          userRole: user.role,
          commentText,
          createdAt: new Date().toISOString(),
          isInternal: isInternalFinal
        }
      });
    } catch (err: any) {
      console.error("Add comment error:", err);
      res.status(500).json({ error: "Failed to publish statement" });
    }
  });

  // Tickets: Process workflow / Status update
  app.post("/api/tickets/update-status", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { ticketId, status, rejectionReason, internalNotes, assignedEngineerId, assignedEngineerName } = req.body;

    if (!ticketId) {
      return res.status(400).json({ error: "Ticket ID is required" });
    }

    try {
      const ticketRows = await executeQuery("SELECT * FROM Tickets WHERE id = ?", [ticketId]);
      if (!ticketRows || ticketRows.length === 0) {
        return res.status(404).json({ error: "Technical ticket not found" });
      }

      const ticket = ticketRows[0];

      if (user.role !== "admin" && user.role !== "engineer") {
        return res.status(403).json({ error: "Operation restricted to technical supervisors & engineers" });
      }

      const oldStatus = ticket.status;

      let updateQuery = "UPDATE Tickets SET ";
      let sets: string[] = [];
      let params: any[] = [];

      if (status) {
        sets.push("status = ?");
        params.push(status);
        if (status === "closed") {
          sets.push("closed_at = ?");
          params.push(new Date());
        }
      }

      if (rejectionReason !== undefined) {
        sets.push("rejection_reason = ?");
        params.push(rejectionReason);
      }

      if (internalNotes !== undefined) {
        sets.push("internal_notes = ?");
        params.push(internalNotes);
      }

      if (assignedEngineerId !== undefined) {
        sets.push("assigned_engineer_id = ?");
        params.push(assignedEngineerId || null);
        if (assignedEngineerId) {
          sets.push("assigned_at = ?");
          params.push(new Date());
        }
      }

      // Auto assign current engineer if they accept / process and none was assigned yet
      if ((status === "accepted" || status === "in_progress") && !ticket.assigned_engineer_id && !assignedEngineerId) {
        sets.push("assigned_engineer_id = ?");
        params.push(user.id);
        sets.push("assigned_at = ?");
        params.push(new Date());
      }

      if (sets.length > 0) {
        updateQuery += sets.join(", ") + " WHERE id = ?";
        params.push(ticketId);
        await executeQuery(updateQuery, params);
      }

      // Auto trigger warning alert messages or log transitions
      if (status && status !== oldStatus) {
        await writeNotification(
          ticket.client_user_id,
          `تم تعديل حالة بلاغكم الفني رقم ${ticket.id} إلى: ${status}`,
          `Support incident status of your ticket ${ticket.id} has transitioned to: ${status}`
        );

        await writeAuditLog(user.id, user.displayNameEn, `تحديث حالة البلاغ ${ticketId} من ${oldStatus} إلى ${status}`, `Incidents pipeline: shifted ticket ${ticketId} status from ${oldStatus} to ${status}`);
      } else if (internalNotes !== undefined) {
        await writeAuditLog(user.id, user.displayNameEn, `تعديل الملاحظات الإدارية الخاصة بالبلاغ رقم ${ticketId}`, `Altered technical internal logs on ticket ${ticketId}`);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Update status error:", err);
      res.status(500).json({ error: "Workflow database modification failed" });
    }
  });

  // Tickets: submit client evaluation and rating for processed technical incident
  app.post("/api/tickets/rate", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { ticketId, ratingValue, ratingFeedback } = req.body;

    if (!ticketId || ratingValue === undefined) {
      return res.status(400).json({ error: "Ticket ID and rating score parameters are mandatory" });
    }

    try {
      const ticketRows = await executeQuery("SELECT * FROM Tickets WHERE id = ?", [ticketId]);
      if (!ticketRows || ticketRows.length === 0) {
        return res.status(404).json({ error: "Technical ticket not found" });
      }

      const ticket = ticketRows[0];
      if (user.role !== "client" || ticket.client_user_id !== user.id) {
        return res.status(403).json({ error: "Only the incident submitter is authorized to evaluate the engineer" });
      }

      await executeQuery(
        "UPDATE Tickets SET rating_value = ?, rating_feedback = ? WHERE id = ?",
        [Number(ratingValue), ratingFeedback || "", ticketId]
      );

      await writeAuditLog(user.id, user.displayNameEn, `تم إرسال تقييم قيمته ${ratingValue} نجوم من العميل للبلاغ رقم ${ticketId}`, `Submitted rating of ${ratingValue} stars on ticket ${ticketId}`);

      res.json({ success: true });
    } catch (err: any) {
      console.error("Rate ticket error:", err);
      res.status(500).json({ error: "Failed to log metrics" });
    }
  });

  // Engineers Directory Management (Admin/Engineer only)
  app.get("/api/engineers", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    if (user.role !== "admin" && user.role !== "engineer") {
      return res.status(403).json({ error: "Admin or Engineer privilege level is requested" });
    }

    try {
      const rows = await executeQuery("SELECT * FROM Users WHERE role = 'engineer'");
      const engineers = rows.map((r: any) => ({
        id: r.id,
        username: r.username,
        role: r.role,
        displayNameAr: r.display_name_ar,
        displayNameEn: r.display_name_en,
        isActive: r.is_active === 1 || r.is_active === true
      }));
      res.json({ engineers });
    } catch (err: any) {
      console.error("Get engineers error:", err);
      res.status(500).json({ error: "Failed to fetch engineer profiles" });
    }
  });

  // Engineers: Create Engineer profile and Login token (Admin only)
  app.post("/api/engineers/create", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Authorized admins only" });
    }

    const { displayNameAr, displayNameEn, username, password } = req.body;
    if (!displayNameAr || !displayNameEn || !username || !password) {
      return res.status(400).json({ error: "All account fields are required" });
    }

    try {
      const existsRows = await executeQuery("SELECT * FROM Users WHERE LOWER(username) = LOWER(?)", [username]);
      if (existsRows && existsRows.length > 0) {
        return res.status(400).json({ error: "Username already taken" });
      }

      const newEngId = `u-eng-${Date.now()}`;
      const hashedPass = await hashPassword(password);

      await executeQuery(
        "INSERT INTO Users (id, username, password_hash, role, display_name_ar, display_name_en, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [newEngId, username, hashedPass, "engineer", displayNameAr, displayNameEn, true]
      );

      await writeAuditLog(user.id, user.displayNameEn, `إنشاء حساب مهندس جديد باسم: ${displayNameAr}`, `Created direct engineer user account: ${displayNameEn}`);

      res.json({
        success: true,
        engineer: {
          id: newEngId,
          username,
          role: "engineer",
          displayNameAr,
          displayNameEn,
          isActive: true
        }
      });
    } catch (err: any) {
      console.error("Create engineer error:", err);
      res.status(500).json({ error: "Failed to insert engineer" });
    }
  });

  // Engineers: Update Engineer details (Admin only)
  app.post("/api/engineers/update", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Operation restricted to technical admins only" });
    }

    const { userId, displayNameAr, displayNameEn, username, password } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Engineer target userId is required" });
    }

    try {
      const targetRows = await executeQuery("SELECT * FROM Users WHERE id = ? AND role = 'engineer'", [userId]);
      if (!targetRows || targetRows.length === 0) {
        return res.status(404).json({ error: "Engineer account not found" });
      }

      const targetUser = targetRows[0];

      if (username && username.toLowerCase() !== targetUser.username.toLowerCase()) {
        const existRows = await executeQuery("SELECT * FROM Users WHERE LOWER(username) = LOWER(?)", [username]);
        if (existRows && existRows.length > 0) {
          return res.status(400).json({ error: "Username already taken by another account" });
        }
      }

      let updateQuery = "UPDATE Users SET ";
      let sets: string[] = [];
      let params: any[] = [];

      if (displayNameAr) { sets.push("display_name_ar = ?"); params.push(displayNameAr); }
      if (displayNameEn) { sets.push("display_name_en = ?"); params.push(displayNameEn); }
      if (username) { sets.push("username = ?"); params.push(username); }
      if (password) {
        const hash = await hashPassword(password);
        sets.push("password_hash = ?");
        params.push(hash);
      }

      if (sets.length > 0) {
        updateQuery += sets.join(", ") + " WHERE id = ?";
        params.push(userId);
        await executeQuery(updateQuery, params);
      }

      const updatedNameAr = displayNameAr || targetUser.display_name_ar;
      const updatedNameEn = displayNameEn || targetUser.display_name_en;

      await writeAuditLog(user.id, user.displayNameEn, `تحديث بيانات المهندس: ${updatedNameAr}`, `Modified settings details for systems engineer: ${updatedNameEn}`);

      res.json({ success: true });
    } catch (err: any) {
      console.error("Update engineer error:", err);
      res.status(500).json({ error: "Failed to persist modifications" });
    }
  });

  // Engineers: Toggle account access status (Admin only)
  app.post("/api/engineers/toggle", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Operation exclusive to admins" });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Specify target userId for connection toggle" });
    }

    try {
      const targetRows = await executeQuery("SELECT * FROM Users WHERE id = ? AND role = 'engineer'", [userId]);
      if (!targetRows || targetRows.length === 0) {
        return res.status(404).json({ error: "Engineer profiles could not be identified" });
      }

      const targetUser = targetRows[0];
      const newState = targetUser.is_active === 1 || targetUser.is_active === true ? 0 : 1;

      await executeQuery("UPDATE Users SET is_active = ? WHERE id = ?", [newState, userId]);

      await writeAuditLog(
        user.id,
        user.displayNameEn,
        `تعديل حالة حساب الدخول للمهندس ${targetUser.display_name_ar} إلى: ${newState ? "نشط" : "معطل"}`,
        `Toggled access state for engineer ${targetUser.display_name_en} to: ${newState ? "Active" : "Suspended"}`
      );

      res.json({ success: true, isActive: newState === 1 });
    } catch (err: any) {
      console.error("Toggle engineer error:", err);
      res.status(500).json({ error: "Failed to toggle membership" });
    }
  });

  // Clients Directory Management (Admin only)
  app.get("/api/clients", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin privilege level is requested" });
    }

    try {
      const rows = await executeQuery(`
        SELECT u.*, c.id AS client_id, c.company_ar, c.company_en, c.email, c.phone, c.created_at AS client_created_at
        FROM Clients c
        JOIN Users u ON c.user_id = u.id
      `);

      const clients = rows.map((row: any) => ({
        id: row.client_id,
        userId: row.id,
        companyAr: row.company_ar,
        companyEn: row.company_en,
        email: row.email,
        phone: row.phone,
        createdAt: row.client_created_at,
        username: row.username,
        isActive: row.is_active === 1 || row.is_active === true,
        displayNameAr: row.display_name_ar,
        displayNameEn: row.display_name_en
      }));

      res.json({ clients });
    } catch (err: any) {
      console.error("Get clients error:", err);
      res.status(500).json({ error: "Failed to retrieve directory records" });
    }
  });

  // Clients: Create Client profile and Login account
  app.post("/api/clients/create", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Authorized admins only" });
    }

    const { companyAr, companyEn, displayNameAr, displayNameEn, email, phone, username, password } = req.body;
    if (!companyAr || !companyEn || !displayNameAr || !displayNameEn || !email || !phone || !username || !password) {
      return res.status(400).json({ error: "All account fields are required" });
    }

    try {
      const existsRows = await executeQuery("SELECT * FROM Users WHERE LOWER(username) = LOWER(?)", [username]);
      if (existsRows && existsRows.length > 0) {
        return res.status(400).json({ error: "Username already taken" });
      }

      const newUserId = `u-client-${Date.now()}`;
      const newClientId = `c-${Date.now()}`;
      const hashedPass = await hashPassword(password);

      // Create base User row
      await executeQuery(
        "INSERT INTO Users (id, username, password_hash, role, display_name_ar, display_name_en, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [newUserId, username, hashedPass, "client", displayNameAr, displayNameEn, true]
      );

      // Create Client metadata row
      await executeQuery(
        "INSERT INTO Clients (id, user_id, company_ar, company_en, email, phone) VALUES (?, ?, ?, ?, ?, ?)",
        [newClientId, newUserId, companyAr, companyEn, email, phone]
      );

      await writeAuditLog(user.id, user.displayNameEn, `إنشاء ملف تعريف لعميل جديد: ${companyAr}`, `Registered brand new customer organization: ${companyEn}`);

      res.json({ success: true });
    } catch (err: any) {
      console.error("Create client error:", err);
      res.status(500).json({ error: "Failed to record customer metrics" });
    }
  });

  // Clients: Update Client profile details
  app.post("/api/clients/update", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Operation restricted to technical admins" });
    }

    const { userId, companyAr, companyEn, displayNameAr, displayNameEn, email, phone, password } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Target userId is required for directory mutations" });
    }

    try {
      const clientRows = await executeQuery("SELECT * FROM Clients WHERE user_id = ?", [userId]);
      if (!clientRows || clientRows.length === 0) {
        return res.status(404).json({ error: "Client profile target lookup failed in the registry" });
      }

      const client = clientRows[0];

      // Update User parent descriptors
      let userSets: string[] = [];
      let userParams: any[] = [];
      if (displayNameAr) { userSets.push("display_name_ar = ?"); userParams.push(displayNameAr); }
      if (displayNameEn) { userSets.push("display_name_en = ?"); userParams.push(displayNameEn); }
      if (password) {
        const hash = await hashPassword(password);
        userSets.push("password_hash = ?");
        userParams.push(hash);
      }

      if (userSets.length > 0) {
        userParams.push(userId);
        await executeQuery(`UPDATE Users SET ${userSets.join(", ")} WHERE id = ?`, userParams);
      }

      // Update Client fields
      let clientSets: string[] = [];
      let clientParams: any[] = [];
      if (companyAr) { clientSets.push("company_ar = ?"); clientParams.push(companyAr); }
      if (companyEn) { clientSets.push("company_en = ?"); clientParams.push(companyEn); }
      if (email) { clientSets.push("email = ?"); clientParams.push(email); }
      if (phone) { clientSets.push("phone = ?"); clientParams.push(phone); }

      if (clientSets.length > 0) {
        clientParams.push(userId);
        await executeQuery(`UPDATE Clients SET ${clientSets.join(", ")} WHERE user_id = ?`, clientParams);
      }

      const loggedComp = companyAr || client.company_ar;
      await writeAuditLog(user.id, user.displayNameEn, `تحديث لملف بيانات العميل: ${loggedComp}`, `Modified settings details for client profiles: ${companyEn || client.company_en}`);

      res.json({ success: true });
    } catch (err: any) {
      console.error("Update client error:", err);
      res.status(500).json({ error: "Failed to persist customer details" });
    }
  });

  // Clients: Toggle account access status
  app.post("/api/clients/toggle", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Operation exclusive to admins" });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Specify target userId for connection toggle" });
    }

    try {
      const clientProfileRows = await executeQuery("SELECT * FROM Clients WHERE user_id = ?", [userId]);
      const userRows = await executeQuery("SELECT * FROM Users WHERE id = ?", [userId]);

      if (!userRows || userRows.length === 0 || !clientProfileRows || clientProfileRows.length === 0) {
        return res.status(404).json({ error: "Associated client profiles could not be identified" });
      }

      const client = clientProfileRows[0];
      const targetUser = userRows[0];
      const newState = (targetUser.is_active === 1 || targetUser.is_active === true) ? 0 : 1;

      await executeQuery("UPDATE Users SET is_active = ? WHERE id = ?", [newState, userId]);

      await writeAuditLog(
        user.id,
        user.displayNameEn,
        `تعديل حالة حساب الدخول للعميل ${client.company_ar} إلى: ${newState ? "نشط" : "معطل"}`,
        `Toggled access state for client ${client.company_en} to: ${newState ? "Active" : "Suspended"}`
      );

      res.json({ success: true, isActive: newState === 1 });
    } catch (err: any) {
      console.error("Toggle client error:", err);
      res.status(500).json({ error: "Failed to modify client entry accessibility" });
    }
  });

  // Security Logs
  app.get("/api/audit-logs", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Access level must be technical supervisor" });
    }

    try {
      const rows = await executeQuery("SELECT * FROM AuditLogs ORDER BY created_at DESC LIMIT 200");
      const auditLogs = rows.map((l: any) => ({
        id: l.id,
        userId: l.user_id,
        userName: l.user_name,
        actionAr: l.action_ar,
        actionEn: l.action_en,
        createdAt: l.created_at
      }));
      res.json({ auditLogs });
    } catch (err: any) {
      console.error("Get audit logs error:", err);
      res.status(500).json({ error: "Failed to access audit trails" });
    }
  });

  // Notifications
  app.get("/api/notifications", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    try {
      const rows = await executeQuery("SELECT * FROM Notifications WHERE target_user_id = ? ORDER BY created_at DESC LIMIT 100", [user.id]);
      const notifications = rows.map((n: any) => ({
        id: n.id,
        targetUserId: n.target_user_id,
        messageAr: n.message_ar,
        messageEn: n.message_en,
        isRead: n.is_read === 1 || n.is_read === true,
        createdAt: n.created_at
      }));
      res.json({ notifications });
    } catch (err: any) {
      console.error("Get notifications error:", err);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/read-all", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    try {
      await executeQuery("UPDATE Notifications SET is_read = TRUE WHERE target_user_id = ?", [user.id]);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Read all notifications error:", err);
      res.status(500).json({ error: "Failed to mark visual flags" });
    }
  });

  // Integrating Vite Dev Server or Production Static Files Router
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Critical server bootstrap error:", error);
});
