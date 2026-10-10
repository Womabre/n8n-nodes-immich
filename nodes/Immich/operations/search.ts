import { INodeProperties } from 'n8n-workflow';
import { returnAllAndLimit } from '../parameters/shared-parameters';
import { dateTimeExpr, idListExpr, optionalExpr } from '../utils/expressions';
import { paginateByPage } from '../utils/pagination';

const sharedSearchFilterOptions: INodeProperties['options'] = [
	{ displayName: 'Album IDs', name: 'albumIds', type: 'string', default: '', description: 'Comma-separated album IDs' },
	{ displayName: 'Is Favorite', name: 'isFavorite', type: 'boolean', default: false },
	{ displayName: 'Is Not In Album', name: 'isNotInAlbum', type: 'boolean', default: false },
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
	},
	{ displayName: 'Person IDs', name: 'personIds', type: 'string', default: '', description: 'Comma-separated person IDs' },
	{ displayName: 'Tag IDs', name: 'tagIds', type: 'string', default: '', description: 'Comma-separated tag IDs' },
	{ displayName: 'City', name: 'city', type: 'string', default: '' },
	{ displayName: 'Country', name: 'country', type: 'string', default: '' },
	{ displayName: 'Make', name: 'make', type: 'string', default: '' },
	{ displayName: 'Model', name: 'model', type: 'string', default: '' },
	{ displayName: 'Taken After', name: 'takenAfter', type: 'dateTime', default: '' },
	{ displayName: 'Taken Before', name: 'takenBefore', type: 'dateTime', default: '' },
	{ displayName: 'Include EXIF', name: 'withExif', type: 'boolean', default: false },
];

const sharedSearchBody = {
	albumIds: idListExpr('filters.albumIds'),
	personIds: idListExpr('filters.personIds'),
	tagIds: idListExpr('filters.tagIds'),
	isFavorite: '={{$parameter["filters"]["isFavorite"]}}',
	isNotInAlbum: '={{$parameter["filters"]["isNotInAlbum"]}}',
	type: optionalExpr('filters.type'),
	city: optionalExpr('filters.city'),
	country: optionalExpr('filters.country'),
	make: optionalExpr('filters.make'),
	model: optionalExpr('filters.model'),
	takenAfter: dateTimeExpr('filters.takenAfter'),
	takenBefore: dateTimeExpr('filters.takenBefore'),
	withExif: '={{$parameter["filters"]["withExif"]}}',
};

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
						body: sharedSearchBody,
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
							query: '={{$parameter["query"]}}',
							...sharedSearchBody,
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
