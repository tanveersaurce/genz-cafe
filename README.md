# ☕ Gen-Z Cafe ("Your Daily Hangout")

A production-grade cafe management and engagement platform designed for **Gen-Z Cafe**, run by 5 partners in India.

This codebase delivers the unified foundation, backend architecture, security baseline, design system primitives, enterprise-grade Authentication/RBAC, User Management, Append-Only Audit Logging, Menu Management, Public Website, Tables & Contactless QR Management, Reservation Engine, and the complete **Orders & POS Billing Module, Kitchen Display System (KDS), and Live Table Occupancy**.

---

## 🎨 Brand Identity & Design Tokens

- **Vibe:** Warm, fresh, and youthful cafe. Forest green surfaces, warm cream accents, gold CTA accents, and photography-forward layout.
- **Palette (WCAG AA Compliant):**
  - `green-950`: `#072617` (Deepest base, sidebar, headers)
  - `green-900`: `#0B3D24` (Header, footer, dark hero overlays)
  - `green-800`: `#14472F` (Primary brand surface, ad cards)
  - `green-700`: `#1D5A3C` (Hover & secondary brand surfaces)
  - `cream-100`: `#FBF3DC` (Page background)
  - `cream-300`: `#F3DDA0` (Logo circle cream, cards, highlights)
  - `gold-500`: `#F2C230` (Primary accent / CTA button)
  - `ink-900`: `#1A1A1A` (Primary typography on light surfaces)
  - *Semantics:* `success` (`#2E9E5B`), `warning` (`#E59E1F`), `danger` (`#D64545`), `info` (`#2F7FD1`)
- **Typography:**
  - Headings: **Playfair Display** (refined serif matching the cafe logo)
  - Body & UI: **Poppins** / **Inter** (clean, high-legibility sans-serif)
  - Accent Script: **Caveat** (sparingly used for taglines like *"Eat • Drink • Repeat"*)
- **FSSAI Dietary Classification Marks:**
  - **Vegetarian (`veg`):** Green bordered square enclosing a solid green circle.
  - **Non-Vegetarian (`non_veg`):** Brown bordered square enclosing a solid brown triangle.
  - **Egg (`egg`):** Brown/yellow bordered square enclosing a solid yellow/orange oval.

---

## 🔐 Role-Based Access Control (RBAC) Matrix

Permissions are centrally defined in `server/src/modules/auth/permissions.ts` and mirrored in `client/src/lib/permissions.ts`. Granular permissions gate every endpoint and UI action.

| Role | Granular Permissions | Responsibilities & Restrictions | Landing Route |
|---|---|---|---|
| **`partner`** | `users:manage`, `users:read`, `partners:view`, `reports:view`, `menu:*`, `tables:*`, `reservations:*`, `orders:*`, `pos:access`, `kitchen:view`, `audit:view` | Full cafe ownership, staff provisioning, price updates, archiving, financials | `/app/dashboard` |
| **`manager`** | `users:read`, `menu:*`, `tables:*`, `reservations:*`, `orders:*`, `pos:access`, `kitchen:view` | Day-to-day operations, price updates, menu archiving, staff oversight | `/app/dashboard` |
| **`marketing`** | `menu:read`, `menu:write` | Photos, descriptions, tags, categories. **Strictly blocked** from prices (`menu:price`), deletions (`menu:delete`), users, reservations, financials | `/app/menu` |
| **`cashier`** | `pos:access`, `orders:read`, `orders:create`, `menu:read`, `menu:availability`, `tables:read`, `reservations:read`, `reservations:manage` | Order billing, receipt generation, table viewing, reservation management | `/app/pos` |
| **`waiter`** | `orders:read`, `orders:create`, `menu:read`, `menu:availability`, `tables:read`, `reservations:read` | Order taking, table viewing, **read-only** reservation view (no modification) | `/app/orders` |
| **`kitchen`** | `kitchen:view`, `orders:read`, `orders:update`, `menu:read`, `menu:availability` | Live KDS tickets, **instant out-of-stock toggle**. Blocked from reservations and prices | `/app/kitchen` |

---

## 🪑 Tables & Contactless QR Management

