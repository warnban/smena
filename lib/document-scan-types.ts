import type { DocTypeId } from "@/lib/document-types";

/** Ответ LLM после распознавания документа */
export type DocumentScanExtract = {
  docType: DocTypeId;
  nationality: string;
  country: string;
  isForeigner: boolean;
  lastName: string;
  firstName: string;
  middleName: string;
  gender: "M" | "F" | "";
  birthDate: string;
  birthPlace: string;
  docSeries: string;
  docNumber: string;
  docIssuedBy: string;
  docIssuedDate: string;
  docDivisionCode: string;
  docExpiry: string;
  registrationAddress: string;
  entryDate: string;
  arrivalPurpose: string;
  hasVisa: boolean;
  visa: Record<string, string> | null;
  migrationCard: Record<string, string> | null;
  confidence: number;
  warnings: string[];
};

export type DocumentScanApiResponse = {
  ok: true;
  extract: DocumentScanExtract;
  filledFields: string[];
  document: {
    id: string;
    name: string;
    filePath: string;
    type: string;
  };
  suggestedIsForeigner: boolean;
  isForeignerMismatch: boolean;
};
