import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// База отсчёта дат — текущий день (демо-данные относительно сегодня)
const TODAY = new Date();
TODAY.setHours(12, 0, 0, 0);
const d = (n) => {
  const x = new Date(TODAY);
  x.setDate(x.getDate() + n);
  return x;
};

const HOTELS = [
  { id: "h1", name: "Grand Hotel Moscow", city: "Москва", address: "Тверская ул., 1", stars: 4, phone: "+7 495 123-45-67", email: "msk@grand.ru" },
  { id: "h2", name: "Grand Hotel SPB", city: "Санкт-Петербург", address: "Невский пр., 100", stars: 4, phone: "+7 812 987-65-43", email: "spb@grand.ru" },
  { id: "h3", name: "Grand Hostel Kazan", city: "Казань", address: "Баумана ул., 5", stars: 3, phone: "+7 843 555-44-33", email: "kzn@grand.ru" },
];

const STAFF = [
  { id: "u1", name: "Анна Дмитриева", role: "owner", position: "Владелец", hotelIds: ["h1", "h2", "h3"], initials: "АД" },
  { id: "u2", name: "Иван Смирнов", role: "manager", position: "Управляющий", hotelIds: ["h1"], initials: "ИС" },
  { id: "u3", name: "Мария Попова", role: "admin", position: "Администратор", hotelIds: ["h1", "h2"], initials: "МП" },
  { id: "u4", name: "Сергей Козлов", role: "admin", position: "Администратор", hotelIds: ["h2"], initials: "СК" },
  { id: "u5", name: "Ольга Новикова", role: "staff", position: "Горничная", hotelIds: ["h1"], initials: "ОН" },
  { id: "u6", name: "Дмитрий Фёдоров", role: "manager", position: "Управляющий", hotelIds: ["h3"], initials: "ДФ" },
];

const EXPENSES = [
  { id: "e1", category: "extra", name: "Закупка белья", price: 3500, icon: "🧺", kind: "expense" },
  { id: "e2", category: "extra", name: "Хозтовары", price: 1200, icon: "🧴", kind: "expense" },
  { id: "e3", category: "extra", name: "Ремонт мелкий", price: 5000, icon: "🔧", kind: "expense" },
  { id: "e4", category: "extra", name: "Коммунальные", price: 8000, icon: "💡", kind: "expense" },
];

const PAYMENT_METHODS = [
  { code: "cash", label: "Наличные", color: "#059669", bg: "#F0FDF4", icon: "Banknote", sortOrder: 0 },
  { code: "card", label: "Карта", color: "#2563EB", bg: "#EFF6FF", icon: "CreditCard", sortOrder: 1 },
  { code: "transfer", label: "Перевод", color: "#7C3AED", bg: "#F5F3FF", icon: "ArrowDownLeft", sortOrder: 2 },
  { code: "ota", label: "OTA предопл.", color: "#D97706", bg: "#FFFBEB", icon: "Globe", sortOrder: 3 },
  { code: "online", label: "Онлайн/СБП", color: "#0891B2", bg: "#ECFEFF", icon: "Smartphone", sortOrder: 4 },
];

const SERVICES = [
  { id: "s1", category: "breakfast", name: "Завтрак (1 чел.)", price: 650, icon: "☕", kind: "service" },
  { id: "s2", category: "laundry", name: "Стирка (1 кг)", price: 380, icon: "👕", kind: "service" },
  { id: "s3", category: "laundry", name: "Экспресс-стирка", price: 650, icon: "⚡", kind: "service" },
  { id: "s4", category: "slippers", name: "Тапочки", price: 250, icon: "🩴", kind: "service" },
  { id: "s5", category: "minibar", name: "Мини-бар пополнение", price: 900, icon: "🍾", kind: "service" },
  { id: "s6", category: "parking", name: "Парковка (сутки)", price: 700, icon: "🚗", kind: "service" },
  { id: "s7", category: "transfer_srv", name: "Трансфер аэропорт", price: 2500, icon: "✈️", kind: "service" },
  { id: "s8", category: "sauna", name: "Сауна (1 час)", price: 1800, icon: "🧖", kind: "service" },
  { id: "s9", category: "extra", name: "Детская кроватка", price: 500, icon: "🛏", kind: "service" },
  { id: "s10", category: "extra", name: "Поздний выезд (+4ч)", price: 1500, icon: "🕐", kind: "service" },
];

