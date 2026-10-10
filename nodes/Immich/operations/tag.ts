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
				resource: ['tag'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a tag',
				routing: {
					request: {
						method: 'POST',
						url: '/tags',
						body: {
							name: '={{$parameter["name"]}}',
							color: '={{$parameter["additionalFields"]["color"] || undefined}}',
							parentId: '={{$parameter["additionalFields"]["parentId"] || undefined}}',
						},
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a tag',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/tags/{{$parameter["tagId"]}}',
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a tag',
				routing: {
					request: {
						method: 'GET',
						url: '=/tags/{{$parameter["tagId"]}}',
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many tags',
				routing: {
					request: {
						method: 'GET',
						url: '/tags',
					},
				},
			},
			{
				name: 'Tag Assets',
				value: 'tagAssets',
				action: 'Tag assets',
				description: 'Apply this tag to one or more assets',
				routing: {
					request: {
						method: 'PUT',
						url: '=/tags/{{$parameter["tagId"]}}/assets',
						body: {
							ids: '={{$parameter["assetIds"].split(",").map(id => id.trim())}}',
						},
					},
				},
			},
			{
				name: 'Untag Assets',
				value: 'untagAssets',
				action: 'Untag assets',
				description: 'Remove this tag from one or more assets',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/tags/{{$parameter["tagId"]}}/assets',
						body: {
							ids: '={{$parameter["assetIds"].split(",").map(id => id.trim())}}',
						},
					},
				},
			},
		],
		default: 'create',
	},

	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['tag'], operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['tag'], operation: ['create'] } },
		options: [
			{ displayName: 'Color', name: 'color', type: 'color', default: '' },
			{ displayName: 'Parent Tag ID', name: 'parentId', type: 'string', default: '' },
		],
	},

	{
		displayName: 'Tag',
		name: 'tagId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The tag to use. Select one from the list, or provide the tag ID directly.',
		modes: resourceLocatorModes('searchTags', 'e.g. 5c9d8f3a-2b1e-4c7a-9f4d-1a2b3c4d5e6f'),
		displayOptions: { show: { resource: ['tag'], operation: ['get', 'delete', 'tagAssets', 'untagAssets'] } },
	},

	{
		displayName: 'Asset IDs',
		name: 'assetIds',
		type: 'string',
		default: '',
		required: true,
		description: 'Comma-separated list of asset IDs',
		displayOptions: { show: { resource: ['tag'], operation: ['tagAssets', 'untagAssets'] } },
	},
];
