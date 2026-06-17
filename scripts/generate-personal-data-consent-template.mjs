/**
 * Генерирует templates/guest-forms/personal-data-consent.docx
 * Запуск: node scripts/generate-personal-data-consent-template.mjs
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
const OUT = path.join(__dirname, "..", "templates", "guest-forms", "personal-data-consent.docx");

const FONT = "Times New Roman";
const SZ = 18; // 9 pt — компактно
const SZ_TITLE = 24; // 12 pt
const SZ_HOTEL = 20;

function ph(tag) {
  return new TextRun({ text: tag, font: FONT, size: SZ });
}

function txt(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: opts.size ?? SZ, bold: opts.bold, italics: opts.italics });
}

function para(children, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 60, line: 220 },
    children: Array.isArray(children) ? children : [children],
  });
}

function cell(children, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
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

function infoRow(label, valueRuns) {
  return new TableRow({
    children: [
      cell(para([txt(label, { bold: true })], { after: 0 }), { width: 3000, borders: thinBorders }),
      cell(para(valueRuns, { after: 0 }), { width: 6360, borders: thinBorders }),
    ],
  });
}

const sections = [
  {
    title: "1. Оператор персональных данных",
    body:
      "Оператор: {hotel_name} ({hotel_legal_name}), адрес: {hotel_city}, {hotel_address}, тел.: {hotel_phone}, e-mail: {hotel_email}.",
  },
  {
    title: "2. Перечень персональных данных",
    body:
      "Фамилия, имя, отчество; дата рождения; пол; гражданство; паспортные данные (вид документа, серия, номер, сведения о выдаче); адрес регистрации (места жительства); контактный телефон; адрес электронной почты; сведения о периоде и цели пребывания; иные сведения, необходимые для миграционного учёта в случаях, предусмотренных законом.",
  },
  {
    title: "3. Цели обработки",
    body:
      "Заключение и исполнение договора оказания услуг проживания; учёт и обслуживание гостей, ведение базы гостей; исполнение обязанностей по миграционному учёту и иным требованиям законодательства РФ, в том числе передача сведений в органы МВД России в установленном порядке.",
  },
  {
    title: "4. Действия с персональными данными",
    body:
      "Сбор, запись, систематизация, накопление, хранение, уточнение (обновление, изменение), использование, передача (предоставление, доступ) уполномоченным органам в случаях, предусмотренных законом, обезличивание, блокирование, удаление, уничтожение — с использованием и без использования средств автоматизации.",
  },
  {
    title: "5. Передача третьим лицам",
    body:
      "Персональные данные передаются в органы внутренних дел (МВД России) исключительно для целей миграционного учёта и в объёме, предусмотренном законодательством РФ. Передача иным третьим лицам без отдельного согласия субъекта персональных данных не осуществляется.",
  },
  {
    title: "6. Сроки хранения",
    body:
      "В течение срока проживания и не менее сроков, установленных законодательством РФ для документов миграционного учёта и ведения базы гостей, но не дольше, чем до достижения целей обработки или до отзыва настоящего согласия — если отсутствуют иные законные основания для обработки, предусмотренные ст. 6 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных».",
  },
  {
    title: "7. Отзыв согласия",
    body:
      "Согласие может быть отозвано путём письменного заявления оператору по адресу: {hotel_address}, либо на e-mail: {hotel_email}. Оператор прекращает обработку и уничтожает персональные данные в срок не более 30 (тридцати) дней с даты получения отзыва, если иное не предусмотрено законодательством РФ (в том числе обязанность хранения сведений для миграционного учёта).",
  },
];

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          margin: { top: 800, right: 800, bottom: 800, left: 800 },
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
                    para([ph("{hotel_legal_name}")], { align: AlignmentType.RIGHT, after: 40 }),
                    para([ph("{hotel_city}"), txt(", "), ph("{hotel_address}")], { align: AlignmentType.RIGHT, after: 40 }),
                    para([txt("Тел.: ", { size: SZ }), ph("{hotel_phone}")], { align: AlignmentType.RIGHT, after: 40 }),
                    para([txt("E-mail: ", { size: SZ }), ph("{hotel_email}")], { align: AlignmentType.RIGHT, after: 0 }),
                  ],
                  { width: 4860, borders: headerLine }
                ),
              ],
            }),
          ],
        }),

        para([txt("Согласие на обработку персональных данных", { size: SZ_TITLE, bold: true })], {
          align: AlignmentType.CENTER,
          before: 100,
          after: 80,
        }),

        para([
          txt(
            "Я, нижеподписавшийся(аяся), действуя свободно, своей волей и в своём интересе, в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных», даю согласие оператору персональных данных на обработку моих персональных данных на условиях, изложенных ниже."
          ),
        ], { after: 80 }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [
            infoRow("Ф.И.О.", [ph("{guest_fio}")]),
            infoRow("Дата рождения", [ph("{guest_birth_date}")]),
            infoRow("Паспорт", [
              txt("серия и № ", { size: SZ }),
              ph("{guest_passport}"),
              txt(", выдан ", { size: SZ }),
              ph("{guest_doc_issued_by}"),
              txt(", ", { size: SZ }),
              ph("{guest_doc_issued_date}"),
            ]),
            infoRow("Адрес регистрации", [ph("{guest_registration_address}")]),
            infoRow("Телефон", [ph("{guest_phone}")]),
            infoRow("Период проживания", [ph("{stay_period}")]),
          ],
        }),

        ...sections.flatMap((s) => [
          para([txt(s.title, { bold: true })], { before: 60, after: 40 }),
          para([txt(s.body)]),
        ]),

        para([
          txt(
            "Настоящее согласие действует с даты подписи до достижения целей обработки либо до его отзыва. Подтверждаю, что ознакомлен(а) с положениями ст. 14–16, 18, 21 152-ФЗ и права субъекта персональных данных мне разъяснены."
          ),
        ], { before: 60, after: 100 }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          borders: noBorders,
          rows: [
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
                cell(para([txt("Дата: ", { bold: true }), ph("{print_date}")], { after: 0 }), { borders: noBorders }),
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
