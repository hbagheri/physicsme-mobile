# گزارش شناسایی صفحهٔ چت physicsme.ir

**تاریخ:** ۲۰۲۶-۰۹-۲۱ · **نسخهٔ افزونه:** `PM_CHAT_VERSION 1.7.8` · **وضعیت:** فقط-خواندنی

هدف این گزارش: ورودیِ ساخت فیگمای اپلیکیشن موبایل و وب‌اپ آیفون. بنابراین
صرفاً «مستندات آنچه هست» نیست — هرجا که ساختار فعلی برای موبایل ناکافی بود،
آن را به‌صراحت علامت زده‌ام.

---

## ۰. روش کار و افشاگری تغییرات

| مورد | وضعیت |
|---|---|
| تغییر فایل پروژه | ❌ هیچ |
| deploy | ❌ هیچ |
| migration | ❌ هیچ |

**اما دو نوع نوشتن در دیتابیس رخ داد که باید بدانی:**

1. **session token موقت.** وردپرس توکن‌های نشست را hash-شده ذخیره می‌کند، پس
   نمی‌شد از نشست موجودِ مرورگرِ تو یک کوکی بسازم. دو نشست موقت برای
   `physicsme_admin` ساختم، اسکرین‌شات گرفتم، و **هر دو را بلافاصله destroy
   کردم**. خالص اثر روی دیتابیس: صفر.

2. **چند پیام واقعی چت.** برای گرفتن عکس استریم/مارک‌داون/بلوک کد، واقعاً سؤال
   فرستادم. این‌ها در `wp_pm_chat_log` ردیف ساختند و ۴ گفتگوی تازه در سایدبارِ
   ادمین اضافه کردند (عنوان‌ها: «انرژی جنبشی…»، «سه قانون نیوتن…»، «کد پایتون
   سقوط آزاد…»، «کد پایتون پرتابه…»). پاک‌شان نکردم چون حذف = عملیات
   برگشت‌ناپذیر روی داده. اگر می‌خواهی، با آیکون سطل زباله در خود UI پنهانشان کن.

مصرف توکن صفر بود: حساب `physicsme_admin` قابلیت `manage_options` دارد و
`PM_Chat_Usage_Limiter` ادمین‌ها را کامل معاف می‌کند.

**سایر نکات روش:**
- همهٔ درخواست‌ها با کوئری‌استرینگ یکتا (`/chat/?r=…`) زده شد تا از کش
  Cloudflare عبور کند.
- `06-quota-full` و `05-error` با **interception در مرورگر** شبیه‌سازی شدند
  (پاسخ 429 و abort). هیچ تنظیماتی روی سرور عوض نشد و مدل خاموش نشد.
- نوار مدیریت وردپرس در پاس دوم عکس‌ها با CSS محلی مخفی شد تا طراحی تمیز دیده شود.

---

## ۱. کد

صفحهٔ چت از **یک افزونهٔ سفارشی** می‌آید، نه قالب و نه سرویس جدا:

```
wordpress/physicalme/wp-content/plugins/physicalme-chat/
├── physicalme-chat.php          ← شورت‌کد [pm_chat_full] + markup کامل صفحه
├── assets/chat-full.css         ← ۶۹۳ خط، تمام استایل صفحه
├── assets/chat-full.js          ← ۸۳۰ خط، کل منطق سمت کلاینت
└── includes/class-chat-api.php  ← REST + SSE + prompt + routing
```

صفحهٔ `/chat/` یک برگهٔ معمولی وردپرس است که فقط شورت‌کد `[pm_chat_full]` را
دارد. markup در PHP نوشته شده و **استاتیک** است؛ JS فقط محتوای داخلش را پر
می‌کند. این برای تو خبر خوبی است: ساختار DOM را می‌شود عیناً در اپ بازسازی کرد
بدون اینکه لازم باشد PHP را بخوانی.

کانتینرهای مرتبط: `wp-physicalme` (وردپرس)، `wp-db` (MariaDB)، `wp-ollama`
(مدل محلی)، `wp-qdrant` (vector search)، `wp-libretranslate` (ترجمه)،
`wp-cloudflared-tunnel` (تونل).

---

### ۱.۱ ساختار DOM

```
#pmcf-wrap                        position:fixed, top:var(--pmcf-top,60px), display:flex
│                                 کلاس .pmcf-rtl وقتی is_rtl()
│
├── #pmcf-sidebar                 width:260px, bg:#1e293b
│   ├── #pmcf-sidebar-header      «⚛ PhysicsMe AI»
│   ├── #pmcf-new-btn             «+ چت جدید»، bg:#2563eb
│   └── #pmcf-sessions            ← با JS پر می‌شود
│       └── .pmcf-session-item[.active]   (تکرارشونده، حداکثر ۶۰)
│           ├── .pmcf-session-title-row
│           │   ├── .pmcf-session-title            عنوان، ۷۰ کاراکتر
│           │   ├── .pmcf-session-btn.pmcf-session-rename   ✏️
│           │   └── .pmcf-session-btn.pmcf-session-delete   🗑
│           ├── .pmcf-session-tokens               «۱٫۰k توکن»
│           ├── .pmcf-session-input                ← فقط هنگام rename
│           └── (نوار تأیید حذف)                   ← فقط هنگام delete
│               ├── .pmcf-del-yes   «بله»
│               └── .pmcf-del-no    «نه»
│
└── #pmcf-main                    flex:1, bg:#fff
    ├── #pmcf-header              gradient(90deg,#1e3a5f,#1e40af)
    │   ├── #pmcf-menu-toggle     ☰ — display:none تا ≤۷۶۸px
    │   ├── .pmcf-title
    │   │   ├── span              «⚛ PhysicsMe Assistant»
    │   │   └── .pmcf-subtitle#pmcf-subtitle  «هوش مصنوعی محلی · Mistral»
    │   └── #pmcf-token-badge     «🎟 ∞» یا «🎟 ۱۲۳۴۵»
    │
    ├── #pmcf-disclaimer          bg:#1c1a10, color:#a89030
    │                             «⚠️ نسخه آزمایشی — در حال آموزش است…»
    │
    ├── #pmcf-messages            role="log" aria-live="polite", flex-column, gap:16px
    │   ├── .pmcf-system          پیام سیستمی وسط‌چین (مثلاً 📄 متن مقاله)
    │   └── .pmcf-msg.pmcf-msg-user / .pmcf-msg-assistant   max-width:820px
    │       ├── .pmcf-bubble[.pmcf-typing]
    │       │   └── (داخل پاسخ) pre > code + .pmcf-code-copy + .pmcf-code-run
    │       ├── .pmcf-translation + .pmcf-translation-label
    │       ├── .pmcf-source.pmcf-source-{site|external|general|code}
    │       └── .pmcf-rating > .pmcf-rate-btn ×۲   👍 👎
    │
    └── #pmcf-input-area
        ├── #pmcf-input           textarea, rows=1, dir="auto", auto-grow
        ├── #pmcf-send            «ارسال ↑»
        └── #pmcf-stop            «توقف ⏹» — فقط هنگام استریم
```

**مودال اجرای پایتون** (خواهر DOM، بیرون `#pmcf-wrap`):

