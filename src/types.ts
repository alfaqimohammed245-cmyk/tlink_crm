export interface User {
  id: string;
  username: string;
  role: "admin" | "engineer" | "client";
  displayNameAr: string;
  displayNameEn: string;
  isActive: boolean;
  password?: string;
}

export interface ClientProfile {
  id: string;
  userId: string;
  companyAr: string;
  companyEn: string;
  email: string;
  phone: string;
  createdAt: string;
  username?: string;
  password?: string;
  isActive?: boolean;
  displayNameAr?: string;
  displayNameEn?: string;
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  fileData: string; // Base64 encoding
  uploadedBy: string; // User Name
  createdAt: string;
}

export interface TicketComment {
  id: string;
  userId: string;
  userName: string;
  userRole: "admin" | "client" | "engineer";
  commentText: string;
  createdAt: string;
  isInternal: boolean;
}

export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketStatus = "new" | "accepted" | "in_progress" | "pending_client" | "closed";

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  clientUserId: string;
  clientNameAr: string;
  clientNameEn: string;
  rejectionReason?: string;
  internalNotes?: string;
  attachments: TicketAttachment[];
  comments: TicketComment[];
  assignedEngineerId?: string;
  assignedEngineerName?: string;
  assignedAt?: string;
  closedByEngineerId?: string;
  closedByEngineerName?: string;
  closedAt?: string;
  reporterPhone?: string;
  ratingValue?: number;
  ratingFeedback?: string;
}

export interface AppNotification {
  id: string;
  targetUserId: string;
  messageAr: string;
  messageEn: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  actionAr: string;
  actionEn: string;
  createdAt: string;
}

export type AppLanguage = "ar" | "en";
