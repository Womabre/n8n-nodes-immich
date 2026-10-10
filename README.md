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
| Update         | Update favorite/description/rating/visibility on an asset                |
| Delete         | Permanently delete one or more assets by ID                              |
| Download       | Download the original file for an asset                                 |
| View           | Retrieve the thumbnail or preview image for an asset                     |
| Get Statistics | Get counts of images/videos for the current user, optionally filtered   |

### Album

| Operation        | Description                                     |
| ----------------- | ------------------------------------------------ |
| Create            | Create a new album, optionally seeded with assets |
| Get               | Retrieve an album by ID                          |
| Get Many          | List albums, optionally filtered                 |
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
| Search Metadata    | Find assets by structured metadata filters (favorites, album, people, tags…) |
| Search Smart       | CLIP-powered natural-language / visual-similarity search                    |
| Get Suggestions    | Get known values for a metadata facet (city, camera make, etc.)             |

### Person

| Operation | Description                                       |
| --------- | -------------------------------------------------- |
| Get Many  | List the people (recognized faces) in your library |
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

## Credentials

The node authenticates using an Immich API key.

Required fields:

- **Immich URL** — base URL of your Immich instance (e.g. `https://immich.yourdomain.com`)
- **API Key** — generate one under Account Settings > API Keys in Immich

---

## Compatibility

- **Node.js:** `>=20.15`
- Built against the Immich OpenAPI spec (Immich 3.0.1)

---

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Immich API documentation](https://immich.app/docs/api/getting-started/)
- [Immich OpenAPI reference](https://api.immich.app/)
