import type { GuestFormData } from "@/lib/guest-form";

export type PendingActionType =
  | "record_payment"
  | "extend_stay"
  | "process_refund"
  | "create_booking"
  | "checkin"
  | "checkout"
  | "relocate"
  | "sale"
  | "encashment"
  | "cancel_booking"
  | "booking_service"
  | "mig_reg"
  | "hk_complete";

export type PendingAction = {
  type: PendingActionType;
  preview: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AssistantConfirmation = {
  pendingAction: PendingAction;
  paymentMethods?: Array<{ code: string; label: string }>;
  needsPaymentMethod?: boolean;
  bookingLink?: { bookingId: string; guestName: string; roomNumber: string };
};

export type HamsterQuickAction = {
  id: string;
  label: string;
  intent: string;
};

export type HamsterChoice = {
  id: string;
  label: string;
  payload?: Record<string, unknown>;
};

export type HamsterFileRequest = {
  docType: string;
  hint: string;
  guestId?: string;
  bookingId?: string;
};

export type HamsterPrintLink = {
  label: string;
  url: string;
};

export type HamsterWorkflowFlow =
  | "idle"
  | "booking"
  | "checkin"
  | "payment"
  | "extend"
  | "refund"
  | "checkout"
  | "relocate"
  | "sale"
  | "encashment"
  | "cancel"
  | "service"
  | "mig_reg"
  | "housekeeping"
  | "print";

export type HamsterWorkflowState = {
  mode: "hamster";
  flow: HamsterWorkflowFlow;
  step: string;
  data: Record<string, unknown>;
};

export type HamsterChatResponse = {
  conversationId: string;
  reply: string;
  confirmation?: AssistantConfirmation;
  faqEmpty?: boolean;
  quickActions?: HamsterQuickAction[];
  choices?: HamsterChoice[];
  fileRequest?: HamsterFileRequest;
  printLinks?: HamsterPrintLink[];
  workflowFlow?: HamsterWorkflowFlow;
  briefing?: boolean;
};

export type AssistantChatResponse = HamsterChatResponse;

export type CheckInPayload = {
  form: GuestFormData;
  regCardSigned: boolean;
  migRegSubmitted?: boolean;
  migRegNotifNumber?: string;
  paymentMethod?: string;
  paymentAmount?: number;
  paymentNights?: number;
  paidThroughDate?: string;
  note?: string;
  discountPercent?: number;
  discountPerNight?: number;
  discountRuleId?: string;
  skipPayment?: boolean;
  channelId?: string;
  date?: string;
};