- **Physical Seating Layout:** Tables have unique `tableNumber`, `label`, `capacity` (1–20), `zone` (`indoor`, `outdoor`, `window`, `family`, `other`), `isReservable` (online booking vs. walk-in only), and `isActive`.
- **Deactivation Safeguard:** Tables with future active bookings (`pending`, `confirmed`, `seated`) cannot be deactivated. The server verifies active future slot locks and rejects deactivation with `HTTP 400 TABLE_HAS_ACTIVE_RESERVATIONS`.
- **Printable A4 QR Sheets (`@media print`):**
  - Formatted for standard A4 paper: exactly **6 cards per page** (2 columns × 3 rows) with automatic page breaking.
  - Each card includes the cafe logo, tagline, table number, label, and high-resolution QR code pointing to `${VITE_SITE_URL}/menu?table=N`.
- **Single QR Download:** Instant PNG download with one click (`table-{N}-qr.png`).
- **Idempotent Seeding:** `npm run seed:tables` seeds 15 realistic tables (indoor booths, window counters, outdoor patio, and family zones).

---

## 📅 Reservation Engine & Double-Booking Strategy

### 1. Discrete 30-Minute Slot Locks (`TableSlotLock`)
- Instead of complex multi-document transaction locks or fragile ranges, reservations occupy discrete **30-minute intervals** (`TableSlotLock`).
- Standard stay duration is **90 minutes** (`3 discrete slots`, e.g. a 19:00 booking locks `19:00`, `19:30`, and `20:00`).
- **Adjacent Overlaps Handled Cleanly:** The slot at `20:30` is **NOT** locked, allowing the next party to be seated at `20:30` on the exact same table without conflict.
- **Database Unique Guard:** Compound unique index on `{ tableId: 1, slotStart: 1 }`.
  - Concurrent race attempts for the last table trigger `E11000 duplicate key error`.
  - The catch block executes an immediate atomic rollback (`deleteMany({ reservationId })`) and raises `HTTP 409 SLOT_CONFLICT`.
  - Automatic 7-day TTL cleanup (`expireAfterSeconds: 604800`) ensures zero orphaned records.

### 2. Timezone & Operating Window (IST Asia/Kolkata)
- All time calculations and validations are evaluated server-side in **Indian Standard Time** (`Asia/Kolkata`, UTC+5:30).
- Open hours: **10:00 AM – 11:00 PM IST** daily.
- Last booking slot: **9:30 PM IST** (90 minutes before closing).
- Minimum lead time: **60 minutes** in advance (staff walk-in overrides bypass this).
- Maximum advance booking: **30 days**.

### 3. Capacity & Auto-Confirmation Rules
- $\le 6$ **Guests:** Automatically matched to the best-fit table (`table.capacity >= guests` with smallest excess capacity) and given **instant confirmation** (`status: 'confirmed'`).
- $> 6$ **Guests:** Created with `status: 'pending'` without locking individual tables. Our host desk reviews group arrangement and assigns tables manually.
- **Anti-Spam & Abuse Protection:**
  - Phone limit: Maximum 2 active future bookings per customer phone number.
  - Hidden honeypot field (`honeypot`) transparently rejects bot spam.
  - Customer-provided idempotency keys prevent duplicate orders on double-click.

### 4. Strict State Machine
```
[pending] ──(confirm)──> [confirmed] ──(seat)──> [seated] ──(complete)──> [completed]
    │                         │
    └───(reject/cancel)───────┴───(cancel / no-show)───> [cancelled] / [no_show]
```
- **15-Minute No-Show Rule:** Staff cannot mark a customer as `no_show` until at least 15 minutes have elapsed past the scheduled reservation start time.
- **Customer Cancellation Cutoff:** Customers can self-service cancel online via their booking reference code up to **120 minutes (2 hours)** before start time. Within 2 hours, they are directed to call the cafe host desk directly.

### 5. Privacy & Data Protection
- Phone numbers are normalized to E.164 (`+91XXXXXXXXXX`).
- Raw customer phone numbers are **never returned to unauthenticated users** or unauthorized staff (waiters receive masked numbers: `+91 98***00000`).
- Customer phone numbers are strictly scrubbed from application logs and audit metadata.

---

## 🍽️ Menu Architecture & Financial Rules

