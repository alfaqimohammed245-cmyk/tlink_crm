-- CRM MySQL Database Schema
-- Generated for Professional Ticket Management System

CREATE DATABASE IF NOT EXISTS `crm_database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `crm_database`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `Users` (
  `id` VARCHAR(36) NOT NULL,
  `username` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'engineer', 'client') NOT NULL,
  `display_name_ar` VARCHAR(255) NOT NULL,
  `display_name_en` VARCHAR(255) NOT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_users_username` (`username`),
  INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Clients Table
CREATE TABLE IF NOT EXISTS `Clients` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL UNIQUE,
  `company_ar` VARCHAR(255) NOT NULL,
  `company_en` VARCHAR(255) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_clients_user` FOREIGN KEY (`user_id`) REFERENCES `Users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tickets Table
CREATE TABLE IF NOT EXISTS `Tickets` (
  `id` VARCHAR(50) NOT NULL,
  `ticket_number` VARCHAR(50) NULL UNIQUE,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `priority` ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  `status` ENUM('new', 'accepted', 'in_progress', 'pending_client', 'closed') NOT NULL DEFAULT 'new',
  `client_user_id` VARCHAR(36) NOT NULL,
  `assigned_engineer_id` VARCHAR(36) NULL,
  `rejection_reason` TEXT NULL,
  `internal_notes` TEXT NULL,
  `reporter_phone` VARCHAR(50) NOT NULL,
  `rating_value` INT NULL,
  `rating_feedback` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `assigned_at` TIMESTAMP NULL DEFAULT NULL,
  `closed_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_tickets_client` FOREIGN KEY (`client_user_id`) REFERENCES `Users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tickets_engineer` FOREIGN KEY (`assigned_engineer_id`) REFERENCES `Users` (`id`) ON DELETE SET NULL,
  INDEX `idx_tickets_status` (`status`),
  INDEX `idx_tickets_priority` (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TicketComments Table
CREATE TABLE IF NOT EXISTS `TicketComments` (
  `id` VARCHAR(36) NOT NULL,
  `ticket_id` VARCHAR(50) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `comment_text` TEXT NOT NULL,
  `is_internal` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_comments_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `Tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `Users` (`id`) ON DELETE CASCADE,
  INDEX `idx_comments_ticket` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. TicketAttachments Table
CREATE TABLE IF NOT EXISTS `TicketAttachments` (
  `id` VARCHAR(36) NOT NULL,
  `ticket_id` VARCHAR(50) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_path` LONGTEXT NOT NULL, -- Storing Base64 or local paths safely
  `uploaded_by` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_attachments_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `Tickets` (`id`) ON DELETE CASCADE,
  INDEX `idx_attachments_ticket` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS `Notifications` (
  `id` VARCHAR(36) NOT NULL,
  `target_user_id` VARCHAR(36) NOT NULL,
  `message_ar` VARCHAR(255) NOT NULL,
  `message_en` VARCHAR(255) NOT NULL,
  `is_read` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`target_user_id`) REFERENCES `Users` (`id`) ON DELETE CASCADE,
  INDEX `idx_notifications_user` (`target_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. AuditLogs Table
CREATE TABLE IF NOT EXISTS `AuditLogs` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `user_name` VARCHAR(255) NOT NULL,
  `action_ar` VARCHAR(255) NOT NULL,
  `action_en` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `Users` (`id`) ON DELETE CASCADE,
  INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
