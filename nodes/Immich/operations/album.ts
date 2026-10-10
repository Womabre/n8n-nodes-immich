import { INodeProperties } from 'n8n-workflow';
import { resourceLocatorModes } from '../parameters/shared-parameters';
import { assertBulkSuccess } from '../utils/bulk';
import { clearableExpr, idListExpr, optionalExpr } from '../utils/expressions';

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
						body: {
							ids: idListExpr('assetIds'),
						},
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
						body: {
							albumName: '={{$parameter["albumName"]}}',
							description: optionalExpr('additionalFields.description'),
							assetIds: idListExpr('additionalFields.assetIds'),
						},
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
						qs: {
							isShared: '={{$parameter["filters"]["isShared"]}}',
							isOwned: '={{$parameter["filters"]["isOwned"]}}',
							name: optionalExpr('filters.name'),
							assetId: optionalExpr('filters.assetId'),
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
						body: {
							ids: idListExpr('assetIds'),
						},
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
						body: {
							albumName: '={{$parameter["updateFields"]["albumName"] || undefined}}',
							description: clearableExpr('updateFields.description'),
							albumThumbnailAssetId: '={{$parameter["updateFields"]["albumThumbnailAssetId"] || undefined}}',
							isActivityEnabled: '={{$parameter["updateFields"]["isActivityEnabled"]}}',
							order: '={{$parameter["updateFields"]["order"] || undefined}}',
						},
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

	// Create
	{
		displayName: 'Album Name',
		name: 'albumName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['album'], operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['album'], operation: ['create'] } },
		options: [
			{ displayName: 'Description', name: 'description', type: 'string', default: '' },
			{
				displayName: 'Asset IDs',
				name: 'assetIds',
				type: 'string',
				default: '',
				description: 'Comma-separated list of asset IDs to seed the album with',
			},
		],
	},

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
			{ displayName: 'Album Name', name: 'albumName', type: 'string', default: '' },
			{ displayName: 'Album Thumbnail Asset ID', name: 'albumThumbnailAssetId', type: 'string', default: '' },
			{
				displayName: 'Asset Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'desc',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description: 'Leave empty to remove the description',
			},
			{ displayName: 'Enable Activity Feed', name: 'isActivityEnabled', type: 'boolean', default: true },
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