- **Integer Paise Money Rule:** ALL money values are stored and transmitted as **integer paise** (`1 INR = 100 paise`, e.g. ₹150 is `15000`).
- **Append-Only Price History (`MenuPriceHistory`):** Records all historical price modifications by staff members.
- **Soft-Delete Safeguard:** Categories containing active menu items cannot be archived.
- **Sharp Image Pipeline:** WebP compression (1200px full, 400px thumbnail), magic-byte file header validation, and EXIF orientation normalization.

---

## 🧾 Orders, POS Billing Station & Table Map Module

### 1. Money & Indian GST Billing Architecture
- **Strict Integer Paise Rule:** All money values (`unitPrice`, `subtotal`, `taxable`, `discount`, `cgst`, `sgst`, `totalTax`, `roundOff`, `grandTotal`, `balancePaise`) are strictly represented and calculated in **integer paise** (`₹1 = 100 paise`). Zero floating-point arithmetic is permitted in calculations.
- **Single Source of Truth (`server/src/config/billingSettings.ts`):**
  - `gstEnabled`: `true`
  - `pricesIncludeTax`: `true` (Indian retail standard: MRP includes GST)
  - `gstin`: `"00AAAAA0000A1Z5"` (`// DUMMY: confirm with cafe/CA`)
  - `legalName`: `"Gen-Z Cafe & Roastery LLP"` (`// DUMMY: confirm with cafe/CA`)
  - `invoicePrefix`: `"GZ"`
  - `financialYearStartMonth`: `4` (Indian FY April 1 – March 31)
  - `roundOffToRupee`: `true`
- **Pure Billing Calculator (`billingCalculator.ts`):**
  - Shared pure function (`server/src/modules/orders/billingCalculator.ts` & `client/src/lib/billingCalculator.ts`) with identical mathematical determinism.
  - **Inclusive Tax Formula:** $\text{taxable} = \text{Math.round}\left(\frac{\text{gross} \times 10000}{100 + \text{rate}}\right)$; $\text{tax} = \text{gross} - \text{taxable}$.
  - **Discount Distribution (Largest-Remainder Method):** Flat or percentage discounts are applied proportionally BEFORE tax across item lines to ensure $\sum \text{lineDiscounts} = \text{discountTotal}$ to the exact single paisa.
  - **Deterministic Odd Paise Rule:** Intra-state GST splits half into CGST and half into SGST. Any odd remainder paisa is deterministically awarded to SGST: $\text{cgst} = \lfloor \text{tax} / 2 \rfloor$, $\text{sgst} = \text{tax} - \text{cgst}$.
  - **Commercial Rupee Round-Off:** Grand totals round to the nearest whole rupee ($\pm 50$ paise), with the exact differential stored in `roundOff` ($\text{taxable} + \text{CGST} + \text{SGST} + \text{roundOff} = \text{grandTotal}$).

### 2. Fiscal Year Invoice Rollover & Daily Sequences
- **Invoice Number Format:** `${invoicePrefix}${FYYY}-${sequence}` (e.g. `GZ2627-000001` for FY 2026-27 starting 1 April). Automatically advances to `GZ2728-000001` on April 1st.
- **Daily Atomic Sequences:**
  - Order Numbers: `T-001`, `T-002` (Dine-in) / `TA-001`, `TA-002` (Takeaway) reset daily via atomic MongoDB `$inc` with upsert.
  - KOT Numbers: `KOT-001`, `KOT-002` reset daily per cafe operating day.

### 3. Concurrency & Double-Booking Strategy
- **MongoDB Partial Unique Index:**
  ```javascript
  { tableId: 1 }, {
    unique: true,
    partialFilterExpression: {
      type: 'dine_in',
      status: { $in: ['open', 'billed'] }
    }
  }
  ```
  Guarantees at the database level that no table can have two simultaneous active orders. If two waiters attempt to open an order on the same table simultaneously, one succeeds and the second returns `409 TABLE_ALREADY_OCCUPIED` along with the `existingOrderId`.
- **Optimistic Concurrency Control:** When concurrent waiters append items to the same running order via `Promise.all`, atomic retries with Mongoose version keys (`__v`) ensure all items survive without data loss.