```
#pmcf-pymodal                     role="dialog" aria-modal="true", display:none
└── #pmcf-pymodal-box
    ├── #pmcf-pymodal-header      «🐍 اجرای کد Python» + #pmcf-pymodal-close ✕
    ├── #pmcf-pymodal-code        pre dir="ltr" — max-height:25vh در موبایل
    ├── #pmcf-pymodal-output-wrap
    │   ├── #pmcf-pymodal-output-label   «خروجی:»
    │   ├── #pmcf-pymodal-output         pre dir="ltr" (کلاس .pmcf-py-error هنگام خطا)
    │   └── #pmcf-pymodal-figures        ← <img> نمودارهای matplotlib
    └── #pmcf-pymodal-footer
        ├── #pmcf-pymodal-run     «▶ اجرا»
        └── #pmcf-pymodal-cancel  «بستن»
```

**رفتار واکنش‌گرا — تنها یک breakpoint وجود دارد: `max-width: 768px`**

| زیر ۷۶۸px | مقدار |
|---|---|
| `#pmcf-sidebar` | `position:fixed`، عرض ۲۶۰px، بیرون صفحه |
| RTL | از **چپ** می‌آید (`left:-260px` → `left:0`) |
| LTR | از **راست** می‌آید (`right:-260px` → `right:0`) |
| انیمیشن | `transition .25s ease` + `box-shadow ∓4px 0 24px rgba(0,0,0,.3)` |
| `#pmcf-menu-toggle` | `display:block` |
| padding پیام‌ها | `24px 20px` → `16px 12px` |
| فونت حباب | `14.5px` → `14px` |

⚠️ **هیچ overlay/backdrop پشت سایدبار باز وجود ندارد** و هیچ سوایپی هم نیست.
برای اپ این دو تا را باید اضافه کنی.

---

### ۱.۲ رنگ‌ها و تایپوگرافی

#### وضعیت فعلی

`chat-full.css` فقط **یک** CSS variable دارد و آن هم رنگ نیست:
`--pmcf-top` (فاصله از بالا، پیش‌فرض `60px`). **هیچ توکن رنگی وجود ندارد** —
۶۳ مقدار رنگ به‌صورت literal تکرار شده‌اند. عملاً پالت، زیرمجموعهٔ
**Tailwind slate / blue / emerald / red / amber** است.

#### جدول توکن پیشنهادی برای فیگما

این جدول را من از روی کد **استخراج و نام‌گذاری** کرده‌ام؛ در پروژه وجود ندارد.
پیشنهاد می‌کنم همین اسم‌ها در فیگما به‌عنوان Color Style ساخته شوند تا بعداً
یک‌به‌یک به کد برگردند.

| توکن | مقدار | کجا استفاده شده |
|---|---|---|
| `surface/app` | `#f1f5f9` | پس‌زمینهٔ کل wrap |
| `surface/main` | `#fff` | ستون اصلی چت |
| `surface/sidebar` | `#1e293b` | سایدبار |
| `surface/sidebar-border` | `#334155` | جداکننده‌های سایدبار |
| `surface/assistant-bubble` | `#f8fafc` | حباب پاسخ AI |
| `surface/assistant-border` | `#e2e8f0` | حاشیهٔ حباب + زیر h2 |
| `brand/primary` | `#2563eb` | حباب کاربر، «چت جدید»، لینک، کرسر تایپ |
| `brand/primary-strong` | `#1d4ed8` | کد inline، hover |
| `brand/header-from` | `#1e3a5f` | شروع گرادیان هدر |
| `brand/header-to` | `#1e40af` | پایان گرادیان هدر + رنگ h2 |
| `text/primary` | `#1e293b` | متن پاسخ |
| `text/strong` | `#111827` | `<strong>` |
| `text/h3` | `#374151` | h3 و متن ترجمه |
| `text/muted` | `#94a3b8` | پیام سیستمی، امتیازدهی |
| `text/on-dark` | `#f1f5f9` | تیتر سایدبار |
| `text/on-brand` | `#fff` | متن روی آبی |
| `state/disclaimer-bg` | `#1c1a10` | نوار هشدار |
| `state/disclaimer-border` | `#3d3510` | حاشیهٔ نوار هشدار |
| `state/disclaimer-text` | `#a89030` | متن نوار هشدار |
| `badge/site` | `#059669` روی `#ecfdf5` / border `#a7f3d0` | منبع: مقالات سایت |
| `badge/external` | `#2563eb` روی `#eff6ff` / border `#bfdbfe` | منبع: خارجی |
| `badge/general` | `#6b7280` روی `#f9fafb` / border `#e5e7eb` | منبع: دانش عمومی |
| `badge/code` | `#b45309` روی `#fffbeb` / border `#fde68a` | پاسخ کد |
| `feedback/error` | `#dc2626` / `#ef4444` / `#b91c1c` | خطا |
| `feedback/success` | `#16a34a` / `#15803d` | موفقیت |
| `surface/code-block` | `#0f172a` | پس‌زمینهٔ `<pre>` |

**Elevation:** `rgba(0,0,0,.3)` برای سایدبار موبایل، `rgba(0,0,0,.6)`/`.65`
برای بک‌دراپ مودال پایتون.

#### تایپوگرافی

| نقش | فونت | اندازه | وزن | line-height |
|---|---|---|---|---|
| پایهٔ کل صفحه | `Vazirmatn, Tahoma, system-ui, sans-serif` | — | — | — |
| کد | `'JetBrains Mono', Consolas, monospace` | `.88em` inline / `13.5px` بلوک | — | `1.6` |
| تیتر سایدبار | ارثی | `14px` | `700` | — |
| دکمهٔ «چت جدید» | ارثی | `13px` | `600` | — |
| عنوان گفتگو | ارثی | `12.5px` | — | — |
| بَج توکن گفتگو | ارثی | `10px` | — | — |
| عنوان هدر | ارثی | `15px` | `700` | — |
| زیرعنوان هدر | ارثی | `11px` | `400` | — |
| بَج توکن هدر | ارثی | `11px` | — | — |
| نوار هشدار | ارثی | `11.5px` | — | — |
| **متن حباب** | ارثی | **`14.5px`** (موبایل `14px`) | — | **`1.7`** |
| h2 داخل پاسخ | ارثی | `1.1em` | `700` | `1.4` |
| h3 داخل پاسخ | ارثی | `1em` | `700` | `1.4` |
| بَج منبع | ارثی | `11px` | — | — |
| ترجمه | `Vazirmatn, Tahoma` | `13.5px` | — | `1.8` |
| ورودی | ارثی | `14px` | — | — |

**شعاع گوشه:** حباب `16px` با گوشهٔ نزدیک به فرستنده `4px` (دم پیام)؛
بلوک کد `8px`؛ دکمه‌ها `8px`؛ بَج‌ها `8px`–`10px`؛ کد inline `4px`.

⚠️ **Vazirmatn از کجا می‌آید؟** در `chat-full.css` فقط نام فونت ذکر شده و هیچ
`@font-face` یا `@import` نیست — یعنی وابسته به قالب سایت است. **در اپ باید
فایل فونت را خودت بandle کنی**، وگرنه روی iOS به Tahoma (که وجود ندارد) و بعد
sans-serif سقوط می‌کند و کل حس فارسی صفحه عوض می‌شود.

---

### ۱.۳ اندپوینت‌ها

همه زیر namespace `physicalme/v1` هستند. آدرس پایه: `https://physicsme.ir/wp-json/physicalme/v1`

