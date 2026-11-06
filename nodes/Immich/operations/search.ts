import { INodeProperties } from 'n8n-workflow';
import { returnAllAndLimit } from '../parameters/shared-parameters';
import { dateTimeSend, idListSend, optionalSend } from '../utils/expressions';
import { paginateByPage } from '../utils/pagination';

const sharedSearchFilterOptions: INodeProperties['options'] = [
	{
		displayName: 'Album IDs',
		name: 'albumIds',
		type: 'string',
		default: '',
		description: 'Comma-separated album IDs',
		routing: idListSend('body', 'albumIds'),
	},
	{
		displayName: 'Is Favorite',
		name: 'isFavorite',
		type: 'boolean',
		default: false,
	},
	{
		displayName: 'Is Not In Album',
		name: 'isNotInAlbum',
		type: 'boolean',
		default: false,
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		options: [
			{ name: 'Any', value: '' },
			{ name: 'Audio', value: 'AUDIO' },
			{ name: 'Image', value: 'IMAGE' },
			{ name: 'Other', value: 'OTHER' },
			{ name: 'Video', value: 'VIDEO' },
		],
		default: '',
		routing: optionalSend('body', 'type'),
	},
	{
		displayName: 'Person IDs',
		name: 'personIds',
		type: 'string',
		default: '',
		description: 'Comma-separated person IDs',
		routing: idListSend('body', 'personIds'),
	},
	{
		displayName: 'Tag IDs',
		name: 'tagIds',
		type: 'string',
		default: '',
		description: 'Comma-separated tag IDs',
		routing: idListSend('body', 'tagIds'),
	},
	{ displayName: 'City', name: 'city', type: 'string', default: '', routing: optionalSend('body', 'city') },
	{ displayName: 'Country', name: 'country', type: 'string', default: '', routing: optionalSend('body', 'country') },
	{ displayName: 'Make', name: 'make', type: 'string', default: '', routing: optionalSend('body', 'make') },
	{ displayName: 'Model', name: 'model', type: 'string', default: '', routing: optionalSend('body', 'model') },
	{
		displayName: 'Taken After',
		name: 'takenAfter',
		type: 'dateTime',
		default: '',
		routing: dateTimeSend('body', 'takenAfter'),
	},
	{
		displayName: 'Taken Before',
		name: 'takenBefore',
		type: 'dateTime',
		default: '',
		routing: dateTimeSend('body', 'takenBefore'),
	},
	{ displayName: 'Include EXIF', name: 'withExif', type: 'boolean', default: false },
];

export const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['search'],
			},
		},
		options: [
			{
				name: 'Search Metadata',
				value: 'searchMetadata',
				action: 'Search assets by metadata',
				description: 'Find assets by structured metadata filters (favorites, album, people, tags, dates, camera…)',
				routing: {
					request: {
						method: 'POST',
						url: '/search/metadata',
						// Booleans (`isFavorite`, `isNotInAlbum`, `withExif`) are toggles that
						// cannot carry an expression, so they stay inline. Every string/date/id-list
						// filter is sent per-field via `routing.send` on the filter definitions.
						body: {
							isFavorite: '={{$parameter["filters"]["isFavorite"]}}',
							isNotInAlbum: '={{$parameter["filters"]["isNotInAlbum"]}}',
							withExif: '={{$parameter["filters"]["withExif"]}}',
						},
					},
					operations: {
						pagination: paginateByPage('body'),
					},
					output: {
						postReceive: [
							{
								type: 'rootProperty',
								properties: {
									property: 'assets.items',
								},
							},
						],
					},
				},
			},
			{
				name: 'Search Smart',
				value: 'searchSmart',
				action: 'Search assets by natural language',
				description: 'CLIP-powered natural-language / visual-similarity search',
				routing: {
					request: {
						method: 'POST',
						url: '/search/smart',
						body: {
							isFavorite: '={{$parameter["filters"]["isFavorite"]}}',
							isNotInAlbum: '={{$parameter["filters"]["isNotInAlbum"]}}',
							withExif: '={{$parameter["filters"]["withExif"]}}',
						},
					},
					operations: {
						pagination: paginateByPage('body'),
					},
					output: {
						postReceive: [
							{
								type: 'rootProperty',
								properties: {
									property: 'assets.items',
								},
							},
						],
					},
				},
			},
			{
				name: 'Get Suggestions',
				value: 'getSuggestions',
				action: 'Get search suggestions',
				description: 'Get known values for a metadata facet (city, camera make, etc.) to help build a search',
				routing: {
					request: {
						method: 'GET',
						url: '/search/suggestions',
						qs: {
							type: '={{$parameter["suggestionType"]}}',
						},
					},
				},
			},
		],
		default: 'searchMetadata',
	},

	// Search Smart
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		default: '',
		required: true,
		description: 'Natural language description of what to find, e.g. "a dog on a beach"',
		displayOptions: { show: { resource: ['search'], operation: ['searchSmart'] } },
		routing: optionalSend('body', 'query'),
	},

	// Search Metadata + Smart shared filters
	...returnAllAndLimit('search', ['searchMetadata', 'searchSmart'], 'body'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['search'], operation: ['searchMetadata', 'searchSmart'] } },
		options: sharedSearchFilterOptions,
	},

	// Get Suggestions
	{
		displayName: 'Suggestion Type',
		name: 'suggestionType',
		type: 'options',
		options: [
			{ name: 'Camera Lens Model', value: 'camera-lens-model' },
			{ name: 'Camera Make', value: 'camera-make' },
			{ name: 'Camera Model', value: 'camera-model' },
			{ name: 'City', value: 'city' },
			{ name: 'Country', value: 'country' },
			{ name: 'State', value: 'state' },
		],
		default: 'city',
		required: true,
		displayOptions: { show: { resource: ['search'], operation: ['getSuggestions'] } },
	},
];