### 4. POS Station & Order Management UI
- **Live 15-Table Map (`/app/pos`):** Visual card grid with auto-polling (10s interval, pauses when tab is inactive) displaying table number, capacity, zone, status (`free`, `occupied`, `billed`, `reserved_soon`), open order ticket summary, and elapsed seating minutes.
- **Dual-Group Ticket Sidebar:** Visually distinguishes:
  - **Sent to Kitchen Items:** Immutable line items already batched into KOTs.
  - **New Draft Items:** Unsaved additions ready for dispatch.
  - **Double-Tap Protection:** Button locks immediately with `useRef` and loading indicators to prevent duplicate KOT dispatches.
- **Portion Variant Selector:** Modal picker for multi-portion menu items (e.g., Cold Brew Regular vs Large) with item notes (e.g., *"oat milk"*, *"less sweet"*).
- **Payment & Split Tenders:** Instant settlement with cash tender change calculator, optional UPI/card transaction reference capture, and automatic table freeing upon full payment.
- **Order History Desk (`/app/orders`):** Filter by date, status, and order type, view read-only tickets, reprint bills/KOTs, and execute managerial bill voids with mandatory audit reason logging.
- **80mm Thermal Printing (`@media print`):** Driverless thermal print stylesheets for both customer tax invoices and kitchen tickets.

---

## ⚡ Real-Time Layer (Socket.io) & Kitchen Display System (KDS)

### 1. Signal Architecture & Data Minimization
- **Database As Truth:** REST + MongoDB remains the authoritative single source of truth. Socket events act strictly as **lightweight signals** that prompt clients to invalidate cached queries.
- **Data Minimization:** Socket payloads carry only identifiers, event names, and minimal operational hints. **Never** broadcast prices, GST/paise totals, customer phone numbers, customer names, or JWT tokens across the wire.
- **Non-Blocking Emitters:** Server broadcasts occur via `realtimeService.emit(...)` wrapped in safe `try/catch` handlers after database mutations commit. Network blips or socket crashes never delay or fail REST HTTP responses.

### 2. Permission-Based Room Isolation
Clients authenticate during handshake using `socket.handshake.auth.token`. Sockets are strictly assigned to rooms matching their RBAC permissions:
| Socket Room | Required Permission | Description |
|---|---|---|
| `room "kitchen"` | `kitchen:view` | Dispatched KOT alerts, item cancellations, status changes |
| `room "pos"` | `orders:read` | Live floor table states, waiter pickup alerts, running bills |
| `room "reservations"` | `reservations:read` | Booking confirmations, walk-in seated events, status updates |
| `room "menu"` | `menu:read` | Real-time 86 stock / availability changes across floor and public site |
| `room "user:<id>"` | *Self-authenticated user* | Session revocation and immediate remote socket disconnect |

### 3. KOT Lifecycle State Machine
```
[new] ──(start prep)──> [preparing] ──(ready)──> [ready] ──(served)──> [served]
  │                          │                     │
  │                          │                     └──(bump back / undo 30s)──> [preparing]
  └──(all items cancelled)───┴───────────────────────────────────────────────> [cancelled]
```
- **Atomic Compare-and-Set (CAS):** Transitions use positional MongoDB `$set` with `{ 'kots.status': expectedFrom }`.
  - Duplicate requests return idempotent `200 OK` (`idempotent: true`).
  - Concurrent state changes return `409 Conflict` (`KOT_STATUS_CONFLICT`).
- **Kitchen Board DTO Minimization:** `GET /api/kitchen/board` serves dedicated operational DTOs with zero financial fields (`basePrice`, `grossAmount`, `gstPaise`) and zero customer PII.
- **Auto-Cancellation:** When all active items in a KOT are cancelled via `/api/orders/:id/items/:lineId/cancel`, the parent KOT automatically transitions to `cancelled`.

### 4. Waiter Ready Notification & Pickup Tray
- As soon as a ticket reaches `ready`, a `kot.status_changed` event targets `pos`.
- Waiters see a pickup tray `<ReadyToServeTray />` listing tickets waiting for table delivery with elapsed pickup timers.
- One-tap `POST /api/pos/kots/:kotId/served` marks the ticket served and records the serving staff member and timestamp.

### 5. Resilient Connection & Polling Fallback
- **Active Connection:** While WebSocket is connected (`Live`, green badge), background polling relaxes to **60 seconds**.
- **Offline / Reconnecting:** If connection is disrupted (`Reconnecting...` yellow, `Offline` red), queries automatically tighten polling to **10 seconds** as fallback.
- **Visibility Recovery:** Immediate refetch occurs as soon as the browser tab regains focus.
- **Token Expiry Re-Auth:** Single-flight token refresh refreshes credentials and re-authenticates the socket seamlessly.

