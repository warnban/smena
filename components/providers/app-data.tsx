"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import type { Hotel, StaffMember, Room, Bed, Guest, Booking, Transaction, ServiceItem, HkTask, Channel, PaymentMethodDef, RoomCategoryDef, Organization, OrganizationStay, HotelDiscountRule, TransactionCategoryDef } from "@/lib/types";
import { buildPmConfig } from "@/lib/payment-methods";
import { categoryLabel } from "@/lib/room-categories";
import { fileServeUrl } from "@/lib/file-url";
import { PM_CONFIG as LEGACY_PM } from "@/lib/constants";

interface SessionInfo {
  userId: string;
  role: string;
  email: string;
}

interface AppData {
  seat: { id: string; name: string } | null;
  session: SessionInfo | null;
  hotels: Hotel[];
  staff: StaffMember[];
  rooms: Room[];
  beds: Bed[];
  guests: Guest[];
  organizations: Organization[];
  organizationStays: OrganizationStay[];
  bookings: Booking[];
  transactions: Transaction[];
  services: ServiceItem[];
  expenses: ServiceItem[];
  paymentMethods: PaymentMethodDef[];
  roomCategories: RoomCategoryDef[];
  getCategoryLabel: (code: string) => string;
  pmConfig: Record<string, { label: string; color: string; bg: string; icon: string }>;
  hkTasks: HkTask[];
  channels: Channel[];
  hotelDiscountRules: HotelDiscountRule[];
  transactionCategories: TransactionCategoryDef[];
  loading: boolean;
  loadError: string | null;
  hotelId: string | "all";
  setHotelId: (id: string | "all") => void;
  currentUser: StaffMember | null;
  canViewAllHotels: boolean;
  canManageSettings: boolean;
  canWriteHotelOps: boolean;
  refresh: () => Promise<void>;
  /** Обновить данные без экрана «Загрузка…» (модалки не закрываются) */
  refreshSilent: () => Promise<void>;
}

