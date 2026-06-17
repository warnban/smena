export type PendingActionType =
  | "record_payment"
  | "extend_stay"
  | "process_refund"
  | "create_booking"
  | "update_booking_status";

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

export type AssistantChatResponse = {
  conversationId: string;
  reply: string;
  confirmation?: AssistantConfirmation;
  faqEmpty?: boolean;
};