### 6. Horizontal Scaling with Redis
The platform currently uses Socket.io's high-performance in-memory adapter for single-instance deployments. For multi-server horizontal scaling behind an AWS ALB or Nginx reverse proxy, install and configure `@socket.io/redis-adapter` or `@socket.io/redis-streams-adapter` with a Redis cluster to broadcast room events across all Node.js cluster processes.

---

## 🏗️ Architecture & Folder Structure

```
genz-cafe/
├── client/                     # Frontend: React 18 + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── app/                # React Router v6, TanStack Query, AuthProvider
│   │   ├── components/
│   │   │   ├── auth/           # ProtectedRoute, PermissionGuard, ChangePasswordModal
│   │   │   ├── layout/         # PublicLayout & StaffLayout shells
│   │   │   ├── menu/           # FoodTypeIndicator, AvailabilityToggle, MenuItemModal...
│   │   │   └── ui/             # Design system primitives (Modal, Button, Card, Badge...)
│   │   ├── lib/                # apiClient, calendarUtils, permissions, formatPrice, timeUtils
│   │   ├── pages/
│   │   │   ├── public/         # HomePage, MenuPage, GalleryPage, ReservationPage, ContactPage
│   │   │   └── staff/          # StaffLoginPage, Dashboard, UsersPage, MenuPage, TablesPage, ReservationsPage, PosPage, KitchenPage, OrdersPage
│   │   └── tests/              # Vitest + React Testing Library (47 passing tests)
│
├── server/                     # Backend: Node.js + Express + TypeScript + Mongoose + Socket.io
│   ├── src/
│   │   ├── app.ts              # Express setup, helmet, cors, rate limiter, uploads static mount
│   │   ├── config/             # env.ts, db.ts, socket.ts, reservationSettings.ts
│   │   ├── modules/
│   │   │   ├── audit/          # Append-only AuditLog model and auditService
│   │   │   ├── auth/           # User, RefreshToken, Argon2id, JWT, permissions
│   │   │   ├── users/          # Staff provisioning, safeguards, password reset
│   │   │   ├── menu/           # Category, MenuItem, MenuPriceHistory, Sharp processing
│   │   │   ├── tables/         # Table model, CRUD, zones, deactivation safeguard
│   │   │   ├── reservations/   # Reservation model, TableSlotLock, ReservationBlock, time engine
│   │   │   └── orders/         # Order model, Zod validation, KDS workflow, POS settlement, floor occupancy
│   │   ├── scripts/
│   │   │   ├── seedPartner.ts  # Idempotent partner admin seed
│   │   │   ├── seedMenu.ts     # Idempotent 5-category, 15-item catalog seed
│   │   │   └── seedTables.ts   # Idempotent 15-table seating catalog seed
│   │   └── tests/              # Vitest + Supertest + MongoMemoryServer (39 passing tests)
│
├── package.json                # Root workspaces & concurrently runner
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v25)
- **MongoDB**: Local MongoDB instance or Atlas connection string

### 2. Environment Setup
```bash
# Server environment
cp server/.env.example server/.env

# Client environment
cp client/.env.example client/.env
```

### 3. Installation
From the repository root:
```bash
npm install
```

### 4. Database Seeding
```bash
# 1. Seed initial Partner Admin (username: partner_admin / password: Partner@1234)
npm run seed:partner

# 2. Seed cafe menu catalog (5 categories, 15 items with realistic prices in paise)
npm run seed:menu

