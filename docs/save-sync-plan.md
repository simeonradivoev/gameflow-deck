# Robust save sync with rclone

Review date: 2026-09-09. Scope: investigation and implementation plan; no runtime changes or remote operations performed. Preserve the user's disabled plugin setting.

## Recommendation

Keep rclone as the storage transport. Move save ownership, change detection, conflict decisions, and recovery into a Gameflow save-sync service. Use immutable, versioned save snapshots with ordinary JSON manifests containing locally computed SHA-256 hashes. Persist each device's last reconciled revision locally. Remote timestamps, file size, and provider hashes can optimize or describe operations; they must not decide which save wins.

The desired experience is automatic synchronization when history proves it is safe, a clear choice when histories diverge, and an undoable restore at any time. Never silently choose a winner by timestamp or size. Binary saves and shared memory cards cannot generally be merged safely.

## Findings in the current implementation

All rclone references below refer to `src/bun/api/plugins/builtin/other/com.simeonradivoev.gameflow.rclone/rclone.ts`.

| Priority | Evidence | Consequence |
| --- | --- | --- |
| P1 | Import at lines 278–320 copies the remote directly into the live save directory. There is no baseline, conflict record, staging area, or rollback snapshot. | A stale remote can overwrite progress made locally or offline before the game starts. |
| P1 | Lines 300 and 374 read `remote.ReadMetadata`; documented fsinfo responses place this flag under `Features`. Import initializes `supportsMetadata` to true and passes it to `NoCheckDest` at line 319. | With the documented response, `!undefined` enables forced import copying. The local fallback also forces copying. Correcting the property alone cannot solve conflict detection. ReadMetadata is not proof of modification-time or hash support. |
| P1 | Fixed-size export uses `NoCheckDest: true` at lines 396–405; other export calls `/sync/sync` at lines 416–430. Neither compares against a previously reconciled version. | Fixed-size memory cards can overwrite another device's changes. Mirroring can remove destination files within the selected scope. There is no retained version to undo these actions. |
| P1 | Both polling loops check `finished` before `error` and never require `success` (lines 331–347 and 443–459). The import path accesses `job.jobid` after enqueue failure was converted to undefined. | Failed jobs can appear successful; polling exceptions can leave launch waiting indefinitely. Rejected/error paths do not reliably clear intervals. Requests have no cancellation or bounded deadline. |
| P1 | Array filter mapping at lines 385–391 does not return the normalized non-glob path. | Non-glob array entries become undefined, serialized as null, making the export selection invalid rather than representing the intended files. |
| P1 | `LaunchGameJob.start()` invokes postPlay in `finally` (lines 304–309), including when prePlay fails. There is no sync-session eligibility check in rclone export. | A failed import or launch can still reach export and overwrite the remote from stale local state. |
| P2 | Import converts every remote stat error to absence and uses `return` for a missing slot (lines 292–308). | Authentication/network errors are hidden; one absent slot skips all later slots. |
| P2 | Save destinations are store/game or emulator/slot; rclone does not use `shared`. PCSX2 explicitly declares shared, fixed-size `*.ps2` cards. | Conflict, locking, and restore scope must account for saves shared across games. Per-game identity alone would be unsafe. |
| P2 | `LaunchGameJob.changedSaveFiles` has a commented-out watcher. Source/emulator hooks populate `validChangedSaveFiles` with selected candidates, including globs. | These are save selections, not reliable evidence of content changes. There is no explicit deletion history. |
| P2 | Post-play sync is inline; the apparent five-second timeout in `LaunchGameJob.postPlay()` is scheduled after the awaited hooks. The SDK task queue is in-memory. | That timeout does not bound hung sync. Pending uploads and decisions need independent durable records to survive crashes/restarts. |
| P2 | Standard integration-test preload blacklists the rclone plugin (`src/tests/preload.ts:25`). | The default test suite does not exercise this plugin through normal application loading. Dedicated isolated coverage is needed. |

Rclone's API documents separate `Features`, `Hashes`, and timestamp `Precision`, plus distinct `finished`, `success`, and `error` job fields. Capability handling and job completion should be validated against the supported binary version. [Rclone remote-control API](https://rclone.org/rc/)