const ROOMS = [
  { id: "r101", number: "101", category: "Single", floor: 1, status: "occupied", price: 2800, amenities: ["wifi", "tv", "кондиционер"] },
  { id: "r102", number: "102", category: "Single", floor: 1, status: "available", price: 2800, amenities: ["wifi", "tv"] },
  { id: "r103", number: "103", category: "Single", floor: 1, status: "checkin", price: 2800, amenities: ["wifi", "tv", "мини-бар"] },
  { id: "r104", number: "104", category: "Single", floor: 1, status: "cleaning", price: 2800, amenities: ["wifi", "tv"] },
  { id: "r105", number: "105", category: "Single", floor: 1, status: "available", price: 2800, amenities: ["wifi", "tv"] },
  { id: "r201", number: "201", category: "Double", floor: 2, status: "occupied", price: 4500, amenities: ["wifi", "tv", "мини-бар", "балкон"] },
  { id: "r202", number: "202", category: "Double", floor: 2, status: "checkout", price: 4500, amenities: ["wifi", "tv", "балкон"] },
  { id: "r203", number: "203", category: "Double", floor: 2, status: "available", price: 4500, amenities: ["wifi", "tv", "мини-бар"] },
  { id: "r204", number: "204", category: "Double", floor: 2, status: "occupied", price: 4500, amenities: ["wifi", "tv"] },
  { id: "r301", number: "301", category: "Family", floor: 3, status: "occupied", price: 7200, amenities: ["wifi", "tv", "балкон", "диван"] },
  { id: "r302", number: "302", category: "Family", floor: 3, status: "available", price: 7200, amenities: ["wifi", "tv", "диван"] },
  { id: "r303", number: "303", category: "Family", floor: 3, status: "maintenance", price: 7200, amenities: ["wifi", "tv", "диван"] },
  { id: "r401", number: "401", category: "Presidential", floor: 4, status: "available", price: 18000, amenities: ["wifi", "tv", "мини-бар", "балкон", "джакузи", "кухня"] },
];

