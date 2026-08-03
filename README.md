# Musicma

آرشیو زنده آهنگ از کانال‌های تلگرام با پخش پروکسی (بدون ذخیره دائمی فایل آهنگ).

## استک

- `apps/web` — Next.js + Prisma + PostgreSQL
- `workers/telegram-stream` — Telethon indexer + stream proxy (FastAPI)
- Docker Compose برای postgres / web / worker

## راه‌اندازی محلی

### 1) Postgres

```bash
docker compose up -d postgres
```

### 2) وب

```bash
cd apps/web
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```

سایت: http://localhost:3000  
ادمین: http://localhost:3000/admin (رمز پیش‌فرض `admin123`)

### 3) ورکر تلگرام

```bash
cd workers/telegram-stream
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app:app --host 0.0.0.0 --port 8090
```

### 4) پنل ادمین

1. برو به http://localhost:3000/admin
2. در بخش **اتصال تلگرام** مقدار `API ID` و `API Hash` را از [my.telegram.org](https://my.telegram.org) بگذار و ذخیره کن
3. با شماره وارد شو (کد تلگرام / در صورت نیاز 2FA)
4. کانال را با `@username` یا لینک `t.me` اعتبارسنجی کن
5. تعداد آهنگ آخر (مثلاً ۱۰ یا ۵۰) را بزن و ذخیره کن
6. بعد از آن، اگر **سینک خودکار** روشن باشد، پست‌های جدید خودش اضافه می‌شوند
7. هر وقت خواستی از لیست کانال‌ها دوباره «بگیر آخرین‌ها» را با تعداد دلخواه بزن

## Docker کامل

```bash
# در ریشه پروژه
cp apps/web/.env.example .env
# TELEGRAM_API_ID / TELEGRAM_API_HASH را در .env ریشه هم ست کن
docker compose up --build
```

قبل از بالا آوردن سرویس worker در داکر، یک‌بار سشن را لوکال بساز و فایل سشن را در volume بگذار یا اولین لاگین تعاملی را خارج از کانتینر انجام بده.

## متغیرهای مهم

| متغیر | نقش |
| --- | --- |
| `DATABASE_URL` | Postgres |
| `INGEST_SECRET` | ارتباط امن web ↔ worker |
| `ADMIN_PASSWORD` | ورود پنل |
| `STREAM_SERVICE_URL` | آدرس سرویس استریم |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` | یوزربات |
| `DATA_DIR` | کاورها + کش داغ کوتاه |

## معماری پخش

مرورگر → `/api/stream/[id]` → worker Telethon → تلگرام (با کش LRU کوتاه روی دیسک). فایل کامل آرشیو دائمی ساخته نمی‌شود.
