# Order Dispatch Plan

## Goal

After a driver chooses to remove an order from their own workflow, route them to a dispatch screen instead of immediately deleting the order. The dispatch screen must allow the driver to:

- send the order to all drivers;
- send the order to one of their teams;
- send the order to an individual driver found through search;
- permanently delete/archive the order with a red danger action.

When an order is sent, it must appear in the recipient driver's Available Orders list with Accept and Skip actions. If a sent order is not accepted, it must return to the previous driver. Each order must preserve who originally created it.

## Existing Code Context

- Active orders are stored in `Order` with `userId` as the current owner.
- Deleted orders are copied into `ArchivedOrder` and removed from `Order`.
- Driver order APIs live in `backend/routes/orders.js`.
- The existing Available Orders page is currently an empty placeholder.
- Teams already exist through `Team` and `TeamMember`.
- The current driver-side order API is defined in `frontend/driverApp/src/react-app/features/orders/ordersApi.js`.

## Implementation Phases

### 1. Database

- Add original creator fields to `Order` and `ArchivedOrder`.
- Add dispatch/offer tables to represent an open offer and its target drivers.
- Backfill existing orders so `createdByUserId` equals the current `userId`.
- Index active offer lookup by status, target driver, order, and expiry.

### 2. Backend

- Create `POST /api/orders/:id/offers` to publish an order to all drivers, a team, or a specific driver.
- Create `GET /api/orders/available` to list open offers visible to the current driver.
- Create `POST /api/orders/:id/offers/:offerId/accept`.
- Create `POST /api/orders/:id/offers/:offerId/skip`.
- Keep the current `DELETE /api/orders/:id` as the true archive/delete action.
- Add audit log actions for offer creation, accept, skip, return, cancel, and final delete.

### 3. Frontend API

- Add RTK Query endpoints for available orders, creating offers, accepting offers, and skipping offers.
- Add cache invalidation for both owned orders and available orders.

### 4. Dispatch Screens

- Change the current delete button in order details to navigate to a dispatch screen.
- Build an order dispatch page with three send options and one red delete action.
- Build a team selection view.
- Build a driver search view.

### 5. Available Orders

- Replace the current empty placeholder with real cards.
- Each card must show key order info, creator/current sender info, and Accept/Skip actions.
- Accept moves the order to the accepting driver.
- Skip removes it from the current driver's available list and can return the order when all targets declined or the direct target declined.

### 6. Translations And Verification

- Add Ukrainian, English, and Czech copy.
- Run the driver build.
- Smoke-test the backend routes where possible.

