import { INodeProperties } from 'n8n-workflow';
import { resourceLocatorModes } from '../parameters/shared-parameters';

export const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['sharedLink'],
			},
		},
		options: [
			{
				name: 'Add Assets',
				value: 'addAssets',
				action: 'Add assets to a shared link',
				description: 'Only valid for individual-asset shared links, not album shared links',
				routing: {
					request: {
						method: 'PUT',
						url: '=/shared-links/{{$parameter["sharedLinkId"]}}/assets',
						body: {
							assetIds: '={{$parameter["assetIds"].split(",").map(id => id.trim())}}',
						},
					},
				},
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a shared link',
				description: 'Share either an album or a list of individual assets via a public link',
				routing: {
					request: {
						method: 'POST',
						url: '/shared-links',
						body: {
							type: '={{$parameter["linkType"]}}',
							albumId: '={{$parameter["linkType"] === "ALBUM" ? $parameter["targetId"] : undefined}}',
							assetIds:
								'={{$parameter["linkType"] === "INDIVIDUAL" ? $parameter["targetId"].split(",").map(id => id.trim()) : undefined}}',
							description: '={{$parameter["additionalFields"]["description"] || undefined}}',
							password: '={{$parameter["additionalFields"]["password"] || undefined}}',
							expiresAt: '={{$parameter["additionalFields"]["expiresAt"] || undefined}}',
							allowDownload: '={{$parameter["additionalFields"]["allowDownload"]}}',
							allowUpload: '={{$parameter["additionalFields"]["allowUpload"]}}',
							showMetadata: '={{$parameter["additionalFields"]["showMetadata"]}}',
						},
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a shared link',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/shared-links/{{$parameter["sharedLinkId"]}}',
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a shared link',
				routing: {
					request: {
						method: 'GET',
						url: '=/shared-links/{{$parameter["sharedLinkId"]}}',
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many shared links',
				routing: {
					request: {
						method: 'GET',
						url: '/shared-links',
						qs: {
							albumId: '={{$parameter["filters"]["albumId"] || undefined}}',
						},
					},
				},
			},
			{
				name: 'Remove Assets',
				value: 'removeAssets',
				action: 'Remove assets from a shared link',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/shared-links/{{$parameter["sharedLinkId"]}}/assets',
						body: {
							assetIds: '={{$parameter["assetIds"].split(",").map(id => id.trim())}}',
						},
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a shared link',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/shared-links/{{$parameter["sharedLinkId"]}}',
						body: {
							description: '={{$parameter["updateFields"]["description"] || undefined}}',
							password: '={{$parameter["updateFields"]["password"] || undefined}}',
							expiresAt: '={{$parameter["updateFields"]["expiresAt"] || undefined}}',
							allowDownload: '={{$parameter["updateFields"]["allowDownload"]}}',
							allowUpload: '={{$parameter["updateFields"]["allowUpload"]}}',
							showMetadata: '={{$parameter["updateFields"]["showMetadata"]}}',
						},
					},
				},
			},
		],
		default: 'create',
	},

	// Create
	{
		displayName: 'Link Type',
		name: 'linkType',
		type: 'options',
		options: [
			{ name: 'Album', value: 'ALBUM' },
			{ name: 'Individual Assets', value: 'INDIVIDUAL' },
		],
		default: 'ALBUM',
		required: true,
		displayOptions: { show: { resource: ['sharedLink'], operation: ['create'] } },
	},
	{
		displayName: 'Album',
		name: 'targetId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The album to use. Select one from the list, or provide the album ID directly.',
		modes: resourceLocatorModes('searchAlbums', 'e.g. 5c9d8f3a-2b1e-4c7a-9f4d-1a2b3c4d5e6f'),
		displayOptions: { show: { resource: ['sharedLink'], operation: ['create'], linkType: ['ALBUM'] } },
	},
	{
		displayName: 'Asset IDs',
		name: 'targetId',
		type: 'string',
		default: '',
		required: true,
		description: 'Comma-separated list of asset IDs',
		displayOptions: { show: { resource: ['sharedLink'], operation: ['create'], linkType: ['INDIVIDUAL'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['sharedLink'], operation: ['create'] } },
		options: [
			{ displayName: 'Allow Download', name: 'allowDownload', type: 'boolean', default: true },
			{ displayName: 'Allow Upload', name: 'allowUpload', type: 'boolean', default: false },
			{ displayName: 'Description', name: 'description', type: 'string', default: '' },
			{ displayName: 'Expires At', name: 'expiresAt', type: 'dateTime', default: '' },
			{ displayName: 'Password', name: 'password', type: 'string', typeOptions: { password: true }, default: '' },
			{ displayName: 'Show Metadata', name: 'showMetadata', type: 'boolean', default: true },
		],
	},

	// Get Many
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['sharedLink'], operation: ['getAll'] } },
		options: [{ displayName: 'Album ID', name: 'albumId', type: 'string', default: '' }],
	},

	// Get / Update / Delete / asset ops — Shared Link
	{
		displayName: 'Shared Link',
		name: 'sharedLinkId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The shared link to use. Select one from the list, or provide the shared link ID directly.',
		modes: resourceLocatorModes('searchSharedLinks', 'e.g. 5c9d8f3a-2b1e-4c7a-9f4d-1a2b3c4d5e6f'),
		displayOptions: {
			show: { resource: ['sharedLink'], operation: ['get', 'update', 'delete', 'addAssets', 'removeAssets'] },
		},
	},

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['sharedLink'], operation: ['update'] } },
		options: [
			{ displayName: 'Allow Download', name: 'allowDownload', type: 'boolean', default: true },
			{ displayName: 'Allow Upload', name: 'allowUpload', type: 'boolean', default: false },
			{ displayName: 'Description', name: 'description', type: 'string', default: '' },
			{ displayName: 'Expires At', name: 'expiresAt', type: 'dateTime', default: '' },
			{ displayName: 'Password', name: 'password', type: 'string', typeOptions: { password: true }, default: '' },
			{ displayName: 'Show Metadata', name: 'showMetadata', type: 'boolean', default: true },
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
		displayOptions: { show: { resource: ['sharedLink'], operation: ['addAssets', 'removeAssets'] } },
	},
];