# 3. Seed cafe tables (15 tables across indoor, window, patio, and family zones)
npm run seed:tables
```

### 5. Running Locally
Start both backend and frontend concurrently:
```bash
npm run dev
```

- **Public Website:** `http://localhost:5173/`
- **Customer Table Reservation:** `http://localhost:5173/reservation`
- **Customer Live Menu:** `http://localhost:5173/menu`
- **Staff Portal Sign-In:** `http://localhost:5173/app/login`
- **POS Billing Station (`/app/pos`):** `http://localhost:5173/app/pos`
- **Kitchen Display System (`/app/kitchen`):** `http://localhost:5173/app/kitchen`
- **Live Floor Orders & Occupancy (`/app/orders`):** `http://localhost:5173/app/orders`
- **Reservation Desk (`/app/reservations`):** `http://localhost:5173/app/reservations`
- **Tables & QR Management (`/app/tables`):** `http://localhost:5173/app/tables`
- **Menu Management (`/app/menu`):** `http://localhost:5173/app/menu`
- **Staff Directory (Partner only):** `http://localhost:5173/app/users`
- **Design System Showcase:** `http://localhost:5173/design-system`
- **Backend Health Check:** `http://localhost:5000/api/health`

---

## 🧪 Testing & Verification Scripts

All test and verification suites run cleanly across both workspaces with **100% pass rate (103 tests total)**:

| Command | Action | Results |
|---|---|---|
| `npm run type-check` | Strict TypeScript verification (`tsc --noEmit`) | **0 errors** across client and server |
| `npm run lint` | ESLint 9 verification | **0 errors, 0 warnings** across client and server |
| `npm run test` | Unit and integration test suites (Vitest) | **103 passing tests** (55 server, 48 client across 21 test files) |
| `npm run build` | Production compilation and asset bundling | **Clean build** (`dist/` server, Vite client) |

---

## 📋 Launch Checklist (Single Source of Truth: `siteConfig.ts` & `billingSettings.ts`)

Before deploying to production, replace all marked placeholder dummy entries in `client/src/config/siteConfig.ts` and `server/src/config/billingSettings.ts`:

- [ ] **Contact Information:**
  - `phone`: Replace `+91 98765 00000` with the cafe's registered business SIM/landline.
  - `whatsapp`: Replace `919876500000` with the active WhatsApp Business mobile number.
  - `email`: Replace `hello@example.com` with the official inquiries mailbox (e.g. `orders@genzcafe.in`).
- [ ] **Physical Address:**
  - `address.line1`: Replace `Shop No. 00, Sample Plaza` with actual shop/unit number.
  - `address.line2`: Replace `Main Road` with street / locality name.
  - `address.city`: Replace `Your City` with real city name.
  - `address.state`: Replace `State` with real state name.
  - `address.pincode`: Replace `000000` with official 6-digit Indian PIN code.
- [ ] **Billing & Tax Settings (`server/src/config/billingSettings.ts`):**
  - `gstin`: Replace `00AAAAA0000A1Z5` with the cafe's registered 15-character GSTIN.
  - `legalName`: Confirm legal registered entity name (e.g. `Gen-Z Cafe & Roastery LLP`).
  - `address`: Confirm official legal registered address printed on customer tax invoices.
  - `invoicePrefix`: Confirm desired invoice prefix (`GZ`).
  - Note: Cafe operating hours exist in both `client/src/config/siteConfig.ts` and `server/src/config/reservationSettings.ts`, and must be updated in tandem until an admin Settings screen is deployed.
- [ ] **Social Media:**
  - `social.instagram`: Replace `https://instagram.com/gencafe.sample` with official Instagram handle.
  - `social.facebook`: Provide verified cafe Facebook page URL.
  - `social.twitter`: Provide Twitter / X profile URL.
- [ ] **Google Maps & Location:**
  - `map.embedUrl`: Paste Google Maps embed `<iframe>` `src` URL for the interactive map widget.
  - `map.lat` & `map.lng`: Update to precise decimal GPS coordinates.
  - `map.directionsUrl`: Update to Google Maps Place / CID direct directions link.
- [ ] **Customer Testimonials:**
  - `testimonials`: Replace the 3 starter testimonials with authentic Google Maps / Zomato reviews from actual cafe visitors.
- [ ] **Promotional Offers:**
  - `offer`: Verify or update the launch offer code (`GENZ20`), percentage discount, and validity hours.
- [ ] **Reservation Settings (`reservationSettings.ts`):**
  - Verify stay duration (currently `90 minutes`), minimum lead time (`60 minutes`), maximum advance (`30 days`), and auto-confirm party threshold (`6 guests`).
- [ ] **SEO & Metadata:**
  - Configure `VITE_SITE_URL` in `client/.env.production` (e.g. `https://genzcafe.in`) for canonical URLs, Open Graph, Twitter Cards, and table QR code destinations.
