import "server-only";

import path from "path";
import fs from "fs";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { GUEST_FORM_TEMPLATES, type GuestFormId } from "@/lib/guest-print-forms";

const TEMPLATES_DIR = path.join(process.cwd(), "templates", "guest-forms");

export function guestFormTemplatePath(formId: GuestFormId): string {
  const meta = GUEST_FORM_TEMPLATES[formId];
  return path.join(TEMPLATES_DIR, meta.filename);
}

export function templateExists(formId: GuestFormId): boolean {
  return fs.existsSync(guestFormTemplatePath(formId));
}

export function renderGuestFormDocx(formId: GuestFormId, context: Record<string, string>): Buffer {
  const templatePath = guestFormTemplatePath(formId);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Шаблон не найден: ${GUEST_FORM_TEMPLATES[formId].filename}`);
  }

  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(context);

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
}
