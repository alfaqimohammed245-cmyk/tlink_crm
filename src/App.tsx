/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Users,
  Ticket as TicketIcon,
  Activity,
  FileText,
  Search,
  Plus,
  LogOut,
  Send,
  User as UserIcon,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Paperclip,
  Eye,
  Settings,
  Bell,
  RefreshCw,
  Globe,
  CornerDownLeft,
  Filter,
  Check,
  ChevronDown,
  Download,
  Printer,
  ChevronRight,
  Info,
  Calendar,
  Lock,
  Phone,
  Mail,
  Building,
  Wrench,
  Star
} from "lucide-react";
import { translations } from "./lib/translations";
import { apiRequest, getAuthToken, setAuthToken, clearAuthToken } from "./lib/api";
import {
  User,
  ClientProfile,
  Ticket,
  TicketComment,
  TicketPriority,
  TicketStatus,
  AppNotification,
  AuditLog,
  AppLanguage
} from "./types";

export default function App() {
  // Locale State
  const [lang, setLang] = useState<AppLanguage>("ar");

  // Auth State
  const [authToken, setAuthTokenState] = useState<string | null>(getAuthToken());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // App Master Data Lists (Synced with API)
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [engineers, setEngineers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Navigation Tabs for Admin
  const [activeAdminTab, setActiveAdminTab] = useState<"dashboard" | "tickets" | "clients" | "audit" | "engineers">("dashboard");

  // Engineer CRUD Form states
  const [showEngineerModal, setShowEngineerModal] = useState(false);
  const [editingEngineer, setEditingEngineer] = useState<User | null>(null);
  const [engineerFormUsername, setEngineerFormUsername] = useState("");
  const [engineerFormPassword, setEngineerFormPassword] = useState("");
  const [engineerFormDisplayNameAr, setEngineerFormDisplayNameAr] = useState("");
  const [engineerFormDisplayNameEn, setEngineerFormDisplayNameEn] = useState("");
  const [engineerFormError, setEngineerFormError] = useState("");

  // Selected Ticket for details viewing/actions
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");

  // Client CRUD Modals & form fields
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientProfile | null>(null);
  const [clientFormCompanyAr, setClientFormCompanyAr] = useState("");
  const [clientFormCompanyEn, setClientFormCompanyEn] = useState("");
  const [clientFormDisplayNameAr, setClientFormDisplayNameAr] = useState("");
  const [clientFormDisplayNameEn, setClientFormDisplayNameEn] = useState("");
  const [clientFormEmail, setClientFormEmail] = useState("");
  const [clientFormPhone, setClientFormPhone] = useState("");
  const [clientFormUsername, setClientFormUsername] = useState("");
  const [clientFormPassword, setClientFormPassword] = useState("");
  const [clientFormError, setClientFormError] = useState("");

  // Create Ticket Form states (Client role)
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketDescription, setNewTicketDescription] = useState("");
  const [newTicketPriority, setNewTicketPriority] = useState<TicketPriority>("medium");
  const [newTicketReporterPhone, setNewTicketReporterPhone] = useState("");
  const [attachedFile, setAttachedFile] = useState<{ fileName: string; fileData: string } | null>(null);
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);

  // Reply Draft State
  const [replyText, setReplyText] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);

  // Admin Direct Decisions state
  const [rejectionDraftReason, setRejectionDraftReason] = useState("");
  const [adminInternalNotesDraft, setAdminInternalNotesDraft] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Client Rating input state
  const [ratingInputStars, setRatingInputStars] = useState<number>(5);
  const [ratingInputFeedback, setRatingInputFeedback] = useState<string>("");

  // Real-time notifications popover
  const [showNotificationsTray, setShowNotificationsTray] = useState(false);

  // Export Layout State
  const [showExportPDFView, setShowExportPDFView] = useState(false);
  const [successToastMessage, setSuccessToastMessage] = useState("");
  const [errorToastMessage, setErrorToastMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailsFileRef = useRef<HTMLInputElement>(null);

  const t = translations[lang];

  // Load User Info and sync backend data
  useEffect(() => {
    if (authToken) {
      verifySession();
    }
  }, [authToken]);

  useEffect(() => {
    if (currentUser) {
      loadApplicationData();
      // Auto Refresh data every 20 seconds to simulate dynamic changes
      const timer = setInterval(() => {
        loadApplicationDataSilently();
      }, 20000);
      return () => clearInterval(timer);
    }
  }, [currentUser]);

  const triggerToast = (msg: string, type: "success" | "error" = "success") => {
    if (type === "success") {
      setSuccessToastMessage(msg);
      setTimeout(() => setSuccessToastMessage(""), 5000);
    } else {
      setErrorToastMessage(msg);
      setTimeout(() => setErrorToastMessage(""), 5000);
    }
  };

  const verifySession = async () => {
    try {
      setIsDataLoading(true);
      const res = await apiRequest("/api/auth/me", "GET");
      setCurrentUser(res.user);
    } catch (err: any) {
      console.error(err);
      handleLogout();
    } finally {
      setIsDataLoading(false);
    }
  };

  const loadApplicationData = async () => {
    if (!getAuthToken()) return;
    try {
      setIsDataLoading(true);
      await loadApplicationDataSilently();
    } catch (err: any) {
      console.error(err);
      triggerToast(lang === "ar" ? "تعذر تحديث البيانات من الخادم" : "Could not sync data from server", "error");
    } finally {
      setIsDataLoading(false);
    }
  };

  const loadApplicationDataSilently = async () => {
    if (!getAuthToken()) return;
    try {
      const ticketsRes = await apiRequest("/api/tickets", "GET");
      setTickets(ticketsRes.tickets);

      // Fetch admin stats
      if (currentUser?.role === "admin" || currentUser?.role === "engineer") {
        try {
          const clientsRes = await apiRequest("/api/clients", "GET");
          setClients(clientsRes.clients);
        } catch (e) {
          console.warn("Clients fetch restricted:", e);
        }

        try {
          const logsRes = await apiRequest("/api/audit-logs", "GET");
          setAuditLogs(logsRes.auditLogs);
        } catch (e) {
          console.warn("Audit logs restricted:", e);
        }

        try {
          const engsRes = await apiRequest("/api/engineers", "GET");
          setEngineers(engsRes.engineers);
        } catch (e) {
          console.warn("Engineers fetch failed:", e);
        }
      }

      // Fetch user notifications
      const notificationsRes = await apiRequest("/api/notifications", "GET");
      setNotifications(notificationsRes.notifications);

      // Deep update selected ticket if currently showing one
      if (selectedTicket) {
        const currentSelected = ticketsRes.tickets.find((tk: Ticket) => tk.id === selectedTicket.id);
        if (currentSelected) {
          setSelectedTicket(currentSelected);
        }
      }
    } catch (err) {
      console.error("Silent sync error:", err);
    }
  };

  // Auth: Handle login submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      setAuthError(lang === "ar" ? "الرجاء كتاية اسم المستخدم وكلمة المرور" : "Please fill in all blanks.");
      return;
    }
    setAuthError("");
    setIsAuthenticating(true);

    try {
      const res = await apiRequest("/api/auth/login", "POST", {
        username: loginUsername,
        password: loginPassword,
      });

      setAuthToken(res.token);
      setAuthTokenState(res.token);
      setCurrentUser(res.user);
      triggerToast(lang === "ar" ? `مرحباً بك مجدداً ${res.user.displayNameAr}` : `Welcome back ${res.user.displayNameEn}`);
    } catch (err: any) {
      setAuthError(err.message || "فشل تسجيل الدخول - تحقق من البيانات");
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Auth: Handle logout click
  const handleLogout = () => {
    clearAuthToken();
    setAuthTokenState(null);
    setCurrentUser(null);
    setSelectedTicket(null);
    setTickets([]);
    setClients([]);
    setAuditLogs([]);
    setNotifications([]);
  };

  // Shortcut login helper for evaluation simplicity
  const quickFillLogin = (role: "admin" | "engineer" | "client1" | "client2") => {
    if (role === "admin") {
      setLoginUsername("admin");
      setLoginPassword("admin123");
    } else if (role === "engineer") {
      setLoginUsername("engineer");
      setLoginPassword("engineer123");
    } else if (role === "client1") {
      setLoginUsername("client1");
      setLoginPassword("client123");
    } else {
      setLoginUsername("client2");
      setLoginPassword("client123");
    }
  };

  // Client management operations (Admin role only)
  const openAddClientModal = () => {
    setEditingClient(null);
    setClientFormCompanyAr("");
    setClientFormCompanyEn("");
    setClientFormDisplayNameAr("");
    setClientFormDisplayNameEn("");
    setClientFormEmail("");
    setClientFormPhone("");
    setClientFormUsername("");
    setClientFormPassword("");
    setClientFormError("");
    setShowClientModal(true);
  };

  const openEditClientModal = (client: ClientProfile) => {
    setEditingClient(client);
    setClientFormCompanyAr(client.companyAr);
    setClientFormCompanyEn(client.companyEn);
    setClientFormDisplayNameAr(client.displayNameAr || "");
    setClientFormDisplayNameEn(client.displayNameEn || "");
    setClientFormEmail(client.email);
    setClientFormPhone(client.phone);
    setClientFormUsername(client.username || "");
    setClientFormPassword(client.password || ""); // Masked plain output lookup
    setClientFormError("");
    setShowClientModal(true);
  };

  const saveClientForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientFormError("");

    const payload = {
      companyAr: clientFormCompanyAr,
      companyEn: clientFormCompanyEn,
      displayNameAr: clientFormDisplayNameAr,
      displayNameEn: clientFormDisplayNameEn,
      email: clientFormEmail,
      phone: clientFormPhone,
      password: clientFormPassword,
    };

    try {
      if (editingClient) {
        // Edit Action
        await apiRequest("/api/clients/update", "POST", {
          ...payload,
          userId: editingClient.userId,
        });
        triggerToast(lang === "ar" ? "تم تحديث معلومات العميل بنجاح" : "Client profile updated successfully");
      } else {
        // Create Action
        if (!clientFormUsername) {
          setClientFormError(lang === "ar" ? "يرجى تحديد اسم مستخدم فريد للعميل" : "Username is required for new registration");
          return;
        }
        await apiRequest("/api/clients/create", "POST", {
          ...payload,
          username: clientFormUsername,
        });
        triggerToast(lang === "ar" ? "تم تسجيل العميل وتوليد حساب الدخول" : "Customer account generated successfully");
      }
      setShowClientModal(false);
      loadApplicationData();
    } catch (err: any) {
      setClientFormError(err.message || t.error);
    }
  };

  const toggleClientStatus = async (userId: string) => {
    try {
      const res = await apiRequest("/api/clients/toggle", "POST", { userId });
      triggerToast(
        lang === "ar"
          ? `تم تحديث الحساب إلى: ${res.isActive ? "نشط" : "معطل"}`
          : `Account status toggled: ${res.isActive ? "Active" : "Suspended"}`
      );
      loadApplicationData();
    } catch (err: any) {
      triggerToast(err.message || t.error, "error");
    }
  };

  // Engineer management operations (Admin role only)
  const openAddEngineerModal = () => {
    setEditingEngineer(null);
    setEngineerFormUsername("");
    setEngineerFormPassword("");
    setEngineerFormDisplayNameAr("");
    setEngineerFormDisplayNameEn("");
    setEngineerFormError("");
    setShowEngineerModal(true);
  };

  const openEditEngineerModal = (eng: User) => {
    setEditingEngineer(eng);
    setEngineerFormUsername(eng.username);
    setEngineerFormPassword(eng.password || "");
    setEngineerFormDisplayNameAr(eng.displayNameAr || "");
    setEngineerFormDisplayNameEn(eng.displayNameEn || "");
    setEngineerFormError("");
    setShowEngineerModal(true);
  };

  const saveEngineerForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setEngineerFormError("");

    if (!engineerFormUsername || !engineerFormPassword || !engineerFormDisplayNameAr || !engineerFormDisplayNameEn) {
      setEngineerFormError(lang === "ar" ? "يرجى تعبئة كافة الحقول" : "Please fill out all fields");
      return;
    }

    try {
      if (editingEngineer) {
        await apiRequest("/api/engineers/update", "POST", {
          userId: editingEngineer.id,
          username: engineerFormUsername,
          password: engineerFormPassword,
          displayNameAr: engineerFormDisplayNameAr,
          displayNameEn: engineerFormDisplayNameEn,
        });
        triggerToast(lang === "ar" ? "تم تحديث بيانات المهندس بنجاح" : "Engineer account details updated successfully");
      } else {
        await apiRequest("/api/engineers/create", "POST", {
          username: engineerFormUsername,
          password: engineerFormPassword,
          displayNameAr: engineerFormDisplayNameAr,
          displayNameEn: engineerFormDisplayNameEn,
        });
        triggerToast(lang === "ar" ? "تم تسجيل حساب الدخول للمهندس وتفعيله" : "Engineer account registered and active");
      }
      setShowEngineerModal(false);
      setEditingEngineer(null);
      loadApplicationData();
    } catch (err: any) {
      setEngineerFormError(err.message || t.error);
    }
  };

  const toggleEngineerStatus = async (userId: string) => {
    try {
      const res = await apiRequest("/api/engineers/toggle", "POST", { userId });
      triggerToast(
        lang === "ar"
          ? `تم تحديث حالة المهندس إلى: ${res.isActive ? "نشط" : "معطل"}`
          : `Engineer status altered: ${res.isActive ? "Active" : "Suspended"}`
      );
      loadApplicationData();
    } catch (err: any) {
      triggerToast(err.message || t.error, "error");
    }
  };

  // Ticket Management actions: file reader for Base64 Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isForIncidentForm: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        triggerToast(lang === "ar" ? "حجم الملف كبير جداً، الحد الأقصى 5 ميجا" : "File is too large, max is 5MB", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        if (isForIncidentForm) {
          setAttachedFile({
            fileName: file.name,
            fileData: base64String,
          });
        } else if (selectedTicket) {
          // Direct background commit to database on currently viewed ticket detail
          uploadAttachmentDirectly(selectedTicket.id, file.name, base64String);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAttachmentDirectly = async (ticketId: string, fileName: string, fileData: string) => {
    try {
      await apiRequest("/api/tickets/upload-attachment", "POST", {
        ticketId,
        fileName,
        fileData,
      });
      triggerToast(lang === "ar" ? "تم رفع المرفق التشخيصي للمنظومة" : "Incident Attachment added to vault");
      loadApplicationData();
    } catch (err: any) {
      triggerToast(err.message || t.error, "error");
    }
  };

  // Create new ticket (Client role only)
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketTitle || !newTicketDescription || !newTicketReporterPhone) {
      triggerToast(lang === "ar" ? "الرجاء كتابة العنوان، التفاصيل، ورقم جوال مقدم البلاغ كاملة" : "Please provide Subject, Description, and Reporter's Phone Number", "error");
      return;
    }

    try {
      await apiRequest("/api/tickets/create", "POST", {
        title: newTicketTitle,
        description: newTicketDescription,
        priority: newTicketPriority,
        attachment: attachedFile,
        reporterPhone: newTicketReporterPhone,
      });

      triggerToast(lang === "ar" ? "تم إنشاء تذكرة الدعم الفني وإخطار المشرفين" : "Incident Ticket filed and logged successfully");
      setShowCreateTicketModal(false);
      setNewTicketTitle("");
      setNewTicketDescription("");
      setNewTicketPriority("medium");
      setNewTicketReporterPhone("");
      setAttachedFile(null);
      loadApplicationData();
    } catch (err: any) {
      triggerToast(err.message || t.error, "error");
    }
  };

  // Submit reply / comment on current incident of focus
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText || !selectedTicket) return;

    try {
      await apiRequest("/api/tickets/add-comment", "POST", {
        ticketId: selectedTicket.id,
        commentText: replyText,
        isInternal: isInternalComment,
      });

      setReplyText("");
      setIsInternalComment(false);
      triggerToast(lang === "ar" ? "تم نشر تعليقك وإدراجه في السجل" : "Support message recorded in transaction stream");
      loadApplicationData();
    } catch (err: any) {
      triggerToast(err.message || t.error, "error");
    }
  };

  // Submit client evaluation of engineer
  const handleSendRating = async () => {
    if (!selectedTicket) return;
    try {
      const response = await apiRequest("/api/tickets/rate", "POST", {
        ticketId: selectedTicket.id,
        ratingValue: ratingInputStars,
        ratingFeedback: ratingInputFeedback,
      });
      triggerToast(lang === "ar" ? "شكراً لك! تم إرسال تقييمك للمهندس بنجاح" : "Thank you! Your rating has been recorded.", "success");
      
      // Update selected ticket state locally to reflect the rating instantly
      if (response && response.ticket) {
        setSelectedTicket(response.ticket);
      }
      loadApplicationData();
    } catch (err: any) {
      triggerToast(err.message || t.error, "error");
    }
  };

  // Admin Direct Decision actions (Accept, Reject, Change Status manually)
  const handleUpdateStatusAndNotes = async (newStatus: TicketStatus, options?: { rejectionReason?: string; notes?: string }) => {
    if (!selectedTicket) return;

    try {
      await apiRequest("/api/tickets/update-status", "POST", {
        ticketId: selectedTicket.id,
        status: newStatus,
        rejectionReason: options?.rejectionReason || "",
        internalNotes: options?.notes || selectedTicket.internalNotes,
      });

      triggerToast(
        lang === "ar"
          ? `تم تحويل حالة البلاغ بنجاح إلى: ${newStatus}`
          : `Incident dispatcher status updated to: ${newStatus}`
      );
      setShowRejectInput(false);
      loadApplicationData();
    } catch (err: any) {
      triggerToast(err.message || t.error, "error");
    }
  };

  const handleSaveInternalNotesOnly = async () => {
    if (!selectedTicket) return;
    try {
      await apiRequest("/api/tickets/update-status", "POST", {
        ticketId: selectedTicket.id,
        status: selectedTicket.status,
        internalNotes: adminInternalNotesDraft,
      });
      triggerToast(lang === "ar" ? "تم حفظ الملاحظات الإدارية الداخلية" : "Internal monitoring parameters updated");
      loadApplicationData();
    } catch (err: any) {
      triggerToast(err.message || t.error, "error");
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await apiRequest("/api/notifications/read-all", "POST");
      loadApplicationData();
      triggerToast(lang === "ar" ? "تم تفريغ صندوق التنبيهات" : "All cleared");
    } catch (err: any) {
      triggerToast(err.message || t.error, "error");
    }
  };

  // Export functions simulation
  const simulateExportCSV = () => {
    // Generate simulated CSV values and start standard download mechanism
    let csvContent = "\uFEFF"; // Arabic characters compatibility byte
    csvContent += "رقم البلاغ,العنوان,العميل,الأولوية,الحالة,تاريخ الإنشاء\n";
    tickets.forEach((tk) => {
      csvContent += `${tk.id},"${tk.title.replace(/"/g, ' ')}","${tk.clientNameAr}","${tk.priority}","${tk.status}","${tk.createdAt}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `crm_tickets_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast(lang === "ar" ? "تم تصدير الجدول إلى ملف Excel/CSV بنجاح" : "Incidents exported as Excel/CSV");
  };

  // Statistics calculation helpers
  const statsTotalClients = clients.length;
  const statsOpenTickets = tickets.filter((t) => t.status !== "closed").length;
  const statsInProgress = tickets.filter((t) => t.status === "in_progress").length;
  const statsClosed = tickets.filter((t) => t.status === "closed").length;

  const ticketsNew = tickets.filter((t) => t.status === "new").length;
  const ticketsAccepted = tickets.filter((t) => t.status === "accepted").length;
  const ticketsPendingClient = tickets.filter((t) => t.status === "pending_client").length;

  // Filter application
  const filteredTickets = tickets.filter((tk) => {
    const term = searchQuery.toLowerCase();
    const matchSearch =
      tk.id.includes(term) ||
      tk.title.toLowerCase().includes(term) ||
      tk.description.toLowerCase().includes(term) ||
      tk.clientNameAr.toLowerCase().includes(term) ||
      tk.clientNameEn.toLowerCase().includes(term);

    const matchStatus = filterStatus === "all" ? true : tk.status === filterStatus;
    const matchPriority = filterPriority === "all" ? true : tk.priority === filterPriority;
    const matchClient = filterClient === "all" ? true : tk.clientUserId === filterClient;

    return matchSearch && matchStatus && matchPriority && matchClient;
  });

  // Load drafts if ticket selection changed
  useEffect(() => {
    if (selectedTicket) {
      setAdminInternalNotesDraft(selectedTicket.internalNotes || "");
    } else {
      setAdminInternalNotesDraft("");
    }
  }, [selectedTicket]);

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-[#070b14] text-slate-100 transition-all duration-300 antialiased"
      id="crm-tech-root"
    >
      {/* Visual Header / Brand Bar */}
      <header id="main-brand-header" className="bg-[#0b1224] text-white border-b border-sky-500/10 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo & Platform Info */}
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="bg-gradient-to-tr from-sky-500 to-blue-600 p-2.5 rounded-xl shadow-md cursor-pointer">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                {t.appName}
                <span className="bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs px-2.5 py-0.5 rounded-full font-medium">
                  {currentUser?.role === "admin" ? t.adminPortal : (currentUser?.role === "engineer" ? t.engineerPortal : t.clientPortal)}
                </span>
              </h1>
              <p className="text-xs text-sky-400 mt-0.5">{t.subName}</p>
            </div>
          </div>

          {/* Practical Action Bars */}
          <div className="flex items-center gap-3">
            
            {/* Language Selector */}
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              id="lang-toggle-btn"
              className="px-3 py-1.5 rounded-lg border border-slate-800 bg-[#070b14] text-xs text-sky-400 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 transition-all"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{lang === "ar" ? "English" : "العربية"}</span>
            </button>

            {currentUser && (
              <>
                {/* Notification Alarm Icon */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowNotificationsTray(!showNotificationsTray);
                      loadApplicationDataSilently();
                    }}
                    id="notifications-tray-trigger"
                    className="p-2 rounded-xl border border-slate-800 bg-[#070b14] text-slate-300 hover:text-white transition-all hover:bg-slate-800 relative cursor-pointer"
                  >
                    <Bell className="w-4 h-4" />
                    {notifications.filter((n) => !n.isRead).length > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-[10px] text-white flex items-center justify-center rounded-full font-bold animate-pulse">
                        {notifications.filter((n) => !n.isRead).length}
                      </span>
                    )}
                  </button>

                  {/* Real-Time Notifications Tray */}
                  {showNotificationsTray && (
                    <div
                      id="notifications-tray-panel"
                      className={`absolute ${lang === "ar" ? "left-0" : "right-0"} mt-2.5 w-80 max-w-sm bg-[#0b1224] text-slate-100 rounded-2xl shadow-2xl border border-slate-800 py-2.5 z-50 animate-in fade-in slide-in-from-top-3`}
                    >
                      <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-200">{t.notifications}</span>
                        {notifications.length > 0 && (
                          <button
                            onClick={handleMarkNotificationsRead}
                            className="text-[10px] text-sky-400 hover:underline font-semibold"
                          >
                            {t.markAllRead}
                          </button>
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto px-2 py-1">
                        {notifications.length === 0 ? (
                          <div className="text-center py-6 text-slate-500 text-xs">
                            {t.noNotifications}
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className={`p-2.5 rounded-lg mb-1.5 transition-colors text-xs ${notif.isRead ? "bg-slate-950/40 text-slate-400" : "bg-sky-950/40 text-sky-200 font-medium border border-sky-500/20"}`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                                <div className="flex-1">
                                  <p>{lang === "ar" ? notif.messageAr : notif.messageEn}</p>
                                  <span className="text-[10px] text-slate-500 block mt-1">
                                    {new Date(notif.createdAt).toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US", {
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Sync button */}
                <button
                  onClick={loadApplicationData}
                  id="data-refresh-btn"
                  className="p-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:text-white transition-all hover:bg-slate-800"
                  title={t.refresh}
                >
                  <RefreshCw className={`w-4 h-4 ${isDataLoading ? "animate-spin text-sky-400" : ""}`} />
                </button>

                {/* Brief User Session Widget */}
                <div className="hidden md:flex items-center gap-2 border-r md:border-r-0 md:border-l border-slate-700 px-3 py-1 text-xs text-slate-300">
                  <UserIcon className="w-4 h-4 text-sky-400" />
                  <span>
                    {t.welcome}{" "}
                    <strong className="text-white">
                      {lang === "ar" ? currentUser.displayNameAr : currentUser.displayNameEn}
                    </strong>
                  </span>
                </div>

                {/* Universal Logout Button */}
                <button
                  onClick={handleLogout}
                  id="navbar-logout-btn"
                  className="px-3 py-2 rounded-xl bg-red-600/10 hover:bg-red-600 border border-red-500/20 text-red-100 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t.logout}</span>
                </button>
              </>
            )}
          </div>

        </div>
      </header>

      {/* Dynamic Success Alert Banner */}
      {successToastMessage && (
        <div className="fixed top-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-emerald-500 text-white rounded-xl shadow-2xl p-4 flex items-start gap-3 border border-emerald-400/30 animate-in slide-in-from-top-6">
          <CheckCircle className="w-5 h-5 shrink-0 text-white mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-white">{lang === "ar" ? "عملية ناجحة" : "Success"}</h4>
            <p className="text-xs text-emerald-50 text-slate-100">{successToastMessage}</p>
          </div>
          <button onClick={() => setSuccessToastMessage("")} className="text-white/60 hover:text-white font-bold">×</button>
        </div>
      )}

      {errorToastMessage && (
        <div className="fixed top-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-rose-600 text-white rounded-xl shadow-2xl p-4 flex items-start gap-3 border border-rose-400/30 animate-in slide-in-from-top-6">
          <AlertCircle className="w-5 h-5 shrink-0 text-white mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-white">{lang === "ar" ? "تنبيه النظام" : "Error Alert"}</h4>
            <p className="text-xs text-rose-50 text-slate-100">{errorToastMessage}</p>
          </div>
          <button onClick={() => setErrorToastMessage("")} className="text-white/60 hover:text-white font-bold">×</button>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* =========================================
            STATE 1: UNAUTHENTICATED LOGIN SCREEN
            ========================================= */}
        {!currentUser && (
          <div className="max-w-md mx-auto mt-10 md:mt-16" id="login-container">
            <div className="bg-[#0b1224] rounded-3xl shadow-2xl border border-sky-500/25 overflow-hidden cyber-glow">
              
              {/* Technical Banner Box */}
              <div className="bg-gradient-to-br from-slate-900 to-navy-950 p-6 text-white text-center border-b border-slate-800/60">
                <div className="mx-auto w-14 h-14 bg-sky-500/10 border border-sky-400/30 flex items-center justify-center rounded-2xl mb-4 animate-pulse">
                  <Shield className="w-8 h-8 text-sky-400" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">{t.loginTitle}</h2>
                <p className="text-xs text-sky-400/80 mt-2 line-clamp-2">{t.loginSubtitle}</p>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                {authError && (
                  <div className="p-3.5 bg-red-950/40 border border-red-500/30 text-red-300 rounded-2xl text-xs flex items-center gap-2">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">{t.username} *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder={lang === "ar" ? "أدخل اسم المستخدم" : "Enter username"}
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">{t.password} *</label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm outline-none transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    id="login-submit-btn"
                    className="w-full mt-2 py-3 bg-gradient-to-r from-blue-600 to-sky-600 text-white font-bold text-sm rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    {isAuthenticating ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        <span>{t.loginBtn}</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Setup / Evaluator quick buttons */}
                <div className="mt-8 pt-6 border-t border-slate-800/80">
                  <span className="text-[11px] font-bold text-sky-400/80 uppercase tracking-wider block mb-3 text-center">
                    {t.credentialsHelper}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => quickFillLogin("admin")}
                      className="py-2.5 px-3 bg-slate-950/65 hover:bg-slate-900 text-slate-200 rounded-xl text-right flex items-center justify-between border border-slate-800 transition"
                    >
                      <span className="font-semibold text-[10px]">{lang === "ar" ? "المدير: admin" : "Admin: admin"}</span>
                      <span className="bg-blue-900/30 border border-blue-500/40 text-blue-300 text-[9px] px-1.5 py-0.5 rounded">Admin</span>
                    </button>
                    <button
                      onClick={() => quickFillLogin("engineer")}
                      className="py-2.5 px-3 bg-slate-950/65 hover:bg-slate-900 text-slate-200 rounded-xl text-right flex items-center justify-between border border-slate-800 transition"
                    >
                      <span className="font-semibold text-[10px]">{lang === "ar" ? "مهندس: engineer" : "Engineer: rami"}</span>
                      <span className="bg-sky-900/40 border border-sky-400/40 text-sky-400 text-[9px] px-1.5 py-0.5 rounded">Engineer</span>
                    </button>
                    <button
                      onClick={() => quickFillLogin("client1")}
                      className="py-2.5 px-3 bg-slate-950/65 hover:bg-slate-900 text-slate-200 rounded-xl text-right flex items-center justify-between border border-slate-800 transition"
                    >
                      <span className="font-semibold text-[10px]">{lang === "ar" ? "عميل 1: client1" : "Client 1: client1"}</span>
                      <span className="bg-emerald-900/30 border border-emerald-500/40 text-emerald-300 text-[9px] px-1.5 py-0.5 rounded">Client 1</span>
                    </button>
                    <button
                      onClick={() => quickFillLogin("client2")}
                      className="py-2.5 px-3 bg-[#0f1a30]/80 hover:bg-[#142340] text-slate-200 rounded-xl text-right flex items-center justify-between border border-slate-800 transition"
                    >
                      <span className="font-semibold text-[10px]">{lang === "ar" ? "عميل 2: client2" : "Client 2: client2"}</span>
                      <span className="bg-teal-900/30 border border-teal-500/40 text-teal-300 text-[9px] px-1.5 py-0.5 rounded">Client 2</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
            
            <p className="text-center text-xs text-slate-500 mt-6 font-mono">
              نظام CRM لإدارة علاقات العملاء والأمن المعلوماتي © {new Date().getFullYear()}
            </p>
          </div>
        )}

        {/* =========================================
            STATE 2: AUTHENTICATED WORK INTERFACE
            ========================================= */}
        {currentUser && (
          <div className="space-y-6">

            {/* Admin & Engineer Tabs Router */}
            {(currentUser.role === "admin" || currentUser.role === "engineer") && (
              <div className="border-b border-slate-800 pb-px mb-2 overflow-x-auto">
                <nav className="flex space-x-1 space-x-reverse min-w-max">
                  
                  <button
                    onClick={() => {
                      setActiveAdminTab("dashboard");
                      setSelectedTicket(null);
                    }}
                    className={`flex items-center gap-2 py-3 px-4 text-xs font-bold transition-all border-b-2 rounded-t-lg ${activeAdminTab === "dashboard" ? "border-sky-500 bg-sky-950/20 text-sky-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                  >
                    <Activity className="w-4 h-4" />
                    <span>{t.tabDashboard}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveAdminTab("tickets");
                      setSelectedTicket(null);
                    }}
                    className={`flex items-center gap-2 py-3 px-4 text-xs font-bold transition-all border-b-2 rounded-t-lg ${activeAdminTab === "tickets" ? "border-sky-500 bg-sky-950/20 text-sky-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                  >
                    <TicketIcon className="w-4 h-4" />
                    <span>{t.allTickets}</span>
                    <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-medium">
                      {tickets.length}
                    </span>
                  </button>

                  {currentUser.role === "admin" && (
                    <button
                      onClick={() => {
                        setActiveAdminTab("clients");
                        setSelectedTicket(null);
                      }}
                      className={`flex items-center gap-2 py-3 px-4 text-xs font-bold transition-all border-b-2 rounded-t-lg ${activeAdminTab === "clients" ? "border-sky-500 bg-sky-950/20 text-sky-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                    >
                      <Users className="w-4 h-4" />
                      <span>{t.tabClients}</span>
                      <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-medium">
                        {clients.length}
                      </span>
                    </button>
                  )}

                  {(currentUser.role === "admin" || currentUser.role === "engineer") && (
                    <button
                      onClick={() => {
                        setActiveAdminTab("engineers");
                        setSelectedTicket(null);
                      }}
                      className={`flex items-center gap-2 py-3 px-4 text-xs font-bold transition-all border-b-2 rounded-t-lg ${activeAdminTab === "engineers" ? "border-sky-500 bg-sky-950/20 text-sky-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                    >
                      <Wrench className="w-4 h-4 text-emerald-400" />
                      <span>{lang === "ar" ? "فريق المهندسين" : "Engineer Staff"}</span>
                      <span className="bg-slate-800 text-emerald-300 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-full font-medium">
                        {engineers.length}
                      </span>
                    </button>
                  )}

                  {currentUser.role === "admin" && (
                    <button
                      onClick={() => {
                        setActiveAdminTab("audit");
                        setSelectedTicket(null);
                      }}
                      className={`flex items-center gap-2 py-3 px-4 text-xs font-bold transition-all border-b-2 rounded-t-lg ${activeAdminTab === "audit" ? "border-sky-500 bg-sky-950/20 text-sky-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>{t.tabAuditLogs}</span>
                    </button>
                  )}

                </nav>
              </div>
            )}

            {/* Client Title and Header Call-To-Action (Client role only) */}
            {currentUser.role === "client" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0a0f1d] p-6 text-white rounded-2xl shadow-lg border border-sky-500/20 cyber-glow">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-sky-400 rounded-full animate-ping" />
                      {lang === "ar" ? `مرحباً بك في بوابة TLINK: ${currentUser.displayNameAr}` : `Logged Company: ${currentUser.displayNameEn}`}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1.5">
                      {lang === "ar"
                        ? "مرحباً بك في البوابة التقنية المتكاملة لخدمات الربط السحابي وربط الفروع المباشر. يمكنك متابعة بلاغاتك أو طلب خدمات طارئة مخصصة."
                        : "Welcome to the unified TLINK tech terminal for Cloud instances & IPSec Interconnectivity solutions."}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateTicketModal(true)}
                    id="client-new-ticket-btn"
                    className="bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs py-3 px-5 rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-2 self-stretch sm:self-auto text-center justify-center cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t.newTicketBtn}</span>
                  </button>
                </div>

                {/* TLINK Core Services Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="tlink-services-grid">
                  
                  {/* Service 1: Cloud Servers */}
                  <div className="bg-[#0a0f1d] border border-sky-500/20 p-5 rounded-2xl text-white flex flex-col justify-between hover:border-sky-500/50 transition duration-300 relative overflow-hidden group cyber-glow">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[10px] uppercase font-mono font-bold tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                          {lang === "ar" ? "نشط - اتصال مستقر" : "Active - Online"}
                        </span>
                        <span className="text-slate-500 text-[10px] font-mono">TLINK-CLOUD-v4</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-sky-400" />
                        {lang === "ar" ? "إدارة السيرفرات السحابية ومساحات التخزين" : "Cloud Dedicated Servers & Storage Blocks"}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                        {lang === "ar" 
                          ? "سيرفرات سحابية آمنة مخصصة لقواعد البيانات وأنظمة الحسابات مع ميزة النسخ الاحتياطي الساعي والتشفير الكامل من طرف إلى طرف."
                          : "Encrypted instances with continuous hourly snapshots designed for ERP systems and enterprise database replication tunnels."}
                      </p>
                    </div>
                    <div className="mt-5 pt-3.5 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono">RAM: 64GB · vCPU: 16 Cores</span>
                      <button
                        onClick={() => {
                          setNewTicketTitle(lang === "ar" ? "طلب ترقية / تهيئة في السيرفر السحابي الخاص بنا" : "Request Cloud Server modification / upgrade");
                          setNewTicketDescription(lang === "ar" ? "يرجى ذكر تفاصيل طلب زيادة موارد السيرفر السحابي أو المشكلة التي تواجهونها هنا..." : "Enter details regarding Cloud Server allocation modifications...");
                          setNewTicketPriority("high");
                          setShowCreateTicketModal(true);
                        }}
                        className="px-3 py-1.5 bg-sky-500/10 text-sky-300 hover:bg-sky-500 hover:text-white border border-sky-500/30 text-[10px] rounded-lg font-bold transition-all"
                      >
                        {lang === "ar" ? "طلب دعم للسيرفر" : "Server Action"}
                      </button>
                    </div>
                  </div>

                  {/* Service 2: Branch Connection VPN */}
                  <div className="bg-[#0a0f1d] border border-blue-500/20 p-5 rounded-2xl text-white flex flex-col justify-between hover:border-blue-500/50 transition duration-300 relative overflow-hidden group cyber-glow">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-300 text-[10px] uppercase font-mono font-bold tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          {lang === "ar" ? "ربط الفروع والـ VPN الفعال" : "VPN Network - Online"}
                        </span>
                        <span className="text-slate-500 text-[10px] font-mono">TLINK-VPN-TUNNEL</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <Building className="w-4 h-4 text-blue-400" />
                        {lang === "ar" ? "ربط فروع الشركة والشبكات المحمية" : "Secure WAN Branch Interconnections & SD-WAN"}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                        {lang === "ar"
                          ? "ربط مالي وإداري مباشر للفروع والمستودعات مع الفرع الرئيسي ومراقبة حية لوقت الاتصال للأجهزة عبر جدران الحماية للشبكات."
                          : "Dedicated site-to-site VPN tunnels & edge routers providing real-time local network synchronization, latency checks, and firewalls."}
                      </p>
                    </div>
                    <div className="mt-5 pt-3.5 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono">Active Nodes: 3 Branches Bound</span>
                      <button
                        onClick={() => {
                          setNewTicketTitle(lang === "ar" ? "مشكلة في ربط فرع أو نفق VPN" : "Branch VPN network tunnel repair request");
                          setNewTicketDescription(lang === "ar" ? "يرجى توضيح الفرع المستهدف للمشكلة وتفاصيل راوتر الربط الخاص بكم..." : "Please specify which physical node requires network tunnel troubleshooting...");
                          setNewTicketPriority("high");
                          setShowCreateTicketModal(true);
                        }}
                        className="px-3 py-1.5 bg-blue-500/10 text-blue-300 hover:bg-blue-500 hover:text-white border border-blue-500/30 text-[10px] rounded-lg font-bold transition-all"
                      >
                        {lang === "ar" ? "طلب دعم الربط" : "Interconnection Action"}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* =========================================
                TAB VIEW A: ADMIN/ENGINEER EXECUTIVE DASHBOARD
                ========================================= */}
            {(currentUser.role === "admin" || currentUser.role === "engineer") && activeAdminTab === "dashboard" && !selectedTicket && (
              <div className="space-y-6" id="admin-dashboard-view">
                
                {/* Statistics Cards Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Card 1 */}
                  <div className="bg-[#0b1224] p-5 rounded-2xl shadow-md border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">{t.statClients}</p>
                      <h4 className="text-2xl font-bold text-white mt-1">{statsTotalClients}</h4>
                    </div>
                    <div className="p-3 bg-sky-950/40 text-sky-400 rounded-xl border border-sky-500/10">
                      <Users className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-[#0b1224] p-5 rounded-2xl shadow-md border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">{t.statOpen}</p>
                      <h4 className="text-2xl font-bold text-amber-400 mt-1">{statsOpenTickets}</h4>
                    </div>
                    <div className="p-3 bg-amber-950/40 text-amber-400 rounded-xl border border-amber-500/10">
                      <Clock className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-[#0b1224] p-5 rounded-2xl shadow-md border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">{t.statInProgress}</p>
                      <h4 className="text-2xl font-bold text-indigo-400 mt-1">{statsInProgress}</h4>
                    </div>
                    <div className="p-3 bg-indigo-950/40 text-indigo-400 rounded-xl border border-indigo-500/10">
                      <Activity className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 4 */}
                  <div className="bg-[#0b1224] p-5 rounded-2xl shadow-md border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">{t.statClosed}</p>
                      <h4 className="text-2xl font-bold text-emerald-400 mt-1">{statsClosed}</h4>
                    </div>
                    <div className="p-3 bg-emerald-950/40 text-emerald-400 rounded-xl border border-emerald-500/10">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                  </div>

                </div>

                {/* Graphic Charts & Layout split row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Visual Pure-CSS Bar Chart distributions */}
                  <div className="bg-[#0b1224] p-5 rounded-2xl shadow-md border border-slate-800/80 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-4">
                        {t.ticketDistribution}
                      </h3>
                      
                      <div className="space-y-4">
                        {/* New */}
                        <div>
                          <div className="flex justify-between text-xs font-medium mb-1.5">
                            <span className="text-slate-300">{t.status_new}</span>
                            <span className="font-bold text-white">{ticketsNew}</span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/50">
                            <div
                              className="bg-sky-500 h-full rounded-full transition-all"
                              style={{ width: `${tickets.length ? (ticketsNew / tickets.length) * 100 : 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Accepted */}
                        <div>
                          <div className="flex justify-between text-xs font-medium mb-1.5">
                            <span className="text-slate-300">{t.status_accepted}</span>
                            <span className="font-bold text-white">{ticketsAccepted}</span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/50">
                            <div
                              className="bg-blue-500 h-full rounded-full transition-all"
                              style={{ width: `${tickets.length ? (ticketsAccepted / tickets.length) * 100 : 0}%` }}
                            />
                          </div>
                        </div>

                        {/* In Progress */}
                        <div>
                          <div className="flex justify-between text-xs font-medium mb-1.5">
                            <span className="text-slate-300">{t.status_in_progress}</span>
                            <span className="font-bold text-white">{statsInProgress}</span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/50">
                            <div
                              className="bg-indigo-500 h-full rounded-full transition-all"
                              style={{ width: `${tickets.length ? (statsInProgress / tickets.length) * 100 : 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Pending client */}
                        <div>
                          <div className="flex justify-between text-xs font-medium mb-1.5">
                            <span className="text-slate-300">{t.status_pending_client}</span>
                            <span className="font-bold text-white">{ticketsPendingClient}</span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/50">
                            <div
                              className="bg-amber-500 h-full rounded-full transition-all"
                              style={{ width: `${tickets.length ? (ticketsPendingClient / tickets.length) * 100 : 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Closed */}
                        <div>
                          <div className="flex justify-between text-xs font-medium mb-1.5">
                            <span className="text-slate-300">{t.status_closed}</span>
                            <span className="font-bold text-white">{statsClosed}</span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/50">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all"
                              style={{ width: `${tickets.length ? (statsClosed / tickets.length) * 100 : 0}%` }}
                            />
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Engineers Leaderboard Performance widget */}
                    <div className="mt-8 pt-6 border-t border-slate-900">
                      <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <Wrench className="w-4 h-4 text-emerald-450" />
                        <span>{lang === "ar" ? "إحصائيات وتقييم المهندسين" : "Engineering Performance Stats"}</span>
                      </h4>

                      {engineers.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">
                          {lang === "ar" ? "لا يوجد مهندسين مسجلين حالياً." : "No registered engineers."}
                        </p>
                      ) : (
                        <div className="space-y-3 scrollbar-none overflow-y-auto max-h-60">
                          {engineers.map((eng) => {
                            const closedCount = tickets.filter(
                              (t) => t.status === "closed" && t.closedByEngineerId === eng.id
                            ).length;

                            const ratedTickets = tickets.filter(
                              (t) => t.closedByEngineerId === eng.id && t.ratingValue !== undefined
                            );
                            const avgRating = ratedTickets.length > 0 
                              ? (ratedTickets.reduce((sum, t) => sum + (t.ratingValue || 0), 0) / ratedTickets.length).toFixed(1)
                              : null;

                            return (
                              <div key={eng.id} className="bg-slate-950/60 p-3 rounded-xl border border-slate-900 flex items-center justify-between text-xs font-medium">
                                <div className="space-y-1">
                                  <span className="text-slate-100 font-bold block">
                                    {lang === "ar" ? eng.displayNameAr : eng.displayNameEn}
                                  </span>
                                  {avgRating ? (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                                      <span className="text-[11px] text-amber-400 font-mono font-bold">
                                        {avgRating} / 5
                                      </span>
                                      <span className="text-[10px] text-slate-500">
                                        ({ratedTickets.length} {lang === "ar" ? "تقييم" : "reviews"})
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 block italic">
                                      {lang === "ar" ? "بدون تقييم" : "No ratings"}
                                    </span>
                                  )}
                                </div>

                                <div className="text-right">
                                  <span className="text-[10px] text-slate-550 block mb-0.5">
                                    {t.closedCount}
                                  </span>
                                  <strong className="text-emerald-450 font-mono text-xs bg-emerald-950/45 px-2 py-0.5 rounded border border-emerald-500/10">
                                    {closedCount}
                                  </strong>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-900 text-center">
                      <p className="text-[11px] text-slate-500">
                        {lang === "ar"
                          ? "تصنيفات تفاعلية بناءً على مدخلات العملاء ومراجعات المشرفين الحالية."
                          : "Calculated instantly according to reported telemetry feeds."}
                      </p>
                    </div>
                  </div>

                  {/* Right Column (Span 2): Recent critical tickets and audit activity logs */}
                  <div className="bg-[#0b1224] p-5 rounded-2xl shadow-md border border-slate-800/80 lg:col-span-2">
                    <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                      <span>{t.recentTickets}</span>
                      <button
                        onClick={() => setActiveAdminTab("tickets")}
                        className="text-xs text-sky-400 hover:underline font-bold"
                      >
                        {lang === "ar" ? "عرض الجميع" : "Browse All Queue"}
                      </button>
                    </h3>

                    <div className="space-y-3">
                      {tickets.slice(0, 4).map((tk) => (
                        <div
                          key={tk.id}
                          onClick={() => setSelectedTicket(tk)}
                          className="p-3.5 bg-slate-950/40 hover:bg-slate-900 border border-slate-800/60 rounded-xl cursor-pointer transition flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3 font-sans">
                            <span
                              className={`w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center font-bold text-[8px] text-white opacity-90 ${
                                tk.priority === "critical"
                                  ? "bg-red-500"
                                  : tk.priority === "high"
                                    ? "bg-amber-500"
                                    : "bg-blue-400"
                              }`}
                            >
                              !
                            </span>
                            <div>
                              <h4 className="font-bold text-xs text-slate-100 line-clamp-1">{tk.title}</h4>
                              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                                {tk.id} # · {lang === "ar" ? tk.clientNameAr : tk.clientNameEn}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 font-sans">
                            <span
                              className={`text-[10px] uppercase font-bold py-1 px-2.5 rounded-lg ${
                                tk.status === "new"
                                  ? "bg-sky-950/40 text-sky-300 border border-sky-500/20"
                                  : tk.status === "in_progress" || tk.status === "processing"
                                    ? "bg-indigo-950/40 text-indigo-300 border border-indigo-500/20"
                                    : tk.status === "closed"
                                      ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/20"
                                      : "bg-slate-900 text-slate-400 border border-slate-700"
                              }`}
                            >
                              {lang === "ar" ? t[`status_${tk.status}`] || tk.status : tk.status}
                            </span>
                            <ChevronLeftOrRight lang={lang} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* =========================================
                TAB VIEW B: TECHNICAL TICKETS QUEUE
                ========================================= */}
            {(((currentUser.role === "admin" || currentUser.role === "engineer") && activeAdminTab === "tickets") ||
              currentUser.role === "client") &&
              !selectedTicket && (
                <div className="space-y-4" id="tickets-queue-view">
                  
                  {/* Filters Header Container */}
                  <div className="bg-[#0b1224] p-4 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <Search className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-3 w-4 h-4 text-slate-500`} />
                      <input
                        type="text"
                        placeholder={t.search}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full ${lang === "ar" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2 bg-slate-950 rounded-xl border border-slate-800 focus:ring-2 focus:ring-sky-500/10 focus:border-sky-500 text-xs outline-none text-white transition`}
                      />
                    </div>

                    {/* Filter parameters selection groups */}
                    <div className="flex flex-wrap items-center gap-2">
                       
                       {/* Status Filter */}
                       <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                         <Filter className="w-3 h-3 text-slate-500" />
                         <select
                           value={filterStatus}
                           onChange={(e) => setFilterStatus(e.target.value)}
                           className="bg-transparent border-0 text-xs font-semibold text-slate-300 outline-none cursor-pointer"
                         >
                           <option value="all">{lang === "ar" ? "كل الحالات" : "All Status"}</option>
                           <option value="new">{t.status_new}</option>
                           <option value="accepted">{t.status_accepted}</option>
                           <option value="in_progress">{t.status_in_progress}</option>
                           <option value="pending_client">{t.status_pending_client}</option>
                           <option value="closed">{t.status_closed}</option>
                         </select>
                       </div>

                       {/* Priority Filter */}
                       <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                         <AlertCircle className="w-3 h-3 text-slate-500" />
                         <select
                           value={filterPriority}
                           onChange={(e) => setFilterPriority(e.target.value)}
                           className="bg-transparent border-0 text-xs font-semibold text-slate-300 outline-none cursor-pointer"
                         >
                           <option value="all">{lang === "ar" ? "كل الأولويات" : "All Priorities"}</option>
                           <option value="low">{t.priority_low}</option>
                           <option value="medium">{t.priority_medium}</option>
                           <option value="high">{t.priority_high}</option>
                           <option value="critical">{t.priority_critical}</option>
                         </select>
                       </div>

                       {/* Admin client filter */}
                       {currentUser.role === "admin" && (
                         <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                           <Users className="w-3 h-3 text-slate-500" />
                           <select
                             value={filterClient}
                             onChange={(e) => setFilterClient(e.target.value)}
                             className="bg-transparent border-0 text-xs font-semibold text-slate-300 outline-none cursor-pointer max-w-[130px]"
                           >
                             <option value="all">{lang === "ar" ? "كل الشركات" : "All Companies"}</option>
                             {clients.map((c) => (
                               <option key={c.userId} value={c.userId}>
                                 {lang === "ar" ? c.companyAr : c.companyEn}
                               </option>
                             ))}
                           </select>
                         </div>
                       )}

                       {/* Export Button (Direct Download or layout view) */}
                       <button
                         onClick={simulateExportCSV}
                         className="p-2 bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 rounded-xl transition cursor-pointer"
                         title={t.exportExcel}
                       >
                         <Download className="w-4 h-4" />
                       </button>

                    </div>

                  </div>

                  {/* Desktop Grid Layout with Tickets */}
                  {filteredTickets.length === 0 ? (
                    <div className="bg-[#0b1224] p-12 text-center rounded-2xl border border-slate-800 cyber-glow">
                      <TicketIcon className="w-12 h-12 text-slate-600 mx-auto mb-4 animate-pulse" />
                      <h3 className="font-bold text-sky-400 text-sm mb-2">{lang === "ar" ? "لا توجد بلاغات دعم مطابقة للمعايير" : "No Tickets Matched"}</h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        {lang === "ar" ? "جرب تعديل خيارات التصفية والبحث في القائمة العلوية" : "Try revising your query or filters above."}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="tickets-bento-grid font-sans">
                      {filteredTickets.map((tk) => {
                        const commentsCount = tk.comments.filter(c => !c.isInternal || currentUser.role === "admin" || currentUser.role === "engineer").length;
                        return (
                          <div
                            key={tk.id}
                            onClick={() => setSelectedTicket(tk)}
                            className="bg-[#0b1224] p-5 rounded-2xl border border-slate-800/80 hover:border-sky-500/50 shadow-sm hover:shadow-lg hover:shadow-sky-500/5 transition duration-200 cursor-pointer flex flex-col justify-between group"
                          >
                            <div>
                              
                              {/* Meta: Priority badge and ID */}
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <span className="text-[10px] text-slate-500 font-mono font-bold">#{tk.id}</span>
                                <span
                                  className={`text-[10px] font-bold py-0.5 px-2.5 rounded-full ${
                                    tk.priority === "critical"
                                      ? "bg-red-950/40 text-red-400 border border-red-500/20"
                                      : tk.priority === "high"
                                        ? "bg-amber-950/40 text-amber-400 border border-amber-500/20"
                                        : tk.priority === "medium"
                                          ? "bg-[#0c1f3c] text-sky-400 border border-sky-400/20"
                                          : "bg-slate-900 text-slate-400 border border-slate-700"
                                  }`}
                                >
                                  {lang === "ar" ? t[`priority_${tk.priority}`] : tk.priority}
                                </span>
                              </div>

                              {/* Title */}
                              <h3 className="font-bold text-xs text-slate-100 group-hover:text-sky-400 transition-colors line-clamp-2">
                                {tk.title}
                              </h3>

                              {/* Description cut */}
                              <p className="text-[11px] text-slate-400 mt-2 line-clamp-3">
                                {tk.description}
                              </p>

                              {/* Dedicated TLINK Service Tag */}
                              <div className="mt-3">
                                {(() => {
                                  const isCloud = tk.title.includes("سيرفر") || tk.title.includes("سحابي") || tk.title.includes("Cloud") || tk.title.includes("Server") || tk.description.includes("سيرفر") || tk.description.includes("سحابي");
                                  const isBranch = tk.title.includes("فرع") || tk.title.includes("فروع") || tk.title.includes("VPN") || tk.title.includes("ربط") || tk.title.includes("Branch") || tk.description.includes("فرع") || tk.description.includes("فروع") || tk.description.includes("VPN");
                                  if (isCloud) {
                                    return (
                                      <span className="inline-flex items-center gap-1 bg-sky-950/40 text-sky-400 border border-sky-400/20 text-[9px] px-2 py-0.5 rounded-md font-bold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                                        {lang === "ar" ? "السيرفرات السحابية" : "Cloud Servers"}
                                      </span>
                                    );
                                  } else if (isBranch) {
                                    return (
                                      <span className="inline-flex items-center gap-1 bg-cyan-950/40 text-cyan-400 border border-cyan-400/20 text-[9px] px-2 py-0.5 rounded-md font-bold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                        {lang === "ar" ? "ربط الفروع" : "Branch Connections"}
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="inline-flex items-center gap-1 bg-slate-950/40 text-slate-400 border border-slate-400/20 text-[9px] px-2 py-0.5 rounded-md font-bold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                      {lang === "ar" ? "دعم شبكات عام" : "General Network Support"}
                                    </span>
                                  );
                                })()}
                              </div>

                            </div>

                            {/* Ticket Footer details */}
                            <div className="mt-5 pt-3.5 border-t border-slate-800 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-slate-300 max-w-[130px] truncate">
                                  {lang === "ar" ? tk.clientNameAr : tk.clientNameEn}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Comment and Attachment badge */}
                                {commentsCount > 0 && (
                                  <span className="text-[10px] bg-slate-950 text-slate-400 border border-slate-800/80 px-1.5 py-0.5 rounded font-bold">
                                    {commentsCount} {lang === "ar" ? "تعقيب" : "reply"}
                                  </span>
                                )}

                                <span
                                  className={`text-[10px] uppercase font-bold py-1 px-2.5 rounded-lg ${
                                    tk.status === "new"
                                      ? "bg-sky-950/40 text-sky-400 border border-sky-500/20"
                                      : tk.status === "accepted"
                                        ? "bg-blue-950/40 text-blue-400 border border-blue-500/20"
                                        : tk.status === "in_progress" || tk.status === "processing"
                                          ? "bg-indigo-950/40 text-indigo-400 border border-indigo-500/20"
                                          : tk.status === "pending_client"
                                            ? "bg-amber-950/40 text-amber-400 border border-amber-500/20"
                                            : "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20"
                                  }`}
                                >
                                  {lang === "ar" ? t[`status_${tk.status}`] || tk.status : tk.status}
                                </span>
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}

            {/* =========================================
                TAB VIEW C: SYSTEM CLIENTS DIRECTORY
                ========================================= */}
            {currentUser.role === "admin" && activeAdminTab === "clients" && !selectedTicket && (
              <div className="space-y-4" id="clients-registry-view">
                
                {/* Actions Header bar */}
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t.tabClients}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">{lang === "ar" ? "قائمة بجميع الشركات المسجلة وحسابات الدخول الخاصة بها" : "Directories of customer access key vaults"}</p>
                  </div>
                  
                  <button
                    onClick={openAddClientModal}
                    id="admin-add-client-btn"
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t.addClientBtn}</span>
                  </button>
                </div>

                {/* Grid list of clients */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clients.map((clt) => (
                    <div
                      key={clt.id}
                      className={`bg-white p-5 rounded-2xl border ${clt.isActive ? "border-slate-200" : "border-red-200 bg-red-50/10"} flex flex-col justify-between shadow-sm relative overflow-hidden`}
                    >
                      {!clt.isActive && (
                        <span className="absolute top-2 left-2 bg-red-100 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                          {t.statusSuspended}
                        </span>
                      )}

                      <div>
                        {/* Company Badge and representive details */}
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                            <Building className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-xs text-slate-900 leading-tight">
                              {lang === "ar" ? clt.companyAr : clt.companyEn}
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                              <UserIcon className="w-3 h-3" />
                              <span>{lang === "ar" ? clt.displayNameAr : clt.displayNameEn}</span>
                            </p>
                          </div>
                        </div>

                        {/* Contacts panel */}
                        <div className="mt-4 space-y-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <p className="flex items-center gap-1.5 font-mono text-[11px]">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{clt.email || "—"}</span>
                          </p>
                          <p className="flex items-center gap-1.5 font-mono text-[11px]">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{clt.phone || "—"}</span>
                          </p>
                          <p className="flex items-center gap-1.5 font-mono text-[11px] pt-1.5 border-t border-slate-200 text-slate-700 font-bold">
                            <Lock className="w-3.5 h-3.5 text-blue-500" />
                            <span>{t.username}: {clt.username}</span>
                          </p>
                        </div>
                      </div>

                      {/* Controls footer */}
                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => openEditClientModal(clt)}
                          className="px-2.5 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg font-bold transition flex items-center gap-1"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>{t.edit}</span>
                        </button>

                        <button
                          onClick={() => toggleClientStatus(clt.userId)}
                          className={`px-3 py-1.5 text-xs rounded-lg font-bold transition flex items-center gap-1 ${clt.isActive ? "text-red-600 hover:bg-red-50" : "bg-emerald-600 text-white hover:opacity-90"}`}
                        >
                          <span>{clt.isActive ? t.statusSuspended : t.statusActive}</span>
                        </button>
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            )}

            {/* =========================================
                TAB VIEW C-2: CERTIFIED SQUAD SQUAD ENGINEERS
                ========================================= */}
            {(currentUser.role === "admin" || currentUser.role === "engineer") && activeAdminTab === "engineers" && !selectedTicket && (
              <div className="space-y-6" id="engineers-directory-wrapper">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#0b1224] p-5 rounded-2xl border border-slate-800 shadow-md">
                  <div>
                    <h3 className="text-sm font-bold text-sky-400 uppercase tracking-widest flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-emerald-400" />
                      <span>{lang === "ar" ? "إدارة المهندسين والكادر الفني" : "Certified Systems Engineers"}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {lang === "ar"
                        ? "متابعة أداء وحسابات مهندسي الدعم الفني، وقياس عدد البلاغات المنجزة (المغلقة) لكل مهندس."
                        : "Monitor performance metrics, closed tickets quotas, and authentication credentials for developers."}
                    </p>
                  </div>

                  {currentUser.role === "admin" && (
                    <button
                      onClick={openAddEngineerModal}
                      className="py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{lang === "ar" ? "تسجيل مهندس جديد" : "Add Tech Engineer"}</span>
                    </button>
                  )}
                </div>

                {engineers.length === 0 ? (
                  <div className="bg-[#0b1224] p-12 text-center rounded-2xl border border-slate-800 shadow-sm">
                    <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-xs font-medium">
                      {lang === "ar" ? "لم يتم تسجيل أي مهندسين في النظام حتى الآن." : "No registered technical engineers at this time."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {engineers.map((eng) => {
                      const closedCount = tickets.filter(
                        (t) => t.status === "closed" && t.closedByEngineerId === eng.id
                      ).length;

                      const activeCount = tickets.filter(
                        (t) => t.status === "processing" && t.assignedEngineerId === eng.id
                      ).length;

                      return (
                        <div
                          key={eng.id}
                          className={`bg-[#0b1224] p-5 rounded-2xl border transition duration-200 flex flex-col justify-between group relative overflow-hidden ${
                            eng.isActive ? "border-slate-800/80 hover:border-emerald-500/30" : "border-red-500/20 bg-red-950/5"
                          }`}
                        >
                          {!eng.isActive && (
                            <span className="absolute top-2 left-2 bg-red-900/30 border border-red-500/35 text-red-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                              {t.statusSuspended}
                            </span>
                          )}

                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <div className="p-3 bg-emerald-950/45 text-emerald-400 rounded-xl border border-emerald-500/20">
                                <Wrench className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-bold text-xs text-white leading-tight">
                                  {lang === "ar" ? eng.displayNameAr : eng.displayNameEn}
                                </h4>
                                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                                  <span>{t.username}: {eng.username}</span>
                                </p>
                              </div>
                            </div>

                            {/* Performance statistics */}
                            <div className="space-y-1.5 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-900 font-sans">
                              <div className="flex items-center justify-between font-medium">
                                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                  {lang === "ar" ? "البلاغات المنجزة (المغلقة):" : "Solved (Closed) Tickets:"}
                                </span>
                                <strong className="text-emerald-400 font-mono text-xs bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/10">
                                  {closedCount} {lang === "ar" ? "بلاغات" : "tickets"}
                                </strong>
                              </div>

                              <div className="flex items-center justify-between font-medium">
                                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                                  {lang === "ar" ? "بلاغات جارية العمل:" : "Active Handled Tickets:"}
                                </span>
                                <strong className="text-amber-400 font-mono text-xs bg-amber-950/50 px-2 py-0.5 rounded border border-amber-500/10">
                                  {activeCount} {lang === "ar" ? "بلاغات" : "tickets"}
                                </strong>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 pt-3 border-t border-slate-900 flex items-center justify-between">
                            <span className="text-[10px] text-zinc-500 font-mono">ID: {eng.id}</span>
                            {currentUser.role === "admin" ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditEngineerModal(eng)}
                                  className="px-2.5 py-1.5 text-[11px] text-sky-400 hover:bg-sky-950/40 rounded-lg font-bold transition flex items-center gap-1 border border-sky-500/20 cursor-pointer"
                                  id={`edit-eng-btn-${eng.id}`}
                                >
                                  <Settings className="w-3.5 h-3.5 text-sky-400" />
                                  <span>{t.edit}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleEngineerStatus(eng.id)}
                                  className={`px-3 py-1.5 text-[11px] rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                                    eng.isActive
                                      ? "text-red-400 hover:bg-red-950/40 border border-red-500/20"
                                      : "bg-emerald-600 text-white hover:opacity-90 border border-emerald-500/35"
                                  }`}
                                  id={`toggle-eng-status-${eng.id}`}
                                >
                                  <span>{eng.isActive ? t.statusSuspended : t.statusActive}</span>
                                </button>
                              </div>
                            ) : (
                              <span className={`text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-md border ${eng.isActive ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/20" : "bg-red-950/20 text-red-500 border-red-500/20"}`}>
                                {eng.isActive ? (lang === "ar" ? "نشط" : "Active") : (lang === "ar" ? "موقوف" : "Suspended")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* =========================================
                TAB VIEW D: SECURITY AUDIT LOGS
                ========================================= */}
            {currentUser.role === "admin" && activeAdminTab === "audit" && !selectedTicket && (
              <div className="bg-[#0b1224] rounded-2xl shadow-md border border-slate-800/80 overflow-hidden" id="audit-logs-view">
                <div className="p-5 border-b border-slate-800">
                  <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider">{t.tabAuditLogs}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{lang === "ar" ? "سجل نظام الأمان التشغيلي لتوثيق جميع حركات المشرفين والعملاء" : "Cryptographic track logs detailing infrastructure changes"}</p>
                </div>

                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#070b14] text-slate-300 border-b border-slate-800">
                      <tr>
                        <th className="p-3 font-semibold">{t.userLog}</th>
                        <th className="p-3 font-semibold">{t.actionLog}</th>
                        <th className="p-3 font-semibold">{t.timeLog}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-900/60 transition-colors">
                          <td className="p-3 font-bold text-slate-200">{log.userName}</td>
                          <td className="p-3 text-slate-300">{lang === "ar" ? log.actionAr : log.actionEn}</td>
                          <td className="p-3 font-mono text-[10px] text-slate-500">
                            {new Date(log.createdAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* =========================================
                DETAILED SCREEN: INCIDENT CHAT & WORKFLOW
                ========================================= */}
            {selectedTicket && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200" id="ticket-detail-view">
                
                {/* Back Link with Header info */}
                <div className="col-span-1 lg:col-span-3 flex items-center justify-between border-b border-slate-800 pb-3">
                  <button
                    onClick={() => {
                      setSelectedTicket(null);
                      loadApplicationData();
                    }}
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-950 text-slate-300 border border-slate-800 rounded-xl hover:bg-slate-900 text-xs font-bold font-sans transition shadow-sm cursor-pointer"
                  >
                    <ChevronLeftOrRight lang={lang} isBackBtn={true} />
                    <span>{lang === "ar" ? "العودة لقائمة البلاغات" : "Back to Registry"}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Simulated PDF Layout Trigger */}
                    <button
                      onClick={() => setShowExportPDFView(true)}
                      className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 text-xs font-bold font-sans rounded-xl transition shadow-sm cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{t.exportPdf}</span>
                    </button>
                  </div>
                </div>

                {/* Left Side (Col span 2): Diagnostic Card details & Replies chain */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Master Incident Card Box */}
                  <div className="bg-[#0b1224] p-6 rounded-2xl shadow-md border border-slate-800/80 space-y-4">
                    
                    {/* Urgency and ID Banner */}
                    <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-[10px] text-slate-500 font-mono block">TK-{selectedTicket.id}</span>
                        <h2 className="font-bold text-sm text-slate-100 mt-0.5">{selectedTicket.title}</h2>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold py-1 px-3 rounded-full flex items-center gap-1 ${
                            selectedTicket.priority === "critical"
                              ? "bg-red-950/40 text-red-400 border border-red-500/20"
                              : "bg-blue-950/40 text-sky-400 border border-blue-500/20"
                          }`}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{lang === "ar" ? t[`priority_${selectedTicket.priority}`] : selectedTicket.priority}</span>
                        </span>

                        <span
                          className={`text-[10px] font-bold py-1 px-3 rounded-full uppercase ${
                            selectedTicket.status === "new"
                              ? "bg-sky-950/40 text-sky-400 border border-sky-500/20"
                              : selectedTicket.status === "closed"
                                ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20"
                                : "bg-indigo-950/40 text-indigo-400 border border-indigo-500/20"
                          }`}
                        >
                          {lang === "ar" ? t[`status_${selectedTicket.status}`] || selectedTicket.status : selectedTicket.status}
                        </span>
                      </div>
                    </div>

                    {/* Assignment Status alert box for clients/engineers */}
                    {selectedTicket.assignedEngineerName ? (
                      <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4 text-xs text-emerald-300 flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-full shrink-0">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-bold text-xs text-emerald-400">
                            {t.ticketReceivedByEngineer}
                          </p>
                          <p className="font-semibold text-slate-200 mt-1 text-xs">
                            {selectedTicket.assignedEngineerName}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-950/25 border border-amber-500/15 rounded-xl p-4 text-xs text-amber-400 flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-full animate-pulse shrink-0">
                          <Clock className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-bold text-xs text-amber-400">
                            {lang === "ar" ? "بانتظار استلام البلاغ والبدء بالعمل عليه من قِبل المهندس الفني المختص..." : "Awaiting assignment or acceptance by a technical support engineer..."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Reporter Phone section */}
                    {selectedTicket.reporterPhone && (
                      <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 border border-slate-800 rounded-xl text-xs max-w-max">
                        <Phone className="w-3.5 h-3.5 text-sky-450" />
                        <span className="text-slate-400">{t.reporterPhoneLabel}:</span>
                        <span className="text-sky-300 font-mono font-bold select-all">{selectedTicket.reporterPhone}</span>
                      </div>
                    )}

                    {/* Problem Statement Box */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">{t.problemDescription}</h4>
                      <p className="text-xs text-slate-200 bg-slate-950 p-4 rounded-xl border border-slate-800 leading-relaxed whitespace-pre-wrap">
                        {selectedTicket.description}
                      </p>
                    </div>

                    {/* Rejection Note Warning (if rejected) */}
                    {selectedTicket.rejectionReason && (
                      <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4 text-xs text-red-400">
                        <h5 className="font-bold mb-1 flex items-center gap-1.5">
                          <XCircle className="w-4 h-4" />
                          <span>{t.reasonsOfRejection}</span>
                        </h5>
                        <p>{selectedTicket.rejectionReason}</p>
                      </div>
                    )}

                    {/* Diagnostic Media Preview Box */}
                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{t.attachments}</h4>
                      {selectedTicket.attachments.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">{t.noAttachments}</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {selectedTicket.attachments.map((att) => {
                            const isImage = att.fileData.startsWith("data:image/");
                            return (
                              <div
                                key={att.id}
                                className="border border-slate-800 rounded-xl overflow-hidden p-2 bg-slate-950 flex flex-col justify-between group h-32 relative"
                              >
                                {isImage ? (
                                  <img
                                    src={att.fileData}
                                    alt={att.fileName}
                                    className="w-full h-20 object-cover rounded-lg"
                                  />
                                ) : (
                                  <div className="w-full h-20 rounded-lg bg-sky-950/40 border border-sky-850/35 text-sky-400 flex items-center justify-center font-bold text-xs font-mono">
                                    DOC
                                  </div>
                                )}
                                <div className="text-[10px] text-slate-400 font-bold truncate mt-1">{att.fileName}</div>
                                
                                {/* Overlay preview trigger */}
                                <a
                                  href={att.fileData}
                                  download={att.fileName}
                                  className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-xl text-[10px] font-bold"
                                >
                                  {lang === "ar" ? "تصدير / فتح ملف" : "Download file"}
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Interactive Drag Drop or attachment insertion zone within this ticket view */}
                      <div className="mt-3.5">
                        <label className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-sky-950/40 text-sky-400 hover:bg-sky-900 rounded-xl border border-sky-500/20 hover:border-sky-500/40 transition text-xs font-bold cursor-pointer">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>{lang === "ar" ? "إرفاق مستند تشخيصي آخر" : "Append Diagnostic Attachment"}</span>
                          <input
                            type="file"
                            className="hidden"
                            ref={detailsFileRef}
                            onChange={(e) => handleFileChange(e, false)}
                          />
                        </label>
                      </div>

                    </div>

                  </div>

                  {/* Comments / Responses Thread Chain */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t.comments}</h3>
                    
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-6 shadow-inner space-y-4 max-h-[500px] overflow-y-auto cyber-grid">
                      {selectedTicket.comments
                        .filter((c) => !c.isInternal || currentUser.role === "admin" || currentUser.role === "engineer")
                        .length === 0 ? (
                          <div className="text-center py-10 text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
                            <Activity className="w-8 h-8 text-sky-500/40 animate-pulse" />
                            <p>{lang === "ar" ? "قناة الاتصال مشفرة وخلف جدار حماية آمن بانتظار رسالتك" : "Connection encrypted behind active firewall. Awaiting transmission."}</p>
                            <p className="text-[10px] text-slate-600">{lang === "ar" ? "اكتب تعليقاً في الأسفل لبدء المحادثة مع المهندس المختص" : "Send a message below to start chatting with your designated engineer."}</p>
                          </div>
                        ) : (
                          selectedTicket.comments
                            .filter((c) => !c.isInternal || currentUser.role === "admin" || currentUser.role === "engineer")
                            .map((cmt) => {
                              const isMe = cmt.userId === currentUser.id;
                              const isEngineer = cmt.userRole === "admin";
                              return (
                                <div
                                  key={cmt.id}
                                  className={`flex flex-col ${isMe ? "items-end" : "items-start"} space-y-1 w-full`}
                                >
                                  {/* Sender tag header line */}
                                  <div className="flex items-center gap-1.5 px-2 text-[10px] text-slate-400">
                                    <span className="font-bold">
                                      {isMe 
                                        ? (lang === "ar" ? "أنت" : "You") 
                                        : (isEngineer 
                                          ? (lang === "ar" ? "مهندس النظم والدعم" : "TLINK Systems Engineer") 
                                          : cmt.userName)}
                                    </span>
                                    {isEngineer && !isMe && (
                                      <span className="bg-sky-500/20 border border-sky-400/30 text-sky-400 text-[8px] px-1.5 py-0.2 rounded font-mono">
                                        TLINK ENG
                                      </span>
                                    )}
                                    {cmt.isInternal && (
                                      <span className="bg-amber-500/20 text-amber-300 text-[8px] px-1.5 py-0.2 rounded font-mono">
                                        INTERNAL ONLY
                                      </span>
                                    )}
                                  </div>

                                  {/* Chat bubble body */}
                                  <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs shadow-sm ${
                                      cmt.isInternal
                                        ? "bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-tr-none"
                                        : isMe
                                          ? "bg-gradient-to-r from-blue-600 to-sky-600 text-white rounded-br-none"
                                          : "bg-slate-800 border border-slate-700 text-slate-100 rounded-bl-none"
                                    }`}
                                  >
                                    <p className="whitespace-pre-wrap leading-relaxed">{cmt.commentText}</p>
                                    
                                    {/* Brief small timestamp */}
                                    <span className="block text-[8px] text-slate-400 mt-2 text-right font-mono opacity-80">
                                      {new Date(cmt.createdAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        day: "numeric",
                                        month: "short"
                                      })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                        )}
                    </div>

                    {/* New Comment Draft Form */}
                    <form onSubmit={handleAddComment} className="bg-[#0b1224] p-4 rounded-xl border border-slate-850 shadow-sm space-y-3">
                      <textarea
                        rows={3}
                        required
                        placeholder={t.addCommentPlaceHolder}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="w-full p-3 bg-slate-950 text-slate-100 rounded-xl border border-slate-800 focus:border-sky-500/40 text-xs outline-none transition"
                      />

                      <div className="flex items-center justify-between gap-4 flex-wrap font-sans">
                        
                        {/* Option: Internal note checkbox (Admin/Engineer only) */}
                        {currentUser.role === "admin" || currentUser.role === "engineer" ? (
                          <label className="flex items-center gap-2 text-xs font-semibold text-amber-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isInternalComment}
                              onChange={(e) => setIsInternalComment(e.target.checked)}
                              className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-0"
                            />
                            <span>{t.internalNoteCheckbox}</span>
                          </label>
                        ) : (
                          <div />
                        )}

                        <button
                          type="submit"
                          className="py-2.5 px-5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 self-end cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{t.sendComment}</span>
                        </button>

                      </div>
                    </form>

                  </div>

                </div>

                {/* Right Side (Col Span 1): Executive Administration panel, Client details profile */}
                <div className="space-y-6">
                          {/* Box 1: Action Controls Block (Admin & Engineer Roles) */}
                  {(currentUser.role === "admin" || currentUser.role === "engineer") && (
                    <div className="bg-[#0b1224] p-5 rounded-2xl shadow-md border border-slate-800/85 space-y-4">
                      
                      <div className="border-b border-slate-800 pb-3">
                        <h3 className="font-bold text-xs text-sky-450 flex items-center gap-1.5 uppercase tracking-wider">
                          <Settings className="w-4 h-4 text-sky-400" />
                          <span>{t.adminActions}</span>
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1">{lang === "ar" ? "القرارات الفورية وتوجيه حالة بلاغات الصيانة" : "Manual override controls"}</p>
                      </div>

                      {/* Decisive Buttons Layout */}
                      <div className="grid grid-cols-2 gap-2 font-sans">
                        
                        <button
                          onClick={() => handleUpdateStatusAndNotes("accepted")}
                          className="p-2.5 bg-blue-950/40 hover:bg-blue-900/40 text-blue-400 text-xs font-bold rounded-xl border border-blue-500/10 transition text-center cursor-pointer"
                        >
                          {t.acceptTicket}
                        </button>

                        <button
                          onClick={() => handleUpdateStatusAndNotes("in_progress")}
                          className="p-2.5 bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/10 transition text-center cursor-pointer"
                        >
                          {t.status_in_progress}
                        </button>

                        <button
                          onClick={() => handleUpdateStatusAndNotes("pending_client")}
                          className="p-2.5 bg-amber-950/40 hover:bg-amber-900/40 text-amber-400 text-xs font-bold rounded-xl border border-amber-500/10 transition text-center cursor-pointer"
                        >
                          {t.reboundPending}
                        </button>

                        <button
                          onClick={() => handleUpdateStatusAndNotes("closed")}
                          className="p-2.5 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-450 text-xs font-bold rounded-xl border border-emerald-500/10 transition text-center col-span-2 cursor-pointer"
                        >
                          {t.closeTicket}
                        </button>

                      </div>

                      {/* Decisive Engineer Assignment Selector Section */}
                      <div className="space-y-2 pt-3 border-t border-slate-800/80">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                          {lang === "ar" ? "المهندس المعين للمتابعة:" : "Assigned Tech Expert:"}
                        </label>
                        
                        <div className="flex gap-2">
                          <select
                            value={selectedTicket.assignedEngineerId || ""}
                            onChange={async (e) => {
                              const engId = e.target.value;
                              const engineerObj = engineers.find(eng => eng.id === engId);
                              const engName = engineerObj 
                                ? (lang === "ar" ? engineerObj.displayNameAr : engineerObj.displayNameEn) 
                                : "";
                              try {
                                await apiRequest("/api/tickets/update-status", "POST", {
                                  ticketId: selectedTicket.id,
                                  assignedEngineerId: engId || null,
                                  assignedEngineerName: engName,
                                });
                                triggerToast(
                                  lang === "ar" 
                                    ? `تم تعيين المهندس ${engName || "ملغى"}` 
                                    : `Ticket assigned to ${engName || "unassigned"}`
                                );
                                loadApplicationData();
                              } catch (err: any) {
                                triggerToast(err.message, "error");
                              }
                            }}
                            className="bg-slate-950 border border-slate-800 p-2 text-xs font-medium text-slate-300 rounded-xl flex-1 outline-none focus:border-sky-500/40"
                          >
                            <option value="">{lang === "ar" ? "-- تحويل لمهندس دعم --" : "-- Choose Specialist --"}</option>
                            {engineers.filter(e => e.isActive).map(e => (
                              <option key={e.id} value={e.id}>
                                {lang === "ar" ? e.displayNameAr : e.displayNameEn} ({e.username})
                              </option>
                            ))}
                          </select>
                          
                          {/* Active "Assign to Me" hook for engineers to immediately grab any ticket */}
                          {currentUser.role === "engineer" && selectedTicket.assignedEngineerId !== currentUser.id && (
                            <button
                              type="button"
                              onClick={async () => {
                                const meName = lang === "ar" ? currentUser.displayNameAr : currentUser.displayNameEn;
                                try {
                                  await apiRequest("/api/tickets/update-status", "POST", {
                                    ticketId: selectedTicket.id,
                                    status: "processing", // auto move to processing/in_progress
                                    assignedEngineerId: currentUser.id,
                                    assignedEngineerName: meName,
                                  });
                                  triggerToast(
                                    lang === "ar" 
                                      ? "تم قبول البلاغ وصار في عهدتك" 
                                      : "Incident accepted and assigned to you."
                                  );
                                  loadApplicationData();
                                } catch (err: any) {
                                  triggerToast(err.message, "error");
                                }
                              }}
                              className="py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white font-bold text-[10px] rounded-xl flex items-center gap-1 shadow cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span>{lang === "ar" ? "قبول وتعيين لي" : "Accept & Assign to Me"}</span>
                            </button>
                          )}
                        </div>

                        {selectedTicket.assignedEngineerName ? (
                          <p className="text-[10px] text-emerald-400 font-bold bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/10 flex items-center gap-1.5 font-sans">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse animate-duration-1000" />
                            <span>
                              {lang === "ar" ? "المستلم الفني:" : "Assigned Specialist:"} {selectedTicket.assignedEngineerName}
                            </span>
                          </p>
                        ) : (
                          <p className="text-[10px] text-amber-400 font-bold bg-amber-950/20 p-2 rounded-lg border border-amber-500/10 flex items-center gap-1.5 font-sans">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-450 animate-pulse" />
                            <span>{lang === "ar" ? "لم يتم التعيين بعد (بانتظار مهندس)" : "No designated specialist. Open for claim."}</span>
                          </p>
                        )}
                      </div>

                      {/* Rejection Trigger logic */}
                      <div className="pt-2 font-sans">
                        {showRejectInput ? (
                          <div className="space-y-2 bg-red-950/30 p-3 rounded-xl border border-red-500/20 animate-in fade-in duration-200">
                            <label className="block text-[11px] font-bold text-red-400">{t.rejectReasonLabel}</label>
                            <input
                              type="text"
                              value={rejectionDraftReason}
                              onChange={(e) => setRejectionDraftReason(e.target.value)}
                              placeholder="..."
                              className="w-full p-2 bg-slate-950 text-slate-100 rounded-lg border border-slate-800 text-xs outline-none"
                            />
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!rejectionDraftReason) {
                                    triggerToast(lang === "ar" ? "يرجى تحديد سبب الرفض" : "Please fill reject reason", "error");
                                    return;
                                  }
                                  handleUpdateStatusAndNotes("closed", { rejectionReason: rejectionDraftReason });
                                }}
                                className="bg-red-700 hover:bg-red-800 text-white px-3 py-1.5 text-xs font-bold rounded-lg transition shrink-0 cursor-pointer"
                              >
                                {t.rejectTicket}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowRejectInput(false)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 text-xs font-bold rounded-lg transition shrink-0 cursor-pointer"
                              >
                                {t.cancel}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowRejectInput(true)}
                            className="w-full py-2 bg-red-950/40 hover:bg-red-900/30 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition text-center cursor-pointer"
                          >
                            🚨 {t.rejectTicket}
                          </button>
                        )}
                      </div>

                      {/* Admin/Engineer Internal Supervisor Memo Notes draft */}
                      <div className="pt-3 border-t border-slate-800/80 space-y-2 font-sans">
                        <label className="block text-xs font-bold text-slate-400">{t.internalNotesTitle}</label>
                        <textarea
                          rows={2}
                          value={adminInternalNotesDraft}
                          onChange={(e) => setAdminInternalNotesDraft(e.target.value)}
                          placeholder="..."
                          className="w-full p-2.5 bg-slate-950 text-slate-100 rounded-xl border border-slate-800 focus:border-sky-500/40 text-xs outline-none transition"
                        />
                        <button
                          type="button"
                          onClick={handleSaveInternalNotesOnly}
                          className="w-full py-2 bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 font-bold text-xs rounded-xl transition shadow text-center cursor-pointer"
                        >
                          {t.saveInternalNotes}
                        </button>
                      </div>

                    </div>
                  )}

                  {/* Rating/Evaluation Widget for Closed Tickets */}
                  {selectedTicket.status === "closed" && selectedTicket.assignedEngineerName && (
                    <div className="bg-[#0b1224] p-5 rounded-2xl shadow-md border border-slate-800/80 space-y-4 font-sans">
                      <div className="border-b border-slate-800 pb-3">
                        <h3 className="font-bold text-xs text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                          <span>{t.rateEngineerTitle}</span>
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {lang === "ar" 
                            ? `تقييم أداء المهندس الفني: ${selectedTicket.assignedEngineerName}`
                            : `Evaluation of engineer performance: ${selectedTicket.assignedEngineerName}`}
                        </p>
                      </div>

                      {selectedTicket.ratingValue !== undefined ? (
                        /* Display Existing Submitted Rating */
                        <div className="space-y-3">
                          <div>
                            <span className="text-slate-400 text-[10px] block">{t.ratingSubmittedLabel}</span>
                            <div className="flex items-center gap-1 mt-1.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-5 h-5 ${
                                    star <= (selectedTicket.ratingValue || 0)
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-slate-705"
                                  }`}
                                />
                              ))}
                              <span className="text-xs font-bold text-slate-200 ml-1.5 mt-0.5 font-mono bg-amber-950/40 border border-amber-500/10 px-2 py-0.5 rounded-md">
                                {selectedTicket.ratingValue} / 5
                              </span>
                            </div>
                          </div>

                          {selectedTicket.ratingFeedback && (
                            <div>
                              <span className="text-slate-400 text-[10px] block">{lang === "ar" ? "تعليق وتقييم العميل ووصفه:" : "Client description/review:"}</span>
                              <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 mt-1.5">
                                <p className="text-xs text-amber-100 italic leading-relaxed">
                                  {selectedTicket.ratingFeedback}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : currentUser.role === "client" ? (
                        /* Display Form to let Client rate the ticket */
                        <div className="space-y-4">
                          <div>
                            <span className="text-slate-300 text-xs font-semibold block mb-1.5">{t.starRatingLabel}</span>
                            <div className="flex items-center gap-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  type="button"
                                  key={star}
                                  onClick={() => setRatingInputStars(star)}
                                  className="focus:outline-none transition-transform hover:scale-125 cursor-pointer"
                                >
                                  <Star
                                    className={`w-6 h-6 transition-all ${
                                      star <= ratingInputStars
                                        ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                                        : "text-slate-600 hover:text-amber-500"
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-slate-300 text-xs font-semibold block">{t.ratingFeedbackLabel}</label>
                            <textarea
                              rows={3}
                              value={ratingInputFeedback}
                              onChange={(e) => setRatingInputFeedback(e.target.value)}
                              placeholder={t.ratingFeedbackPlaceholder}
                              className="w-full p-2.5 bg-slate-950 text-slate-150 rounded-xl border border-slate-800 focus:border-amber-500/40 text-xs outline-none transition"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleSendRating}
                            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-950/50 transition duration-200 cursor-pointer"
                          >
                            ⭐ {t.submitRatingBtn}
                          </button>
                        </div>
                      ) : (
                        /* Awaiting rating placeholder */
                        <p className="text-xs text-slate-500 italic mt-1 bg-slate-950/20 p-3 rounded-xl border border-slate-900">
                          {t.noRatingProvidedLabel}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Box 2: Incident Metadata details and Contacts */}
                  <div className="bg-[#0b1224] p-5 rounded-2xl shadow-md border border-slate-800/80 space-y-3.5">
                    
                    <div className="b-b border-b border-slate-800 pb-3">
                      <h3 className="font-bold text-xs text-sky-400 uppercase tracking-wider">
                        {lang === "ar" ? "تفاصيل حالة وإجراءات البلاغ" : "Ticket Status & Actions"}
                      </h3>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      
                      <div>
                        <span className="text-slate-500 text-[10px] block">{t.clientName}</span>
                        <strong className="text-slate-200 block text-xs mt-0.5">
                          {lang === "ar" ? selectedTicket.clientNameAr : selectedTicket.clientNameEn}
                        </strong>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] block">{t.createdAt}</span>
                        <span className="text-slate-400 font-mono block mt-0.5 text-xs">
                          {new Date(selectedTicket.createdAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
                        </span>
                      </div>

                      {selectedTicket.assignedAt && (
                        <div>
                          <span className="text-slate-500 text-[10px] block">{t.assignedAtLabel}</span>
                          <span className="text-slate-350 font-mono block mt-0.5 text-xs text-emerald-400 font-semibold">
                            {new Date(selectedTicket.assignedAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
                          </span>
                        </div>
                      )}

                      {selectedTicket.closedAt && (
                        <div>
                          <span className="text-slate-500 text-[10px] block">{t.closedAtLabel}</span>
                          <span className="text-slate-350 font-mono block mt-0.5 text-xs text-red-400 font-semibold">
                            {new Date(selectedTicket.closedAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
                          </span>
                        </div>
                      )}

                      {selectedTicket.assignedAt && selectedTicket.closedAt && (
                        <div className="bg-emerald-950/25 border border-emerald-500/15 p-2.5 rounded-xl">
                          <span className="text-emerald-450 text-[10px] uppercase tracking-wider block font-bold">
                            {lang === "ar" ? "الزمن المستغرق لحل البلاغ:" : "Duration to solve issue:"}
                          </span>
                          <span className="text-slate-200 text-xs font-mono font-bold block mt-1">
                            {(() => {
                              const diffMs = new Date(selectedTicket.closedAt).getTime() - new Date(selectedTicket.assignedAt).getTime();
                              const diffMins = Math.floor(diffMs / 60000);
                              if (diffMins < 1) return lang === "ar" ? "أقل من دقيقة واحدة" : "Less than a minute";
                              if (diffMins < 60) return lang === "ar" ? `${diffMins} دقيقة` : `${diffMins} minutes`;
                              const diffHours = Math.floor(diffMins / 60);
                              const remMins = diffMins % 60;
                              return lang === "ar" 
                                ? `${diffHours} ساعة و ${remMins} دقيقة` 
                                : `${diffHours}h ${remMins}m`;
                            })()}
                          </span>
                        </div>
                      )}

                      <div>
                        <span className="text-slate-500 text-[10px] block">{t.status}</span>
                        <span className="font-bold uppercase text-sky-400 text-xs block mt-0.5">
                          {lang === "ar" ? t[`status_${selectedTicket.status}`] || selectedTicket.status : selectedTicket.status}
                        </span>
                      </div>

                      {/* Display warning reminder of confidentiality */}
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-850/80 text-[11px] text-slate-400">
                        <p>
                          {lang === "ar"
                            ? "جميع الردود والصور المتبادلة في هذا البلاغ موثقة بسجل أنشطة الأمان ومتاحة فقط لأطراف المشكلة الدعم الفني والعميل مباشرة."
                            : "Incidents transaction parameters are covered strictly under technical SLAs and isolated vaults."}
                        </p>
                      </div>

                    </div>

                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* =========================================
          MODAL VIEW A: SYSTEM FILE INCIDENT FORM (CLIENTS ROLE)
          ========================================= */}
      {showCreateTicketModal && (
        <div className="fixed inset-0 bg-[#0f1520]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div
            id="create-ticket-modal-inner"
            className="bg-white max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col my-auto"
          >
            <div className="bg-gradient-to-r from-blue-700 to-sky-600 p-5 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-sm text-white">{t.newTicketBtn}</h3>
              <button
                onClick={() => setShowCreateTicketModal(false)}
                className="text-white hover:opacity-85 font-mono text-xl cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.ticketTitle} *</label>
                <input
                  type="text"
                  required
                  placeholder={lang === "ar" ? "يرجى كتابة عنوان مختصر للمشكلة" : "Subject title of technical incident"}
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-xs text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.urgency} *</label>
                <select
                  value={newTicketPriority}
                  onChange={(e) => setNewTicketPriority(e.target.value as TicketPriority)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 font-bold text-xs text-slate-900 bg-white"
                >
                  <option value="low">{t.priority_low}</option>
                  <option value="medium">{t.priority_medium}</option>
                  <option value="high">{t.priority_high}</option>
                  <option value="critical">{t.priority_critical}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.reporterPhoneLabelRequired}</label>
                <input
                  type="text"
                  required
                  placeholder={lang === "ar" ? "مثال: 05xxxxxxx" : "e.g., +9665xxxxxxx"}
                  value={newTicketReporterPhone}
                  onChange={(e) => setNewTicketReporterPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-xs text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.problemDescription} *</label>
                <textarea
                  rows={4}
                  required
                  placeholder={lang === "ar" ? "يرجى التوضيح من متى تظهر المشكلة، ورسالة الخطأ إن وجدت، والخطوات لإعادة تكرار المشكلة..." : "Provide detailed troubleshooting information..."}
                  value={newTicketDescription}
                  onChange={(e) => setNewTicketDescription(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-xs text-slate-900 bg-white"
                />
              </div>

              {/* Advanced Attachment Module with Drag/Drop emulation */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.attachments}</label>
                <div className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-4 text-center cursor-pointer bg-slate-50 transition relative">
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    ref={fileInputRef}
                    onChange={(e) => handleFileChange(e, true)}
                  />
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <Paperclip className="w-8 h-8 text-slate-400" />
                    <span className="font-bold text-[11px] text-slate-600">{t.dragDropHelp}</span>
                    <span className="text-[10px] text-slate-400 block">JPEG, PNG, PDF (Max 5MB)</span>
                  </div>
                </div>

                {/* Attached File Indicator */}
                {attachedFile && (
                  <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between">
                    <span className="font-bold truncate max-w-[280px] text-[11px]">{attachedFile.fileName}</span>
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="text-emerald-800 hover:text-black font-semibold text-xs"
                    >
                      {lang === "ar" ? "حذف" : "Remove"}
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setShowCreateTicketModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition"
                >
                  {t.save}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL VIEW B-2: REGISTER DIRECT ENGINEER ACCOUNT (ADMIN ONLY)
          ========================================= */}
      {showEngineerModal && (
        <div className="fixed inset-0 bg-[#070b14]/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div
            id="engineer-crud-modal-inner"
            className="bg-[#0b1224] max-w-md w-full rounded-2xl shadow-2xl overflow-hidden border border-sky-500/25 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col my-auto"
          >
            <div className="bg-[#0f1a30] p-5 text-white flex items-center justify-between border-b border-slate-800/80 shrink-0">
              <h3 className="font-bold text-sm text-sky-400 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-emerald-400" />
                <span>{editingEngineer ? (lang === "ar" ? "تعديل بيانات المهندس" : "Edit Engineer Details") : (lang === "ar" ? "تسجيل مَلف مهندس جديد" : "Register System Engineer")}</span>
              </h3>
              <button
                onClick={() => setShowEngineerModal(false)}
                className="text-slate-400 hover:text-white font-mono text-xl cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveEngineerForm} className="p-5 sm:p-6 space-y-4 text-xs font-mono overflow-y-auto flex-1">
              {engineerFormError && (
                <div className="p-3 bg-red-950/40 border border-red-500/35 text-red-300 rounded-2xl text-xs">
                  {engineerFormError}
                </div>
              )}

              <p className="text-[11px] text-slate-400 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60 leading-relaxed font-sans">
                {lang === "ar"
                  ? "مخصص لإعداد حساب مهندس لتلقي وقبوب البلاغات الفنية مباشرة مَع تعيين اسم مستخدم وكلمة سر للتشغيل."
                  : "Configure individual engineer user accounts with active login authorizations to manage incoming CRM pipelines."}
              </p>

              <div className="font-sans">
                <label className="block font-semibold mb-1.5 text-slate-300">{lang === "ar" ? "الاسم الكريم (بالعربية) *" : "Engineer Name (Arabic) *"}</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: المهندس أحمد الراشد"
                  value={engineerFormDisplayNameAr}
                  onChange={(e) => setEngineerFormDisplayNameAr(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-xs text-white"
                />
              </div>

              <div className="font-sans">
                <label className="block font-semibold mb-1.5 text-slate-300">{lang === "ar" ? "الاسم الكريم (بالإنجليزية) *" : "Engineer Name (English) *"}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineer Ahmed"
                  value={engineerFormDisplayNameEn}
                  onChange={(e) => setEngineerFormDisplayNameEn(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
                <div>
                  <label className="block font-semibold mb-1.5 text-slate-300">{t.username} *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. eng_ahmed"
                    value={engineerFormUsername}
                    onChange={(e) => setEngineerFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1.5 text-slate-300">{t.password} *</label>
                  <input
                    type="text"
                    required
                    placeholder="••••••••"
                    value={engineerFormPassword}
                    onChange={(e) => setEngineerFormPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/85 flex justify-end gap-2.5 font-sans">
                <button
                  type="button"
                  onClick={() => setShowEngineerModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 bg-transparent border border-slate-800 hover:text-white rounded-xl transition cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white rounded-xl font-bold transition shadow-md shadow-emerald-950/40 cursor-pointer"
                >
                  {t.save}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL VIEW B: CLIENT CRUDS (STAFF ONLY)
          ========================================= */}
      {showClientModal && (
        <div className="fixed inset-0 bg-[#0f1520]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div
            id="client-crud-modal-inner"
            className="bg-white max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-205 max-h-[90vh] flex flex-col my-auto"
          >
            <div className="bg-gradient-to-r from-[#0f1520] to-blue-900 p-5 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-sm text-white">
                {editingClient ? t.editClientTitle : t.addClientBtn}
              </h3>
              <button
                onClick={() => setShowClientModal(false)}
                className="text-white hover:opacity-85 font-mono text-xl cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveClientForm} className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {clientFormError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                  {clientFormError}
                </div>
              )}

              <p className="text-[11px] text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-100">
                {t.clientFormHelp}
              </p>

              {/* Group Name inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">{t.companyAr} *</label>
                  <input
                    type="text"
                    required
                    placeholder="مؤسسة التقنية العالية"
                    value={clientFormCompanyAr}
                    onChange={(e) => setClientFormCompanyAr(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-1 outline-none text-xs text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">{t.companyEn} *</label>
                  <input
                    type="text"
                    required
                    placeholder="High Tech Est."
                    value={clientFormCompanyEn}
                    onChange={(e) => setClientFormCompanyEn(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-1 outline-none text-xs text-slate-900 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">{t.displayNameAr} *</label>
                  <input
                    type="text"
                    required
                    placeholder="م. محمد الودعاني"
                    value={clientFormDisplayNameAr}
                    onChange={(e) => setClientFormDisplayNameAr(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-1 outline-none text-xs text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">{t.displayNameEn} *</label>
                  <input
                    type="text"
                    required
                    placeholder="Eng. Mohammed"
                    value={clientFormDisplayNameEn}
                    onChange={(e) => setClientFormDisplayNameEn(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-1 outline-none text-xs text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Contact communications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">{t.email}</label>
                  <input
                    type="email"
                    placeholder="contact@company.com"
                    value={clientFormEmail}
                    onChange={(e) => setClientFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-1 outline-none text-xs text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">{t.phone}</label>
                  <input
                    type="text"
                    placeholder="+9665..."
                    value={clientFormPhone}
                    onChange={(e) => setClientFormPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-1 outline-none text-xs text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Login parameters setup */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <span className="font-bold text-[11px] text-blue-750 block">🔐 إعدادات حساب تسجيل الدخول للمنظومة</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-700">{t.username} *</label>
                    <input
                      type="text"
                      required
                      disabled={!!editingClient}
                      placeholder="client_name"
                      value={clientFormUsername}
                      onChange={(e) => setClientFormUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl disabled:bg-slate-200 focus:ring-1 outline-none text-xs font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-700">{t.password} *</label>
                    <input
                      type="text"
                      required
                      placeholder="pass123..."
                      value={clientFormPassword}
                      onChange={(e) => setClientFormPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-1 outline-none text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 font-bold text-xs">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow transition"
                >
                  {t.save}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL VIEW C: PRINTABLE EXCEL/PDF INCIDENT EXPORT VIEW
          ========================================= */}
      {showExportPDFView && selectedTicket && (
        <div className="fixed inset-0 bg-[#0f1520]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div
            id="print-export-modal-inner"
            className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden text-xs my-8 shrink-0"
          >
            {/* Header control buttons */}
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <span className="font-bold text-xs">{lang === "ar" ? "معاينة الطباعة وتصدير PDF المستندي" : "Export Diagnostic Data PDF Layout"}</span>
              
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>{lang === "ar" ? "اطبع المستند" : "Trigger system default Print"}</span>
                </button>
                <button
                  onClick={() => setShowExportPDFView(false)}
                  className="py-1.5 px-3.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition"
                >
                  {t.cancel}
                </button>
              </div>
            </div>

            {/* Print Material frame */}
            <div className="p-8 space-y-6" id="printable-area-diagnostics">
              
              <div className="flex justify-between items-start border-b border-slate-300 pb-5">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-950">{t.appName}</h1>
                  <p className="text-xs text-slate-500 mt-1">{t.subName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">منصة تقارير الصيانة الرقمية للعملاء</p>
                </div>
                <div className="text-left">
                  <span className="font-mono text-slate-500 font-bold tracking-widest text-lg">TK-#{selectedTicket.id}</span>
                  <p className="text-[10px] text-slate-400 mt-1">{lang === "ar" ? "تاريخ التصدير" : "Date of Export"}</p>
                  <span className="text-xs font-mono font-bold text-slate-700 block">{new Date().toISOString().substring(0, 10)}</span>
                </div>
              </div>

              {/* Sub-grid of status and details */}
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <span className="text-[10px] block text-slate-400 font-semibold">{t.ticketId}</span>
                  <span className="font-mono font-bold text-sm text-slate-900 block mt-1">TK-{selectedTicket.id}</span>
                </div>
                <div>
                  <span className="text-[10px] block text-slate-400 font-semibold">{t.urgency}</span>
                  <span className="font-bold text-slate-800 block mt-1 uppercase">
                    {lang === "ar" ? t[`priority_${selectedTicket.priority}`] : selectedTicket.priority}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] block text-slate-400 font-semibold">{t.status}</span>
                  <span className="font-bold text-blue-700 block mt-1 uppercase">
                    {lang === "ar" ? t[`status_${selectedTicket.status}`] : selectedTicket.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] block text-slate-400 font-semibold">{t.clientName}</span>
                  <strong className="text-slate-900 block mt-1 truncate">
                    {lang === "ar" ? selectedTicket.clientNameAr : selectedTicket.clientNameEn}
                  </strong>
                </div>
                {selectedTicket.assignedEngineerName && (
                  <div>
                    <span className="text-[10px] block text-slate-400 font-semibold">{t.assignedEngineer}</span>
                    <strong className="text-emerald-700 block mt-1 truncate">
                      {selectedTicket.assignedEngineerName}
                    </strong>
                  </div>
                )}
                {selectedTicket.reporterPhone && (
                  <div>
                    <span className="text-[10px] block text-slate-400 font-semibold">{t.reporterPhoneLabel}</span>
                    <strong className="text-slate-900 font-mono block mt-1">
                      {selectedTicket.reporterPhone}
                    </strong>
                  </div>
                )}
              </div>

              {/* Title and Statement description */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{t.ticketTitle}</span>
                <h3 className="text-sm font-bold text-slate-900 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">{selectedTicket.title}</h3>
                
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider pt-2">{t.problemDescription}</span>
                <p className="text-xs p-4 bg-slate-50 border border-slate-200 rounded-xl leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Append comments feed for legal records if they exist */}
              {selectedTicket.comments.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">سجل المحاضر والتعقيبات (Replies & Actions Log)</span>
                  <div className="space-y-2">
                    {selectedTicket.comments
                      .filter(com => !com.isInternal)
                      .map((com) => (
                        <div key={com.id} className="border-b border-slate-200 pb-3">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                            <span>{com.userName} ({com.userRole === "admin" ? "Support Tech" : "Customer"})</span>
                            <span className="font-mono">{new Date(com.createdAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}</span>
                          </div>
                          <p className="text-xs text-slate-700 italic leading-relaxed">{com.commentText}</p>
                        </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejection / Hold causes */}
              {selectedTicket.rejectionReason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-[11px]">
                  <strong className="block mb-1 font-bold">⚠️ سبب الرفض والتحفظ المحدد من الدعم:</strong>
                  <p>{selectedTicket.rejectionReason}</p>
                </div>
              )}

              {/* Security Seal Verification stamp */}
              <div className="border-t border-slate-350 pt-6 flex items-center justify-between text-[10px] text-slate-400">
                <p>مُولد تلقائياً عبر نظام وبوابة علاقات عملاء شركة الخدمات التقنية الشاملة</p>
                <span className="font-mono font-bold text-slate-600 block">SECURE SHA256-AUTHENTICATED VOUCHER</span>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// Minimal helper to toggle Left/Right layout arrows dynamically
function ChevronLeftOrRight({ lang, isBackBtn = false }: { lang: AppLanguage; isBackBtn?: boolean }) {
  if (lang === "ar") {
    return isBackBtn ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />;
  } else {
    return isBackBtn ? <ChevronRight className="w-3.5 h-3.5 rotate-180" /> : <ChevronRight className="w-3.5 h-3.5" />;
  }
}

