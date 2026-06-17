# Smena CRM

CRM для гостиниц: бронирования, заселение, финансы, housekeeping, печать бланков.

## Требования

- Node.js 20+
- PostgreSQL 15+

## Быстрый старт (dev)

```bash
cp .env.example .env
# Заполните DATABASE_URL и JWT_SECRET

docker compose -f docker-compose.dev.yml up -d   # Postgres на порту 5433
npm install
npm run db:migrate:dev -- --name init            # или: npm run db:push
npm run generate:guest-forms                     # если нет .docx в templates/guest-forms/
npm run dev
```

## Переменные окружения

| Переменная | Обязательна | Описание |
|------------|-------------|----------|
| `DATABASE_URL` | да | PostgreSQL connection string |
| `JWT_SECRET` | **да в prod** | Секрет для JWT (мин. 32 символа) |
| `PLATFORM_DEV_EMAIL` | да (для dev-панели) | Логин панели разработчика |
| `PLATFORM_DEV_PASSWORD` | да (для dev-панели) | Пароль панели разработчика |
| `NEXT_PUBLIC_CRM_URL` | нет | URL CRM для ссылок с лендинга (prod: `https://app.domen.ru`) |
| `NEXT_PUBLIC_PLATFORM_URL` | нет | URL dev-панели (prod: `https://dev.domen.ru`) |
| `MIGRATION_SECRET` | нет | Ключ импорта из старой CRM |
| `S3_BUCKET` | prod | Бакет для сканов и документов |
| `S3_ACCESS_KEY_ID` | prod | Ключ S3 |
| `S3_SECRET_ACCESS_KEY` | prod | Секрет S3 |
| `S3_ENDPOINT` | нет | Для Yandex/Selectel (не AWS) |
| `S3_REGION` | нет | `ru-central1` для Yandex |
| `S3_FORCE_PATH_STYLE` | нет | `true` для Selectel/MinIO |
| `NODE_ENV` | нет | `production` включает secure cookies |

## Архитектура (prod)

| Домен | Назначение |
|-------|------------|
| `domen.ru` | Лендинг / «присоединиться» |
| `app.domen.ru` | CRM для отелей |
| `dev.domen.ru` | Панель разработчика |

Локально всё на одном хосте: `/` — лендинг, `/login` — CRM, `/platform` — панель разработчика.

**Панель разработчика:** `/platform/login` — обзор сетей, отелей, выручки, пользователей, блокировка аккаунтов, просмотр/сброс паролей CRM-пользователей.

## Деплой в production

```bash
npm ci
npm run db:migrate          # prisma migrate deploy
npm run build
npm run start
```

**Health check:** `GET /api/health` → `{ "ok": true, "status": "healthy" }`

### Чеклист prod

- [ ] `JWT_SECRET` — уникальная длинная строка
- [ ] `DATABASE_URL` — prod PostgreSQL
- [ ] `npm run db:migrate` выполнен
- [ ] Шаблоны `templates/guest-forms/*.docx` на сервере
- [ ] **Не** запускать `prisma/seed.mjs` в prod
- [ ] S3: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (+ `S3_ENDPOINT` для Yandex/Selectel)
- [ ] Без S3 — volume для `public/uploads/` (только dev / fallback)

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Dev-сервер |
| `npm run build` | Prisma generate + production build |
| `npm run db:migrate` | Применить миграции (prod) |
| `npm run generate:guest-forms` | Сгенерировать Word-шаблоны бланков |

## Бланки гостей

Шаблоны в `templates/guest-forms/`. Подробнее — `templates/guest-forms/README.md`.

При заселении печатаются: согласие на ПДн, правила проживания, договор на услуги.