Rclone `sync` can delete destination files. `copy` avoids destination deletion but can still replace files; neither supplies application-level conflict history. [Sync documentation](https://rclone.org/commands/rclone_sync/), [copy documentation](https://rclone.org/commands/rclone_copy/)

## Correctness model

### Save scope before any transfer

Introduce an additive SDK save-set discovery contract that resolves before import. The existing `SaveSlots` only provides directories, while `SaveFileChange` supplies filters and shared/fixed-size information after play. The new contract must identify:

- Stable logical save-set ID, original source/game identity where relevant, slot, platform/profile compatibility, and scope schema version.
- Validated local root and exact included relative paths, with explicit glob semantics and exclusions.
- Whether a set belongs to one game or is a shared emulator resource, and which files form an indivisible consistency group.
- Overlapping local roots and shared resources that require the same lock.

For legacy integrations, permit safe backup only when the selection is known. Do not infer a narrowly scoped restore from a directory alone. Upgrade bundled integrations deliberately; preserve external SDK compatibility. Keep `findSaveLocations` read-only and do not trigger sync while displaying game details. Distinguish a discoverable but not-yet-created save folder from an unavailable mount or permission failure.

Resolve glob matches locally to explicit paths. Reject traversal, absolute remote paths, symlink/junction escapes, case collisions, incompatible Windows filenames, unexpected scope expansion, and source/destination overlap. Keep backups and staging outside watched save roots. An empty or invalid selection must never mean “all files.”

### Snapshots and manifests

Create a new remote namespace, for example `gameflow/save-sync/v2/<save-set-id>/revisions/<revision-id>/`. Leave the existing `gameflow/saves` layout untouched during migration.

Each revision contains a complete logical inventory and immutable payloads. Start with independent snapshots for simplicity; add deduplication later only with proven retention/reference handling. A versioned manifest records the save-set identity, device ID and user-facing name, parent revision IDs, relative file paths, byte lengths, SHA-256 hashes, and explicit removals. Include snapshot/session timestamps for display, with provenance; they are not an ordering authority. Never upload absolute local paths or credentials.

Persist local records for save sets, reconciled revisions, sessions, snapshots, pending operations, conflicts, and recovery journals in Drizzle-managed SQLite. A baseline advances only after the selected version was successfully verified and applied/published. Capture local hashes even for equal-size files and memory cards; timestamps alone must not allow hashing to be skipped in the correctness path.

### Supporting destinations without metadata

Manifests are normal file content, so they work on a destination without custom metadata, modification times, or hashes. For legacy or externally editable files with no trustworthy hash, read the bytes and hash them. Rclone supports download-based checking; expose the extra verification time without weakening the comparison. [Download-based verification](https://rclone.org/commands/rclone_check/)

Verify newly uploaded snapshot bytes using compatible content hashes where available, otherwise read back and hash. A locally generated manifest is not proof the upload arrived intact. Validate every downloaded payload against its manifest before installation. Corrupt, incomplete, missing, unsupported, or unreadable manifests mean “cannot verify,” never “nothing changed.”

Treat the v2 namespace as Gameflow-managed immutable history. Detect payload mismatch on reads and periodic integrity checks. An unchanged manifest cannot establish that an external writer has not modified payload bytes; do not claim that guarantee without rereading the data. Raw-folder interoperability, if later required, needs repeated content verification and its own concurrency contract.

### Reconciliation rules

Compare local content (L), remote committed history/content (R), and the last reconciled baseline (B), at a complete save-set or declared consistency-group level.

| Observation | Action |
| --- | --- |
| L and R have identical verified content | Reconcile without transfer; record observed history. |
| L = B; R is a verified descendant | Back up L, then stage and apply R. |
| R = B; L changed | Publish a new revision descending from B. |
| Both changed and differ, or remote history has competing branches | Preserve both; require a choice. Even disjoint file changes can form incompatible game state. |
| No baseline, both sides contain different saves | First-sync choice; never guess which is newer. |
| No baseline, only one side has saves and the other is confirmed empty | Offer an explicit initial backup/restore preview, then establish the baseline. |
| Unreachable remote, incomplete listing, unreadable root, or invalid manifest | Keep local saves; expose pending/error state. No overwrite, deletion, or baseline advancement. |
| Baseline files are missing | Treat as potential deletion/reset, not initialization. Verify scope/root availability and require review for suspicious or complete disappearance. |

Model deletions in revision history. A successful restore may remove explicitly managed files absent from the selected revision, after making a rollback snapshot. Preserve all out-of-scope files. Never translate a failed scan, changed filter, missing drive, or empty listing into deletion. Keep deletion-versus-modification conflicts for the user.

### Concurrent devices and publication

Use unique immutable revision paths. Upload payloads first, verify them, then publish a manifest/commit record last. Readers must validate completeness; do not assume remote rename is atomic. A partial commit is ignored and remains recoverable.

Use revision ancestry, not a single mutable “latest” file, as history. Re-list before publication and before applying a conflict decision. Two devices may still publish concurrently on a backend without conditional writes or a reliable distributed lock. Preserve both branches and surface the conflict when both are visible. A best-effort remote lock is not a correctness guarantee; a delayed listing can delay detection, but must not destroy either version.

Bind user decisions to the observed local fingerprint and exact remote revision set. If either changes while the dialog is open, refresh the comparison before applying. A resolution publishes a revision referencing all reviewed branches. A newly discovered branch remains unresolved. Initially disable automatic remote history pruning; safe distributed garbage collection is a separate milestone.

## Safeguards and lifecycle

1. Before play, discover and lock the save set, reconcile, preserve the current local version, and finish any local restore before starting the process. Use explicit session states so failed/cancelled preparation cannot authorize export.
2. During play, forbid restoring into active save roots. Record the session's baseline and offline/conflict choice. Enforce shared-resource locks across games, manual restore, and sync jobs. Source integrations that detach must establish actual process exit before snapshotting; if uncertain, defer capture.
3. After exit, snapshot selected files into local staging and hash the staged bytes. Detect files changing during capture and retry within a bound; settle delays alone are not proof of consistency. Capture valid saves after a game crash when safe, while labelling the session accurately.
4. Persist an upload operation before returning to the library. Run uploads through the SDK task queue with a separate save-sync group, cancellation, bounded requests, backoff, progress, and explicit outcomes. Never wait on a child job in the same occupied queue group. On restart, revalidate and resume from the durable outbox.
5. Restore through staging plus a local transaction journal and rollback snapshot. A multi-file restore is not universally atomic, especially across Windows volumes; prevent launch until completion or recovery. Handle locks, disk-full errors, partial writes, crashes between files, and interrupted rollback.
6. On shutdown or plugin reload, abort network work, stop rclone jobs, settle polling loops, release listeners/locks, and retain pending work. Do not discard unsent snapshots. Replace readiness-log guessing with a bounded health check and handle process exit. Record/test a supported rclone version and verify downloaded binaries rather than silently depending on `rclone-current`.
7. Keep unresolved conflicts, unsent snapshots, and pre-restore versions pinned. Suggested later local retention default: 10 verified versions per set, with user-visible storage limits. If safe retention cannot fit, ask the user to free space; never silently delete the only recovery copy. Remote pruning remains off until reachability, offline devices, and race handling are tested.

## User experience

Use one main setting, “Sync saves across devices,” plus “Local backups only” and “Off.” Migrate existing import/export combinations into explicit equivalent modes rather than silently enabling the opposite direction. Preserve disabled state. Place technical rclone configuration in advanced settings; show destination setup/testing in plain language. A destination without metadata should work automatically using Gameflow manifests, with “Verifying save contents…” when readback takes time.

Add a Saves area to game details and a global pending-actions list. Show actionable states: Up to date; Saved on this device; Upload pending; Checking saves; Needs your choice; Could not sync; Paused. “No saves found” is different from “Could not read saves.” Routine success should update the status quietly. Notify once for a new actionable problem, not on every retry.

When launching with a conflict, show:

> **Choose the save to use**
>
> Progress changed on more than one device. Both versions will be kept in save history.
>
> **This device — Steam Deck**: last played here, snapshot time, save size.
>
> **Other device — Desktop PC**: originating device, snapshot time, save size.

Primary choices:

- **Use this device's save**: preserve the remote version, revalidate the decision, publish the resolution, and launch using local content.
- **Use the other save**: preserve local content, download/verify/restore the selected remote version, record the resolution, and launch.
- **Decide later**: return to game details with the conflict intact.

Offer **Play with this device's save without syncing** as a clearly explained secondary action: preserve both branches, allow play, and retain the new local snapshot without overwriting the unresolved remote branch. This also supports offline play. “Keep both” means keeping both in history; do not put renamed conflict files in the live save folder or imply the game can load both.

For more than two remote branches, list all alternatives by device/session. Show unknown dates honestly and label snapshot time separately from last-played time. Do not claim “more progress” without a game-specific parser. For a shared card, explicitly say that choosing it affects other games using that card.

Provide **Retry**, **Review conflict**, **Restore previous version**, **Pause sync for this game/save set**, and **View details**. Restore should show the affected set and retain an undo snapshot. A failure after choosing must leave a recoverable status, not dismiss the dialog as successful. Offline choices cannot authorize a future blind overwrite when connectivity returns.

Reuse `ContextDialog`, option `Button`, focus boundaries, and existing shortcut patterns. Require deliberate activation of a version; default focus must not select a winner automatically. B/back cancels or defers safely. Restore focus to the initiating control. Support controller, keyboard, mouse, handheld/desktop sizes, and both themes. Avoid raw paths, hashes, and rclone errors in the main decision UI.

## Implementation sequence

| Phase | Work and integration points | Exit criteria |
| --- | --- | --- |
| 1. Contain current failures | Refactor rclone RC client/polling; validate schemas; correct capabilities, filters, absent-slot handling, cancellation, readiness, and error reporting. Gate export on session eligibility. Remove unsafe direct overwrite/mirror behavior from automatic paths. Keep disabled configuration. | Failed jobs cannot report success or hang launch. Preparation failure cannot upload. Until safe restore is available, explicitly show backup-only/unavailable status rather than silently claiming sync. |
| 2. Save sets and local recovery | Add compatible SDK discovery/types in `shared.ts` and `hooks/games.ts`; update bundled adapters. Add backend service under `src/bun/api/saves`, Drizzle state, local snapshots, locks, and restore journal. | Exact scopes and shared cards are modelled; interrupted local restores recover; no unrelated files are touched. |
| 3. Remote version protocol | Add manifests, immutable snapshots, validation, ancestry reconciliation, durable outbox, and `SaveSyncJob`. Treat local fallback as the same transport contract. | Metadata-free storage detects same-size edits, preserves competing revisions, resumes uploads, and verifies payloads. |
| 4. Launch and conflict UI | Integrate explicit session states into `launch-game-job.ts`; add typed Elysia status/history/resolve/retry/restore/pause endpoints via `rpc.ts`; expose save jobs through `jobs.ts`. Extend launcher and game details with conflict and history components. | Decisions survive UI reconnect/restart; stale choices are rejected; offline play does not overwrite unresolved remote saves; controller flow works. |
| 5. Migration and release gate | Import legacy folders read-only into snapshots, hash content, preview first sync, preserve originals, and keep v2 isolated from old clients. Add setup diagnostics and optional retention after correctness is proven. | Legacy local/remote differences require a choice; remote/profile/filter changes cannot reuse the wrong baseline; Windows and Linux acceptance scenarios pass. |

Proposed API mutations should accept opaque save-set/conflict/snapshot IDs and expected revision tokens, not arbitrary filesystem paths or remote names from the browser. Keep credentials and path resolution server-side. Persist unresolved user actions separately from transient WebSocket job updates. Prefer additive SDK contracts and settings migrations, with an explicit minimum SDK range when required.

## Verification plan

Use Bun tests with an injected fake transport for deterministic failures and real rclone against temporary isolated local remotes for protocol integration. Include metadata-free capability responses and equal-size/equal-time content edits. The normal application preload excludes rclone, so explicitly load the implementation in dedicated tests without launching real user configuration.

Required scenarios:

- Every reconciliation-table row; fixed-size card changes; identical independent edits; three devices; clock skew; divergent parents; delayed remote listing and a concurrent resolution.
- First sync, reset baseline, changed destination/profile/filter, missing slot followed by valid slots, disappearing mount, denied access, invalid selection, and deletion-versus-edit.
- Upload failure at each publication boundary, invalid commit JSON, mismatched payload hash, missing payload, RC finished-with-error, enqueue failure, timeout, cancellation, restart, and plugin reload.
- Failed prePlay must not export. Offline play followed by another device's upload must conflict. Cloud unavailability must not prevent an explicitly chosen local session.
- Crash/disk-full/file-lock at each restore step; rollback interrupted and resumed; files changing during snapshot; failed launch versus actual game crash.
- Shared-card contention between games; consistent multi-file restore; literal/glob/array path selection; Windows case/junction/path rules and Linux symlinks/case sensitivity.
- History restore and undo; pinned versions survive retention; unsupported schema and legacy clients cannot overwrite v2; missing hashes never silently reduce equality to size alone.
- UI reconnect, back/cancel, all controller actions, focus restoration, inaccessible destination, offline/pending state, handheld/desktop, and light/dark themes.

For implementation changes run targeted Bun tests, `bun run tsc`, `bun run test`, and `bun run build:vite`; generate/review migrations with `bun run drizzle:generate`. Test Windows native and Linux NW.js, including AppImage/Flatpak access and suspend/resume where supported. Do not enable sync automatically until these gates pass.

## Alternative considered

Rclone bisync already offers baseline comparison, conflict handling, recovery options, and a download-hash fallback. It is useful as a reference or a prototype comparison, but is not a drop-in user-friendly save system: Gameflow still needs stable save scopes, shared-card semantics, launch decisions, durable UI state, snapshots, and transactional local restore. Default conflict-file renaming is unsuitable in live game save directories. The recommended design keeps those decisions explicit in Gameflow. [Bisync documentation](https://rclone.org/bisync/)

## Review limitations

This is a source review and documentation-backed design, not a reproduced runtime test. No configured destination, user save, installed rclone binary, or secret configuration was inspected. No tests/builds were run because no application code changed. The pre-existing untracked `src/tests/mock-roms/` directory was left untouched. Provider-specific consistency and performance need isolated validation during implementation.

## Implementation progress — first safety milestone

Implemented on 2026-09-09:

- Replaced legacy automatic import/export with explicit backup-only behavior. Stored import/export preferences and the disabled plugin setting are preserved; automatic restore performs no writes. Settings explain the restriction and the first applicable launch shows a notice.
- Added local snapshot capture with SHA-256 manifests, independent version directories, explicit file selection, nested glob support, path/junction containment, overlap checks, and content checks before and after capture. Shared-card identity is retained. Live saves and previous snapshots are not changed.
- New remote backups use the separate gameflow/save-backups/v1 namespace. Payloads are uploaded from the local snapshot, verified through content readback, and followed by manifest publication and a final check. Legacy gameflow/saves data is untouched.
- Added sequential, cancellable rclone job polling, request/job deadlines, job-success validation, process-identity readiness checks, and cleanup/reload handling. Raw upstream errors/logs are not forwarded to users.
- Post-play export now requires a process to have started. Failed preparation cannot trigger export; an actual game crash still runs post-play hooks.

This is the containment milestone, not the completed sync design. Conflict decisions, snapshot browsing/restoration, transaction journals, stable pre-launch save-set discovery, durable upload retry, revision ancestry, retention, SDK/database migrations, and pinned binary downloads remain to implement. Current backups are retained without automatic pruning. Failed uploads retain local snapshots but are not automatically retried. Upload work still runs in the post-play hook until the durable queue milestone.

The interim local layout is <downloadPath>/save-backups/rclone/<save-set-hash>/<snapshot-id>/, containing manifest.json and files/. There is no automatic conversion into the planned v2 reconciliation protocol and no direct migration of legacy saves.

Verification on Windows with Bun:

- bun test src/tests/save-backup.test.ts src/tests/launch-output.test.ts: 20 passed. Includes fake metadata-free transport, transfer failures/cancellation, literal/glob selection, same-size/same-time card edits, path escapes, failed preparation, and reused plugin-instance reload.
- The opt-in real-rclone test passed with rclone 1.73.4, a temporary configuration, and an isolated local alias destination. Enable it by supplying GAMEFLOW_TEST_RCLONE pointing to a binary. It verifies independent uploads and unchanged legacy remote data.
- bun run test: 80 passed, 1 skipped, 1 failed. The existing uses custom emulator test fails at its platform insert with UNIQUE constraint failed: platforms.slug, before launch behavior.
- bun run tsc: remains blocked by eight existing diagnostics in packaging, Windows controls, GameList, Header, SelectMenu, and test preload. No diagnostics were reported in changed files.
- No frontend files changed; no frontend build, controller UI exercise, Linux runtime, AppImage, or Flatpak verification was performed in this milestone.
