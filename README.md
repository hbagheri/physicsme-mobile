# من فیزیکی — وب اپلیکیشن

PWA فارسی و RTL برای خواندن فیزیک. بدون مرحلهٔ build اجرا می‌شود.

## اجرای محلی

```bash
python3 -m http.server 8080
# http://localhost:8080
```

Service worker فقط روی `https` یا `localhost` ثبت می‌شود — این محدودیت مرورگر است.

## تست روی آیفون

۱. لپ‌تاپ و آیفون روی یک شبکه باشند
۲. `python3 -m http.server 8080 --bind 0.0.0.0`
۳. در سافاری آیفون: `http://<IP لپ‌تاپ>:8080`
۴. برای تست حالت نصب‌شده: اشتراک‌گذاری ← Add to Home Screen

نکته: بدون `https` نه service worker ثبت می‌شود و نه `standalone` درست کار
می‌کند. برای تست کامل از Cloudflare Tunnel استفاده کن.

## وصل‌کردن به وردپرس

در `src/js/app.js` فقط بدنهٔ چهار تابع داخل `api` را عوض کن. ویوها دست‌نخورده
می‌مانند.

## هنوز مانده

- پوشهٔ `icons/` خالی است — سه فایل PNG لازم است: `icon-192.png`،
  `icon-512.png`، `icon-maskable-512.png` و `icon-180.png` برای apple-touch-icon
- تصویر پس‌زمینهٔ سایت جایگزین کلاس `.board` در `app.css` شود
- قالب‌های chat، interactive و account

بقیه در `CLAUDE.md`.
