# استقرار — اپ جدا از سایت

## تصویر کلی

```
physicsme.ir           ← وردپرس موجود. دست‌نخورده.
                          هم سایت دسکتاپ، هم API محتوا
                          ↑
                          │ fetch (cross-origin)
                          │
app.physicsme.ir       ← این مخزن. فقط موبایل.
                          دسکتاپ از اینجا به physicsme.ir ریدایرکت می‌شود
```

وردپرس هیچ تغییری نمی‌کند جز اضافه‌شدن چند endpoint و هدر CORS.

---

## ۱. زیردامنه یا زیرمسیر؟

هر دو کار می‌کنند. تفاوتشان در یک چیز است:

**`app.physicsme.ir` (زیردامنه)** — کاملاً جدا. سرویس‌ورکر، کش و ذخیره‌سازی
اپ هیچ تداخلی با سایت ندارد. ولی origin متفاوت است، پس **CORS لازم دارد**.

**`physicsme.ir/app/`** (زیرمسیر) — هم‌origin، پس CORS لازم نیست. اما باید
مطمئن شوی وردپرس این مسیر را به خودش نمی‌گیرد، و scope سرویس‌ورکر را
دقیق `/app/` بگذاری وگرنه کل سایت را کش می‌کند.

با ساختار فعلی تو (کلادفلر تانل جلوی داکر روی لپ‌تاپ)، **زیردامنه تمیزتر
است** — یک مسیر تانل جدا، بدون درگیری با قوانین وردپرس.

## ۲. CORS در وردپرس

اگر زیردامنه را انتخاب کردی، این در `functions.php` یا یک افزونهٔ کوچک لازم است:

```php
add_action('rest_api_init', function () {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function ($value) {
        $origin = get_http_origin();
        $allowed = ['https://app.physicsme.ir'];
        if ($origin && in_array($origin, $allowed, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
            header('Vary: Origin');
        }
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-WP-Nonce');
        return $value;
    });
}, 15);
```

`Allow-Credentials: true` فقط وقتی لازم است که نشست کاربر را با کوکی
منتقل کنی. اگر احراز هویت با توکن تلگرام و هدر `Authorization` باشد،
این خط را بردار — امن‌تر است.

> با `Allow-Credentials: true` هرگز `Access-Control-Allow-Origin: *`
> نگذار. مرورگر رد می‌کند، و اگر هم نمی‌کرد فاجعهٔ امنیتی بود.

## ۳. اندپوینت‌هایی که وردپرس باید بدهد

شکل داده‌ای که اپ انتظار دارد، در `FIXTURES` داخل `src/js/app.js` دقیقاً
نوشته شده. همان را برگردان:

| متد | مسیر | برمی‌گرداند |
|---|---|---|
| GET | `/nodes?parent=<id>` | آرایهٔ گره‌ها (دسته، فصل، بند) |
| GET | `/article/<id>` | مقاله با بلوک‌های پاراگراف که **هرکدام `id` دارند** |
| GET | `/me/quota` | `{ used, total }` |
| POST | `/ask` | `{ paragraphId, articleId, target, text }` |

**نکتهٔ حیاتی:** هر پاراگراف باید `id` پایدار داشته باشد. قابلیت «از این
پاراگراف بپرس» بدون آن کار نمی‌کند — نه AI می‌فهمد کدام بخش، نه سؤالی که
برای تو می‌آید معنا دارد. اگر وردپرس الان id پاراگراف ندارد، این اولین
چیزی است که باید اضافه شود.

## ۴. الزامات میزبانی

- **HTTPS اجباری است.** بدون آن سرویس‌ورکر ثبت نمی‌شود و PWA نصب نمی‌شود.
  کلادفلر تانل این را می‌دهد.
- `manifest.webmanifest` باید با نوع `application/manifest+json` سرو شود.
- `sw.js` نباید کش طولانی بگیرد، وگرنه به‌روزرسانی اپ گیر می‌کند:
  `Cache-Control: no-cache` برایش بگذار.

## ۵. ریدایرکت دسکتاپ

فعلاً در جاوااسکریپت انجام می‌شود (`desktopGuard` در `app.js`) که کافی است.

اگر خواستی سمت سرور هم باشد — سریع‌تر است چون قبل از دانلود اپ اتفاق می‌افتد —
در کلادفلر یک Redirect Rule بساز. اما **حواست باشد**: تشخیص سمت سرور فقط
User-Agent دارد و `pointer: fine` را نمی‌بیند، پس دقتش کمتر است. ترکیب هر دو
بهترین نتیجه را می‌دهد: قانون سرور برای موارد واضح، جاوااسکریپت برای بقیه.

هرگز ریدایرکت دوطرفه نساز. اگر `physicsme.ir` هم موبایل را به اپ بفرستد و
اپ هم دسکتاپ را به سایت، یک حلقه می‌سازی که با کش کلادفلر عیب‌یابی‌اش
کابوس است.