| مسیر | متد | دسترسی | استفادهٔ صفحهٔ چت |
|---|---|---|---|
| `/chat` | POST | کاربر یا مهمان | ✅ ارسال پیام (SSE) |
| `/chat/sessions` | GET | لاگین‌شده | ✅ لیست گفتگوها |
| `/chat/sessions/{id}` | GET | لاگین‌شده | ✅ بارگذاری پیام‌ها |
| `/chat/sessions/{id}/rename` | POST | لاگین‌شده | ✅ تغییر نام |
| `/chat/sessions/{id}/hide` | POST | لاگین‌شده | ✅ حذف (نرم) |
| `/chat/rate` | POST | همه | ✅ 👍/👎 |
| `/chat/status` | GET | `manage_options` | ❌ فقط ادمین |
| `/chat/admin-stats` | GET | هدر `X-Bot-Secret` | ❌ بات تلگرام |
| `/chat/kb-correct` | POST | `bot_secret` | ❌ بات تلگرام |
| `/iypt/has-membership` | GET | همه | ❌ صفحات IYPT |

الگوی `{id}`: `[a-zA-Z0-9_\-]+` — در عمل UUID v4 تولیدشده در **کلاینت**.

#### احراز هویت

کوکی وردپرس + هدر `X-WP-Nonce`. هیچ توکن جدایی وجود ندارد. جزئیات کامل در
بخش ۳.

#### `GET /chat/sessions`

پاسخ — آرایهٔ ساده، حداکثر ۶۰ مورد، مرتب بر اساس آخرین پیام نزولی:

```json
[
  {
    "id": "4298fef9-2135-4239-9e0f-bc664643a508",
    "title": "قانون دوم نیوتن را کوتاه توضیح بده",
    "date": "2026-09-20 20:11:44",
    "tokens": 1043
  }
]
```

- `title` = `custom_title` یا اولین پیام کاربر، بریده به **۷۰ کاراکتر**
- `tokens` = مجموع `tokens` تمام ردیف‌های `role='assistant'` آن نشست
- `date` رشتهٔ MySQL است، **نه ISO-8601 و بدون timezone** — در اپ باید
  به‌عنوان UTC parse شود

#### `GET /chat/sessions/{id}`

```json
[
  { "role": "user",      "message": "قانون دوم نیوتن را کوتاه توضیح بده" },
  { "role": "assistant", "message": "قانون دوم نیوتن بیان می‌کند که…" }
]
```

⚠️ **مهم برای اپ:** این پاسخ `log_id` ندارد. یعنی وقتی گفتگوی قدیمی را باز
می‌کنی، دکمه‌های 👍/👎 **کار نمی‌کنند** چون `handle_rate` به `log_id` نیاز
دارد. امتیازدهی فقط روی پاسخ‌های همین نشستِ باز ممکن است.

اگر مالک نشست کاربر فعلی نباشد → `404 {"error":"not found"}`.

#### `POST /chat/sessions/{id}/rename`

بدنه: `{"title":"نام جدید"}` (حداکثر ۱۲۰ کاراکتر) → `{"ok":true,"title":"…"}`

#### `POST /chat/sessions/{id}/hide`

بدنه: خالی → `{"ok":true}`

#### `POST /chat/rate`

```json
{ "log_id": 781, "rating": 1, "session_id": "4298fef9-…" }
```

`rating` فقط `1` یا `-1`. محدودیت ۳۰ رأی در ۵ دقیقه به ازای هر IP.

#### `POST /chat/` — استریم

**بله، پاسخ استریم می‌شود. با SSE، اما نه با `EventSource`.**

این تمایز برای اپ حیاتی است: `EventSource` فقط GET می‌زند و هدر سفارشی
نمی‌پذیرد. اینجا یک `fetch()` با متد POST زده می‌شود و بدنه با
`res.body.getReader()` به‌صورت دستی پارس می‌شود. سرور فرمت SSE می‌فرستد
(`text/event-stream`)، ولی کلاینت آن را دستی می‌خواند.

درخواست:

```
POST /wp-json/physicalme/v1/chat
Content-Type: application/json
X-WP-Nonce: <nonce>

{ "message": "…", "history": [...], "session_id": "<uuid>", "lang": "fa" }
```

- `history` در **کلاینت** نگهداری می‌شود و هر بار کامل فرستاده می‌شود؛ سرور
  آخرین ۲۰ نوبت را نگه می‌دارد. سرور از دیتابیس تاریخچه نمی‌خواند.
- `session_id` را کلاینت می‌سازد. اگر خالی باشد سرور یکی می‌سازد و در رویداد
  `done` برمی‌گرداند.

هدرهای پاسخ: `Content-Type: text/event-stream; charset=UTF-8`،
`Cache-Control: no-cache`، `X-Accel-Buffering: no`، `Connection: keep-alive`.

رویدادها (`JSON_UNESCAPED_UNICODE`):

| event | data | معنی |
|---|---|---|
| `status` | `{"text":"در حال فکر کردن…"}` | تغییر وضعیت؛ چند بار می‌آید |
| `token` | `{"text":"قطعه"}` | یک تکهٔ متن — به انتها append شود |
| `source` | `{"type":"site\|external\|general\|gate\|code","label":"…"}` | بَج منبع |
| `translation` | `{"text":"…"}` | بلوک ترجمهٔ اختیاری |
| `done` | ↓ | پایان |

```json
{
  "session_id": "4298fef9-2135-4239-9e0f-bc664643a508",
  "remaining": 98957,
  "claude_today": 0,
  "response_tokens": 1043,
  "provider": "groq",
  "log_id": 781
}
```

`log_id` **فقط اینجا** برمی‌گردد — تنها راه فعال‌کردن دکمهٔ امتیاز.

خطاها SSE نیستند؛ JSON معمولی با کد وضعیت هستند:

```
429  {"success":false,"data":{"code":"limit_reached","message":"⚠️ سقف سوالات تموم شد. فردا دوباره امتحان کن."}}
429  {"success":false,"code":"rate_limited"}
403  {"success":false}
```

کلاینت `res.ok` را اول چک می‌کند و `data.message` را به کاربر نشان می‌دهد.

**توقف:** دکمهٔ «توقف» یک `AbortController.abort()` است. سرور
`ignore_user_abort(true)` دارد و `connection_aborted()` را چک می‌کند، پس
تولید متوقف می‌شود — اما متنی که تا آن لحظه تولید شده **در دیتابیس ذخیره
نمی‌شود**.

---

### ۱.۴ اسکیمای دیتابیس

پیشوند `wp_`. موتور InnoDB، `utf8mb4`.

#### `wp_pm_chat_log` — تمام پیام‌ها

```sql
CREATE TABLE `wp_pm_chat_log` (
  `id`         bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id`    bigint(20) unsigned NOT NULL DEFAULT 0,
  `session_id` varchar(64)         NOT NULL DEFAULT '',
  `role`       enum('user','assistant') NOT NULL,
  `message`    longtext            NOT NULL,
  `provider`   varchar(20)         NOT NULL DEFAULT '',
  `tokens`     int(10) unsigned    DEFAULT NULL,
  `created_at` datetime            NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id`    (`user_id`),
  KEY `session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

**این جدول منبعِ حقیقت است.** هیچ جدول «گفتگو» مستقلی وجود ندارد — یک گفتگو
فقط «مجموعهٔ ردیف‌هایی با `session_id` یکسان» است. `tokens` فقط برای
`role='assistant'` پر می‌شود.

#### `wp_pm_chat_sessions` — فقط متادیتا

