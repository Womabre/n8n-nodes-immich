import { INodeProperties } from 'n8n-workflow';
import { resourceLocatorModes } from '../parameters/shared-parameters';
import { assertBulkSuccess } from '../utils/bulk';
import { clearableSend, dateTimeSend, idListSend, idListJs, optionalSend } from '../utils/expressions';

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
					},
					output: {
						postReceive: [assertBulkSuccess],
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
						// `linkType` is an options field (cannot carry an expression), and
						// `albumId` is a resourceLocator the proxy extracts. `assetIds` is a
						// comma-separated string the user can fill with an expression, so it is
						// sent per-field via `routing.send` on the field definition.
						// Booleans (`allowDownload`/`allowUpload`/`showMetadata`) are toggles.
						body: {
							type: '={{$parameter["linkType"]}}',
							albumId: '={{$parameter["linkType"] === "ALBUM" ? $parameter["albumId"] : undefined}}',
							assetIds: `={{$parameter["linkType"] === "INDIVIDUAL" ? ${idListJs('assetIds')} : undefined}}`,
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
					},
					output: {
						postReceive: [assertBulkSuccess],
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
						// Booleans (`allowDownload`/`allowUpload`/`showMetadata`) are toggles.
						body: {
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
		name: 'albumId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The album to use. Select one from the list, or provide the album ID directly.',
		modes: resourceLocatorModes('searchAlbums', 'e.g. 5c9d8f3a-2b1e-4c7a-9f4d-1a2b3c4d5e6f'),
		displayOptions: { show: { resource: ['sharedLink'], operation: ['create'], linkType: ['ALBUM'] } },
	},
	{
		displayName: 'Asset IDs',
		name: 'assetIds',
		type: 'string',
		default: '',
		required: true,
		description: 'Comma-separated list of asset IDs',
		displayOptions: { show: { resource: ['sharedLink'], operation: ['create'], linkType: ['INDIVIDUAL'] } },
		// Sent via the conditional `assetIds` body entry in the Create operation; this
		// field has no `routing.send` because the value is consumed by the inline
		// conditional expression that also gates on `linkType`.
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
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				routing: optionalSend('body', 'description'),
			},
			{
				displayName: 'Expires At',
				name: 'expiresAt',
				type: 'dateTime',
				default: '',
				routing: dateTimeSend('body', 'expiresAt'),
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				routing: optionalSend('body', 'password'),
			},
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
		options: [
			{
				displayName: 'Album ID',
				name: 'albumId',
				type: 'string',
				default: '',
				routing: optionalSend('query', 'albumId'),
			},
		],
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
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description: 'Leave empty to remove the description',
				routing: clearableSend('body', 'description'),
			},
			{
				displayName: 'Expires At',
				name: 'expiresAt',
				type: 'dateTime',
				default: '',
				description: 'Leave empty to make the link never expire',
				routing: dateTimeSend('body', 'expiresAt', { clearable: true }),
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'Leave empty to remove the password',
				routing: clearableSend('body', 'password'),
			},
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
		routing: idListSend('body', 'assetIds'),
	},
];
