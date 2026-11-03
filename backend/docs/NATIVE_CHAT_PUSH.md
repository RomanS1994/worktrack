# Native chat push rollout

This adds Expo push delivery for the WorkTrack native clients. It is a companion to the durable chat outbox and does not change Web Push or production data.

## Deployment order

1. Apply `20261022160000_native_chat_push` after `20261022140000_chat_notification_outbox` on an isolated staging database.
2. Deploy the API version containing the native registration endpoint and notification worker. The worker shares the existing chat notification poller and stores Expo tickets before receipt polling.
3. Confirm `EXPO_PUSH_PROJECT_IDS` permits the exact EAS project UUID. If `EXPO_PUSH_ACCESS_TOKEN` is configured, use the EAS access token for that project. The checked-in app UUID is the default allowlisted project.
4. Register a test iOS device through `POST /api/notifications/native-push` after the user grants system notification permission. Confirm the authenticated registration is bound to its current session, user, membership and company.
5. Send a synthetic chat message from another test member. Check the Expo ticket/receipt, tap the notification, verify the mobile app selects the matching company and opens the referenced chat message. Repeat with the app foregrounded, backgrounded and terminated.

`GET` on the same endpoint returns whether the current session has a registration. `DELETE` removes only the token registration owned by that authenticated session. The endpoint never serializes device tokens into user profiles or API responses.

Expo delivery is asynchronous and at-least-once. The database delivery queue retries transient failures with bounded backoff, polls accepted ticket receipts, and removes tokens reported as `DeviceNotRegistered`. A device notification is not a substitute for chat history synchronization; the app must reload the message by its ID after the user taps.

This change does not apply either migration, configure APNs credentials, build/sign an iOS app, or deploy an API. Verify the complete flow only on an isolated staging API and a physical device before release.