const Ctx = createContext<AppData | null>(null);

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppDataProvider");
  return ctx;
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [seat, setSeat] = useState<{ id: string; name: string } | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationStays, setOrganizationStays] = useState<OrganizationStay[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [expenses, setExpenses] = useState<ServiceItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDef[]>([]);
  const [roomCategories, setRoomCategories] = useState<RoomCategoryDef[]>([]);
  const [hkTasks, setHkTasks] = useState<HkTask[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [hotelDiscountRules, setHotelDiscountRules] = useState<HotelDiscountRule[]>([]);
  const [transactionCategories, setTransactionCategories] = useState<TransactionCategoryDef[]>([]);
  const [canViewAllHotels, setCanViewAllHotels] = useState(false);
  const [canManageSettings, setCanManageSettings] = useState(false);
  const [canWriteHotelOps, setCanWriteHotelOps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hotelId, setHotelIdState] = useState<string | "all">("all");
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);

  const pmConfig = useMemo(() => {
    if (paymentMethods.length) return buildPmConfig(paymentMethods);
    return LEGACY_PM;
  }, [paymentMethods]);

  const getCategoryLabel = useCallback(
    (code: string) => categoryLabel(roomCategories, code),
    [roomCategories]
  );

  const setHotelId = useCallback((id: string | "all") => {
    setHotelIdState(id);
    try {
      localStorage.setItem("hotelId", id);
    } catch {}
  }, []);

  const applyBootstrap = useCallback((data: Record<string, unknown>) => {
    setSeat((data.seat as { id: string; name: string }) ?? null);
    setSession((data.session as SessionInfo) ?? null);
    setHotels(data.hotels as Hotel[]);
    setStaff(data.staff as StaffMember[]);
    setCurrentUser((data.currentUser as StaffMember) ?? null);
    setCanViewAllHotels(Boolean(data.canViewAllHotels));
    setCanManageSettings(Boolean(data.canManageSettings));
    setCanWriteHotelOps(Boolean(data.canWriteHotelOps));
    setRooms(data.rooms as Room[]);
    setBeds((data.beds as Bed[]) ?? []);
    setGuests(
      (data.guests as Guest[]).map((g) => ({
        ...g,
        documents: (g.documents ?? []).map((d) => ({
          ...d,
          filePath: fileServeUrl(d.filePath ?? ""),
          uploadedAt: d.uploadedAt ? new Date(d.uploadedAt as unknown as string).toISOString() : "",
        })),
      }))
    );
    setOrganizations(
      (data.organizations as Organization[]).map((o) => ({
        ...o,
        documents: (o.documents ?? []).map((d) => ({
          ...d,
          filePath: fileServeUrl(d.filePath ?? ""),
          uploadedAt: d.uploadedAt ? new Date(d.uploadedAt as unknown as string).toISOString() : "",
        })),
      }))
    );
    setOrganizationStays(
      (data.organizationStays as OrganizationStay[]).map((s) => ({
        ...s,
        checkIn: new Date(s.checkIn),
        checkOut: new Date(s.checkOut),
        rooms: (s.rooms ?? []).map((r) => ({
          ...r,
          checkIn: new Date(r.checkIn),
          checkOut: new Date(r.checkOut),
          checkedOutAt: r.checkedOutAt ? new Date(r.checkedOutAt as unknown as string) : null,
        })),
      }))
    );
    setServices((data.services as ServiceItem[]) ?? []);
    setExpenses((data.expenses as ServiceItem[]) ?? []);
    setPaymentMethods((data.paymentMethods as PaymentMethodDef[]) ?? []);
    setRoomCategories((data.roomCategories as RoomCategoryDef[]) ?? []);
    setHkTasks((data.hkTasks as HkTask[]) ?? []);
    setChannels((data.channels as Channel[]) ?? []);
    setHotelDiscountRules((data.hotelDiscountRules as HotelDiscountRule[]) ?? []);
    setTransactionCategories((data.transactionCategories as TransactionCategoryDef[]) ?? []);
    setBookings(
      (data.bookings as Booking[]).map((b) => ({
        ...b,
        checkIn: new Date(b.checkIn),
        checkOut: new Date(b.checkOut),
        checkedOutAt: b.checkedOutAt ? new Date(b.checkedOutAt as string) : null,
      }))
    );
    setTransactions(
      (data.transactions as Transaction[]).map((t) => ({
        ...t,
        date: new Date(t.date),
        cancelledAt: t.cancelledAt ? new Date(t.cancelledAt as unknown as string) : null,
      }))
    );

    const hotelsList = data.hotels as Hotel[];
    const accessibleIds: string[] =
      (data.currentUser as StaffMember)?.role === "owner"
        ? hotelsList.map((h) => h.id)
        : (data.currentUser as StaffMember)?.hotelIds ?? [];

    try {
      const saved = localStorage.getItem("hotelId");
      if (saved === "all" && data.canViewAllHotels) {
        setHotelIdState("all");
      } else if (saved && accessibleIds.includes(saved)) {
        setHotelIdState(saved);
      } else if (accessibleIds.length === 1) {
        setHotelIdState(accessibleIds[0]);
      } else if (data.canViewAllHotels) {
        setHotelIdState("all");
      } else if (accessibleIds[0]) {
        setHotelIdState(accessibleIds[0]);
      }
    } catch {}
  }, []);

  const fetchBootstrap = useCallback(async () => {
    const res = await fetch("/api/bootstrap", { cache: "no-store" });
    if (res.status === 401) {
      window.location.href = "/login";
      return null;
    }
    if (!res.ok) {
      let message = `Не удалось загрузить данные (${res.status})`;
      try {
        const err = await res.json();
        if (err.error) message = err.error;
      } catch {
        /* не JSON */
      }
      setLoadError(message);
      return null;
    }
    setLoadError(null);
    return res.json() as Promise<Record<string, unknown>>;
  }, []);

  const refreshSilent = useCallback(async () => {
    const data = await fetchBootstrap();
    if (data) applyBootstrap(data);
  }, [applyBootstrap, fetchBootstrap]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchBootstrap();
      if (data) applyBootstrap(data);
    } finally {
      setLoading(false);
    }
  }, [applyBootstrap, fetchBootstrap]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value: AppData = useMemo(
    () => ({
      seat, session, hotels, staff, rooms, beds, guests, organizations, organizationStays, bookings, transactions,
      services, expenses, paymentMethods, roomCategories, getCategoryLabel, pmConfig, hkTasks, channels, hotelDiscountRules, transactionCategories,
      loading, loadError, hotelId, setHotelId, currentUser, canViewAllHotels, canManageSettings, canWriteHotelOps, refresh, refreshSilent,
    }),
    [seat, session, hotels, staff, rooms, beds, guests, organizations, organizationStays, bookings, transactions, services, expenses, paymentMethods, roomCategories, getCategoryLabel, pmConfig, hkTasks, channels, hotelDiscountRules, transactionCategories, loading, loadError, hotelId, setHotelId, currentUser, canViewAllHotels, canManageSettings, canWriteHotelOps, refresh, refreshSilent]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
