/**
 * Генерирует templates/guest-forms/hotel-services-contract.docx
 * Запуск: node scripts/generate-hotel-services-contract-template.mjs
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
const OUT = path.join(__dirname, "..", "templates", "guest-forms", "hotel-services-contract.docx");

const FONT = "Times New Roman";
const SZ = 17;
const SZ_TITLE = 24;
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

function sectionTitle(text) {
  return para([txt(text, { size: SZ_SECTION, bold: true })], { before: 60, after: 35 });
}

function clause(text) {
  return para([txt(text)], { after: 40 });
}

const articles = [
  {
    title: "1. Предмет договора",
    text: "1.1. Исполнитель обязуется по заданию Заказчика (Потребителя) оказать гостиничные услуги по временному размещению и сопутствующие услуги, предусмотренные действующими тарифами и правилами {hotel_name}, а Заказчик обязуется принять и оплатить оказанные услуги на условиях настоящего договора.",
  },
  {
    title: "2. Срок, место и условия оказания услуг",
    text: "2.1. Услуги оказываются по адресу: {hotel_city}, {hotel_address} ({hotel_name}).\n2.2. Номер (место) размещения: № {room_number}.\n2.3. Период проживания: {stay_period} ({nights} сут.).\n2.4. Время заезда — с {check_in_time}, время выезда — до {check_out_time}, если иное не согласовано с администрацией.\n2.5. Качество и состав услуг определяются Правилами оказания гостиничных услуг (Постановление Правительства РФ от 18.11.2020 № 1853), правилами проживания {hotel_name}, действующими тарифами и категорией размещения.",
  },
  {
    title: "3. Стоимость услуг и порядок расчётов",
    text: "3.1. Стоимость услуг по настоящему договору составляет {booking_amount} (на дату заключения договора).\n3.2. Оплачено: {booking_paid}; остаток к оплате: {booking_balance}.\n3.3. Окончательный расчёт производится с учётом фактически оказанных услуг, дополнительных услуг и изменений срока проживания по действующим тарифам.\n3.4. Оплата производится в рублях РФ наличным или безналичным способом, в том числе банковской картой, если иной порядок не согласован при заселении.\n3.5. Налоги и сборы включаются в стоимость либо уплачиваются в порядке, установленном законодательством РФ и применяемой системой налогообложения Исполнителя.",
  },
  {
    title: "4. Права и обязанности Исполнителя",
    text: "4.1. Исполнитель обязан: предоставить номер (место) в состоянии, пригодном для проживания; информировать Заказчика о видах, порядке и условиях оказания услуг, действующих тарифах и правилах проживания; обеспечивать сохранность и иные требования безопасности; соблюдать требования законодательства РФ, в том числе о миграционном учёте и персональных данных.\n4.2. Исполнитель вправе требовать оплаты услуг, соблюдения правил проживания и предоставления документов, необходимых для заселения и учёта; отказать в размещении на основаниях, предусмотренных законом и правилами проживания.",
  },
  {
    title: "5. Права и обязанности Заказчика (Потребителя)",
    text: "5.1. Заказчик обязан: своевременно оплачивать услуги; соблюдать правила проживания и общественный порядок; бережно относиться к имуществу Исполнителя; предоставить документ, удостоверяющий личность, и иные документы по требованию законодательства РФ.\n5.2. Заказчик вправе: получать услуги надлежащего качества и в согласованные сроки; требовать безопасности проживания; получать полную и достоверную информацию об услугах и тарифах; предъявлять претензии в порядке, установленном законодательством о защите прав потребителей.",
  },
  {
    title: "6. Изменение срока проживания и возврат средств",
    text: "6.1. При досрочном выезде стоимость пересчитывается по действующим тарифам с учётом фактического срока проживания и применимых скидочных категорий.\n6.2. Неиспользованная предоплата за неоказанные услуги возвращается в порядке и сроки, установленные правилами возврата {hotel_name}, настоящим договором и ст. 22, 32 Закона РФ «О защите прав потребителей».",
  },
  {
    title: "7. Ответственность сторон",
    text: "7.1. Стороны несут ответственность в соответствии с законодательством РФ и настоящим договором.\n7.2. Исполнитель не несёт ответственности за ценные вещи и документы, оставленные без присмотра, если иное не предусмотрено законом.\n7.3. Условия настоящего договора, ограничивающие права потребителя по сравнению с законом, недействительны.",
  },
  {
    title: "8. Защита прав потребителей и разрешение споров",
    text: "8.1. Заказчик (Потребитель) вправе обратиться с претензией к Исполнителю по адресу: {hotel_address}, e-mail: {hotel_email}, тел.: {hotel_phone}.\n8.2. Претензии по качеству услуг могут быть предъявлены в разумный срок, но не позднее установленного законом.\n8.3. Заказчик вправе обратиться в органы, уполномоченные на защиту прав потребителей, и в суд.\n8.4. Споры разрешаются путём переговоров; при недостижении согласия — в суде по правилам подсудности, установленным законодательством РФ, в том числе ст. 17 Закона «О защите прав потребителей».",
  },
  {
    title: "9. Заключительные положения",
    text: "9.1. Настоящий договор составлен в двух экземплярах, по одному для каждой из сторон, и вступает в силу с момента подписания.\n9.2. Неотъемлемой частью договора являются: правила проживания {hotel_name}, действующие тарифы, правила возврата, согласие на обработку персональных данных (при необходимости).\n9.3. Заказчик подтверждает, что до заключения договора получил информацию об услугах, тарифах и правилах проживания в объёме, предусмотренном ст. 8–10 Закона «О защите прав потребителей» и Правилами оказания гостиничных услуг.",
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
        para([txt("Договор № ", { size: SZ }), ph("{contract_number}"), txt(" на оказание гостиничных услуг", { size: SZ })], {
          align: AlignmentType.CENTER,
          before: 0,
          after: 40,
        }),
        para([txt("г. ", { size: SZ }), ph("{hotel_city}"), txt("     ", { size: SZ }), ph("{print_date}")], {
          after: 60,
        }),

        sectionTitle("Стороны договора"),

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
                    para([txt("Тел.: "), ph("{hotel_phone}")], { after: 35 }),
                    para([txt("E-mail: "), ph("{hotel_email}")], { after: 0 }),
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
                    para([txt("Адрес рег.: "), ph("{guest_registration_address}")], { after: 35 }),
                    para([txt("Тел.: "), ph("{guest_phone}")], { after: 0 }),
                  ],
                  { borders: thinBorders }
                ),
              ],
            }),
          ],
        }),

        ...articles.flatMap((a) => [sectionTitle(a.title), ...a.text.split("\n").map((p) => clause(p))]),

        sectionTitle("10. Подписи сторон"),

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
                    para([
                      txt("___________________ / "),
                      ph("{guest_fio}"),
                      txt(" /"),
                    ], { after: 60 }),
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