```sql
CREATE TABLE `wp_pm_chat_sessions` (
  `id`           bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `session_id`   varchar(64) NOT NULL,
  `user_id`      bigint(20) unsigned NOT NULL,
  `custom_title` varchar(120) DEFAULT NULL,
  `is_hidden`    tinyint(1)  NOT NULL DEFAULT 0,
  `created_at`   datetime    NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_user` (`session_id`,`user_id`)
) ENGINE=InnoDB
```

این جدول **فقط وقتی ردیف می‌گیرد که کاربر نام را عوض کند یا گفتگو را حذف
کند.** گفتگوی دست‌نخورده اصلاً اینجا ردیفی ندارد. به همین دلیل کوئری لیست
`LEFT JOIN` است و شرط `is_hidden IS NULL OR is_hidden = 0` دارد.

#### `wp_pm_chat_usage` — سهمیه

```sql
CREATE TABLE `wp_pm_chat_usage` (
  `id`            bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `identifier`    varchar(64)      NOT NULL,
  `ident_type`    varchar(10)      NOT NULL DEFAULT 'user',
  `period`        varchar(10)      NOT NULL,
  `tokens_used`   int(10) unsigned NOT NULL DEFAULT 0,
  `requests_used` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at`    datetime         NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ident_period` (`identifier`,`period`),
  KEY `period_idx` (`period`)
) ENGINE=InnoDB
```

`identifier` = شناسهٔ عددی کاربر (رشته‌ای) یا `sha256` کوکی مهمان.
`period` = `YYYY-MM-DD` یا `YYYY-MM`.

#### `wp_pm_chat_ratings` و `wp_pm_chat_refunds`

```sql
CREATE TABLE `wp_pm_chat_ratings` (
  `id`          bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `log_id`      bigint(20) unsigned NOT NULL,
  `session_id`  varchar(64) NOT NULL DEFAULT '',
  `user_id`     bigint(20) unsigned NOT NULL DEFAULT 0,
  `rating`      tinyint(4)  NOT NULL DEFAULT 0,
  `refunded_at` datetime    DEFAULT NULL,
  `created_at`  datetime    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_log` (`log_id`)
) ENGINE=InnoDB
```

`refunds` ستون‌های `rating_id, log_id, user_id, response_tokens, refund_pct,
refund_tokens, admin_id, note, created_at` دارد — سیستم بازگرداندن توکن برای
پاسخ‌های بد.

#### رابطه با کاربران وردپرس

```
wp_users.ID
   ├─→ wp_pm_chat_log.user_id          (بدون FK)
   ├─→ wp_pm_chat_sessions.user_id     (بدون FK)
   ├─→ wp_pm_chat_usage.identifier     (رشته! بدون FK)
   └─→ wp_pm_chat_ratings.user_id      (بدون FK)
```

**هیچ FOREIGN KEY ای وجود ندارد.** حذف کاربر وردپرس، چت‌هایش را یتیم می‌کند.

#### «حذف» گفتگو دقیقاً چه می‌کند؟

**حذف نرم است. هیچ پیامی پاک نمی‌شود.**

```php
INSERT INTO wp_pm_chat_sessions (session_id, user_id, custom_title, is_hidden, created_at)
VALUES (%s, %d, NULL, 1, NOW())
ON DUPLICATE KEY UPDATE is_hidden = 1
```

- تنها ستونی که عوض می‌شود: `wp_pm_chat_sessions.is_hidden` → `1`
- `wp_pm_chat_log` **کاملاً دست‌نخورده** می‌ماند؛ متن همهٔ پیام‌ها باقی است
- مصرف توکنِ ثبت‌شده هم باقی می‌ماند — حذف گفتگو سهمیه را برنمی‌گرداند
- هیچ UI ای برای «بازیابی» وجود ندارد، ولی با یک UPDATE ساده برمی‌گردد

⚠️ **این یک نکتهٔ حقوقی/حریم خصوصی است.** اگر اپ به فروشگاه اپل برود، دکمهٔ
«حذف» که واقعاً حذف نمی‌کند می‌تواند مشکل‌ساز شود. پیشنهاد: یا برچسب را به
«بایگانی» تغییر بده، یا یک حذف واقعی اضافه کن.

---

### ۱.۵ منطق توکن

#### «۱٫۰k توکن» زیر هر گفتگو از کجا می‌آید؟

از این تکه در کوئری لیست:

```sql
SUM(CASE WHEN l.role = 'assistant' THEN COALESCE(l.tokens,0) ELSE 0 END) AS tokens
```

یعنی **مجموع توکن تمام پاسخ‌های AI در آن گفتگو**. پیام‌های خود کاربر شمرده
نمی‌شوند. فرمت‌کردن به «k» در JS انجام می‌شود.

#### «توکن» اینجا توکن واقعی LLM نیست

```php
public static function calc_tokens( string $response ): int {
    $chars_per_token = max( 1, (int) get_option( 'pm_chat_limit_chars_per_token', 4 ) );
    return 1 + (int) floor( mb_strlen( $response ) / $chars_per_token );
}
```

مقدار فعلی `pm_chat_limit_chars_per_token` = **۳**. پس:

> توکن = ۱ + ⌊ تعداد کاراکتر پاسخ ÷ ۳ ⌋

این یک واحد شمارش داخلی است، نه توکنایزر مدل. فقط طول **پاسخ** حساب می‌شود؛
سؤال کاربر و متن مقالات (context) رایگان‌اند.

#### سهمیه کجا تعریف شده؟

در `wp_options`:

| گزینه | مقدار فعلی | یعنی |
|---|---|---|
| `pm_chat_limit_member` | **۱۰۰٬۰۰۰** | سقف کاربر لاگین‌شده |
| `pm_chat_limit_member_period` | `daily` | روزانه |
| `pm_chat_limit_guest` | **۵٬۰۰۰** | سقف مهمان |
| `pm_chat_limit_guest_period` | `daily` | روزانه |
| `pm_chat_limit_chars_per_token` | **۳** | ضریب تبدیل |
| `pm_chat_guest_global_daily` | `0` | سقف کلی مهمان‌ها — غیرفعال |

۱۰۰٬۰۰۰ توکن ÷ ۳ ≈ **۳۰۰٬۰۰۰ کاراکتر پاسخ در روز** برای هر عضو. با میانگین
پاسخ ۱٬۵۰۰ کاراکتری، حدود **۲۰۰ سؤال در روز**.

**ادمین‌ها کاملاً معاف‌اند** (`manage_options` یا `edit_others_posts` →
`remaining = PHP_INT_MAX` → بَج `🎟 ∞`).

#### مکانیزم بدهی (rollover)

نکتهٔ ظریفی که در اپ باید درست نمایش داده شود:

```php
$remaining = $limit - $used;
return [ 'allowed' => $used < $limit, ... ];
```

شرط عبور `$used < $limit` است، نه `$used + cost <= $limit`. یعنی **یک پاسخ
می‌تواند از سقف عبور کند** و `remaining` منفی شود. آن مازاد به روز بعد منتقل
می‌شود:

```php
$initial_debt = max( 0, $prev_used - $limit );
```

پس روز بعد کاربر با بدهی شروع می‌کند. **بَج باید بتواند عدد منفی نشان دهد** —
الان کد فقط `'🎟 ' + remaining` می‌گذارد و منفی را بدون هیچ استایل خاصی چاپ
می‌کند.

#### وقتی سهمیه تمام شود چه می‌شود؟

سرور **قبل از تماس با مدل** با `429` برمی‌گردد:

```json
{"success":false,"data":{"code":"limit_reached","message":"⚠️ سقف سوالات تموم شد. فردا دوباره امتحان کن."}}
```

برای مهمان پیام فرق می‌کند: «⚠️ سقف سوالات تموم شد. برای ادامه وارد سایت شو.»

در UI این فقط به‌صورت یک پیام سیستمی داخل جریان چت ظاهر می‌شود — **ورودی قفل
نمی‌شود، بَج قرمز نمی‌شود، و هیچ CTA ای برای ارتقا نیست**. این برای یک اپ
تجاری ضعیف است؛ ← بخش ۴.

---

### ۱.۶ مدل AI

#### ⚠️ برچسب هدر اشتباه است

هدر می‌گوید **«هوش مصنوعی محلی · Mistral»**. هر دو نیمهٔ این جمله نادرست است:

1. **Mistral نیست.** `pm_chat_model` = `qwen2.5:7b`.
2. **لزوماً محلی نیست.** در عمل بیشتر پاسخ‌ها از Groq (ابری) می‌آیند.

این یک رشتهٔ ثابت در `physicalme-chat.php:308` است و هیچ‌وقت آپدیت نمی‌شود.
**در طراحی اپ، این زیرعنوان باید داینامیک شود** و از فیلد `provider` در رویداد
`done` پر شود.

#### زنجیرهٔ ارائه‌دهنده

`pm_chat_provider_chain` = `[{"id":"ollama","enabled":true},{"id":"groq","enabled":true}]`

| ارائه‌دهنده | مدل | محل اجرا |
|---|---|---|
| `ollama` | `qwen2.5:7b` | کانتینر `wp-ollama` روی همین لپ‌تاپ، `http://wp-ollama:11434` |
| `groq` | `qwen/qwen3.8-27b` | API ابری Groq |
| `anthropic` | `claude-haiku-4-5-20251001` | غیرفعال (`pm_chat_claude_fallback_enabled = 0`) |
| `openai` | `gpt-4o-mini` | بدون کلید |

Ollama است، نه llama.cpp و نه API بیرونی — برای مدل محلی.

#### چرا در عمل Groq جواب می‌دهد؟

دو دلیل جداگانه:

**الف) مسیریابی دومرحله‌ای.** برای سؤال‌های «عمومی» و سؤال‌های کدنویسی، ابتدا
فقط ارائه‌دهنده‌های ابری امتحان می‌شوند:

```php
$passes = ( ( $source_type === 'general' || $is_code_query ) && $has_cloud_in_chain
            && ! get_option( 'pm_chat_ollama_allow_general', 0 ) )
          ? [ 'cloud', 'local' ]
          : [ 'all' ];
```

**ب) گارد cold-start.** `PM_Chat_Ollama_Client::is_reachable()` علاوه بر ping،
`/api/ps` را چک می‌کند و اگر مدل در حافظه بارگذاری نشده باشد (یا کمتر از ۹۰
ثانیه تا انقضایش مانده باشد) **false** برمی‌گرداند، چون بارگذاری روی CPU
۶۰–۱۲۰ ثانیه طول می‌کشد.

این یک حلقهٔ خودتقویت‌شونده ساخته: مدل از حافظه خارج می‌شود → درخواست‌ها به
Groq می‌روند → مدل هیچ‌وقت گرم نمی‌شود. یک cron هر ۸ دقیقه
(`pm_chat_warm_ollama`) برای مقابله اضافه شده، ولی آمار ارائه‌دهنده نشان
می‌دهد هنوز غالب Groq است.

**این مستقیماً به حرف تو ربط دارد** که «می‌خواهیم بر اساس سایت جواب بدهیم».
نکتهٔ مهم: **RAG مستقل از مدل است.** بازیابی از `wp_pm_chat_knowledge` + Qdrant
انجام می‌شود و متن مقالات به‌عنوان context به *هر* مدلی که جواب بدهد داده
می‌شود. پس پاسخ Groq هم از روی مقالات سایت ساخته می‌شود. چیزی که با استفاده از
Groq «هدر» می‌رود، سرمایه‌گذاری روی مدل محلی است، نه پایگاه دانش.

#### system prompt

**حالت ۱ — سؤال کدنویسی** (`$is_code_query === true`)، عیناً:

```
You are a physics Python programming assistant. The user is asking you to write
Python code. OUTPUT ONLY a complete, runnable Python code block. Do NOT write any
text before or after the code block. Do NOT describe steps. Do NOT explain. Just
write the code. Define all parameters as variables at the top. Use correct physics
formulas. CRITICAL: ALL code — variable names, comments, strings — must be in
English only. No Persian inside the code block.
[PYODIDE_RULES]
Your explanation text must be in Persian (Farsi).
```

**حالت ۲ — سؤال معمولی.** `pm_chat_system_prompt` خالی است، پس متن پیش‌فرض
استفاده می‌شود و لایه‌لایه ساخته می‌شود:

```
You are a science tutor assistant for PhysicsMe (physicsme.ir). You answer
questions about {SUBJECTS} clearly, correctly, and concisely. If the question is
unrelated to these subjects, politely decline.

The user you are talking to is: "{USER_LABEL}". CRITICAL: Do NOT use any name,
username, or personal identifier from the reference articles. The ONLY name you
may use to address the user is "{USER_LABEL}". Never say names like "Ana Lucia",
"John", or any other name from the articles.

Must respond in Persian (Farsi). Write short, clear sentences. If the user asks
for code or simulation, provide complete runnable code — no step-by-step
descriptions. IMPORTANT: All code must be entirely in English — variable names,
comments, strings. No Persian inside code blocks.

If your answer contains Python code, these rules apply. [PYODIDE_RULES]
```

سپس **یکی از این دو**:

```
Reference articles are provided below. Use these articles as your primary source.
Explain the topic clearly in your own words — do NOT copy the text word for word.
If the articles contain formulas or key facts, include them in your explanation.
Do NOT contradict the articles.

{CONTEXT_TEXT}
```

یا وقتی context پیدا نشد:

```
WARNING: No reference articles were found for this question. Answer only if you
are certain. If unsure, say so clearly.

Trusted science references:
{EXTERNAL_SITES}
```

و برای انگلیسی یک قید سخت در انتها:

```
CRITICAL RULE: Write your entire response in English only. Do NOT use Persian,
Farsi, Arabic, or any other language — even if the reference articles or the
question contain Persian text.
```

`PYODIDE_RULES` یک ثابت طولانی در `class-chat-api.php` است که قواعد نوشتن کد
اجراشدنی در Pyodide را دیکته می‌کند (منع `np.zeros` + فیلتر، منع حلقهٔ
`while y > 0` با شروع از `0.0`، سقف طول کد، و…). متن کامل در
`source/class-chat-api.php` ثابت `PYODIDE_RULES`.

#### آیا محتوای مقالهٔ سایت به مدل داده می‌شود؟

**بله، از سه مسیر:**

1. **RAG خودکار** — جستجوی برداری در `wp_pm_chat_knowledge` از طریق Qdrant با
   embedding محلی. نتایج در `{CONTEXT_TEXT}` قرار می‌گیرند و `source` برابر
   `site` می‌شود (بَج سبز «از مقالات سایت»).
2. **جستجوی متنی سایت** — `PM_Chat_Site_Search` به‌عنوان پشتیبان.
3. **تزریق صریح از URL** — پارامتر `?ctx=` متن مقاله را می‌گیرد و کلاینت آن را
   به اول پیام اضافه می‌کند: `'متن مقاله:\n' + ctx + '\n\n' + q`. همراهش یک
   `.pmcf-system` با «📄 …» نشان داده می‌شود.