const GUESTS = [
  { id: "g1", name: "Александр Петров", lastName: "Петров", firstName: "Александр", middleName: "Сергеевич", gender: "M", birthDate: "12.03.1985", birthPlace: "г. Москва", phone: "+7 916 234-56-78", email: "petrov@mail.ru", country: "Россия", nationality: "RU", isForeigner: false, docType: "rf_passport", docSeries: "4521", docNumber: "356789", docIssuedBy: "ОВД района Арбат г. Москвы", docIssuedDate: "15.06.2015", docDivisionCode: "770-001", registrationAddress: "г. Москва, ул. Арбат, д.10, кв.35", migRegRequired: false, migRegStatus: "not_required", visits: 5, preferences: "Тихий номер, верхние этажи", vip: true, totalSpent: 84000, regCardSigned: true },
  { id: "g2", name: "Maria Schmidt", lastName: "Schmidt", firstName: "Maria", middleName: "", gender: "F", birthDate: "08.11.1992", birthPlace: "Berlin, Germany", phone: "+49 176 452-37-89", email: "m.schmidt@gmail.com", country: "Германия", nationality: "DE", isForeigner: true, docType: "foreign_passport", docNumber: "C3X8Y2914", docIssuedBy: "Bundesdruckerei GmbH", docIssuedDate: "20.01.2021", docExpiry: "19.01.2031", registrationAddress: "Berlin, Hauptstraße 14, 10827", arrivalPurpose: "tourism", entryDate: "14.06.2026", migrationCard: { series: "3116", number: "4522890", entryDate: "14.06.2026" }, migRegRequired: true, migRegStatus: "submitted", migRegDeadline: "16.06.2026", migRegSubmittedAt: "15.06.2026", migRegNotifNumber: "77-2026-МУ-00142", visits: 1, preferences: "Non-smoking floor", vip: false, totalSpent: 11200, regCardSigned: true },
  { id: "g3", name: "Дмитрий Козлов", lastName: "Козлов", firstName: "Дмитрий", middleName: "Андреевич", gender: "M", birthDate: "22.07.1990", birthPlace: "г. Санкт-Петербург", phone: "+7 903 876-54-32", email: "kozlov@yandex.ru", country: "Россия", nationality: "RU", isForeigner: false, docType: "rf_passport", docSeries: "4016", docNumber: "123456", docIssuedBy: "УФМС России по г. Санкт-Петербургу", docIssuedDate: "10.08.2016", docDivisionCode: "780-001", registrationAddress: "г. Санкт-Петербург, Невский пр., д.45, кв.12", migRegRequired: false, migRegStatus: "not_required", visits: 3, preferences: "Поздний выезд 13:00", vip: false, totalSpent: 26400, regCardSigned: false },
  { id: "g4", name: "Li Wei", lastName: "Li", firstName: "Wei", middleName: "", gender: "M", birthDate: "05.04.1988", birthPlace: "Beijing, China", phone: "+86 138 0013 8000", email: "liwei@qq.com", country: "Китай", nationality: "CN", isForeigner: true, docType: "foreign_passport", docNumber: "E72943812", docIssuedBy: "Ministry of Public Security of PRC", docIssuedDate: "12.03.2022", docExpiry: "11.03.2032", registrationAddress: "Beijing, Chaoyang District, Jianguomen St. 1", arrivalPurpose: "business", entryDate: "13.06.2026", visa: { number: "V07482693", issuedBy: "Посольство РФ в Пекине", issuedDate: "01.06.2026", expiry: "01.09.2026", type: "Деловая (B)", entries: "Двукратная" }, migrationCard: { series: "2816", number: "9834521", entryDate: "13.06.2026" }, migRegRequired: true, migRegStatus: "pending", migRegDeadline: "16.06.2026", visits: 2, preferences: "High floor, city view", vip: false, totalSpent: 22400, regCardSigned: false },
  { id: "g5", name: "Елена Соколова", lastName: "Соколова", firstName: "Елена", middleName: "Владимировна", gender: "F", birthDate: "30.09.1978", birthPlace: "г. Казань", phone: "+7 926 111-22-33", email: "sokolova@mail.ru", country: "Россия", nationality: "RU", isForeigner: false, docType: "rf_passport", docSeries: "1607", docNumber: "887654", docIssuedBy: "ОВД г. Казань", docIssuedDate: "05.10.2018", docDivisionCode: "160-001", registrationAddress: "г. Москва, Кутузовский пр., д.2, кв.88", migRegRequired: false, migRegStatus: "not_required", visits: 8, preferences: "VIP, шампанское при заезде", vip: true, totalSpent: 145000, regCardSigned: true },
  { id: "g6", name: "John Blackwood", lastName: "Blackwood", firstName: "John", middleName: "", gender: "M", birthDate: "17.02.1975", birthPlace: "London, United Kingdom", phone: "+44 7700 900-123", email: "j.blackwood@gmail.com", country: "Великобр.", nationality: "GB", isForeigner: true, docType: "foreign_passport", docNumber: "842671093", docIssuedBy: "HM Passport Office", docIssuedDate: "03.09.2020", docExpiry: "02.09.2030", registrationAddress: "London, Baker Street 221B, NW1 6XE", arrivalPurpose: "tourism", entryDate: "09.06.2026", migrationCard: { series: "3011", number: "2241078", entryDate: "09.06.2026" }, migRegRequired: true, migRegStatus: "submitted", migRegDeadline: "11.06.2026", migRegSubmittedAt: "10.06.2026", migRegNotifNumber: "77-2026-МУ-00138", visits: 1, preferences: "", vip: false, totalSpent: 27000, regCardSigned: true },
  { id: "g7", name: "Ольга Иванова", lastName: "Иванова", firstName: "Ольга", middleName: "Николаевна", gender: "F", birthDate: "14.12.1969", birthPlace: "г. Москва", phone: "+7 915 333-44-55", email: "ivanova.o@mail.ru", country: "Россия", nationality: "RU", isForeigner: false, docType: "rf_passport", docSeries: "4510", docNumber: "234567", docIssuedBy: "ОВД Басманного района г. Москвы", docIssuedDate: "20.01.2010", docDivisionCode: "770-100", registrationAddress: "г. Москва, Рублёвское шоссе, д.1, кв.5", migRegRequired: false, migRegStatus: "not_required", visits: 12, preferences: "Гипоаллергенное бельё", vip: true, totalSpent: 218000, regCardSigned: true },
  { id: "g8", name: "Ahmed Hassan", lastName: "Hassan", firstName: "Ahmed", middleName: "", gender: "M", birthDate: "27.06.1983", birthPlace: "Dubai, UAE", phone: "+971 50 123-45-67", email: "a.hassan@email.ae", country: "ОАЭ", nationality: "AE", isForeigner: true, docType: "foreign_passport", docNumber: "AE8847123", docIssuedBy: "UAE Federal Authority for Identity and Citizenship", docIssuedDate: "11.02.2023", docExpiry: "10.02.2028", registrationAddress: "Dubai, Sheikh Zayed Road, Tower A, Apt. 501", arrivalPurpose: "tourism", entryDate: "14.06.2026", visa: { number: "T04893721", issuedBy: "Посольство РФ в ОАЭ", issuedDate: "05.06.2026", expiry: "05.07.2026", type: "Туристическая (Т)", entries: "Однократная" }, migrationCard: { series: "3117", number: "5512009", entryDate: "14.06.2026" }, migRegRequired: true, migRegStatus: "pending", migRegDeadline: "16.06.2026", visits: 1, preferences: "Halal meals", vip: false, totalSpent: 14000, regCardSigned: false },
];

