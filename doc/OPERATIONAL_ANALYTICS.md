# تحلیل عملیات برای مدیر رستوران

از پنل مدیریت، «دستیار گزارش مدیر» را باز کنید. چهار دکمه گزارش مستقیم در بالای صفحه قرار دارد. بازه امروز، هفت روز اخیر، این هفته یا هفته قبل را انتخاب کنید؛ هفته از شنبه و زمان‌ها به وقت تهران محاسبه می‌شوند. گزارش مستقیم به AvalAI، Redis یا صف وابسته نیست. با پرسش فارسی نیز AvalAI می‌تواند یکی از همین گزارش‌های مجاز را انتخاب کند؛ مدل به پایگاه داده دسترسی مستقیم ندارد.

## تحلیل فروش و روندها

ارزش روزانه سفارش‌های تکمیل‌شده، تعداد سفارش و تعداد غذا را ببینید. ده قلم پرتعداد دو بازه، با تعداد جاری، تعداد در بازه هم‌طول قبل و اختلاف تعداد نمایش داده می‌شوند. اقلام لغوشده از فروش حذف شده‌اند. ارزش ثبت‌شده سفارش، پول وصول‌شده یا سود نیست؛ اطلاعات پرداخت و هزینه مواد وجود ندارد. تغییر تعداد، علت رشد یا افت را مشخص نمی‌کند. روزهای بدون سفارش در جدول روزانه نمایش داده نمی‌شوند.

## پیشنهاد منو و ترکیب غذاها

پس از دست‌کم ۲۰ سفارش تکمیل‌شده در بازه، غذاهایی که حداقل در پنج سفارش مشترک دیده شده‌اند برای آزمایش در کنار هم پیشنهاد می‌شوند. سهم سفارش مشترک و تعداد شواهد نمایش داده می‌شود؛ اقلام یا دسته‌های غیرفعال پیشنهاد ترکیب نمی‌شوند. غذاهایی با حداقل پنج سفارش در بازه قبل و افت بیش از نصف نیز برای بررسی عرضه یا توضیحات منو نمایش داده می‌شوند. هیچ قیمت یا منویی خودکار تغییر نمی‌کند. هم‌وقوعی، رابطه علّی یا سودآوری را اثبات نمی‌کند؛ موجودی، هزینه و ساعات فعالیت باید بررسی شوند.

## پیش‌بینی تقاضا

بازه این گزارش ثابت است: ۵۶ روز کامل گذشته، با حذف روز جاری. سابقه مشاهده‌شده باید به ابتدای آن بازه یا قبل برسد؛ حداقل ۱۰۰ سفارش دارای قلم و ۲۸ روز دارای سفارش لازم است. در غیر این صورت اعداد آینده تولید نمی‌شوند. سفارش لغوشده هم تقاضای ثبت‌شده است؛ سفارش خالی محاسبه نمی‌شود.

برای هفت روز از امروز، دو روش مقایسه می‌شوند: همان روز هفته قبل و میانگین چهار روز هم‌نام هفته. خطای مطلق میانگین روی ۱۴ روز پایانی با پیش‌بینی متکی به گذشته هر روز، روش منتخب را تعیین می‌کند. این نمونه محدود برای انتخاب مدل است، نه اثبات کیفیت روی داده مستقل جدید. بازه راهنما از صدک ۹۰ خطای مطلق گذشته ساخته می‌شود و تضمین پوشش آماری ندارد. پیش‌بینی امروز برای کل روز است و با جمع ساعت‌های آینده متفاوت است.

۲۴ ساعت کامل آینده جداگانه با میانگین چهار ساعت هم‌نام در چهار هفته قبل نمایش داده می‌شود؛ کمینه و بیشینه فقط چهار مشاهده‌اند و فاصله اطمینان نیستند. میانگین کسری به معنای ثبت سفارش کسری نیست. داده بدون ثبت، صفر فرض می‌شود؛ تعطیلی و قطعی از نبود تقاضا قابل تفکیک نیست. مناسبت‌ها، آب‌وهوا، تبلیغ و تغییر ساعت کار لحاظ نشده‌اند. این ابزار به‌تنهایی مبنای خرید مواد یا تعهد مالی نیست.

## تحلیل تأخیر آشپزخانه

زمان شروع آماده‌سازی، آماده‌شدن و تحویل در همان تراکنش تغییر وضعیت هر ردیف ثبت می‌شوند؛ تکرار درخواست موفق، زمان را تغییر نمی‌دهد. زمان‌های گمشده داده قدیمی ساخته نمی‌شوند. برای هر غذا حداقل سه ردیف زمان‌دار لازم است. میانه و صدک ۹۰ آماده‌سازی، میانگین انتظار قبل از شروع و تعداد بیشتر از ۲۰ دقیقه نمایش داده می‌شود. ردیف‌های لغوشده کنار گذاشته می‌شوند. هر ردیف یک نمونه است، مستقل از تعداد غذا در آن ردیف.

جدول عقب‌ماندگی فعلی مستقل از بازه گزارش است: ردیف‌های سفارش باز که بیش از ۲۰ دقیقه منتظر شروع‌اند، بیش از ۲۰ دقیقه در آماده‌سازی‌اند یا زمان شروعشان موجود نیست. این هشدار علت تأخیر یا عملکرد یک فرد را ثابت نمی‌کند؛ غذاها زمان استاندارد یکسان ندارند.

## Engineering notes

- Four additional strict tools: `SALES_TRENDS`, `MENU_SUGGESTIONS`, `DEMAND_FORECAST`, `KITCHEN_DELAYS`. The queued AI planner selects tools only; facts, estimates and recommendations are deterministic application results.
- Direct endpoint: `GET /api/v1/admin/ai/analyses/reports?tool=SALES_TRENDS&period=LAST_7_DAYS`. Authentication and manager role are required. Unknown parameters, arbitrary dates, tools and caller-supplied tenant/branch fields fail closed. Scope comes from the session and is reauthorized inside the report transaction.
- Existing report executor uses a repeatable-read, read-only transaction, three-second statement timeout and bounded report windows/results. Shared pure forecast functions have no transport or database dependencies. No raw SQL or restaurant data is sent to AvalAI; only the question and strict routing schema are sent.
- Additive migration `20261030100000_operational_analytics` adds nullable timing fields and indexes. Database checks enforce chronological order for known timestamps while preserving legacy rows. No destructive backfill or automatic menu mutation.
- Forecasting approach references: [seasonal baselines and rolling-origin evaluation](https://otexts.robjhyndman.com/fpp3/toolbox.html). No LLM demand prediction or calibrated confidence-interval claim.
- Apply migrations and regenerate Prisma before restarting API/worker. Existing demo history intentionally remains unmeasured; the thirty-day seed should show insufficient forecasting history. Do not turn invented timestamps into measured kitchen performance.
- This is additional user-requested scope after the original assessment; it does not establish six-hour compliance. Production deployment is a separate action.
