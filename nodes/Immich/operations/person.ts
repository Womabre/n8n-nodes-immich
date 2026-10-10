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
				resource: ['person'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many people',
				description: 'List the people (recognized faces) in your library',
				routing: {
					request: {
						method: 'GET',
						url: '/people',
						qs: {
							page: '={{$parameter["filters"]["page"]}}',
							size: '={{$parameter["filters"]["size"]}}',
							withHidden: '={{$parameter["filters"]["withHidden"]}}',
						},
					},
					output: {
						postReceive: [
							{
								type: 'rootProperty',
								properties: {
									property: 'people',
								},
							},
						],
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a person',
				routing: {
					request: {
						method: 'GET',
						url: '=/people/{{$parameter["personId"]}}',
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a person',
				description: 'Rename, favorite, hide, or set the birth date for a person',
				routing: {
					request: {
						method: 'PUT',
						url: '=/people/{{$parameter["personId"]}}',
						body: {
							name: '={{$parameter["updateFields"]["name"] || undefined}}',
							isFavorite: '={{$parameter["updateFields"]["isFavorite"]}}',
							isHidden: '={{$parameter["updateFields"]["isHidden"]}}',
							birthDate: '={{$parameter["updateFields"]["birthDate"] || undefined}}',
						},
					},
				},
			},
			{
				name: 'Merge',
				value: 'merge',
				action: 'Merge people',
				description: 'Merge one or more duplicate people into this person',
				routing: {
					request: {
						method: 'POST',
						url: '=/people/{{$parameter["personId"]}}/merge',
						body: {
							ids: '={{$parameter["mergeIds"].split(",").map(id => id.trim())}}',
						},
					},
				},
			},
		],
		default: 'getAll',
	},

	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['person'], operation: ['getAll'] } },
		options: [
			{ displayName: 'Page', name: 'page', type: 'number', default: 1 },
			{ displayName: 'Size', name: 'size', type: 'number', default: 500 },
			{ displayName: 'Include Hidden', name: 'withHidden', type: 'boolean', default: false },
		],
	},

	{
		displayName: 'Person',
		name: 'personId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The person to use. Select one from the list, or provide the person ID directly.',
		modes: resourceLocatorModes('searchPeople', 'e.g. 5c9d8f3a-2b1e-4c7a-9f4d-1a2b3c4d5e6f'),
		displayOptions: { show: { resource: ['person'], operation: ['get', 'update', 'merge'] } },
	},

	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['person'], operation: ['update'] } },
		options: [
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{ displayName: 'Is Favorite', name: 'isFavorite', type: 'boolean', default: false },
			{ displayName: 'Is Hidden', name: 'isHidden', type: 'boolean', default: false },
			{ displayName: 'Birth Date', name: 'birthDate', type: 'dateTime', default: '' },
		],
	},

	{
		displayName: 'Person IDs to Merge In',
		name: 'mergeIds',
		type: 'string',
		default: '',
		required: true,
		description: 'Comma-separated list of duplicate person IDs to merge into Person ID',
		displayOptions: { show: { resource: ['person'], operation: ['merge'] } },
	},
];
