/* =====================================================================
   من فیزیکی — i18n
   ---------------------------------------------------------------------
   One dictionary, two languages, no build step. Everything the user can
   read lives here; nothing in app.js or chat.js spells a sentence out.

   Two things follow the language rather than the direction:
     · digits   — Persian uses ۰-۹ and ٬ as the group separator
     · ordering — `dir` flips the whole layout through logical properties

   Direction is written to three places on <html>: `dir` (for the browser),
   `lang` (for hyphenation and the screen reader), and `data-dir` (for the
   one CSS value logical properties cannot mirror — see --drawer-park).
   ===================================================================== */

window.PMI18n = (function () {
  'use strict';

  var STR = {

    fa: {
      'app.name':            'من فیزیکی',
      'app.tagline':         'خواندن و یادگیری فیزیک به زبان فارسی',

      'a11y.back':           'بازگشت',
      'a11y.account':        'حساب کاربری',

      'auth.title':          'ثبت‌نام رایگان',
      'auth.h':              'حسابت را بساز',
      'auth.why':            'شمارهٔ موبایل نمی‌گیریم. با تلگرام یا ایمیل ثبت‌نام کن؛ همان حساب در سایت هم کار می‌کند و پاسخ استادها هم در تلگرام به تو می‌رسد.',
      'auth.start':          'ثبت‌نام با تلگرام',
      'auth.withEmail':      'ثبت‌نام با ایمیل',
      'auth.noMethod':       'ثبت‌نام همین حالا روی سرور در دسترس نیست. کمی بعد دوباره امتحان کن.',
      'auth.waitTitle':      'در تلگرام تأیید کن',
      'auth.waitBody':       'منتظر تأیید ربات…',
      'auth.step1':          'ربات <b>{bot}</b> را در تلگرام باز کن.',
      'auth.step2':          'این کد را کپی کن:',
      'auth.step3':          'کد را در همان گفتگو برای ربات بفرست. ربات حسابت را می‌سازد و همین‌جا وارد می‌شوی.',
      'auth.copy':           'کپی',
      'auth.copied':         'کپی شد ✓',
      'auth.cancel':         'انصراف',
      'auth.checking':       'یک لحظه…',
      'auth.email':          'ایمیل',
      'auth.emailPh':        'name@example.com',
      'auth.sendCode':       'ارسال کد',
      'auth.sending':        'در حال ارسال…',
      'auth.codeSent':       'کد شش‌رقمی به {email} فرستاده شد.',
      'auth.code6':          'کد شش‌رقمی',
      'auth.verify':         'تأیید',
      'auth.errTitle':       'ثبت‌نام انجام نشد',
      'auth.errBody':        'تأییدی دریافت نشد. شاید مهلت تمام شد یا اینترنت قطع شد.',
      'auth.retry':          'تلاش دوباره',
      'auth.openTelegram':   'باز کردن تلگرام',

      'gate.title':          'این بخش برای اعضاست',
      'gate.body':           'یک فصل را رایگان و بدون حساب می‌خوانی. برای بقیهٔ مقالات و توکن بیشترِ هوش مصنوعی، حساب بساز.',
      'gate.join':           'ثبت‌نام رایگان',
      'gate.free':           'رایگان است و شمارهٔ موبایل نمی‌خواهد.',

      'account.title':       'حساب کاربری',
      'account.name':        'نام',
      'account.namePh':      'نامت را بنویس',
      'account.uname':       'نام کاربری',
      'account.unamePh':     'مثلاً ali.reza',
      'account.unameHint':   'با همین وارد سایت می‌شوی. حروف انگلیسی، ۳ تا ۲۰ نویسه.',
      'account.unameAuto':   'این نام را خودمان ساختیم؛ می‌توانی عوضش کنی.',
      'account.unameSave':   'تغییر نام کاربری',
      'account.unameOk':     'نام کاربری عوض شد',
      'account.telegram':    'تلگرام',
      'account.save':        'ذخیره',
      'account.saved':       'ذخیره شد',
      'account.usage':       'مصرف و سهمیه',
      'account.usageSub':    'توکن امروز و هفت روز گذشته',
      'account.settings':    'تنظیمات',
      'account.settingsSub': 'زبان، تم، حافظهٔ پایتون',
      'account.logout':      'خروج از حساب',
      'account.logoutSub':   'گفتگوها روی سرور می‌مانند',
      'account.delete':      'حذف حساب',
      'account.deleteSub':   'حساب و همهٔ گفتگوها برای همیشه پاک می‌شوند',
      'account.deleteAsk':   'حساب برای همیشه حذف شود؟',
      'account.deleteBody':  'این کار برگشت‌پذیر نیست. حساب، گفتگوها، مصرف توکن و پیوند تلگرام پاک می‌شوند.',
      'account.deleteYes':   'بله، حذف کن',
      'account.deleteNo':    'انصراف',
      'account.guest':       'مهمان',
      'account.signIn':      'برای ذخیرهٔ گفتگوها وارد شو',

      'usage.title':         'مصرف و سهمیه',
      'usage.today':         'امروز',
      'usage.used':          'مصرف‌شده',
      'usage.limit':         'سقف روزانه',
      'usage.remaining':     'باقی‌مانده',
      'usage.debtNote':      'پاسخ آخر از سقف عبور کرد. این مقدار از سهمیهٔ فردا کم می‌شود.',
      'usage.week':          'هفت روز گذشته',
      'usage.noData':        'هنوز مصرفی ثبت نشده',
      'usage.unit':          'توکن',
      'day.sat':             'ش',
      'day.sun':             'ی',
      'day.mon':             'د',
      'day.tue':             'س',
      'day.wed':             'چ',
      'day.thu':             'پ',
      'day.fri':             'ج',

      'settings.title':      'تنظیمات',
      'settings.language':   'زبان',
      'settings.theme':      'تم',
      'settings.themeLight': 'روشن',
      'settings.themeDark':  'تیره',
      'settings.themeAuto':  'سیستم',
      'settings.storage':    'حافظه',
      'settings.pyCache':    'حافظهٔ مفسر پایتون',
      'settings.pyCacheSub': 'پس از پاک کردن، اولین اجرای بعدی دوباره حدود ۲۰ ثانیه طول می‌کشد.',
      'settings.clear':      'پاک کردن',
      'settings.cleared':    'پاک شد',
      'settings.about':      'دربارهٔ اپ',
      'settings.version':    'نسخهٔ {v}',

      'onb.skip':            'رد کردن',
      'onb.next':            'بعدی',
      'onb.start':           'شروع',
      'onb.1t':              'کتاب نیست، مسیر است',
      'onb.1b':              'از دبیرستان تا هالیدی، هر فصل به بندهای کوتاه شکسته شده تا بتوانی یک بند را تمام کنی و برگردی.',
      'onb.2t':              'هر جا گیر کردی، علامت ؟',
      'onb.2b':              'کنار هر پاراگراف یک ؟ هست. بزن تا همان پاراگراف با متنش به دستیار برود — یا برای استاد فرستاده شود.',
      'onb.3t':              'کد پایتون را همین‌جا اجرا کن',
      'onb.3b':              'نمودارها روی همین گوشی ساخته می‌شوند، نه روی سرور. اولین اجرا کمی طول می‌کشد و حافظه می‌خواهد.',
      'a11y.ai':             'دستیار هوش مصنوعی',
      'a11y.close':          'بستن',
      'a11y.conversations':  'گفتگوها',
      'a11y.quota':          'سهمیهٔ توکن',
      'a11y.send':           'ارسال',
      'a11y.stop':           'توقف',
      'a11y.askPara':        'پرسش دربارهٔ این پاراگراف',
      'a11y.copyAnswer':     'کپی پاسخ',
      'a11y.helpful':        'مفید بود',
      'a11y.notHelpful':     'مفید نبود',
      'a11y.rename':         'تغییر نام',
      'a11y.delete':         'حذف',

      'list.title':          'فصل‌ها',
      'banner.copyright':    'به‌دلیل محدودیت‌های کپی‌رایت، به‌جای اصل کتاب‌ها جزوه‌ای بر پایهٔ آن‌ها آمده است. پرسش‌ها تا حد ممکن به سؤالات اصلی نزدیک‌اند، اما حق نشر رعایت شده.',

      'sheet.paraTitle':     'این پاراگراف را نفهمیدم',
      'sheet.paraSub':       'پاراگراف {n} انتخاب شده است.',
      'sheet.aiTitle':       'دستیار من فیزیکی',
      'sheet.aiSub':         'سؤالت را بپرس، یا یکی از دو مسیر زیر را انتخاب کن.',
      'sheet.optAi':         'از دستیار بپرس',
      'sheet.optAiSub':      'پاسخ فوری، از سهمیهٔ توکن تو کم می‌شود',
      'sheet.optTutor':      'برای استاد بفرست',
      'sheet.optTutorSub':   'پاسخ در تلگرام به تو اطلاع داده می‌شود',
      'sheet.quota':         'سهمیهٔ امروز: <b>{left} پرسش</b> از {total} باقی مانده',
      'sheet.draftAsk':      'این پاراگراف را نفهمیدم، ساده‌تر توضیح بده.',
      'sheet.citePara':      'پاراگراف {n}',

      'chat.new':            'گفتگوی جدید',
      'chat.assistant':      'دستیار من فیزیکی',
      'chat.fresh':          'گفتگوی تازه',
      'chat.conversations':  'گفتگوها',
      'chat.search':         'جست‌وجو در گفتگوها',
      'chat.quotaToday':     'سهمیهٔ امروز:',
      'chat.placeholder':    'سؤالت را بنویس…',
      'chat.blocked':        'تا فردا نمی‌توانی سؤال بفرستی',
      'chat.labNote':        'نسخهٔ آزمایشی — دستیار هنوز در حال آموزش است. به پاسخ‌ها کاملاً اعتماد نکن.',
      'chat.emptyTitle':     'چه چیزی را نفهمیدی؟',
      'chat.emptyBody':      'هر جای مقاله گیر کردی، روی علامت ؟ کنار همان پاراگراف بزن تا سؤالت با متنش اینجا بیاید. یا یکی از این‌ها را امتحان کن:',
      'chat.thinking':       'در حال فکر کردن…',
      'chat.stopped':        'تولید پاسخ متوقف شد — این متن ذخیره نشده است',
      'chat.retry':          'تلاش دوباره',
      'chat.nothingFound':   'چیزی پیدا نشد',
      'chat.provider':       'پاسخ‌دهنده: {name}',
      'chat.tokens':         '{n} توکن',
      'chat.deleteAsk':      'این گفتگو حذف شود؟',
      'chat.deleteKeeps':    'از فهرست می‌رود؛ مصرف توکن ثبت‌شده باقی می‌ماند.',
      'chat.deleteYes':      'حذف',
      'chat.deleteNo':       'انصراف',

      'quota.unknown':       'سهمیه پس از اولین پاسخ مشخص می‌شود',
      'quota.debt':          'سهمیهٔ امروز تمام شده و <b>{n} توکن</b> به فردا منتقل می‌شود',
      'quota.empty':         'سهمیهٔ امروز تمام شد',
      'quota.left':          '<b>{n} توکن</b> از سهمیهٔ امروز باقی مانده',
      'quota.wallTitle':     'سقف سؤال‌های امروز تمام شد',
      'quota.wallDebt':      'آخرین پاسخ از سقف عبور کرد، پس فردا با {n} توکن بدهی شروع می‌کنی.',
      'quota.wallFresh':     'فردا سهمیهٔ تازه می‌گیری.',
      'quota.wallCta':       'دیدن مصرف و ارتقای حساب',

      'group.today':         'امروز',
      'group.yesterday':     'دیروز',
      'group.lastWeek':      'هفتهٔ گذشته',
      'group.older':         'قدیمی‌تر',

      'topic.code':          'کد',
      'topic.electricity':   'الکتریسیته',
      'topic.mechanics':     'مکانیک',
      'topic.heat':          'گرما',
      'topic.light':         'نور',
      'topic.quantum':       'کوانتوم',
      'topic.physics':       'فیزیک',
      'topic.new':           'تازه',

      'src.site':            '📖 از مقالات سایت',
      'src.external':        '🔗 منبع خارجی',
      'src.general':         '💭 دانش عمومی',
      'src.code':            '🐍 کد',

      'code.copy':           'کپی',
      'code.copied':         'کپی شد',
      'code.run':            '▶ اجرا',

      'py.title':            '🐍 اجرای کد Python',
      'py.warnTitle':        '⚠️ اجرا روی همین گوشی انجام می‌شود',
      'py.warnBody':         'کد روی سرور اجرا نمی‌شود. مفسر پایتون داخل اپ بالا می‌آید:',
      'py.warn1':            'اولین اجرا حدود ۲۰ ثانیه طول می‌کشد',
      'py.warn2':            'حدود ۳۰۰ مگابایت حافظه می‌گیرد',
      'py.warn3':            'روی گوشی‌های قدیمی ممکن است اپ بسته شود',
      'py.start':            'شروع اجرا',
      'py.cancel':           'لغو',
      'py.close':            'بستن',
      'py.preparing':        'در حال آماده‌سازی…',
      'py.loadingInterp':    'بارگذاری مفسر پایتون…',
      'py.loadingPkgs':      'آماده‌سازی numpy و matplotlib…',
      'py.output':           'خروجی',
      'py.figure':           'نمودار',
      'py.rerun':            'اجرای دوباره',

      'err.unknown':         'خطای ناشناخته',
      'err.offline':         'ارتباط با دستیار قطع شد. اینترنت را بررسی کن.',
      'err.script':          'بارگذاری {src} شکست خورد',
      'err.load':            'محتوا بارگذاری نشد. اینترنت را بررسی کن.',
      'err.retry':           'تلاش دوباره',

      'node.school':         'فیزیک دبیرستان',
      'node.uni':            'فیزیک دانشگاه',
      'node.wiki':           'ویکی فیزیک',
      'node.ai':             'هوش مصنوعی',
      'node.riazi':          'رشتهٔ ریاضی',
      'node.tajrobi':        'رشتهٔ تجربی',

      'sub.book':            '{c} فصل · {l} درس',
      'sub.chapter':         '{l} درس',
      'group.lesson':        'بندها',
      'group.problems':      'پرسش‌ها و مسائل',
      'group.flashcards':    'کارت‌های حافظه',
      'save.do':             '📥 ذخیره برای آفلاین',
      'save.busy':           'در حال دریافت…',
      'save.done':           '✓ ذخیره شد — برای حذف بزن',
      'save.full':           'بیشتر از {n} مقاله نمی‌شود؛ یکی را حذف کن',
      'save.fail':           'دریافت نشد؛ دوباره بزن',
      'saved.title':         'مقاله‌های آفلاین',
      'saved.sub':           'چیزی که خودت ذخیره کرده‌ای',
      'saved.count':         '{n} از {max} مقاله',
      'saved.remove':        'حذف',
      'saved.clearAll':      'حذف همه',
      'saved.emptyTitle':    'هنوز چیزی ذخیره نشده',
      'saved.emptyBody':     'هر مقاله‌ای را که باز می‌کنی، دکمهٔ «ذخیره برای آفلاین» بالایش هست. فقط همان‌ها روی گوشی می‌مانند.',

      'ask.title':           'پرسش از استاد',
      'ask.intro':           'این را یک آدم می‌خواند و جواب می‌دهد، نه ربات. پس ممکن است چند ساعت طول بکشد. جواب هم در تلگرام به تو می‌رسد و هم همین‌جا زیر «پرسش‌های من» می‌ماند.',
      'ask.about':           'دربارهٔ این پاراگراف',
      'ask.label':           'سؤالت',
      'ask.ph':              'دقیقاً کجایش را نفهمیدی؟',
      'ask.send':            'بفرست',
      'ask.sending':         'در حال فرستادن…',
      'ask.short':           'سؤالت را کمی کامل‌تر بنویس.',
      'ask.okTitle':         'رسید ✓',
      'ask.okBody':          'سؤالت در صف است. تا جواب بیاید می‌توانی از هوش مصنوعی هم بپرسی.',
      'ask.okGo':            'پرسش‌های من',
      'ask.needAuth':        'برای پرسیدن از استاد باید حساب داشته باشی — رایگان است.',

      'inbox.title':         'پرسش‌های من',
      'inbox.sub':           'سؤال‌هایی که از استاد پرسیده‌ای',
      'inbox.emptyTitle':    'هنوز چیزی نپرسیده‌ای',
      'inbox.emptyBody':     'کنار هر پاراگراف یک «؟» هست. بزنی، می‌توانی همان‌جا از استاد بپرسی.',
      'inbox.waiting':       'منتظر جواب',
      'inbox.answered':      'جواب آمد',
      'inbox.new':           'تازه',
      'inbox.answer':        'جواب استاد',
      'inbox.openArticle':   'مقاله',
      'inbox.refresh':       'به‌روزرسانی',
      'inbox.asked':         'پرسیدی {t}',
      'inbox.answeredAt':    'جواب {t}',

      'time.now':            'همین حالا',
      'time.min':            '{n} دقیقه پیش',
      'time.hour':           '{n} ساعت پیش',
      'time.day':            '{n} روز پیش',

      'reader.video':        'تماشای ویدئو',

      'ios.tip':             'برای نصب روی آیفون: دکمهٔ <b>اشتراک‌گذاری</b> در نوار پایین سافاری، سپس <b>Add to Home Screen</b>.',

      'update.available':    'نسخهٔ {v} آمده است.',
      'update.get':          'دریافت',

      'seed.1':              'تفاوت بار و جرم چیست؟',
      'seed.2':              'قانون دوم نیوتن را با مثال توضیح بده',
      'seed.3':              'کد پایتون سقوط آزاد با نمودار بنویس',

      'status.searching':    'در حال جست‌وجو در مقالات سایت…',
      'status.thinking':     'در حال فکر کردن…',
      'status.writing':      'در حال نوشتن پاسخ…'
    },

    en: {
      'app.name':            'PhysicsMe',
      'app.tagline':         'Read and learn physics',

      'a11y.back':           'Back',
      'a11y.account':        'Account',

      'auth.title':          'Free sign-up',
      'auth.h':              'Create your account',
      'auth.why':            'We do not ask for a phone number. Sign up with Telegram or email; the same account works on the website, and tutor replies arrive in Telegram.',
      'auth.start':          'Sign up with Telegram',
      'auth.withEmail':      'Sign up with email',
      'auth.noMethod':       'Sign-up is not available on the server right now. Please try again shortly.',
      'auth.waitTitle':      'Confirm in Telegram',
      'auth.waitBody':       'Waiting for the bot…',
      'auth.step1':          'Open the <b>{bot}</b> bot in Telegram.',
      'auth.step2':          'Copy this code:',
      'auth.step3':          'Send the code to the bot. It creates your account and signs you in here.',
      'auth.copy':           'Copy',
      'auth.copied':         'Copied ✓',
      'auth.cancel':         'Cancel',
      'auth.checking':       'One moment…',
      'auth.email':          'Email',
      'auth.emailPh':        'name@example.com',
      'auth.sendCode':       'Send code',
      'auth.sending':        'Sending…',
      'auth.codeSent':       'A six-digit code was sent to {email}.',
      'auth.code6':          'Six-digit code',
      'auth.verify':         'Verify',
      'auth.errTitle':       'Sign-up did not go through',
      'auth.errBody':        'No confirmation came back. The link may have expired, or the connection dropped.',
      'auth.retry':          'Try again',
      'auth.openTelegram':   'Open Telegram',

      'gate.title':          'Members only',
      'gate.body':           'One chapter is free with no account. For every other article — and a larger AI allowance — create an account.',
      'gate.join':           'Sign up free',
      'gate.free':           'It is free and needs no phone number.',

      'account.title':       'Account',
      'account.name':        'Name',
      'account.namePh':      'Your name',
      'account.uname':       'Username',
      'account.unamePh':     'e.g. ali.reza',
      'account.unameHint':   'You sign in to the site with this. Latin letters, 3 to 20 characters.',
      'account.unameAuto':   'We made this name up; you can change it.',
      'account.unameSave':   'Change username',
      'account.unameOk':     'Username changed',
      'account.telegram':    'Telegram',
      'account.save':        'Save',
      'account.saved':       'Saved',
      'account.usage':       'Usage and allowance',
      'account.usageSub':    "Today's tokens and the last seven days",
      'account.settings':    'Settings',
      'account.settingsSub': 'Language, theme, Python storage',
      'account.logout':      'Sign out',
      'account.logoutSub':   'Conversations stay on the server',
      'account.delete':      'Delete account',
      'account.deleteSub':   'The account and every conversation are erased for good',
      'account.deleteAsk':   'Delete the account permanently?',
      'account.deleteBody':  'This cannot be undone. The account, conversations, token history and Telegram link are all erased.',
      'account.deleteYes':   'Yes, delete it',
      'account.deleteNo':    'Cancel',
      'account.guest':       'Guest',
      'account.signIn':      'Sign in to keep your conversations',

      'usage.title':         'Usage and allowance',
      'usage.today':         'Today',
      'usage.used':          'Used',
      'usage.limit':         'Daily cap',
      'usage.remaining':     'Remaining',
      'usage.debtNote':      'The last answer went over the cap. This much comes off tomorrow.',
      'usage.week':          'Last seven days',
      'usage.noData':        'Nothing recorded yet',
      'usage.unit':          'tokens',
      'day.sat':             'Sa',
      'day.sun':             'Su',
      'day.mon':             'Mo',
      'day.tue':             'Tu',
      'day.wed':             'We',
      'day.thu':             'Th',
      'day.fri':             'Fr',

      'settings.title':      'Settings',
      'settings.language':   'Language',
      'settings.theme':      'Theme',
      'settings.themeLight': 'Light',
      'settings.themeDark':  'Dark',
      'settings.themeAuto':  'System',
      'settings.storage':    'Storage',
      'settings.pyCache':    'Python interpreter storage',
      'settings.pyCacheSub': 'Once cleared, the next first run takes about 20 seconds again.',
      'settings.clear':      'Clear',
      'settings.cleared':    'Cleared',
      'settings.about':      'About',
      'settings.version':    'Version {v}',

      'onb.skip':            'Skip',
      'onb.next':            'Next',
      'onb.start':           'Start',
      'onb.1t':              'Not a book — a path',
      'onb.1b':              'From high school to Halliday, every chapter is cut into short sections, so you can finish one and come back.',
      'onb.2t':              'Stuck? Tap the ?',
      'onb.2b':              'Every paragraph has a ? beside it. Tap it and that paragraph goes to the assistant with its text — or to a tutor.',
      'onb.3t':              'Run the Python right here',
      'onb.3b':              'Plots are drawn on this phone, not on a server. The first run takes a moment and wants some memory.',
      'a11y.ai':             'AI assistant',
      'a11y.close':          'Close',
      'a11y.conversations':  'Conversations',
      'a11y.quota':          'Token allowance',
      'a11y.send':           'Send',
      'a11y.stop':           'Stop',
      'a11y.askPara':        'Ask about this paragraph',
      'a11y.copyAnswer':     'Copy answer',
      'a11y.helpful':        'Helpful',
      'a11y.notHelpful':     'Not helpful',
      'a11y.rename':         'Rename',
      'a11y.delete':         'Delete',

      'list.title':          'Chapters',
      'banner.copyright':    'Copyright rules mean the original books are not reproduced here. What you get is a set of notes written from the same topic map, with problems close in spirit to the originals.',

      'sheet.paraTitle':     'I did not follow this paragraph',
      'sheet.paraSub':       'Paragraph {n} is selected.',
      'sheet.aiTitle':       'PhysicsMe assistant',
      'sheet.aiSub':         'Ask your question, or pick one of the two routes below.',
      'sheet.optAi':         'Ask the assistant',
      'sheet.optAiSub':      'Answers right away, spends your token allowance',
      'sheet.optTutor':      'Send to a tutor',
      'sheet.optTutorSub':   'The reply reaches you on Telegram',
      'sheet.quota':         'Today: <b>{left} questions</b> left of {total}',
      'sheet.draftAsk':      'I did not follow this paragraph — explain it more simply.',
      'sheet.citePara':      'Paragraph {n}',

      'chat.new':            'New conversation',
      'chat.assistant':      'PhysicsMe assistant',
      'chat.fresh':          'Fresh conversation',
      'chat.conversations':  'Conversations',
      'chat.search':         'Search conversations',
      'chat.quotaToday':     'Today:',
      'chat.placeholder':    'Type your question…',
      'chat.blocked':        'You cannot send until tomorrow',
      'chat.labNote':        'Experimental — the assistant is still learning. Do not take answers on trust.',
      'chat.emptyTitle':     'What did not make sense?',
      'chat.emptyBody':      'Anywhere you get stuck in an article, tap the ? beside that paragraph and the question arrives here with its text. Or try one of these:',
      'chat.thinking':       'Thinking…',
      'chat.stopped':        'Generation stopped — this text was not saved',
      'chat.retry':          'Try again',
      'chat.nothingFound':   'Nothing found',
      'chat.provider':       'Answered by: {name}',
      'chat.tokens':         '{n} tokens',
      'chat.deleteAsk':      'Delete this conversation?',
      'chat.deleteKeeps':    'It leaves the list; the recorded token use stays.',
      'chat.deleteYes':      'Delete',
      'chat.deleteNo':       'Cancel',

      'quota.unknown':       'Allowance shows after the first answer',
      'quota.debt':          "Today's allowance is spent and <b>{n} tokens</b> carry over to tomorrow",
      'quota.empty':         "Today's allowance is spent",
      'quota.left':          "<b>{n} tokens</b> left of today's allowance",
      'quota.wallTitle':     "You have reached today's limit",
      'quota.wallDebt':      'The last answer went over the cap, so tomorrow starts {n} tokens in debt.',
      'quota.wallFresh':     'A fresh allowance arrives tomorrow.',
      'quota.wallCta':       'See usage and upgrade',

      'group.today':         'Today',
      'group.yesterday':     'Yesterday',
      'group.lastWeek':      'Last week',
      'group.older':         'Older',

      'topic.code':          'Code',
      'topic.electricity':   'Electricity',
      'topic.mechanics':     'Mechanics',
      'topic.heat':          'Heat',
      'topic.light':         'Light',
      'topic.quantum':       'Quantum',
      'topic.physics':       'Physics',
      'topic.new':           'New',

      'src.site':            '📖 From site articles',
      'src.external':        '🔗 External source',
      'src.general':         '💭 General knowledge',
      'src.code':            '🐍 Code',

      'code.copy':           'Copy',
      'code.copied':         'Copied',
      'code.run':            '▶ Run',

      'py.title':            '🐍 Run Python',
      'py.warnTitle':        '⚠️ This runs on your phone',
      'py.warnBody':         'The code does not run on a server. A Python interpreter starts inside the app:',
      'py.warn1':            'the first run takes about 20 seconds',
      'py.warn2':            'it takes roughly 300 MB of memory',
      'py.warn3':            'on older phones the app may be closed',
      'py.start':            'Start',
      'py.cancel':           'Cancel',
      'py.close':            'Close',
      'py.preparing':        'Preparing…',
      'py.loadingInterp':    'Loading the Python interpreter…',
      'py.loadingPkgs':      'Preparing numpy and matplotlib…',
      'py.output':           'Output',
      'py.figure':           'Figure',
      'py.rerun':            'Run again',

      'err.unknown':         'Unknown error',
      'err.offline':         'Lost contact with the assistant. Check your connection.',
      'err.script':          'Failed to load {src}',
      'err.load':            'Could not load this. Check your connection.',
      'err.retry':           'Try again',

      'node.school':         'High-school physics',
      'node.uni':            'University physics',
      'node.wiki':           'Physics wiki',
      'node.ai':             'AI assistant',
      'node.riazi':          'Mathematics track',
      'node.tajrobi':        'Experimental track',

      'sub.book':            '{c} chapters · {l} lessons',
      'sub.chapter':         '{l} lessons',
      'group.lesson':        'Sections',
      'group.problems':      'Questions and problems',
      'group.flashcards':    'Flashcards',
      'save.do':             '📥 Save for offline',
      'save.busy':           'Downloading…',
      'save.done':           '✓ Saved — tap to remove',
      'save.full':           'Room for {n} articles; remove one first',
      'save.fail':           'Download failed; tap to retry',
      'saved.title':         'Offline articles',
      'saved.sub':           'The ones you saved yourself',
      'saved.count':         '{n} of {max} articles',
      'saved.remove':        'Remove',
      'saved.clearAll':      'Remove all',
      'saved.emptyTitle':    'Nothing saved yet',
      'saved.emptyBody':     'Every article has a “Save for offline” button at the top. Only those stay on the phone.',

      'ask.title':           'Ask a teacher',
      'ask.intro':           'A person reads this and answers it, not a bot — so it can take a few hours. The answer arrives in Telegram and stays here under “My questions”.',
      'ask.about':           'About this paragraph',
      'ask.label':           'Your question',
      'ask.ph':              'Which part exactly lost you?',
      'ask.send':            'Send',
      'ask.sending':         'Sending…',
      'ask.short':           'Write a little more so it can be answered.',
      'ask.okTitle':         'Received ✓',
      'ask.okBody':          'Your question is queued. While you wait, the AI can have a go at it too.',
      'ask.okGo':            'My questions',
      'ask.needAuth':        'Asking a teacher needs an account — it is free.',

      'inbox.title':         'My questions',
      'inbox.sub':           'What you have asked a teacher',
      'inbox.emptyTitle':    'Nothing asked yet',
      'inbox.emptyBody':     'Every paragraph has a “?” beside it. Tap it and you can ask a teacher right there.',
      'inbox.waiting':       'Waiting for an answer',
      'inbox.answered':      'Answered',
      'inbox.new':           'New',
      'inbox.answer':        'The teacher’s answer',
      'inbox.openArticle':   'Article',
      'inbox.refresh':       'Refresh',
      'inbox.asked':         'asked {t}',
      'inbox.answeredAt':    'answered {t}',

      'time.now':            'just now',
      'time.min':            '{n} min ago',
      'time.hour':           '{n} h ago',
      'time.day':            '{n} d ago',

      'reader.video':        'Watch the video',

      'ios.tip':             'To install on iPhone: the <b>Share</b> button in Safari’s bottom bar, then <b>Add to Home Screen</b>.',

      'update.available':    'Version {v} is out.',
      'update.get':          'Get it',

      'seed.1':              'What is the difference between charge and mass?',
      'seed.2':              "Explain Newton's second law with an example",
      'seed.3':              'Write Python for free fall with a plot',

      'status.searching':    'Searching site articles…',
      'status.thinking':     'Thinking…',
      'status.writing':      'Writing the answer…'
    }
  };

  var DIR = { fa: 'rtl', en: 'ltr' };
  var lang = 'fa';

  function stored() {
    try { return localStorage.getItem('pm-lang'); } catch (e) { return null; }
  }

  function t(key, vars) {
    var s = STR[lang][key];
    if (s === undefined) s = STR.fa[key];
    if (s === undefined) return key;          // loud on purpose: an untranslated key shows itself
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) {
      return vars[k] === undefined ? m : vars[k];
    });
  }

  /* Persian digits are not decoration — a Latin numeral inside a Persian
     sentence breaks the bidi run and the number jumps to the wrong side. */
  var FA = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];

  function num(n) {
    var neg = n < 0;
    var s = Math.abs(n).toString();
    if (lang === 'fa') {
      s = s.replace(/\B(?=(\d{3})+(?!\d))/g, '٬').replace(/\d/g, function (d) { return FA[+d]; });
      return (neg ? '−' : '') + s;
    }
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '−' : '') + s;
  }

  /* Digit-for-digit, no grouping — for strings that are not quantities:
     version numbers, sign-in codes. Grouping "0.2.0" would be nonsense. */
  function digits(s) {
    s = String(s);
    return lang === 'fa' ? s.replace(/\d/g, function (d) { return FA[+d]; }) : s;
  }

  /* Static markup carries its key in an attribute so a language switch is a
     re-walk of the DOM rather than a reload. */
  function applyStatic(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (n) {
      n.innerHTML = t(n.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-aria]').forEach(function (n) {
      n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria')));
    });
    root.querySelectorAll('[data-i18n-ph]').forEach(function (n) {
      n.placeholder = t(n.getAttribute('data-i18n-ph'));
    });
  }

  function apply() {
    var html = document.documentElement;
    html.lang = lang;
    html.dir = DIR[lang];
    html.setAttribute('data-dir', DIR[lang]);
    document.title = t('app.name');
    applyStatic(document);
  }

  function set(l) {
    if (!STR[l]) return;
    lang = l;
    try { localStorage.setItem('pm-lang', l); } catch (e) {}
    apply();
  }

  lang = STR[stored()] ? stored() : 'fa';

  return {
    t: t,
    num: num,
    digits: digits,
    apply: apply,
    applyStatic: applyStatic,
    set: set,
    get lang() { return lang; },
    get dir() { return DIR[lang]; }
  };
})();

var T = window.PMI18n.t;
