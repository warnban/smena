/**
 * Генерирует templates/guest-forms/hotel-rules.docx
 * Запуск: node scripts/generate-hotel-rules-template.mjs
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
const OUT = path.join(__dirname, "..", "templates", "guest-forms", "hotel-rules.docx");

const FONT = "Times New Roman";
const SZ = 17; // ~8.5 pt
const SZ_TITLE = 24;
const SZ_SECTION = 18;
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
    spacing: { before: opts.before ?? 0, after: opts.after ?? 50, line: 215 },
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

function sectionTitle(text) {
  return para([txt(text, { size: SZ_SECTION, bold: true })], { before: 70, after: 40 });
}

function bullet(text) {
  return para([txt(`• ${text}`)], { after: 35 });
}

function ruleParagraph(text) {
  return para([txt(text)], { after: 45 });
}

const prohibited = [
  "Портить имущество {hotel_name} и общего пользования.",
  "Нарушать тишину с 23:00 до 07:00.",
  "Приводить посетителей без согласования с администрацией.",
  "Распивать алкоголь, употреблять наркотические средства, курить в помещениях и на прилегающей территории (в т.ч. детских площадках), кроме специально отведённых мест, если они обозначены.",
  "Находиться в состоянии алкогольного и/или наркотического опьянения в помещениях и на прилегающей территории.",
  "Передавать ключи (карты доступа) посторонним лицам.",
  "Менять номер (место) без уведомления администрации.",
  "Хранить легковоспламеняющиеся вещества, оружие, наркотики, химические и радиоактивные вещества.",
  "Нарушать законодательство РФ, в том числе нормы гражданского и уголовного законодательства.",
  "Содержать животных и птиц без согласования с администрацией, если иное не предусмотрено правилами конкретного объекта.",
  "Проживать несовершеннолетним без сопровождения законных представителей. При самостоятельном заселении лиц младше 18 лет — при наличии документа, удостоверяющего личность, и нотариально заверенного согласия родителей (законных представителей) на заключение договора и самостоятельное проживание.",
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
                    para([ph("{hotel_legal_name}")], { align: AlignmentType.RIGHT, after: 35 }),
                    para([ph("{hotel_city}"), txt(", "), ph("{hotel_address}")], { align: AlignmentType.RIGHT, after: 35 }),
                    para([txt("Сайт: ", { size: SZ }), ph("{hotel_website}")], { align: AlignmentType.RIGHT, after: 35 }),
                    para([txt("Тел.: ", { size: SZ }), ph("{hotel_phone}")], { align: AlignmentType.RIGHT, after: 0 }),
                  ],
                  { width: 4860, borders: headerLine }
                ),
              ],
            }),
          ],
        }),

        para([txt("Правила проживания", { size: SZ_TITLE, bold: true })], {
          align: AlignmentType.CENTER,
          before: 80,
          after: 60,
        }),

        sectionTitle("1. Заселение и документы"),
        ruleParagraph(
          "При заселении необходимо предъявить документ, удостоверяющий личность (паспорт гражданина РФ или иной документ, предусмотренный законом). Иностранные граждане обязаны предоставить документы для миграционного учёта: паспорт, миграционную карту, визу (при необходимости) и иные документы по требованию законодательства РФ."
        ),
        ruleParagraph(
          "В соответствии с правилами миграционного учёта {hotel_name} ({hotel_legal_name}) передаёт сведения о месте пребывания иностранного гражданина в органы МВД России в течение 24 часов с момента заселения. Для оформления учёта необходимо подписать согласие на обработку персональных данных."
        ),

        sectionTitle("2. Время заезда и выезда"),
        ruleParagraph("Стандартное время: заезд — с 14:00, выезд — до 12:00."),
        ruleParagraph(
          "Продление номера (места) и оплата производятся до 12:00 дня. При неоплате в установленный срок администрация вправе предложить иное место или отказать в продлении при отсутствии свободных мест."
        ),
        ruleParagraph(
          "Ранний заезд: с 06:00 — доплата 50% от суточной стоимости места; до 06:00 — 100% от суточной стоимости (при наличии мест)."
        ),
        ruleParagraph(
          "Поздний выезд: до 19:00 — доплата 50% от суточной стоимости места; после 19:00 — 100% от суточной стоимости."
        ),

        sectionTitle("3. Досрочный выезд и скидки"),
        ruleParagraph(
          "При выезде до окончания оплаченного периода стоимость пересчитывается по действующим тарифам с учётом фактического срока проживания и применимых скидочных категорий (если скидка была предоставлена при единовременной оплате на определённый срок). Неиспользованная предоплата возвращается по правилам возврата и законодательству РФ."
        ),

        sectionTitle("4. Ключ и залог"),
        ruleParagraph(
          "При заселении выдаётся ключ (магнитная карта доступа) под залог в размере, установленном администрацией; при выезде залог возвращается при сдаче ключа и отсутствии задолженности и претензий по имуществу."
        ),

        sectionTitle("5. Уборка и бельё"),
        ruleParagraph(
          "При длительном проживании постельное бельё меняется не реже 1 раза в 7 дней, полотенца — не реже 1 раза в 3 дня, если иной порядок не согласован с администрацией."
        ),

        sectionTitle("6. Личные вещи"),
        ruleParagraph(
          "Администрация не несёт ответственности за ценные вещи и документы, оставленные без присмотра. Для хранения рекомендуется использовать индивидуальные ящики (локеры), если они предусмотрены."
        ),

        sectionTitle("7. Запрещается"),
        ...prohibited.map((item) => bullet(item)),

        sectionTitle("8. Ответственность за нарушения"),
        ruleParagraph(
          "За нарушение правил проживания администрация вправе применить меры в соответствии с действующим прейскурантом (в т.ч. оплату ущерба), выдать предупреждение или расторгнуть договор размещения при грубом или неоднократном нарушении."
        ),
        ruleParagraph(
          "За нарушение общественного порядка (громкие звуки в часы тишины, нецензурная лексика, оскорбления, проявление нетерпимости) администрация вправе потребовать прекращения нарушения; при повторном или грубом нарушении — расторгнуть договор размещения. Возврат неиспользованной предоплаты — по правилам возврата и законодательству РФ."
        ),
        ruleParagraph(
          "При порче имущества {hotel_name} гость обязан возместить ущерб в полном объёме в соответствии с прейскурантом и законодательством РФ."
        ),
        ruleParagraph(
          "Администрация вправе отказать в размещении при отсутствии свободных мест, непредоставлении документов, отказе от оплаты, состоянии, опасном для окружающих, нарушении правил при предыдущих заездах и в иных случаях, предусмотренных законом."
        ),

        sectionTitle("9. Хранение вещей после выезда"),
        ruleParagraph(
          "После выезда гость вправе бесплатно оставить вещи на ресепшн до утра следующего дня. Дальнейшее хранение — по тарифам администрации. Забытые вещи хранятся не более 30 суток, после чего могут быть утилизированы в порядке, установленном законом и внутренними правилами."
        ),

        sectionTitle("10. Срок действия"),
        ruleParagraph(
          "Настоящие правила действуют 6 (шесть) месяцев с даты подписания и распространяются на последующие заезды гостя в {hotel_name}, если иное не согласовано при бронировании."
        ),

        para([txt("Желаем комфортного проживания! По любым вопросам обращайтесь к администрации.", { italics: true })], {
          before: 60,
          after: 80,
        }),

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
                cell(para([txt("Номер / период", { bold: true })], { after: 0 }), { borders: thinBorders }),
                cell(
                  para([txt("№ ", { size: SZ }), ph("{room_number}"), txt(" · ", { size: SZ }), ph("{stay_period}")], { after: 0 }),
                  { borders: thinBorders }
                ),
              ],
            }),
          ],
        }),

        para([
          txt(
            "С действующими тарифами на услуги размещения, тарифами на возмещение ущерба и настоящими правилами проживания ознакомлен(а) и согласен(на)."
          ),
        ], { before: 80, after: 80 }),

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
