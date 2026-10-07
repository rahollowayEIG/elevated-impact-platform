# ElevationPilot Google Drive folders

Ryan requested Hangar-down organization on October 7, 2026. Every connected app must resolve the authorized Hangar before creating a folder or writing an export. Labels help people navigate; immutable organization/event IDs and stored Google folder IDs determine ownership.

## Folder hierarchy

- Shared platform root → Hangars → Hangar name → app → materials for organization-wide work.
- Shared platform root → Hangars → Hangar name → Events → event → app → materials for event-scoped work.
- Brand assets belong under their Hangar. Event artifacts belong under their event, even when EIG manages the event for another Hangar.
- InceptionApex's current EIG-only resizer exports go to Hangars / Elevated Impact Group / InceptionApex / Resized Images. The resizer has no customer/event destination picker yet.
- My Designs is private platform project storage. A flattened image/ZIP in Drive is an export, not the editable project or a replacement for version history.

The existing configured root is named EIG Golf Event Registrations within the EIG Events shared-drive area. The new Hangars hierarchy is underneath that configured root. Moving/renaming the platform root is a separate migration; do not silently repoint existing syncs.

## Identity and permissions

Folder mappings live in service-only `platform_google_drive_folders`. Their keys contain the configured root and immutable organization ID; event-specific mappings must also include the immutable event ID. Reuse mappings, preserve folder/file IDs, verify the expected parent before writing, and stop if a destination has moved or changed. Never take an arbitrary client-supplied folder ID as an authorized destination.

Drive hierarchy does not establish access isolation by itself. The current connection is EIG's shared Google account, not each user's personal Drive. The new endpoint checks a verified account, fresh interactive session, active account, and current EIG membership before every export. Customer rollout requires an authorized destination picker plus a review of Drive inherited permissions and provider account boundaries. Do not expose the EIG shared Drive to customer accounts by simply changing the menu gate.

Resized exports are explicitly user-triggered. Record the existing actor account, organization, filename, byte count, checksum, Google file/folder ID, completion time and request ID in `inception_drive_exports`. Verify Google metadata and SHA-256 before reporting success. Repeated identical requests use the same file ID. Credentials and resumable upload URLs stay on the server. No message, email, publication or sharing change is part of an export.

## Existing folder audit and migration gap

The October 7 audit matched all three database-linked registration event folders to Chapel Hill Golf Course. Google metadata confirmed they remain directly under the old registration root. One older folder with a duplicate Club Championships label is also present but is not linked by the current event records. Do not infer its ownership or delete it from its name.

The existing `sync-google-roster` function still creates event folders directly under `GOOGLE_DRIVE_FOLDER_ID`; it has not adopted this hierarchy. Therefore the whole Drive is **not yet organized Hangar down**. A follow-up migration must update that writer, establish the Chapel Hill / Events destination, verify the source parents and access inheritance, move the three verified folders while preserving IDs, audit before/after parents, and reconcile the unlinked duplicate. Review other Drive writers before claiming platform-wide completion.