const BOOKINGS = [
  { id: "b001", roomId: "r101", guestId: "g1", guestName: "Александр Петров", checkIn: d(-3), checkOut: d(2), checkInHour: 14, checkOutHour: 12, source: "direct", status: "checkedin", amount: 14000, guests: 1, paid: 14000, notes: "" },
  { id: "b002", roomId: "r102", guestId: "g2", guestName: "Maria Schmidt", checkIn: d(0), checkOut: d(4), checkInHour: 14, checkOutHour: 12, source: "booking", status: "confirmed", amount: 11200, guests: 1, paid: 5600, notes: "Поздний заезд" },
  { id: "b003", roomId: "r103", guestId: "g3", guestName: "Дмитрий Козлов", checkIn: d(0), checkOut: d(3), checkInHour: 14, checkOutHour: 15, source: "ostrovok", status: "new", amount: 8400, guests: 1, paid: 0, notes: "Поздний выезд +3ч" },
  { id: "b004", roomId: "r104", guestId: "g4", guestName: "Li Wei", checkIn: d(1), checkOut: d(5), checkInHour: 11, checkOutHour: 12, source: "expedia", status: "confirmed", amount: 11200, guests: 1, paid: 11200, notes: "Ранний заезд" },
  { id: "b005", roomId: "r105", guestId: "g5", guestName: "Елена Соколова", checkIn: d(3), checkOut: d(7), checkInHour: 14, checkOutHour: 12, source: "direct", status: "confirmed", amount: 11200, guests: 1, paid: 5600, notes: "VIP" },
  { id: "b006", roomId: "r201", guestId: "g6", guestName: "John Blackwood", checkIn: d(-5), checkOut: d(1), checkInHour: 14, checkOutHour: 12, source: "booking", status: "checkedin", amount: 27000, guests: 2, paid: 27000, notes: "" },
  { id: "b007", roomId: "r202", guestId: "g7", guestName: "Ольга Иванова", checkIn: d(-2), checkOut: d(0), checkInHour: 14, checkOutHour: 12, source: "direct", status: "checkedout", amount: 9000, guests: 2, paid: 9000, notes: "" },
  { id: "b008", roomId: "r203", guestId: "g8", guestName: "Ahmed Hassan", checkIn: d(2), checkOut: d(6), checkInHour: 14, checkOutHour: 12, source: "expedia", status: "confirmed", amount: 18000, guests: 2, paid: 9000, notes: "Halal" },
  { id: "b009", roomId: "r204", guestId: "g1", guestName: "Александр Петров", checkIn: d(-1), checkOut: d(3), checkInHour: 14, checkOutHour: 12, source: "direct", status: "checkedin", amount: 18000, guests: 2, paid: 18000, notes: "" },
  { id: "b010", roomId: "r301", guestId: "g5", guestName: "Елена Соколова", checkIn: d(-4), checkOut: d(2), checkInHour: 14, checkOutHour: 12, source: "yandex", status: "checkedin", amount: 43200, guests: 4, paid: 43200, notes: "VIP" },
  { id: "b011", roomId: "r302", guestId: "g3", guestName: "Дмитрий Козлов", checkIn: d(4), checkOut: d(9), checkInHour: 14, checkOutHour: 12, source: "booking", status: "confirmed", amount: 36000, guests: 3, paid: 18000, notes: "" },
  { id: "b012", roomId: "r401", guestId: "g7", guestName: "Ольга Иванова", checkIn: d(5), checkOut: d(8), checkInHour: 14, checkOutHour: 12, source: "direct", status: "confirmed", amount: 54000, guests: 2, paid: 27000, notes: "Presidential" },
  { id: "b013", roomId: "r102", guestId: "g4", guestName: "Li Wei", checkIn: d(6), checkOut: d(10), checkInHour: 14, checkOutHour: 12, source: "booking", status: "new", amount: 11200, guests: 1, paid: 0, notes: "" },
  { id: "b014", roomId: "r105", guestId: "g8", guestName: "Ahmed Hassan", checkIn: d(-6), checkOut: d(-1), checkInHour: 14, checkOutHour: 12, source: "direct", status: "checkedout", amount: 14000, guests: 1, paid: 14000, notes: "" },
  { id: "b015", roomId: "r202", guestId: "g2", guestName: "Maria Schmidt", checkIn: d(0), checkOut: d(4), checkInHour: 14, checkOutHour: 12, source: "booking", status: "confirmed", amount: 18000, guests: 2, paid: 9000, notes: "После выезда Ивановой" },
];