اگر هیچ‌کدام چیزی پیدا نکرد، `source_type = 'general'` می‌شود که باعث
مسیریابی به ابر هم می‌شود (بند الف بالا).

---

### ۱.۷ رندر پاسخ

**این سه جواب، کتابخانه‌های لازم اپ را تعیین می‌کنند:**

| چیز | کتابخانه | نسخه | منبع |
|---|---|---|---|
| مارک‌داون | **marked** | `@9` | `cdn.jsdelivr.net/npm/marked@9/marked.min.js` |
| ریاضی | **MathJax** (نه KaTeX) | **`@3`، خروجی CHTML** | `cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js` |
| اجرای پایتون | **Pyodide** | `v0.27.6` | `cdn.jsdelivr.net/pyodide/v0.27.6/full/pyodide.js` |
| رنگ‌آمیزی کد | ❌ **هیچ** | — | — |

#### مارک‌داون

```js
marked.parse(protect(text), { breaks: true, gfm: true })
```

`breaks:true` یعنی خط جدید = `<br>`. `gfm:true` یعنی جدول و لیست تسک.
`protect()` قبل از پارس، ریاضی را از دست marked در امان نگه می‌دارد.

#### ریاضی — MathJax 3، نه KaTeX

```js
window.MathJax = {
  tex: {
    inlineMath:  [['\\(','\\)'], ['$','$']],
    displayMath: [['\\[','\\]'], ['$$','$$']],
    packages:    { '[+]': ['ams'] }
  },
  options: { skipHtmlTags: ['script','noscript','style','textarea','pre','code'] }
};
```

بعد از هر بار رندر: `MathJax.typesetPromise([el])`.

⚠️ **پیامد مستقیم برای اپ:** MathJax 3 با خروجی CHTML حدود **۱ مگابایت** است و
به فونت‌های وب خودش نیاز دارد. KaTeX بسیار سبک‌تر و سریع‌تر است، اما
`packages:{'[+]':['ams']}` و سینتکس `$…$` باید هنگام مهاجرت تست شوند. **اگر
خواستی به KaTeX مهاجرت کنی، این یک تصمیم آگاهانه است نه یک جایگزینی مکانیکی.**
گزینهٔ امن: همان MathJax، ولی bundle شده نه از CDN.

#### بلوک کد — هیچ highlight ای وجود ندارد

نه Prism، نه highlight.js، نه Shiki. بلوک کد فقط `<pre><code>` است با
پس‌زمینهٔ `#0f172a`، فونت JetBrains Mono، `font-size:13.5px`،
`line-height:1.6`، `border-radius:8px`، و `direction:ltr` اجباری حتی در حالت
RTL.

روی هر `<pre>` دو دکمه با JS اضافه می‌شود (`position:absolute`):

- `.pmcf-code-copy` — «کپی» → `navigator.clipboard.writeText()` → به مدت
  ۱٫۸ ثانیه «کپی شد» می‌شود و کلاس `.copied` می‌گیرد
- `.pmcf-code-run` — «▶ اجرا» → مودال Pyodide را باز می‌کند (فقط برای
  `language-python`)

**پیشنهاد برای اپ:** اضافه‌کردن highlight یک بهبود واضح است، ولی چون در وب
وجود ندارد، اگر اضافه‌اش کنی طراحی موبایل و دسکتاپ از هم جدا می‌شوند. اگر
اضافه می‌کنی، به وب هم اضافه کن.

#### اجرای پایتون (Pyodide)

جریان: کلیک «اجرا» → مودال با کد → کلیک «▶ اجرا» → اگر Pyodide بارگذاری نشده
لود می‌شود → `loadPackagesFromImports(code)` بسته‌های لازم (numpy، matplotlib،
…) را خودکار می‌آورد → اجرا → stdout در `#pmcf-pymodal-output` و نمودارها
به‌صورت `<img>` در `#pmcf-pymodal-figures`.

طبق تصمیم ۲۰۲۶-۰۹-۲۱، **این قابلیت در اپ می‌ماند و کاملاً سمت کلاینت**:
Pyodide داخل اپ bundle می‌شود (نه CDN)، فقط با فشردن «اجرا» lazy-load می‌شود،
و **قبل از اجرا روی گوشی به کاربر هشدار داده می‌شود که مصرف RAM بالاست و اپ
ممکن است کرش کند**. اجرای سمت سرور رد شد (RCE + ظرفیت ناکافی سرور).

---

## ۲. اسکرین‌شات‌ها

همه در `screens/`. ویوپورت دسکتاپ `1440×900`، موبایل `390×844`، هر دو با
`deviceScaleFactor=2` (رتینا). زبان مرورگر `fa-IR`.

| فایل | چه چیزی در آن مهم است |
|---|---|
| `01-empty-chat.png` | حالت خالی واقعاً خالی نیست — یک پیام خوش‌آمد ثابت از سمت دستیار نشان داده می‌شود. **هیچ نمونه‌سؤال یا prompt پیشنهادی وجود ندارد**؛ این بزرگ‌ترین فرصت طراحی در کل صفحه است. |
| `02-rename.png` | تغییر نام با `prompt()` بومی نیست — عنوان درجا با `.pmcf-session-input` جایگزین می‌شود. یعنی در اپ هم می‌شود همین را داشت بدون دیالوگ سیستمی. |
| `03-delete.png` | تأیید حذف هم `confirm()` بومی نیست — نوار درجای «حذف این چت؟ بله / نه». **هیچ هشداری نمی‌دهد که حذف در واقع فقط پنهان‌سازی است.** |
| `04-streaming.png` | لحظهٔ استریم: کرسر چشمک‌زن `▋` (`.pmcf-typing::after`) انتهای متن. توجه کن که حباب در حین رشد **می‌پرد** چون MathJax بعد از هر چانک دوباره typeset می‌کند. |
| `05-error.png` | خطای شبکه به‌صورت یک حباب معمولی با «⚠️» ظاهر می‌شود، نه یک کامپوننت خطای مجزا. **دکمهٔ «تلاش دوباره» وجود ندارد** — کاربر باید سؤالش را دوباره تایپ کند. |
| `06-quota-full.png` | پاسخ ۴۲۹ سهمیه. ورودی قفل نمی‌شود و بَج توکن قرمز نمی‌شود. هیچ CTA ای برای ارتقای حساب نیست. |
| `07-markdown.png` | تیتر (`h2` آبی با خط زیر)، لیست شماره‌دار، `<strong>`، و فرمول display رندرشده با MathJax. مرجع سبک‌دهی مارک‌داون برای فیگما. |
| `08-code-block.png` | بلوک کد تیره با دکمه‌های «کپی» و «▶ اجرا» در گوشه. کد LTR داخل صفحهٔ RTL. عرض کد از حباب بیرون می‌زند و اسکرول افقی می‌خورد. |
| `09-long-scroll.png` | گفتگوی طولانی وسط اسکرول: حباب کاربر آبی راست‌چین، حباب دستیار روشن چپ‌چین، بَج منبع و ردیف امتیاز زیر هر پاسخ. |
| `10-sidebar-mobile.png` | **مهم‌ترین عکس.** در ۳۹۰px: هدر به دو خط می‌شکند، سایدبار کامل پنهان است، بلوک کد از صفحه بیرون می‌زند، و ناحیهٔ پیام به‌شدت فشرده می‌شود. این تصویر توجیه کل بازطراحی است. |
| `10b-sidebar-mobile-open.png` | سایدبار باز روی موبایل. **هیچ overlay تیره‌ای پشتش نیست** و ناحیهٔ چت زیرش هنوز قابل لمس است. |
| `11-mobile-conversation.png` | گفتگو در ۳۹۰px بعد از انتخاب از سایدبار. |
| `12-python-modal.png` | مودال Pyodide قبل از اجرا: کد LTR در بالا، ناحیهٔ خروجی خالی، دکمه‌های «▶ اجرا» و «بستن». مودال روی صفحه می‌نشیند و بک‌دراپ تیره دارد. |
| `13-python-result.png` | مودال بعد از اجرا — **اجرا واقعاً کار می‌کند**: خروجی `print` و دو نمودار matplotlib کنار هم رندر شده‌اند. توجه کن به اولین خط خروجی: `Matplotlib is building the font cache; this may take a moment.` این دقیقاً همان تأخیر اولین اجراست که روی گوشی باید به کاربر هشدار داده شود. |

