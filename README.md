# DocTra / pdfApp

DocTra, також `pdfApp`, це веб-застосунок для приватних transfer-водіїв і невеликих команд. Він об'єднує створення договорів, PDF-документів, замовлень, передачу замовлень іншим водіям, статистику, податкові звіти, профіль водія, постачальників, плани підписки і адмін-панель.

Проект побудований як split-stack система:

| Частина | Призначення |
| --- | --- |
| Driver app | Основний мобільний кабінет водія у `frontend/driverApp` |
| Admin app | Back-office для менеджера/адміна у `frontend/adminApp` |
| Dispatcher app | Зарезервований окремий frontend mount у `frontend/dispatcherApp` |
| Shared frontend | Спільні компоненти, i18n, auth, API slice у `frontend/shared` |
| Backend | Node HTTP API без Express, Prisma, PostgreSQL, auth, PDF, orders |
| PDF engine | HTML-шаблони, які рендеряться у PDF через Puppeteer/Chromium |
| Database | PostgreSQL через Prisma schema і migrations |

## Зміст

- [Коротко про можливості](#коротко-про-можливості)
- [Архітектура](#архітектура)
- [Ролі та доступи](#ролі-та-доступи)
- [Плани](#плани)
- [Driver App](#driver-app)
- [Admin App](#admin-app)
- [Backend API](#backend-api)
- [Модель даних](#модель-даних)
- [Локальний запуск](#локальний-запуск)
- [Змінні середовища](#змінні-середовища)
- [Скрипти](#скрипти)
- [Деплой](#деплой)
- [Перевірки](#перевірки)

## Коротко про можливості

Основні можливості системи:

- реєстрація, логін, refresh-сесія, захищені routes;
- створення transfer-замовлення через форму договору;
- вибір постачальника для замовлення зі списку збережених постачальників;
- збереження замовлень у базу;
- генерація PDF договору з типом документа `offer` або `confirmation`;
- 10-хвилинне вікно генерації після відкриття token-сесії;
- історія замовлень з фільтрами, сортуванням і деталями;
- редагування ціни, комісії, контактів, статусів і даних замовлення;
- видалення та відновлення замовлень через архів;
- передача замовлення всім водіям, конкретному водієві або команді;
- прийняття або пропуск отриманого замовлення;
- команди водіїв для Platinum-плану;
- статистика використання, активності та доходів;
- податкова інформація по місяцях;
- календар доходів і список замовлень за конкретний день;
- PDF-звіт за місяць, Excel-звіт замовлень і файл даних для бухгалтера;
- бізнес-профіль водія;
- окрема сторінка постачальників з кількома записами, IČO і DIČ;
- flight tracking для Platinum-плану через aviationstack;
- багатомовність: українська, англійська, чеська;
- адмін-панель для акаунтів, планів, підписок, замовлень і audit log;
- PWA-friendly frontend assets, SVG sprite icons, Netlify rewrites.

## Архітектура

### Frontend

Frontend складається з трьох застосунків:

| App | Path | Build output | Призначення |
| --- | --- | --- | --- |
| Driver | `frontend/driverApp` | `dist/` | Кабінет водія |
| Admin | `frontend/adminApp` | `dist/admin/` | Адмін-панель |
| Dispatcher | `frontend/dispatcherApp` | `dist/dispatcher/` | Зарезервований mount `/dispatcher/` |

Driver і Admin використовують React, Redux Toolkit, RTK Query, React Router і спільний модуль `frontend/shared`.

Важливі frontend директорії:

```text
frontend/
  driverApp/
    src/react-app/
      components/      спільні компоненти driver app
      features/        contract, orders, address autocomplete та інші feature-модулі
      pages/           route pages driver app
  adminApp/
    src/react-app/
      pages/           route pages admin app
      features/admin/  admin UI компоненти
  dispatcherApp/       окремий зарезервований frontend
  shared/
    src/react-app/
      app/             API base, i18n, layout, common components
      features/        auth/admin/shared helpers
```

### Backend

Backend це Node HTTP server у `backend/server.js`.

Він робить:

- env validation при старті;
- CORS;
- optional `X-API-KEY` перевірку;
- auth через access token і refresh cookie;
- Prisma connection і синхронізацію планів;
- маршрутизацію через `backend/routes/index.js`;
- PDF generation через `backend/pdf`;
- flight status refresh через `backend/services/flight-status-refresh.js`;
- audit logging через helper-и Prisma.

Основні backend директорії:

```text
backend/
  auth/          токени, refresh cookie, rate limit, guards
  config/        плани, runtime env validation
  db/            Prisma helpers, store, plan/subscription sync
  lib/           HTTP helpers, error handling
  pdf/           contract PDF renderer і шаблони
  prisma/        schema і migrations
  routes/        API route handlers
  services/      orders, teams, dispatch, tax reports, flight status
  tools/         create-admin, seed, Prisma postinstall
  validation/    input validation helpers
```

## Ролі та доступи

| Роль | Доступ |
| --- | --- |
| `user` | Driver app, власні замовлення, профіль, постачальники, статистика, податкова інформація, запит апгрейду |
| `manager` | Усе як `user` + менеджерські можливості backend, робота з користувачами, планами, підписками, замовленнями |
| `admin` | Усе як `manager` + зміна ролей користувачів |

Доступи в UI:

- звичайні protected routes вимагають авторизації;
- admin routes вимагають `admin`;
- team routes вимагають Platinum-план;
- flight tracking дані показуються тільки для Platinum-плану;
- self-service зміна плану через `PATCH /api/me/plan` навмисно вимкнена.

## Плани

Плани визначені у `backend/config/plans.js` і синхронізуються у базу при старті backend.

| ID | Назва | Ліміт на місяць | Ціна | Стара ціна | PDF документи |
| --- | --- | ---: | ---: | ---: | --- |
| `plan-free` | Free | 100 | 0 CZK | 199 CZK | `offer`, `confirmation` |
| `plan-25` | Silver | 300 | 229 CZK | 299 CZK | `offer`, `confirmation` |
| `plan-50` | Gold | 500 | 379 CZK | 499 CZK | `offer`, `confirmation` |
| `plan-100` | Platinum | 1000 | 699 CZK | 899 CZK | `offer`, `confirmation` |

Platinum додатково відкриває:

- командні функції;
- передачу замовлення на команду;
- live flight status;
- сторінки промо-функцій без редіректу на апгрейд.

## Driver App

Driver app це основний кабінет водія.

### Routes

| Route | Екран |
| --- | --- |
| `/` | Головна / створення замовлення |
| `/sign-in` | Авторизація |
| `/orders` | Робочий простір замовлень |
| `/orders/:orderId/dispatch` | Передача замовлення |
| `/orders/:orderId/dispatch/team` | Передача замовлення команді |
| `/orders/:orderId/dispatch/driver` | Передача конкретному водієві |
| `/available-orders` | Отримані замовлення, які можна прийняти або пропустити |
| `/calendar` | Розклад |
| `/history` | Історія замовлень |
| `/history/display/:orderId` | Display screen для замовлення |
| `/stats` | Статистика |
| `/account` | Акаунт |
| `/settings` | Налаштування |
| `/settings/business-profile` | Бізнес-профіль водія |
| `/settings/providers` | Постачальники |
| `/settings/language` | Мова |
| `/settings/plan-upgrade` | Запит підвищення плану |
| `/settings/tax-info` | Податкова інформація |
| `/settings/tax-info/pdf` | Екран місячного PDF-звіту |
| `/settings/tax-info/excel` | Екран Excel-звіту |
| `/settings/tax-info/accountant` | Екран даних для бухгалтера |
| `/flight-tracking` | Опис flight tracking |
| `/team-collaboration` | Опис командних можливостей |
| `/settings/team` | Команда водія |
| `/settings/team/search` | Пошук водіїв для команди |

### Створення замовлення

Форма договору знаходиться в `frontend/driverApp/src/react-app/features/contract`.

Вона збирає:

- постачальника для замовлення;
- пасажира;
- контакт пасажира;
- кількість пасажирів;
- pickup адресу;
- dropoff адресу;
- дату і час поїздки;
- тип оплати: card, cash, invoice;
- додаткові дані: номер рейсу, коментар водія, багаж, дитячі крісла;
- загальну суму;
- тип PDF документа.

Валідація вимагає:

- ім'я клієнта;
- email або телефон клієнта;
- кількість пасажирів;
- адресу звідки;
- адресу куди;
- дату і час;
- тип оплати;
- ціну.

### Token session для генерації

Перед збереженням або PDF-генерацією використовується generation session:

- тривалість: 10 хвилин;
- session зберігає `orderId`, `orderNumber`, `documentType`, `expiresAt`;
- якщо session протермінована, водій має відкрити форму замовлення заново;
- при download PDF, якщо замовлення ще не існує, воно створюється зі статусом `pending_pdf`;
- після успішної PDF-генерації статус оновлюється на `pdf_generated`;
- при помилці PDF статус оновлюється на `pdf_failed`.

### PDF договори

Contract PDF генерується через:

```text
POST /api/contracts/get-pdf
```

Підтримані типи:

- `offer`;
- `confirmation`.

PDF створюється на backend з HTML-шаблону, а frontend отримує Blob і завантажує файл локально.

### Замовлення

Замовлення зберігаються у таблиці `orders`.

Важливі поля:

- `orderNumber`;
- `status`;
- `customer`;
- `trip`;
- `totalPrice`;
- `pdf`;
- `contractData`;
- `metadata`;
- `flightNumber`;
- `createdByUserId`;
- `createdBySnapshot`.

Замовлення можна:

- створити;
- переглянути;
- оновити;
- видалити;
- передати іншому водієві;
- передати команді;
- відкрити в історії;
- згенерувати PDF;
- переглянути в admin app.

### Історія

Сторінка `/history`:

- завантажує власні замовлення;
- групує їх по вкладках: сьогодні, заплановані, завершені та інші;
- підтримує фільтр по даті;
- підтримує сортування;
- відкриває деталі замовлення у drawer;
- дає доступ до dispatch flow;
- показує route, дату, пасажирів, багаж, ціну і статус.

### Деталі замовлення

Drawer деталей замовлення дозволяє:

- переглядати клієнта, маршрут, дату, оплату, ціну;
- копіювати контактні дані;
- відкривати call/email/send actions;
- змінювати ціну;
- зберігати комісію;
- переглядати постачальника із snapshot замовлення;
- зберегти постачальника із замовлення у власний профіль, якщо такого ще немає;
- передавати замовлення;
- генерувати PDF.

### Передача замовлень

Order dispatch працює через `order_offers` і `order_offer_targets`.

Водій може:

- надіслати замовлення всім водіям;
- надіслати конкретному водієві;
- надіслати команді, якщо активний Platinum;
- видалити замовлення.

Отримувач бачить замовлення на `/available-orders` і може:

- прийняти;
- пропустити.

Після прийняття:

- замовлення переходить до нового власника;
- contract data отримує driver data нового власника;
- provider snapshot із замовлення зберігається, якщо він був у вихідному замовленні;
- отримувач може окремо зберегти постачальника у свій профіль.

### Команди

Команди доступні для Platinum.

Функції:

- створення команди;
- додавання водіїв;
- вибір активної команди;
- видалення учасників;
- передача замовлення на команду;
- обмеження доступу через `requirePlatinumTeam`.

Backend моделі:

- `Team`;
- `TeamMember`.

### Постачальники

Постачальники винесені в окремий екран `/settings/providers`.

Профіль користувача може містити:

- `providers`: список постачальників;
- `defaultProviderId`: основний постачальник;
- `provider`: нормалізований основний постачальник для backward compatibility.

Кожен постачальник має:

- `id`;
- `name`;
- `address`;
- `ico`;
- `dic`.

Логіка:

- список за замовчуванням згорнутий;
- новий постачальник зберігається окремою кнопкою;
- існуючих постачальників можна редагувати;
- можна зробити постачальника основним;
- можна видалити всіх постачальників;
- якщо `providers: []`, backend не відновлює старий legacy provider;
- у формі замовлення вибирається тільки фактичний provider зі списку;
- якщо stale provider видалений, форма переходить на перший доступний або очищає provider.

### Бізнес-профіль

Бізнес-профіль водія зберігає:

- ім'я водія;
- адресу;
- SPZ;
- IČO;
- DIČ, якщо є.

Постачальники більше не редагуються в бізнес-профілі, бо мають окремий екран.

### Податкова інформація

Екран `/settings/tax-info` показує дані по вибраному місяцю.

Джерело даних:

```text
GET /api/orders?dateField=trip&from=YYYY-MM-DDT00:00&to=YYYY-MM-DDT00:00&limit=1000
```

Frontend додатково фільтрує замовлення по року і місяцю, щоб не підмішувати дані з інших місяців.

На екрані є:

- перемикач місяця;
- загальний заробіток за місяць;
- кількість замовлень;
- календар доходів;
- вибір дня;
- список усіх замовлень за вибраний день;
- кнопки переходу до трьох типів файлів.

Payment buckets:

- `cash`;
- `card`;
- `invoice`, у UI це фактура;
- `unknown`.

Податок як окрема метрика прибраний.

### Податкові файли

Є три екрани:

| Route | Тип | Призначення |
| --- | --- | --- |
| `/settings/tax-info/pdf` | PDF | Місячний звіт для перегляду |
| `/settings/tax-info/excel` | XLS | Таблиця замовлень для обробки |
| `/settings/tax-info/accountant` | PDF | Дані для бухгалтера |

Файли генеруються backend endpoint-ом:

```text
POST /api/tax-reports/download
```

Payload:

```json
{
  "type": "pdf",
  "month": "2026-06",
  "language": "uk"
}
```

`type` може бути:

- `pdf`;
- `excel`;
- `accountant`.

Особливості:

- назва у звітах береться з імені водія, не з бренду;
- Excel не має колонки `Platforma`;
- тип оплати `Platforma` нормалізується у `Faktura`;
- файли не кладуться в Redux state, а завантажуються direct fetch-ом;
- PDF для бухгалтера містить дані підприємця, доходи, комісії і підсумки.

### Статистика

Сторінка `/stats` має вкладки:

- usage;
- salary;
- activity.

Дані:

- usage приходить з `/api/me/usage`;
- orders завантажуються з `/api/orders`;
- рахується використання місячного ліміту;
- показується кількість замовлень;
- показуються видалені повідомлення за місяць;
- salary/activity обчислюються з order data.

### Розклад

Сторінка `/calendar` будує календар/таймлайн по замовленнях.

Вона використовує:

- дату поїздки;
- маршрут;
- пасажирів;
- статус;
- коротку інформацію про замовлення.

### Flight Tracking

Flight tracking доступний для Platinum.

Backend сервіс:

- бере номер рейсу з `flightNumber` або `contractData.flightNumber`;
- перевіряє тільки рейси сьогодні або завтра;
- кешує статус глобально за парою `flightNumber + flightDate` і копіює його в `metadata.flightStatus`;
- не виконує повторний зовнішній запит раніше ніж через 15 хвилин, включно після помилки API;
- дедуплікує паралельні запити через атомарний DB lock;
- припиняє оновлення після статусів `landed` або `cancelled`;
- не оновлює завершені по часу замовлення;
- використовує `AVIATIONSTACK_API_KEY`;
- нормалізує статуси: `landed`, `delayed`, `in_air`, `scheduled`, `cancelled`, `unknown`;
- ховає flight status для користувачів без доступу.

### Мова

Підтримані мови:

- українська;
- English;
- čeština.

i18n знаходиться у:

```text
frontend/shared/src/react-app/app/i18n/messages.js
```

### Акаунт і налаштування

Settings містить:

- мову;
- команду;
- бізнес-профіль;
- постачальників;
- податкову інформацію;
- підвищення плану;
- admin access link для відповідних ролей;
- сесію і видалення акаунта.

## Admin App

Admin app доступний на `/admin/`.

### Routes

| Route | Екран |
| --- | --- |
| `/admin` | Dashboard |
| `/admin/accounts` | Список акаунтів |
| `/admin/accounts/:userId` | Деталі акаунта |
| `/admin/orders` | Всі замовлення |
| `/admin/orders/users/:userId` | Замовлення конкретного користувача |
| `/admin/orders/view/:orderId` | Деталі замовлення |
| `/admin/orders/:orderId` | Деталі замовлення |
| `/admin/settings` | Налаштування адміна |
| `/admin/settings/language` | Мова адмінки |
| `/admin/settings/audit` | Audit log |

### Функціонал адмінки

Admin app дозволяє:

- переглядати користувачів;
- фільтрувати і відкривати акаунти;
- бачити профіль, роль, підписку і usage;
- змінювати роль користувача;
- змінювати план і статус підписки;
- продовжувати підписку;
- підтверджувати оплату pending upgrade;
- скасовувати підписку;
- керувати планами;
- переглядати всі замовлення;
- дивитися активні та archived/deleted замовлення;
- відновлювати archived order;
- дивитися audit log.

## Backend API

Усі protected endpoints використовують `Authorization: Bearer <accessToken>`.

Якщо `API_KEY` заданий на backend, frontend має надсилати `X-API-KEY`, значення якого береться з `VITE_API_KEY`.

### Public

| Method | Endpoint | Призначення |
| --- | --- | --- |
| `GET` | `/api/health` | Health check backend і PostgreSQL |
| `GET` | `/api/plans` | Активні плани |
| `POST` | `/api/contracts/get-pdf` | Генерація contract PDF для існуючого order |

### Auth

| Method | Endpoint | Призначення |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Реєстрація |
| `POST` | `/api/auth/login` | Логін |
| `POST` | `/api/auth/refresh` | Оновлення access token через refresh cookie |
| `POST` | `/api/auth/logout` | Logout і revoke refresh session |

### My account

| Method | Endpoint | Призначення |
| --- | --- | --- |
| `GET` | `/api/me` | Поточний користувач |
| `GET` | `/api/me/usage` | Usage поточного плану |
| `PATCH` | `/api/me/profile` | Профіль, бізнес-дані, постачальники, avatar |
| `GET` | `/api/me/team` | Команди користувача |
| `PATCH` | `/api/me/team` | Створення/оновлення команд |
| `POST` | `/api/me/subscription/upgrade-request` | Запит апгрейду плану |
| `PATCH` | `/api/me/plan` | Вимкнено, повертає 403 |
| `DELETE` | `/api/me` | Видалення акаунта |

### Orders

| Method | Endpoint | Призначення |
| --- | --- | --- |
| `POST` | `/api/orders` | Створити замовлення |
| `GET` | `/api/orders` | Список власних замовлень |
| `GET` | `/api/orders?dateField=trip&from=...&to=...` | Замовлення по даті поїздки |
| `GET` | `/api/orders/:id` | Деталі замовлення |
| `PATCH` | `/api/orders/:id` | Оновити замовлення |
| `DELETE` | `/api/orders/:id` | Видалити/заархівувати замовлення |
| `PATCH` | `/api/orders/:id/assign-driver` | Призначити водія |
| `GET` | `/api/orders/drivers` | Пошук водіїв для dispatch |
| `GET` | `/api/orders/available` | Доступні order offers |
| `POST` | `/api/orders/:id/offers` | Створити offer передачі |
| `POST` | `/api/orders/:id/offers/:offerId/accept` | Прийняти offer |
| `POST` | `/api/orders/:id/offers/:offerId/skip` | Пропустити offer |

### Tax reports

| Method | Endpoint | Призначення |
| --- | --- | --- |
| `POST` | `/api/tax-reports/download` | PDF/XLS/accountant файл за місяць |

### Manager / Admin

| Method | Endpoint | Призначення |
| --- | --- | --- |
| `GET` | `/api/manager/users` | Список користувачів |
| `GET` | `/api/manager/users/:id` | Деталі користувача |
| `PATCH` | `/api/manager/users/:id/role` | Зміна ролі, admin only |
| `PATCH` | `/api/manager/users/:id/subscription` | Зміна підписки |
| `POST` | `/api/manager/users/:id/subscription/extend` | Продовження підписки |
| `POST` | `/api/manager/users/:id/subscription/cancel` | Скасування підписки |
| `POST` | `/api/manager/users/:id/subscription/confirm-payment` | Підтвердження оплати |
| `GET` | `/api/manager/plans` | Список планів |
| `POST` | `/api/manager/plans` | Створення плану |
| `PATCH` | `/api/manager/plans/:id` | Оновлення плану |
| `GET` | `/api/manager/orders` | Всі замовлення |
| `GET` | `/api/manager/orders/:id` | Деталі active або archived order |
| `POST` | `/api/manager/orders/:id/restore` | Відновлення archived order |
| `GET` | `/api/manager/audit` | Audit log |

## Модель даних

Prisma schema знаходиться у `backend/prisma/schema.prisma`.

| Model | Призначення |
| --- | --- |
| `User` | Акаунт, роль, телефон, активна команда, JSON profile |
| `Session` | Refresh token sessions |
| `Plan` | Каталог планів |
| `Subscription` | Підписка користувача, ліміт, pending upgrade |
| `Order` | Активне замовлення |
| `ArchivedOrder` | Видалене/заархівоване замовлення |
| `Team` | Команда власника |
| `TeamMember` | Учасники команди |
| `OrderOffer` | Offer передачі замовлення |
| `OrderOfferTarget` | Target-и offer-а для конкретних водіїв |
| `AuditLog` | Журнал дій auth/profile/subscription/plans/orders |

### User profile JSON

Профіль користувача нормалізується через `backend/services/profiles.js`.

Типова структура:

```json
{
  "avatarUrl": "",
  "driver": {
    "name": "",
    "address": "",
    "spz": "",
    "ico": "",
    "dic": ""
  },
  "provider": {
    "id": "",
    "name": "",
    "address": "",
    "ico": "",
    "dic": ""
  },
  "providers": [],
  "defaultProviderId": ""
}
```

## Локальний запуск

Потрібно:

- Node.js;
- npm;
- PostgreSQL;
- Chromium dependency для PDF у середовищі, де запускається Puppeteer.

### 1. Встановити залежності

```bash
npm install
npm --prefix backend install
```

### 2. Створити env файли

```bash
cp frontend/driverApp/.env.example frontend/driverApp/.env
cp backend/.env.example backend/.env
```

Заповніть у `backend/.env`:

- `AUTH_TOKEN_SECRET`;
- `DATABASE_URL` або `DIRECT_DATABASE_URL`;
- за потреби `API_KEY`;
- за потреби `AVIATIONSTACK_API_KEY`.

Заповніть у `frontend/driverApp/.env`:

- `VITE_API_BASE_URL`;
- якщо backend має `API_KEY`, також `VITE_API_KEY`;
- за потреби `VITE_GOOGLE_MAPS_API_KEY`.

### 3. Prisma

```bash
npm run db:generate
npm run db:migrate
```

### 4. Запустити все разом

```bash
npm run dev
```

Порти:

| Сервіс | URL |
| --- | --- |
| Driver app | `http://localhost:5173` |
| Admin app | `http://localhost:4174/admin/` |
| Dispatcher app | `http://localhost:4175/dispatcher/` |
| Backend | `http://localhost:3001` |

### 5. Створити admin

```bash
npm run admin:create -- --email=admin@example.com --name="Admin" --password="password123"
```

або підвищити існуючого користувача, якщо це підтримано параметрами скрипта:

```bash
npm run admin:create -- --email=user@example.com --promote-existing
```

## Змінні середовища

### Frontend

Файл: `frontend/driverApp/.env`

| Variable | Обов'язково | Призначення |
| --- | --- | --- |
| `VITE_API_BASE_URL` | так | Base URL backend API, наприклад `http://localhost:3001/api` |
| `VITE_API_KEY` | ні | Public key для `X-API-KEY`, якщо backend API key увімкнений |
| `VITE_GOOGLE_MAPS_API_KEY` | ні | Google Maps Places для адрес |
| `VITE_SUPPORT_WHATSAPP_URL` | ні | Support link для manual payment |
| `VITE_SUPPORT_TELEGRAM_URL` | ні | Support link для manual payment |
| `VITE_ADMIN_APP_URL` | ні | URL або path до admin app |
| `VITE_DRIVER_APP_URL` | ні | URL або path до driver app з admin app |

### Backend

Файл: `backend/.env`

| Variable | Обов'язково | Призначення |
| --- | --- | --- |
| `BACKEND_PORT` | ні | Порт backend, default `3001` |
| `CLIENT_ORIGIN` | ні | CORS origins, comma-separated |
| `TZ` | ні | Часовий пояс backend; рекомендовано `Europe/Prague` |
| `API_KEY` | ні | Optional backend API key |
| `AUTH_TOKEN_SECRET` | так | Секрет access token, мінімум 32 символи |
| `ACCESS_TOKEN_TTL_MINUTES` | ні | TTL access token |
| `REFRESH_TOKEN_TTL_HOURS` | ні | TTL refresh cookie |
| `REFRESH_COOKIE_NAME` | ні | Назва refresh cookie |
| `REFRESH_COOKIE_SAME_SITE` | ні | SameSite для refresh cookie |
| `REFRESH_COOKIE_SECURE` | ні | Secure flag для refresh cookie |
| `AUTH_LOGIN_WINDOW_MINUTES` | ні | Rate-limit window login |
| `AUTH_LOGIN_LOCK_MINUTES` | ні | Lock duration login |
| `AUTH_LOGIN_LOCK_AFTER_ATTEMPTS` | ні | Attempts до lock login |
| `AUTH_REGISTER_WINDOW_MINUTES` | ні | Rate-limit window register |
| `AUTH_REGISTER_LOCK_MINUTES` | ні | Lock duration register |
| `AUTH_REGISTER_LOCK_AFTER_ATTEMPTS` | ні | Attempts до lock register |
| `AVIATIONSTACK_API_KEY` | ні | Backend-only ключ flight status |
| `AVIATIONSTACK_BASE_URL` | ні | Base URL aviationstack |
| `AVIATIONSTACK_CACHE_TTL_MINUTES` | ні | TTL кешу flight status, мінімум 15 хв |
| `AVIATIONSTACK_FUTURE_CACHE_TTL_MINUTES` | ні | TTL для рейсів на завтра, типово 60 хв |
| `AVIATIONSTACK_MAX_REFRESH_PER_REQUEST` | ні | Max refresh за request |
| `AVIATIONSTACK_TIMEOUT_MS` | ні | Timeout запиту до aviationstack |
| `AVIATIONSTACK_USE_FLIGHT_DATE_FILTER` | ні | Передавати платний/plan-specific `flight_date`; типово `false` |
| `DATABASE_URL` | так* | Prisma/PostgreSQL URL |
| `DIRECT_DATABASE_URL` | так* | Direct DB URL або fallback для Prisma |

`DATABASE_URL` або `DIRECT_DATABASE_URL` має бути заданий. Backend не стартує з placeholder-значеннями.

`DB_MODE=file` і `DATA_FILE` залишені тільки як local/testing коментарі в `.env.example`; production працює через PostgreSQL.

## Скрипти

Root scripts:

| Команда | Що робить |
| --- | --- |
| `npm run dev` | Запускає driver, admin, dispatcher і backend |
| `npm run dev:client` | Запускає driver app |
| `npm run dev:admin` | Запускає admin app |
| `npm run dev:dispatcher` | Запускає dispatcher app |
| `npm run dev:server` | Запускає backend dev |
| `npm run build` | Збирає driver, admin і dispatcher |
| `npm run build:driver` | Збирає driver app у `dist/` |
| `npm run build:admin` | Збирає admin app у `dist/admin/` |
| `npm run build:dispatcher` | Збирає dispatcher app у `dist/dispatcher/` |
| `npm run preview` | Preview production frontend |
| `npm run start:server` | Старт backend через backend package |
| `npm run db:generate` | Prisma generate |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:migrate:deploy` | Prisma migrate deploy |
| `npm run admin:create -- ...` | Створити або підвищити admin |
| `npm run secrets:check` | Перевірка tracked files на секрети |
| `npm run hooks:install` | Встановити git hooks |

Backend scripts:

| Команда | Що робить |
| --- | --- |
| `npm --prefix backend run dev` | Запустити backend |
| `npm --prefix backend run start` | Production start backend |
| `npm --prefix backend run db:generate` | Prisma generate |
| `npm --prefix backend run db:migrate` | Prisma migrate dev |
| `npm --prefix backend run db:migrate:deploy` | Prisma migrate deploy |
| `npm --prefix backend run db:seed` | Prisma seed |
| `npm --prefix backend run admin:create -- ...` | Admin create tool |

## Деплой

### Frontend на Netlify

`netlify.toml`:

- build command: `npm run build`;
- publish: `dist`;
- `/admin/*` -> `/admin/index.html`;
- `/dispatcher/*` -> `/dispatcher/index.html`;
- `/api/*` proxy -> backend API URL, у поточному `netlify.toml` це Render backend;
- `/*` -> `/index.html`.

Production layout:

| Path | App |
| --- | --- |
| `/` | Driver app |
| `/admin/` | Admin app |
| `/dispatcher/` | Dispatcher app |

Потрібні frontend env:

- `VITE_API_BASE_URL`, якщо не використовується Netlify `/api/*` proxy;
- `VITE_API_KEY`, якщо backend API key увімкнений;
- optional Google/support URLs.

### Backend на Render або іншому Node host

Типові налаштування:

- root directory: `backend`;
- install command: `npm install`;
- release command: `npm run db:migrate:deploy`;
- start command: `npm run start`;
- health check: `/api/health`;
- env: `AUTH_TOKEN_SECRET`, `DATABASE_URL` або `DIRECT_DATABASE_URL`.

Для flight tracking на Render:

- обов’язково: `AVIATIONSTACK_API_KEY`;
- рекомендовано явно: `AVIATIONSTACK_CACHE_TTL_MINUTES=15`;
- рекомендовано явно: `AVIATIONSTACK_FUTURE_CACHE_TTL_MINUTES=60`;
- рекомендовано явно: `AVIATIONSTACK_USE_FLIGHT_DATE_FILTER=false`;
- рекомендовано: `TZ=Europe/Prague`, оскільки refresh-window використовує локальну дату поїздки;
- `AVIATIONSTACK_MAX_REFRESH_PER_REQUEST` обмежує кількість різних рейсів, які один HTTP request може спробувати оновити.

Новий глобальний кеш потребує таблицю `flight_status_cache`, тому pre-deploy/release command із `db:migrate:deploy` має бути увімкнений до запуску нової версії backend.

## Операційні правила

- public signup створює роль `user`;
- новий користувач стартує на `plan-free`;
- paid upgrade створює pending request;
- оплату підтверджує manager/admin;
- self-service plan change вимкнений;
- backend валідовує env перед стартом;
- backend повертає `503` на `/api/health`, якщо база недоступна;
- login/register мають brute-force lockouts;
- refresh token зберігається у cookie;
- access token передається через `Authorization: Bearer`;
- Blob/PDF downloads не мають зберігатися у Redux state;
- SVG-іконки мають бути у `frontend/shared/src/react-app/app/components/SvgIcon/sprite.svg`, а не inline SVG у компонентах.

## Перевірки

У проекті немає окремого root `test` script. Базові перевірки перед релізом:

```bash
git diff --check
npm run build:driver
npm run build:admin
npm run build:dispatcher
```

Для backend syntax check можна запускати:

```bash
node --check backend/routes/tax-reports.js
node --check backend/services/tax-reports.js
```

Для production DB:

```bash
npm run db:migrate:deploy
```

Для секретів:

```bash
npm run secrets:check
```

## Ліцензія

ISC
