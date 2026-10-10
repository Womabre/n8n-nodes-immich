# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-10

Neither 0.1.0 nor 0.2.0 has been published to npm. Parameter changes marked **Breaking** only affect workflows built against a local 0.1.0 build.

### Added

- Return All and Limit on Search Metadata, Search Smart and Person Get Many. Return All pages through results 1000 at a time.
- Bulk operations (album Add/Remove Assets, tag Tag/Untag Assets, shared-link Add/Remove Assets, person Merge) now fail with every rejected ID and its reason. Before, Immich's per-ID errors were returned as ordinary output. `duplicate` counts as success.
- Album Get Many filters for Immich 3: Is Shared, Is Owned and Name.
- Upload sends the `filename` form field and an `x-immich-checksum` SHA-1 header, so Immich can spot files it already has.
- Update operations can clear values: shared-link password, expiry and description, album description, and asset rating (new **Unrated** option).
- Downloads and thumbnails without a server filename are named `<assetId>[-thumbnail|-preview].<ext>`.
- Tests that run the routing expressions through n8n's own expression engine, plus tests for the multipart builder, bulk-result check, pagination and binary handling.

### Changed

- **Breaking:** Asset Get Statistics filters (Is Favorite, Is Trashed, Visibility) moved into an optional Filters collection.
- **Breaking:** Shared Link Create uses `albumId` (Album) and `assetIds` (Individual Assets) instead of one shared `targetId` parameter.
- **Breaking:** the Page and Size filters on Search and Person Get Many are replaced by Return All and Limit.
- **Breaking:** Asset Update Rating is now a dropdown (1-5 stars, Rejected, Unrated) instead of a number.
- Comma-separated ID fields also accept arrays, and ignore blank entries.
- Date-time fields are sent as ISO 8601 with an explicit offset. Input without an offset is read in the workflow timezone.
- Downloaded files keep the server's `Content-Type`. The file extension is only used when the server sends `application/octet-stream`.
- Asset Update and Delete descriptions now match the API: the update endpoint is stable, and Delete moves assets to the trash unless Force is on.
- `bun run release` runs release-it from `.release-it.json` (same steps as `n8n-node release`, without regenerating this changelog).
- Compatibility: Immich 3.0 or newer.

### Removed

- **Breaking:** Album Get Many "Shared Only" filter. Immich 3 removed the `shared` query parameter.
- Template leftovers: `gulpfile.js`, `index.js`, legacy `.eslintrc*` files, the duplicate `eslint.config.mjs`, `package-lock.json`, and the `gulp`, `auto-changelog`, `eslint-plugin-n8n-nodes-base` and `@typescript-eslint/*` devDependencies.
- Changelog entries inherited from `n8n-nodes-autodesk-vault-data-api`.

### Fixed

- Asset Get Statistics always sent `isFavorite=false&isTrashed=false`, so favourites and trashed assets were never counted.
- Switching Shared Link Create from Album to Individual Assets left a stale album selector value behind, and the request then failed.
- A trailing slash in the credential URL produced `https://host//api` in requests and in the credential test.
- Shared-link `expiresAt`, search `takenAfter`/`takenBefore`, asset `dateTimeOriginal` and upload dates from the date picker had no timezone offset, so Immich 3 rejected them.
- Person `birthDate` was sent as a date-time. Immich expects `YYYY-MM-DD`.
- Upload filenames containing `"` or line breaks broke the multipart request.

## [0.1.0] - 2026-07-08

### Added

- First Immich release: an `Immich` node and an `ImmichApi` credential (API key) covering Asset, Album, Search, Person, Tag, Shared Link, User and Server. The package began as a copy of `n8n-nodes-autodesk-vault-data-api` and was rewritten from scratch.

[Unreleased]: https://github.com/Womabre/n8n-nodes-immich/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Womabre/n8n-nodes-immich/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Womabre/n8n-nodes-immich/releases/tag/v0.1.0