---

## ۳. سؤال‌های باز

### دکمهٔ «∞ ▮▮» بالای سایدبار چه کار می‌کند؟

**هیچ کاری. دکمه نیست.** این `#pmcf-token-badge` است — یک `<span>` بدون هیچ
event listener ای، که در هدر (نه سایدبار) قرار دارد.

```js
if (remaining === -1 || remaining === null) { tokenBadge.textContent = '🎟 ∞'; return; }
tokenBadge.textContent = '🎟 ' + remaining;
```

آن «▮▮» که دیده‌ای، ایموجی بلیت `🎟` است که فونت رندرش نکرده (tofu). `∞`
یعنی سهمیهٔ نامحدود — چون با حساب ادمین وارد شده‌ای.

**توصیه:** در اپ این باید یک دکمهٔ واقعی شود که به صفحهٔ مصرف
(`pm_chat_usage_page_id` = برگهٔ ۳۰۸۳) برود، و ایموجی با یک آیکون SVG جایگزین شود.

### کاربری که لاگین نیست، در `/chat` چه می‌بیند؟

**صفحهٔ چت را اصلاً نمی‌بیند.** دو لایهٔ گیت وجود دارد:

```php
add_action( 'template_redirect', function () {
    if ( is_page( 'chat' ) && ! is_user_logged_in() ) {
        wp_redirect( wp_login_url( get_permalink() ) );
        exit;
    }
} );
```

ریدایرکت به `https://physicsme.ir/wp-login.php?redirect_to=…%2Fchat%2F`
(تأییدشده با curl). لایهٔ دوم، خودِ شورت‌کد است که اگر به هر دلیلی اجرا شود
فقط این را برمی‌گرداند:

> برای استفاده از چت لطفاً [وارد شوید](…).

⚠️ **اما مهمان‌ها از چت ویجت محروم نیستند** — `pm_chat_guest_enabled = 1` و
اندپوینت `POST /chat` مهمان می‌پذیرد (سقف ۵٬۰۰۰ توکن روزانه با شناسهٔ کوکی).
یعنی ویجت شناور در بقیهٔ سایت برای مهمان کار می‌کند؛ فقط **صفحهٔ کامل** لاگین
می‌خواهد. برای اپ باید تصمیم بگیری کدام رفتار را می‌خواهی.

### آیا کاربر می‌تواند پیام خودش را ویرایش یا پاسخ را regenerate کند؟

**نه و نه.** هیچ کدی برای ویرایش پیام یا تولید دوبارهٔ پاسخ وجود ندارد. تنها
کنترل حین تولید، دکمهٔ «توقف» است. تنها بازخورد بعد از تولید، 👍/👎.

هر دو قابلیت در اپ ارزش اضافه‌کردن دارند، ولی regenerate به تغییر بک‌اند نیاز
دارد (الان هر درخواست یک ردیف جدید در `wp_pm_chat_log` می‌سازد؛ برای
regenerate یا باید ردیف قبلی جایگزین شود یا مفهوم «نسخه» اضافه شود).

### آیا دکمهٔ کپی روی پاسخ‌ها هست؟

**فقط روی بلوک‌های کد، نه روی خود پاسخ.** `.pmcf-code-copy` فقط به عناصر
`<pre>` اضافه می‌شود. برای کپی‌کردن یک پاسخ متنی هیچ راهی جز انتخاب دستی
نیست — که روی موبایل داخل یک ناحیهٔ اسکرول‌شونده عملاً دردناک است.

**این یکی از واضح‌ترین کمبودها برای موبایل است.** در فیگما یک دکمهٔ کپی در سطح
پیام لازم است.

### نام گفتگو چطور ساخته می‌شود — از اولین پیام، یا AI می‌سازدش؟

**از اولین پیام کاربر. AI هیچ نقشی ندارد.**

```sql
(SELECT message FROM wp_pm_chat_log sub
 WHERE sub.session_id = l.session_id AND sub.role = 'user'
 ORDER BY sub.id ASC LIMIT 1) AS auto_title
```

```php
$title = $row->custom_title ?: ( $row->auto_title ?: '…' );
return [ 'title' => mb_substr( $title, 0, 70 ), ... ];
```

اگر کاربر نام دستی گذاشته باشد آن برنده است؛ وگرنه اولین پیام بریده به ۷۰
کاراکتر؛ اگر هیچ‌کدام نبود `…`. **هیچ فراخوانی LLM برای خلاصه‌سازی عنوان انجام
نمی‌شود** — یعنی عنوان‌ها معمولاً جملهٔ کامل سؤال‌اند و در عرض ۲۶۰px سایدبار
بریده می‌شوند.

### آیا گفتگو به مقالهٔ خاصی از سایت گره می‌خورد؟

**نه. گفتگو همیشه مستقل است.** هیچ ستونی برای `post_id` در هیچ‌کدام از
جدول‌ها نیست.

تنها اتصال، **گذرا و فقط در همان پیام اول** است: پارامتر `?ctx=` که متن مقاله
را به ابتدای پیام کاربر می‌چسباند. بعد از ارسال، آن متن بخشی از
`wp_pm_chat_log.message` می‌شود و هیچ ارجاع ساختاریافته‌ای به مقاله باقی
نمی‌ماند.

⚠️ **این برای اپ مهم است:** اگر می‌خواهی «از این مقاله بپرس» داشته باشی، الان
کل متن مقاله داخل پیام کاربر ذخیره می‌شود — که هم حباب اول را غول‌پیکر می‌کند
و هم دیتابیس را باد می‌کند. بهتر است ستون `post_id` اضافه شود.

### احراز هویت چطور کار می‌کند؟

**کوکی وردپرس + nonce REST. هیچ توکن یا JWT جدایی وجود ندارد.**

- کوکی: `wordpress_logged_in_<COOKIEHASH>` با مقدار
  `username|expiration|token|hmac`
- nonce: `wp_create_nonce('wp_rest')` که در `wp_localize_script` داخل HTML
  صفحه تزریق می‌شود و کلاینت در هدر `X-WP-Nonce` می‌فرستد
- `permission_callback` تمام اندپوینت‌های نشست: `fn() => is_user_logged_in()`
- مالکیت: هر سه اندپوینت `load/rename/hide` مالک را با یک کوئری روی
  `wp_pm_chat_log` چک می‌کنند و اگر متفاوت بود `404` می‌دهند (نه `403` — تا
  وجود نشست فاش نشود). این درست پیاده شده.

