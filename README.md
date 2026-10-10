# n8n-nodes-immich

This is an n8n community node for interacting with [Immich](https://immich.app/), the self-hosted photo and video management solution. It lets you upload, organize, search, and share your Immich library directly from n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Resources](#resources)

---

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

---

## Operations

### Asset

| Operation      | Description                                                              |
| -------------- | ------------------------------------------------------------------------- |
| Upload         | Upload a photo or video to Immich                                       |
| Get            | Retrieve asset info by ID                                                |
| Update         | Update description, favorite, rating, visibility, date or location        |
| Delete         | Move assets to the trash, or delete them permanently with Force          |
| Download       | Download the original file for an asset                                 |
| View           | Retrieve the thumbnail or preview image for an asset                     |
| Get Statistics | Count images/videos for the current user; counts everything unless filtered |

### Album

| Operation        | Description                                     |
| ----------------- | ------------------------------------------------ |
| Create            | Create a new album, optionally seeded with assets |
| Get               | Retrieve an album by ID                          |
| Get Many          | List albums, filtered by shared/owned status, name or asset |
| Update            | Update an album's name, description, thumbnail, or sort order |
| Delete            | Delete an album                                  |
| Add Assets        | Add assets to an album                           |
| Remove Assets     | Remove assets from an album                      |
| Add User          | Add a user to an album                           |
| Update User Role  | Update a user's role on an album                 |
| Remove User       | Remove a user from an album                      |

### Search

| Operation         | Description                                                                |
| ------------------ | ---------------------------------------------------------------------------- |
| Search Metadata    | Find assets by structured metadata filters (favorites, album, people, tags…); supports Return All |
| Search Smart       | CLIP-powered natural-language / visual-similarity search; supports Return All |
| Get Suggestions    | Get known values for a metadata facet (city, camera make, etc.)             |

### Person

| Operation | Description                                       |
| --------- | -------------------------------------------------- |
| Get Many  | List the people (recognized faces) in your library; supports Return All |
| Get       | Retrieve a person by ID                            |
| Update    | Rename, favorite, hide, or set the birth date       |
| Merge     | Merge duplicate people into one                    |

### Tag

| Operation     | Description                          |
| ------------- | --------------------------------------- |
| Create        | Create a tag                          |
| Get Many      | List tags                             |
| Get           | Retrieve a tag by ID                  |
| Delete        | Delete a tag                          |
| Tag Assets    | Apply a tag to one or more assets     |
| Untag Assets  | Remove a tag from one or more assets  |

### Shared Link

| Operation      | Description                                            |
| --------------- | --------------------------------------------------------- |
| Create          | Share an album or a list of assets via a public link     |
| Get Many        | List shared links, optionally filtered                  |
| Get             | Retrieve a shared link by ID                             |
| Update          | Update a shared link's settings                          |
| Delete          | Delete a shared link                                     |
| Add Assets      | Add assets to an individual-asset shared link             |
| Remove Assets   | Remove assets from a shared link                          |

### User

| Operation | Description                                                 |
| --------- | ------------------------------------------------------------- |
| Get Many  | Search/list users on the server (useful for sharing)         |
| Get Me    | Get the profile for the authenticated API key                |
| Get       | Retrieve a user by ID                                        |

### Server

| Operation       | Description                                    |
| ---------------- | ------------------------------------------------- |
| Get About Info   | Get build/version/repository metadata            |
| Get Version      | Get the server version                           |
| Get Statistics   | Get server-wide usage counts                     |
| Get Storage      | Get disk usage for server storage                |
| Ping             | Health check — confirms the server is reachable  |

---

## Usage notes

- **ID lists:** fields that take several IDs accept a comma-separated string or an array, e.g. `{{ $json.assetIds }}`. Empty entries are ignored.
- **Bulk results:** Add/Remove Assets, Tag/Untag Assets and Merge fail the node if Immich rejects any ID, listing each ID and reason. IDs that were already present (`duplicate`) count as success, so re-runs are safe.
- **Dates:** date-times without a timezone offset (what the date picker produces) are read in the workflow timezone.
- **Clearing values:** in an Update operation, add a description, password or expiry field and leave it empty to remove that value. For asset ratings, pick **Unrated**.

---

## Credentials

The node authenticates using an Immich API key.

Required fields:

- **Immich URL** — base URL of your Immich instance (e.g. `https://immich.yourdomain.com`)
- **API Key** — generate one under Account Settings > API Keys in Immich

---

## Compatibility

- **Node.js:** `>=20.15`
- **Immich:** 3.0 or newer. Checked against the Immich 3.3.1 OpenAPI spec. Immich 2.x is not supported: its upload requires `deviceAssetId`/`deviceId` and its album filter uses a different parameter.

---

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Immich API documentation](https://immich.app/docs/api/getting-started/)
- [Immich OpenAPI reference](https://api.immich.app/)
