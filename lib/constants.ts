// Цветовые карты и лейблы — перенос из макета asmena2

export const ROOM_KIND_LABELS: Record<string, string> = {
  private: "Номер",
  dorm: "Общая комната",
};

export const DORM_GENDER_LABELS: Record<string, string> = {
  male: "Мужская",
  female: "Женская",
  mixed: "Общая",
};

export const ROOM_STATUS: Record<string, { color: string; label: string; bg: string }> = {
  available:   { color: "#10B981", label: "Доступен", bg: "#F0FDF4" },
  occupied:    { color: "#EF4444", label: "Занят",    bg: "#FEF2F2" },
  checkin:     { color: "#F59E0B", label: "Заезд",    bg: "#FFFBEB" },
  checkout:    { color: "#3B82F6", label: "Выезд",    bg: "#EFF6FF" },
  cleaning:    { color: "#F97316", label: "Уборка",   bg: "#FFF7ED" },
  maintenance: { color: "#9CA3AF", label: "Ремонт",   bg: "#F9FAFB" },
};

export const BOOKING_ST: Record<string, { bg: string; text: string; border: string; label: string }> = {
  new:        { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE", label: "Новая" },
  confirmed:  { bg: "#F0FDF4", text: "#059669", border: "#A7F3D0", label: "Подтверждена" },
  checkedin:  { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A", label: "Заселён" },
  checkedout: { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE", label: "Выписан" },
  cancelled:  { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA", label: "Отменена" },
};

export const SOURCE: Record<string, { bg: string; text: string; border: string; solid: string; label: string }> = {
  booking:  { bg: "#DCFCE7", text: "#166534", border: "#86EFAC", solid: "#16A34A", label: "Booking.com" },
  expedia:  { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD", solid: "#2563EB", label: "Expedia" },
  direct:   { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A", solid: "#D97706", label: "Прямое" },
  ostrovok: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5", solid: "#DC2626", label: "Ostrovok" },
  yandex:   { bg: "#FFEDD5", text: "#9A3412", border: "#FDBA74", solid: "#EA580C", label: "Яндекс" },
};

export const PM_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  cash:     { label: "Наличные",     color: "#059669", bg: "#F0FDF4", icon: "Banknote" },
  card:     { label: "Карта",        color: "#2563EB", bg: "#EFF6FF", icon: "CreditCard" },
  transfer: { label: "Перевод",      color: "#7C3AED", bg: "#F5F3FF", icon: "ArrowDownLeft" },
  ota:      { label: "OTA предопл.", color: "#D97706", bg: "#FFFBEB", icon: "Globe" },
  online:   { label: "Онлайн/СБП",   color: "#0891B2", bg: "#ECFEFF", icon: "Smartphone" },
};

export const MIG_REG_STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  not_required: { label: "Не требуется",   color: "#64748B", bg: "#F8FAFC", icon: "Shield" },
  pending:      { label: "Ожидает подачи", color: "#DC2626", bg: "#FEF2F2", icon: "ShieldAlert" },
  submitted:    { label: "Подано в МВД",   color: "#059669", bg: "#F0FDF4", icon: "ShieldCheck" },
  overdue:      { label: "Просрочено!",    color: "#DC2626", bg: "#FEF2F2", icon: "AlertOctagon" },
};

export const ROOM_CATEGORY_LABEL: Record<string, string> = {
  Single: "Одноместный",
  Double: "Двухместный",
  Family: "Семейный",
  Presidential: "Президентский",
};

export const NAV_ITEMS = [
  { group: "ОСНОВНОЕ", items: [
    { id: "dashboard", href: "/dashboard", icon: "LayoutDashboard", label: "Dashboard" },
    // Шахматка временно скрыта
    { id: "bookings", href: "/bookings", icon: "BookOpen", label: "Бронирования" },
  ]},
  { group: "ОПЕРАЦИИ", items: [
    { id: "guests", href: "/guests", icon: "Users", label: "Гости" },
    { id: "organizations", href: "/organizations", icon: "Building2", label: "Организации" },
    { id: "refunds", href: "/refunds", icon: "RotateCcw", label: "Возвраты" },
    { id: "rooms", href: "/rooms", icon: "BedDouble", label: "Номерной фонд" },
    { id: "channels", href: "/channels", icon: "Globe", label: "Менеджер каналов (OTA)" },
  ]},
  { group: "АНАЛИТИКА", items: [
    { id: "reports", href: "/reports", icon: "BarChart3", label: "Отчёты" },
    { id: "schedule", href: "/schedule", icon: "Calendar", label: "График работы" },
    { id: "housekeeping", href: "/housekeeping", icon: "Sparkles", label: "Уборка номеров" },
  ]},
  { group: "СИСТЕМА", items: [
    { id: "settings", href: "/settings", icon: "Settings", label: "Настройки" },
  ]},
];