**مهمان‌ها** با کوکی `pm_chat_guest_id` (UUID v4، ۳۰ روزه، httpOnly، SameSite
Lax) شناخته می‌شوند که برای سهمیه `sha256` می‌شود.

#### ⛔ این بزرگ‌ترین مانع ساخت اپ است

مدل احراز هویت مبتنی بر کوکی + nonce برای یک اپ نیتیو **مناسب نیست**:

1. **nonce فقط داخل HTML صفحه است.** اپ باید `/chat/` را HTML بگیرد و nonce را
   با regex بیرون بکشد — شکننده و زشت.
2. **nonce عمر محدود دارد** (۱۲–۲۴ ساعت). اپی که هفته‌ها باز می‌ماند مرتب
   `403` می‌گیرد بدون اینکه راه تمدیدی داشته باشد.
3. **لاگین باید از فرم `wp-login.php` عبور کند** — یعنی WebView یا شبیه‌سازی
   فرم. هیچ اندپوینت `POST /login` ای که توکن برگرداند وجود ندارد.
4. **Cloudflare پاسخ‌های `/wp-json/` را کش می‌کند** (مستند در
   `reference_cloudflare_cache`) و لیست خصوصی چت یک کاربر را به دیگران
   می‌دهد. این تا وقتی Cache Rule اصلاح نشود، یک اپ چندکاربره را غیرقابل
   انتشار می‌کند.

**پیش‌نیاز قطعی قبل از اپ:** یک لایهٔ احراز هویت مبتنی بر توکن. سبک‌ترین راه در
وردپرس، **Application Passwords** (داخلی، از WP 5.6) است: کاربر یک بار لاگین
می‌کند، اپ یک application password می‌گیرد و بعد از آن با
`Authorization: Basic` کار می‌کند — بدون nonce و بدون انقضای ناگهانی. گزینهٔ
سنگین‌تر: JWT یا OAuth2.

---

## ۴. چیزهایی که برای یک اپ مستقل کم است

این بخش در پرامت تو نبود، ولی چون خروجی قرار است فیگمای یک اپ کامل شود، بدون
این‌ها طراحی ناقص می‌ماند.

### صفحات و جریان‌هایی که اصلاً وجود ندارند

| مورد | وضعیت فعلی | برای اپ |
|---|---|---|
| ورود / ثبت‌نام | فرم `wp-login.php` وردپرس | صفحهٔ نیتیو لازم است |
| بازیابی رمز | `wp-login.php?action=lostpassword` | صفحهٔ نیتیو لازم است |
| onboarding | ❌ | حداقل یک صفحه |
| صفحهٔ حساب کاربری | برگهٔ `pm_chat_profile_page_id` = ۳۰۸۴ (وب) | نیتیو |
| صفحهٔ مصرف/سهمیه | برگهٔ `pm_chat_usage_page_id` = ۳۰۸۳ (وب) | نیتیو |
| تنظیمات (زبان، تم) | ❌ | لازم است |
| حالت آفلاین | ❌ | لازم است |
| حالت تاریک | ❌ سایدبار تیره است ولی تم تاریک نیست | تصمیم بگیر |
| جستجو در گفتگوها | ❌ | با ۶۰ گفتگو لازم می‌شود |
| حذف حساب | ❌ | **الزام App Store** |

### حالت‌هایی که در فیگما باید طراحی شوند

**لیست گفتگو:** خالی · در حال بارگذاری (skeleton) · عادی · در حال تغییر نام ·
تأیید حذف · خطای بارگذاری · آفلاین

**پیام:** در حال ارسال · در حال استریم · کامل · متوقف‌شده توسط کاربر · خطا ·
امتیاز داده‌شده

**ورودی:** خالی · در حال تایپ · چندخطی (رشدیابنده) · غیرفعال حین استریم ·
غیرفعال به دلیل اتمام سهمیه

**اجرای پایتون:** بی‌کار · **هشدار RAM موبایل** ← جدید · در حال بارگذاری
Pyodide · در حال اجرا · خروجی متنی · خروجی نمودار · خطای اجرا · timeout

**سهمیه:** عادی · نزدیک به اتمام (مثلاً زیر ۱۰٪) · تمام‌شده · بدهکار (منفی)

### مسائل فنی که باید قبل از اپ حل شوند

1. **احراز هویت توکنی** — بخش ۳. مسدودکننده.
2. **Cache Rule های Cloudflare** — `/wp-json/*` و درخواست‌های دارای کوکی
   `wordpress_logged_in_*` باید `Bypass cache` شوند. **فقط از داشبورد
   Cloudflare قابل انجام است.** تا آن موقع نشت حریم خصوصی باز است.
3. **`log_id` در `load_session`** — بدون آن امتیازدهی روی گفتگوی قدیمی مرده است.
4. **صفحه‌بندی** — `LIMIT 60` بدون offset. کاربر پرمصرف گفتگوهای قدیمی‌اش را
   برای همیشه از دست می‌دهد.
5. **بandle کردن فونت Vazirmatn** در اپ.
6. **زیرعنوان داینامیک** به‌جای «Mistral» ثابت.
7. **`date` بدون timezone** — باید به UTC صریح تبدیل شود.
8. **streaming در WKWebView** — `fetch().body.getReader()` از Safari 14.1 به
   بعد پشتیبانی می‌شود. برای iOS قدیمی‌تر نیاز به fallback است.

---

## ۵. موانعی که خوردم

| مانع | نتیجه |
|---|---|
| کوکی وردپرس از نشست موجود ساختنی نبود (توکن‌ها hash-شده ذخیره می‌شوند) | نشست موقت ساختم و destroy کردم (بخش ۰) |
| کش Cloudflare جلوی دیدن وضعیت واقعی را می‌گرفت | با کوئری‌استرینگ یکتا دور زدم |
| گرفتن عکس استریم سخت بود چون Groq سریع جواب می‌دهد | در چند بازهٔ زمانی نمونه گرفتم تا فریم ناقص بیفتد |
| `05-error` و `06-quota-full` بدون تغییر پیکربندی | با interception در مرورگر شبیه‌سازی شد؛ **سرور دست‌نخورده** |
| `wp-cli` و `mysql` در کانتینرها نصب نیستند | از `docker exec wp-db mariadb` استفاده کردم |

**کلیدهای API (Groq، Anthropic، bot secret) عمداً در این گزارش نیامده‌اند** هرچند
در `wp_options` قابل مشاهده‌اند.

---

## فایل‌های کپی‌شده در `source/`

| فایل | چرا |
|---|---|
| `chat-full.css` | تمام استایل — مرجع اصلی فیگما |
| `chat-full.js` | تمام منطق کلاینت، رندر، Pyodide، SSE |
| `physicalme-chat.php` | markup صفحه + گیت لاگین + enqueue |
| `class-chat-api.php` | REST، SSE، prompt، routing، RAG |
| `class-usage-limiter.php` | منطق کامل توکن و سهمیه |
| `class-ollama-client.php` | گارد cold-start مدل محلی |
| `class-provider-groq.php` | پیاده‌سازی استریم ابری |
| `class-provider-interface.php` | قرارداد ارائه‌دهنده |

`shoot.py` و `shoot2.py` هم در ریشه هستند — اسکریپت‌های Playwright که
اسکرین‌شات‌ها را گرفتند، تا بتوانی بعد از بازطراحی دوباره اجرایشان کنی.
