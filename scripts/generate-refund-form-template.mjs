/**
 * Генерирует templates/guest-forms/refund-form.docx
 * Запуск: node scripts/generate-refund-form-template.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "templates", "guest-forms", "refund-form.docx");

const FONT = "Times New Roman";
const SZ = 20; // 10 pt — компактно на одну страницу
const SZ_TITLE = 26; // 13 pt
const SZ_HOTEL = 22;

function ph(tag) {
  return new TextRun({ text: tag, font: FONT, size: SZ });
}

function txt(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: opts.size ?? SZ, bold: opts.bold, italics: opts.italics });
}

function para(children, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 80, line: 240 },
    children: Array.isArray(children) ? children : [children],
  });
}

function cell(children, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    borders: opts.borders,
    children: Array.isArray(children) ? children : [children],
  });
}

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

const thinBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
};

const headerLine = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: "2563EB" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

const rules = [
  "Скидка предоставляется при единовременной оплате проживания на срок, установленный действующими тарифами и правилами размещения. При досрочном выезде оплата производится за фактически оказанные услуги; стоимость пересчитывается по тарифу, соответствующему фактическому сроку проживания: если фактический срок меньше оплаченного, но попадает в другую действующую скидочную категорию — применяется тариф этой категории; если фактический срок не даёт права ни на одну скидку — применяется полный тариф без скидки.",
  "О досрочном выезде гость уведомляет администрацию при первой возможности. Неиспользованная предоплата за неоказанные услуги проживания подлежит возврату за вычетом стоимости фактически оказанных услуг и иных сумм, предусмотренных договором и законодательством РФ.",
  "Возврат денежных средств осуществляется тем же способом, которым была произведена оплата (наличные или безналичный расчёт), если иное не согласовано сторонами в письменной форме (ст. 22 Закона РФ «О защите прав потребителей»). При оплате банковской картой возврат перечисляется на ту же карту в сроки, установленные банком-эмитентом.",
  "Срок возврата — не позднее 10 календарных дней с даты получения настоящего заявления и подписанного гостем бланка при наличии документов, необходимых для перечисления (при безналичном возврате).",
];

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          margin: { top: 900, right: 900, bottom: 900, left: 900 },
        },
      },
      children: [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          borders: noBorders,
          rows: [
            new TableRow({
              children: [
                cell(
                  para([txt("{hotel_name}", { size: SZ_HOTEL, bold: true })], { after: 0 }),
                  { width: 4500, borders: headerLine }
                ),
                cell(
                  [
                    para([txt("ИП ", { size: SZ }), ph("{hotel_legal_name}")], { align: AlignmentType.RIGHT, after: 40 }),
                    para([ph("{hotel_city}"), txt(", "), ph("{hotel_address}")], { align: AlignmentType.RIGHT, after: 40 }),
                    para([txt("Сайт: ", { size: SZ }), ph("{hotel_website}")], { align: AlignmentType.RIGHT, after: 40 }),
                    para([txt("E-mail: ", { size: SZ }), ph("{hotel_email}")], { align: AlignmentType.RIGHT, after: 40 }),
                    para([txt("Тел.: ", { size: SZ }), ph("{hotel_phone}")], { align: AlignmentType.RIGHT, after: 0 }),
                  ],
                  { width: 4860, borders: headerLine }
                ),
              ],
            }),
          ],
        }),

        para([txt("Бланк возврата денежных средств", { size: SZ_TITLE, bold: true })], {
          align: AlignmentType.CENTER,
          before: 120,
          after: 120,
        }),

        para([
          txt("Для оформления возврата ознакомьтесь с правилами ниже и подтвердите подписью согласие с условиями возврата неиспользованной предоплаты за услуги проживания."),
        ], { after: 100 }),

        ...rules.map((rule, i) =>
          para([txt(`${i + 1}. ${rule}`, { size: SZ })], { after: 60 })
        ),

        para([txt("Срок осуществления возврата — см. п. 4 выше.", { bold: true })], { before: 40, after: 140 }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              children: [
                cell(para([txt("Ф.И.О. гостя", { bold: true })], { after: 0 }), { width: 2800, borders: thinBorders }),
                cell(para([ph("{guest_fio}")], { after: 0 }), { width: 6560, borders: thinBorders }),
              ],
            }),
            new TableRow({
              children: [
                cell(para([txt("Контактный телефон", { bold: true })], { after: 0 }), { borders: thinBorders }),
                cell(para([ph("{guest_phone}")], { after: 0 }), { borders: thinBorders }),
              ],
            }),
            new TableRow({
              children: [
                cell(para([txt("Номер / период", { bold: true })], { after: 0 }), { borders: thinBorders }),
                cell(
                  para([txt("№ ", { size: SZ }), ph("{room_number}"), txt(" · ", { size: SZ }), ph("{stay_period}")], { after: 0 }),
                  { borders: thinBorders }
                ),
              ],
            }),
            new TableRow({
              children: [
                cell(para([txt("Дата выезда", { bold: true })], { after: 0 }), { borders: thinBorders }),
                cell(para([ph("{check_out}")], { after: 0 }), { borders: thinBorders }),
              ],
            }),
            new TableRow({
              children: [
                cell(para([txt("Реквизиты для возврата", { bold: true })], { after: 0 }), { borders: thinBorders }),
                cell(
                  para([txt("________________________________________________________", { size: SZ })], { after: 0 }),
                  { borders: thinBorders }
                ),
              ],
            }),
          ],
        }),

        para([
          txt("Сумма к возврату (заполняет администрация): ", { bold: true }),
          txt("____________________ руб."),
        ], { before: 160, after: 160 }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          borders: noBorders,
          rows: [
            new TableRow({
              children: [
                cell(
                  para([txt("С бланком и правилами возврата ознакомлен(а), условия принимаю.", { size: SZ })], { after: 0 }),
                  { width: 9360, borders: noBorders }
                ),
              ],
            }),
            new TableRow({
              children: [
                cell(
                  para([
                    txt("Подпись ", { bold: true }),
                    txt("___________________  ", { size: SZ }),
                    ph("{guest_fio}"),
                  ], { after: 0 }),
                  { borders: noBorders }
                ),
              ],
            }),
            new TableRow({
              children: [
                cell(
                  para([txt("Дата: ", { bold: true }), ph("{print_date}")], { after: 0 }),
                  { borders: noBorders }
                ),
              ],
            }),
          ],
        }),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buffer);
console.log("Created:", OUT);