const TXNS = [
  { id: "tx001", date: d(-14), type: "payment", category: "accommodation", paymentMethod: "ota", amount: 9000, guestName: "Ольга Иванова", bookingId: "b007", roomNumber: "202" },
  { id: "tx002", date: d(-12), type: "payment", category: "accommodation", paymentMethod: "card", amount: 14000, guestName: "Ahmed Hassan", bookingId: "b014", roomNumber: "105" },
  { id: "tx003", date: d(-10), type: "service", category: "laundry", paymentMethod: "cash", amount: 760, guestName: "Ahmed Hassan", bookingId: "b014", roomNumber: "105" },
  { id: "tx004", date: d(-9), type: "encashment", category: "encashment", paymentMethod: "cash", amount: 12000, note: "Инкассация #1" },
  { id: "tx005", date: d(-8), type: "payment", category: "accommodation", paymentMethod: "card", amount: 27000, guestName: "John Blackwood", bookingId: "b006", roomNumber: "201" },
  { id: "tx006", date: d(-7), type: "service", category: "breakfast", paymentMethod: "cash", amount: 1300, guestName: "John Blackwood", bookingId: "b006", roomNumber: "201" },
  { id: "tx007", date: d(-5), type: "payment", category: "accommodation", paymentMethod: "card", amount: 43200, guestName: "Елена Соколова", bookingId: "b010", roomNumber: "301" },
  { id: "tx008", date: d(-4), type: "service", category: "sauna", paymentMethod: "cash", amount: 1800, guestName: "Елена Соколова", bookingId: "b010", roomNumber: "301" },
  { id: "tx009", date: d(-3), type: "payment", category: "accommodation", paymentMethod: "transfer", amount: 14000, guestName: "Александр Петров", bookingId: "b001", roomNumber: "101" },
  { id: "tx010", date: d(-3), type: "payment", category: "accommodation", paymentMethod: "transfer", amount: 18000, guestName: "Александр Петров", bookingId: "b009", roomNumber: "204" },
  { id: "tx011", date: d(-1), type: "encashment", category: "encashment", paymentMethod: "cash", amount: 8000, note: "Инкассация #2" },
  { id: "tx012", date: d(-1), type: "service", category: "transfer_srv", paymentMethod: "card", amount: 2500, guestName: "Елена Соколова", bookingId: "b010", roomNumber: "301" },
  { id: "tx013", date: d(0), type: "payment", category: "accommodation", paymentMethod: "ota", amount: 5600, guestName: "Maria Schmidt", bookingId: "b002", roomNumber: "102" },
  { id: "tx014", date: d(0), type: "service", category: "breakfast", paymentMethod: "cash", amount: 1300, guestName: "Елена Соколова", bookingId: "b010", roomNumber: "301" },
  { id: "tx015", date: d(0), type: "service", category: "laundry", paymentMethod: "card", amount: 380, guestName: "Александр Петров", bookingId: "b001", roomNumber: "101" },
];

