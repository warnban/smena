/**
 * Дополнительное соглашение к договору на гостиничные услуги (изменение срока проживания).
 * Запуск: node scripts/generate-hotel-contract-amendment-template.mjs
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
const OUT = path.join(__dirname, "..", "templates", "guest-forms", "hotel-contract-amendment.docx");

const FONT = "Times New Roman";
const SZ = 17;
const SZ_SECTION = 18;

function ph(tag) {
  return new TextRun({ text: tag, font: FONT, size: SZ });
}

function txt(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: opts.size ?? SZ, bold: opts.bold, italics: opts.italics });
}

function para(children, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 45, line: 215 },
    children: Array.isArray(children) ? children : [children],
  });
}

function cell(children, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    verticalAlign: opts.verticalAlign ?? VerticalAlign.TOP,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    borders: opts.borders,
    columnSpan: opts.columnSpan,
    children: Array.isArray(children) ? children : [children],
  });
}

const thinBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
};

function sectionTitle(text) {
  return para([txt(text, { size: SZ_SECTION, bold: true })], { before: 60, after: 35 });
}

function clause(text) {
  return para([txt(text)], { after: 40 });
}

const articles = [
  {
    title: "1. Изменение срока и условий размещения",
    text: "1.1. В связи с {change_reason} срока проживания Заказчика (Потребителя) Стороны договорились изменить пункт 2.3 Договора и изложить его в следующей редакции:\n«Период проживания: {new_stay_period} ({new_nights} сут.). Дата выезда — до {check_out_time} «{new_check_out}».\n1.2. Ранее согласованный период проживания: {prev_stay_period} ({prev_nights} сут.), дата выезда — «{prev_check_out}», более не действует.\n1.3. Номер (место) размещения: № {room_number} — без изменений.\n1.4. Изменение срока проживания оформляется по инициативе Заказчика и/или по согласованию с администрацией {hotel_name} в порядке, предусмотренном Договором, правилами проживания и Правилами оказания гостиничных услуг (Постановление Правительства РФ от 18.11.2020 № 1853).",
  },
  {
    title: "2. Изменение стоимости услуг",
    text: "2.1. Стоимость услуг по Договору с учётом настоящего дополнительного соглашения составляет {new_booking_amount} (ранее — {prev_booking_amount}, изменение: {amount_delta}).\n2.2. Пересчёт произведён по действующим тарифам {hotel_name} с учётом фактического срока проживания, применимых скидочных категорий и условий, указанных в Договоре.\n2.3. На дату подписания настоящего дополнительного соглашения оплачено: {booking_paid}; остаток к оплате: {booking_balance}.\n2.4. Доплата за {change_type} срока проживания производится до {check_out_time} дня выезда, если иной порядок не согласован с администрацией.",
  },
  {
    title: "3. Возврат средств при сокращении срока",
    text: "3.1. При сокращении срока проживания неиспользованная предоплата за неоказанные услуги подлежит возврату в порядке и сроки, установленные правилами возврата {hotel_name}, Договором, настоящим дополнительным соглашением и ст. 22, 32 Закона РФ «О защите прав потребителей» (не позднее 10 календарных дней с даты предъявления соответствующего требования, если иное не установлено законом).\n3.2. Пересчёт стоимости при досрочном выезде производится по действующим тарифам с учётом фактически оказанных услуг и применимых скидочных категорий.",
  },
  {
    title: "4. Прочие условия",
    text: "4.1. Во всём остальном, что не урегулировано настоящим дополнительным соглашением, Стороны руководствуются Договором № {contract_number} от {contract_date}, правилами проживания {hotel_name}, действующими тарифами и законодательством РФ, в том числе Гражданским кодексом РФ (глава 53 «Подряд» / услуги), Законом «О защите прав потребителей», Правилами оказания гостиничных услуг.\n4.2. Заказчик подтверждает, что получил информацию об изменении срока и стоимости услуг в объёме, предусмотренном ст. 8–10 Закона «О защите прав потребителей».\n4.3. Настоящее дополнительное соглашение изменяет Договор на основании ст. 450, 452 Гражданского кодекса РФ по соглашению Сторон.",
  },
  {
    title: "5. Заключительные положения",
    text: "5.1. Настоящее дополнительное соглашение является неотъемлемой частью Договора № {contract_number} от {contract_date}.\n5.2. Соглашение составлено в двух экземплярах, имеющих одинаковую юридическую силу, по одному для каждой из Сторон.\n5.3. Вступает в силу с момента подписания Сторонами.",
  },
];

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        para([txt("Дополнительное соглашение № ", { size: SZ }), ph("{amendment_number}")], {
          align: AlignmentType.CENTER,
          before: 0,
          after: 20,
        }),
        para([txt("к Договору № ", { size: SZ }), ph("{contract_number}"), txt(" на оказание гостиничных услуг", { size: SZ })], {
          align: AlignmentType.CENTER,
          after: 20,
        }),
        para([txt("от ", { size: SZ }), ph("{contract_date}")], {
          align: AlignmentType.CENTER,
          after: 50,
        }),
        para([txt("г. ", { size: SZ }), ph("{hotel_city}"), txt("     ", { size: SZ }), ph("{print_date}")], {
          after: 60,
        }),

        para([
          txt("Исполнитель: ", { bold: true }),
          ph("{hotel_name}"),
          txt(" ("),
          ph("{hotel_legal_name}"),
          txt("), и Заказчик (Потребитель): "),
          ph("{guest_fio}"),
          txt(", именуемые в дальнейшем «Стороны», заключили настоящее дополнительное соглашение о нижеследующем:"),
        ], { after: 50 }),

        sectionTitle("Стороны"),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              children: [
                cell(para([txt("Исполнитель", { bold: true })], { after: 0 }), { width: 4680, borders: thinBorders }),
                cell(para([txt("Заказчик (Потребитель)", { bold: true })], { after: 0 }), { width: 4680, borders: thinBorders }),
              ],
            }),
            new TableRow({
              children: [
                cell(
                  [
                    para([ph("{hotel_name}"), txt(" ("), ph("{hotel_legal_name}"), txt(")")], { after: 35 }),
                    para([ph("{hotel_city}"), txt(", "), ph("{hotel_address}")], { after: 35 }),
                    para([txt("Тел.: "), ph("{hotel_phone}")], { after: 0 }),
                  ],
                  { borders: thinBorders }
                ),
                cell(
                  [
                    para([ph("{guest_fio}")], { after: 35 }),
                    para([
                      txt("Паспорт: "),
                      ph("{guest_passport}"),
                      txt(", выдан "),
                      ph("{guest_doc_issued_by}"),
                      txt(", "),
                      ph("{guest_doc_issued_date}"),
                    ], { after: 35 }),
                    para([txt("Тел.: "), ph("{guest_phone}")], { after: 0 }),
                  ],
                  { borders: thinBorders }
                ),
              ],
            }),
          ],
        }),

        para([ph("{change_summary}")], { after: 50 }),

        ...articles.flatMap((a) => [sectionTitle(a.title), ...a.text.split("\n").map((p) => clause(p))]),

        sectionTitle("6. Подписи сторон"),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              children: [
                cell(para([txt("Исполнитель", { bold: true })], { after: 0 }), { width: 4680, borders: thinBorders }),
                cell(para([txt("Заказчик", { bold: true })], { after: 0 }), { width: 4680, borders: thinBorders }),
              ],
            }),
            new TableRow({
              children: [
                cell(
                  [
                    para([txt("___________________ / _________________ /")], { after: 60 }),
                    para([txt("(подпись)              (Ф.И.О.)")], { after: 0 }),
                  ],
                  { borders: thinBorders }
                ),
                cell(
                  [
                    para([txt("___________________ / "), ph("{guest_fio}"), txt(" /")], { after: 60 }),
                    para([txt("(подпись)              (Ф.И.О.)")], { after: 0 }),
                  ],
                  { borders: thinBorders }
                ),
              ],
            }),
            new TableRow({
              children: [
                cell(para([txt("М.П. (при наличии)")], { after: 0 }), { borders: thinBorders }),
                cell(para([txt("Дата: "), ph("{print_date}")], { after: 0 }), { borders: thinBorders }),
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
