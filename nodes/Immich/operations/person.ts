import { INodeProperties } from 'n8n-workflow';
import { resourceLocatorModes, returnAllAndLimit } from '../parameters/shared-parameters';
import { assertBulkSuccess } from '../utils/bulk';
import { dateExpr, idListExpr, optionalExpr } from '../utils/expressions';
import { paginateByPage } from '../utils/pagination';

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
							withHidden: '={{$parameter["filters"]["withHidden"]}}',
						},
					},
					operations: {
						pagination: paginateByPage('qs'),
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
							name: optionalExpr('updateFields.name'),
							isFavorite: '={{$parameter["updateFields"]["isFavorite"]}}',
							isHidden: '={{$parameter["updateFields"]["isHidden"]}}',
							birthDate: dateExpr('updateFields.birthDate'),
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
							ids: idListExpr('mergeIds'),
						},
					},
					output: {
						postReceive: [assertBulkSuccess],
					},
				},
			},
		],
		default: 'getAll',
	},

	...returnAllAndLimit('person', ['getAll'], 'query'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['person'], operation: ['getAll'] } },
		options: [
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
			{
				displayName: 'Birth Date',
				name: 'birthDate',
				type: 'dateTime',
				default: '',
				description: 'Only the date is used. Leave empty to remove the birth date.',
			},
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