async function main() {
  console.log("Очистка...");
  await prisma.transaction.deleteMany();
  await prisma.serviceSale.deleteMany();
  await prisma.workScheduleEntry.deleteMany();
  await prisma.salaryLedgerEntry.deleteMany();
  await prisma.dailyShiftLog.deleteMany();
  await prisma.paymentMethodDef.deleteMany();
  await prisma.hkTask.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.guestDocument.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.room.deleteMany();
  await prisma.staffOnHotel.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.service.deleteMany();
  await prisma.hotel.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.user.deleteMany();

  console.log("Пользователь и сеть (Seat)...");
  const passwordHash = await bcrypt.hash("demo123", 10);
  const owner = await prisma.user.create({
    data: {
      id: "u-owner",
      email: "demo@smena.ru",
      passwordHash,
      devPasswordPlain: "demo123",
      name: "Анна Дмитриева",
      role: "owner",
    },
  });

  const seat = await prisma.seat.create({
    data: {
      id: "seat-demo",
      name: "Grand Hotel Group",
      ownerId: owner.id,
    },
  });

  await prisma.user.update({
    where: { id: owner.id },
    data: { seatId: seat.id },
  });

  console.log("Отели...");
  for (const h of HOTELS) {
    await prisma.hotel.create({ data: { ...h, seatId: seat.id } });
  }

  console.log("Сотрудники...");
  for (const s of STAFF) {
    const userId = s.role === "owner" ? owner.id : undefined;
    await prisma.staff.create({
      data: {
        id: s.id,
        seatId: seat.id,
        userId,
        name: s.name,
        role: s.role,
        position: s.position,
        initials: s.initials,
        hotels: { create: s.hotelIds.map((hid) => ({ hotelId: hid })) },
      },
    });
  }

  console.log("Способы оплаты...");
  for (const pm of PAYMENT_METHODS) {
    await prisma.paymentMethodDef.create({ data: { ...pm, seatId: seat.id, active: true } });
  }

  console.log("Услуги и расходы...");
  for (const s of SERVICES) await prisma.service.create({ data: { ...s, seatId: seat.id, active: true } });
  for (const e of EXPENSES) await prisma.service.create({ data: { ...e, seatId: seat.id, active: true } });

  console.log("Номера...");
  for (const r of ROOMS) await prisma.room.create({ data: { ...r, hotelId: "h1" } });

  console.log("Гости...");
  for (const g of GUESTS) {
    await prisma.guest.create({
      data: {
        ...g,
        seatId: seat.id,
        visa: g.visa ?? undefined,
        migrationCard: g.migrationCard ?? undefined,
      },
    });
  }

  console.log("Сканы документов...");
  const DOCS = [
    { guestId: "g2", type: "passport", name: "passport_schmidt.pdf", size: "1.2 MB", pages: 2 },
    { guestId: "g4", type: "passport", name: "passport_liwei.pdf", size: "980 KB", pages: 2 },
    { guestId: "g6", type: "passport", name: "passport_blackwood.pdf", size: "1.1 MB", pages: 2 },
    { guestId: "g6", type: "migration_card", name: "migcard_blackwood.pdf", size: "420 KB", pages: 1 },
  ];
  for (const doc of DOCS) await prisma.guestDocument.create({ data: doc });

  console.log("Брони...");
  for (const b of BOOKINGS) await prisma.booking.create({ data: { ...b, hotelId: "h1" } });

  console.log("Транзакции...");
  for (const t of TXNS) await prisma.transaction.create({ data: { ...t, hotelId: "h1" } });

  console.log("Каналы...");
  const CHANNELS = [
    { hotelId: "h1", name: "Booking.com", code: "booking", color: "#16A34A", status: "ok", inventory: 8, rate: 4200, commission: 15, bookingsMonth: 47, revenueMonth: 185000, lastSyncMin: 2 },
    { hotelId: "h1", name: "Expedia", code: "expedia", color: "#2563EB", status: "ok", inventory: 8, rate: 4350, commission: 18, bookingsMonth: 28, revenueMonth: 98000, lastSyncMin: 5 },
    { hotelId: "h1", name: "Ostrovok", code: "ostrovok", color: "#DC2626", status: "err", inventory: 6, rate: 3900, commission: 12, bookingsMonth: 19, revenueMonth: 67000, lastSyncMin: 32 },
    { hotelId: "h1", name: "Яндекс", code: "yandex", color: "#EA580C", status: "ok", inventory: 8, rate: 4000, commission: 10, bookingsMonth: 12, revenueMonth: 43000, lastSyncMin: 8 },
  ];
  for (const ch of CHANNELS) await prisma.channel.create({ data: ch });

  console.log("Привязка OTA броней к каналам...");
  const chList = await prisma.channel.findMany({ where: { hotelId: "h1" } });
  for (const ch of chList) {
    await prisma.booking.updateMany({
      where: { hotelId: "h1", source: ch.code, channelId: null },
      data: { channelId: ch.id },
    });
  }

  console.log("Выезды с датой...");
  await prisma.booking.updateMany({
    where: { status: "checkedout", checkedOutAt: null },
    data: { checkedOutAt: new Date() },
  });

  console.log("Housekeeping...");
  const HK = [
    { hotelId: "h1", roomId: "r104", roomNumber: "104", type: "Плановая уборка (7 дней)", category: "scheduled", assignee: "Мария К.", priority: "high", status: "in_progress", time: "08:00", est: "45 мин" },
    { hotelId: "h1", roomId: "r202", roomNumber: "202", type: "Уборка после выезда", category: "checkout", assignee: "Наталья С.", priority: "high", status: "pending", time: "10:00", est: "60 мин" },
    { hotelId: "h1", roomId: "r303", roomNumber: "303", type: "Уборка после переселения", category: "relocation", assignee: "Ирина В.", priority: "normal", status: "pending", time: "11:00", est: "60 мин" },
    { hotelId: "h1", roomId: "r105", roomNumber: "105", type: "Плановая уборка (7 дней)", category: "scheduled", assignee: "Мария К.", priority: "normal", status: "done", time: "09:00", est: "30 мин" },
    { hotelId: "h1", roomId: "r301", roomNumber: "301", type: "Уборка после выезда", category: "checkout", assignee: "Наталья С.", priority: "normal", status: "pending", time: "12:00", est: "60 мин" },
    { hotelId: "h1", roomId: "r203", roomNumber: "203", type: "Плановая уборка (7 дней)", category: "scheduled", assignee: "Ирина В.", priority: "normal", status: "done", time: "07:30", est: "45 мин" },
  ];
  for (const t of HK) await prisma.hkTask.create({ data: t });

  console.log("График работы (демо неделя)...");
  const weekStart = new Date(TODAY);
  weekStart.setDate(TODAY.getDate() - ((TODAY.getDay() + 6) % 7));
  const SCHEDULE = [
    { staffId: "u3", role: "day_admin", dayOffset: 0 },
    { staffId: "u3", role: "night_admin", dayOffset: 1 },
    { staffId: "u2", role: "day_admin", dayOffset: 2 },
    { staffId: "u4", role: "night_admin", dayOffset: 3 },
    { staffId: "u3", role: "day_admin", dayOffset: 4 },
    { staffId: "u5", role: "housekeeping", dayOffset: 0 },
    { staffId: "u5", role: "housekeeping", dayOffset: 1 },
    { staffId: "u5", role: "housekeeping", dayOffset: 3 },
    { staffId: "u5", role: "housekeeping", dayOffset: 4 },
  ];
  const staffNames = { u2: "Иван Смирнов", u3: "Мария Попова", u4: "Сергей Козлов", u5: "Ольга Новикова" };
  for (const s of SCHEDULE) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + s.dayOffset);
    await prisma.workScheduleEntry.create({
      data: { hotelId: "h1", date, staffId: s.staffId, role: s.role },
    });
    if (s.role === "day_admin" || s.role === "night_admin") {
      const existing = await prisma.dailyShiftLog.findUnique({
        where: { hotelId_date: { hotelId: "h1", date } },
      });
      await prisma.dailyShiftLog.upsert({
        where: { hotelId_date: { hotelId: "h1", date } },
        create: {
          hotelId: "h1",
          date,
          dayAdminName: s.role === "day_admin" ? staffNames[s.staffId] : "",
          nightAdminName: s.role === "night_admin" ? staffNames[s.staffId] : "",
        },
        update: {
          dayAdminName: s.role === "day_admin" ? staffNames[s.staffId] : existing?.dayAdminName ?? "",
          nightAdminName: s.role === "night_admin" ? staffNames[s.staffId] : existing?.nightAdminName ?? "",
        },
      });
    }
  }

  console.log("Готово ✓  demo@smena.ru / demo123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
