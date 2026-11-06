import { INodeProperties } from 'n8n-workflow';
import { resourceLocatorModes } from '../parameters/shared-parameters';
import { assertBulkSuccess } from '../utils/bulk';
import { clearableSend, idListSend, optionalSend } from '../utils/expressions';
import { resolveUpsertAlbum } from '../utils/upsert';

export const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['album'],
			},
		},
		options: [
			{
				name: 'Add Assets',
				value: 'addAssets',
				action: 'Add assets to an album',
				routing: {
					request: {
						method: 'PUT',
						url: '=/albums/{{$parameter["albumId"]}}/assets',
					},
					output: {
						postReceive: [assertBulkSuccess],
					},
				},
			},
			{
				name: 'Add User',
				value: 'addUser',
				action: 'Add a user to an album',
				routing: {
					request: {
						method: 'PUT',
						url: '=/albums/{{$parameter["albumId"]}}/users',
						body: {
							albumUsers: '={{[{ userId: $parameter["userId"], role: $parameter["role"] }]}}',
						},
					},
				},
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create an album',
				description: 'Create a new album, optionally seeded with assets',
				routing: {
					request: {
						method: 'POST',
						url: '/albums',
					},
				},
			},
			{
				name: 'Create or Update',
				value: 'upsert',
				action: 'Create an album or add assets to it',
				description: 'Create a new record, or update the current one if it already exists (upsert)',
				routing: {
					request: {
						method: 'POST',
						url: '/albums',
					},
					send: {
						preSend: [resolveUpsertAlbum],
					},
					// `assertBulkSuccess` is harmless on the create branch: the POST /albums
					// response is a single album object with no `success` field, so the filter
					// passes everything through. On the add-assets branch (PUT) it turns
					// failed IDs into a node error, with `duplicate` counting as success so
					// re-runs stay idempotent.
					output: {
						postReceive: [assertBulkSuccess],
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an album',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/albums/{{$parameter["albumId"]}}',
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an album',
				description: 'Retrieve an album by ID',
				routing: {
					request: {
						method: 'GET',
						url: '=/albums/{{$parameter["albumId"]}}',
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many albums',
				description: 'List albums, optionally filtered',
				routing: {
					request: {
						method: 'GET',
						url: '/albums',
						// `isShared`/`isOwned` are boolean toggles the user can only set to
						// true/false, so they cannot carry an expression and are safe to read
						// back via `$parameter`. The string filters (`name`, `assetId`) are
						// sent per-field via `routing.send` on the field definitions, which
						// resolves user-entered expressions through `$value`.
						qs: {
							isShared: '={{$parameter["filters"]["isShared"]}}',
							isOwned: '={{$parameter["filters"]["isOwned"]}}',
						},
					},
				},
			},
			{
				name: 'Remove Assets',
				value: 'removeAssets',
				action: 'Remove assets from an album',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/albums/{{$parameter["albumId"]}}/assets',
					},
					output: {
						postReceive: [assertBulkSuccess],
					},
				},
			},
			{
				name: 'Remove User',
				value: 'removeUser',
				action: 'Remove a user from an album',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/albums/{{$parameter["albumId"]}}/user/{{$parameter["userId"]}}',
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update an album',
				description: "Update an album's name, description, thumbnail, or sort order",
				routing: {
					request: {
						method: 'PATCH',
						url: '=/albums/{{$parameter["albumId"]}}',
					},
				},
			},
			{
				name: 'Update User Role',
				value: 'updateUserRole',
				action: 'Update a user role on an album',
				routing: {
					request: {
						method: 'PUT',
						url: '=/albums/{{$parameter["albumId"]}}/user/{{$parameter["userId"]}}',
						body: {
							role: '={{$parameter["role"]}}',
						},
					},
				},
			},
		],
		default: 'create',
	},

	// Create / Upsert
	{
		displayName: 'Album Name',
		name: 'albumName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['album'], operation: ['create', 'upsert'] } },
		// For `create` this sends `albumName` in the body. For `upsert` the preSend
		// hook rewrites the body entirely (and reads albumName via getNodeParameter),
		// so this send is a no-op on that branch.
		routing: optionalSend('body', 'albumName'),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['album'], operation: ['create'] } },
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				routing: optionalSend('body', 'description'),
			},
			{
				displayName: 'Asset IDs',
				name: 'assetIds',
				type: 'string',
				default: '',
				description: 'Comma-separated list of asset IDs to seed the album with',
				routing: idListSend('body', 'assetIds'),
			},
		],
	},

	// Upsert — asset IDs (consumed by the preSend hook, not via routing.send,
	// because the body shape differs between the create and add-assets branches)
	{
		displayName: 'Asset IDs',
		name: 'assetIds',
		type: 'string',
		default: '',
		required: true,
		description: 'Comma-separated list of asset IDs to add to the album',
		displayOptions: { show: { resource: ['album'], operation: ['upsert'] } },
	},

	// Add User — body is a single object `albumUsers: [{ userId, role }]` built
	// from the `userId` resourceLocator and `role` options field. Both are
	// non-free-text (locator picks an ID, role picks from options), so neither
	// can carry a `{{ }}` expression; the inline `$parameter` body is safe.
	// Update User Role — body is `{ role }`, role is options-only, inline safe.

	// Get / Update / Delete / asset & user ops — Album
	{
		displayName: 'Album',
		name: 'albumId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The album to use. Select one from the list, or provide the album ID directly.',
		modes: resourceLocatorModes('searchAlbums', 'e.g. 5c9d8f3a-2b1e-4c7a-9f4d-1a2b3c4d5e6f'),
		displayOptions: {
			show: {
				resource: ['album'],
				operation: [
					'get',
					'update',
					'delete',
					'addAssets',
					'removeAssets',
					'addUser',
					'updateUserRole',
					'removeUser',
				],
			},
		},
	},

	// Get Many
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['album'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Asset ID',
				name: 'assetId',
				type: 'string',
				default: '',
				description: 'Only return albums containing this asset (Immich then ignores the other filters)',
				routing: optionalSend('query', 'assetId'),
			},
			{
				displayName: 'Is Owned',
				name: 'isOwned',
				type: 'boolean',
				default: true,
				description: 'Whether to return only albums you own (true) or only albums shared with you (false)',
			},
			{
				displayName: 'Is Shared',
				name: 'isShared',
				type: 'boolean',
				default: true,
				description: 'Whether to return only shared albums (true) or only unshared albums (false)',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Only return albums with exactly this name',
				routing: optionalSend('query', 'name'),
			},
		],
	},

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['album'], operation: ['update'] } },
		options: [
			{
				displayName: 'Album Name',
				name: 'albumName',
				type: 'string',
				default: '',
				routing: optionalSend('body', 'albumName'),
			},
			{
				displayName: 'Album Thumbnail Asset ID',
				name: 'albumThumbnailAssetId',
				type: 'string',
				default: '',
				routing: optionalSend('body', 'albumThumbnailAssetId'),
			},
			{
				displayName: 'Asset Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'desc',
				routing: optionalSend('body', 'order'),
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description: 'Leave empty to remove the description',
				routing: clearableSend('body', 'description'),
			},
			{
				displayName: 'Enable Activity Feed',
				name: 'isActivityEnabled',
				type: 'boolean',
				default: true,
				routing: optionalSend('body', 'isActivityEnabled'),
			},
		],
	},

	// Add/Remove Assets
	{
		displayName: 'Asset IDs',
		name: 'assetIds',
		type: 'string',
		default: '',
		required: true,
		description: 'Comma-separated list of asset IDs',
		displayOptions: { show: { resource: ['album'], operation: ['addAssets', 'removeAssets'] } },
		routing: idListSend('body', 'ids'),
	},

	// Add/Update User
	{
		displayName: 'User',
		name: 'userId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The user to use. Select one from the list, or provide the user ID directly.',
		modes: resourceLocatorModes('searchUsers', 'e.g. 5c9d8f3a-2b1e-4c7a-9f4d-1a2b3c4d5e6f'),
		displayOptions: { show: { resource: ['album'], operation: ['addUser', 'updateUserRole', 'removeUser'] } },
	},
	{
		displayName: 'Role',
		name: 'role',
		type: 'options',
		options: [
			{ name: 'Editor', value: 'editor' },
			{ name: 'Viewer', value: 'viewer' },
		],
		default: 'viewer',
		displayOptions: { show: { resource: ['album'], operation: ['addUser', 'updateUserRole'] } },
	},
];
