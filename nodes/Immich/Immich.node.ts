import { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';

import { searchAlbums, searchPeople, searchSharedLinks, searchTags, searchUsers } from './methods/listSearch';

import * as asset from './operations/asset';
import * as album from './operations/album';
import * as search from './operations/search';
import * as person from './operations/person';
import * as tag from './operations/tag';
import * as sharedLink from './operations/sharedLink';
import * as user from './operations/user';
import * as server from './operations/server';

export class Immich implements INodeType {
	methods = {
		listSearch: {
			searchAlbums,
			searchPeople,
			searchSharedLinks,
			searchTags,
			searchUsers,
		},
	};

	description: INodeTypeDescription = {
		displayName: 'Immich',
		name: 'immich',
		usableAsTool: true,
		version: 1,
		group: ['transform'],
		// The multicolour Immich logo reads well on both themes, so one file serves both.
		icon: { light: 'file:Immich.svg', dark: 'file:Immich.svg' },
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with a self-hosted Immich photo and video management server',
		defaults: {
			name: 'Immich',
		},
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],

		credentials: [
			{
				name: 'immichApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.host.replace(/[/]+$/, "")}}/api',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Album', value: 'album' },
					{ name: 'Asset', value: 'asset' },
					{ name: 'Person', value: 'person' },
					{ name: 'Search', value: 'search' },
					{ name: 'Server', value: 'server' },
					{ name: 'Shared Link', value: 'sharedLink' },
					{ name: 'Tag', value: 'tag' },
					{ name: 'User', value: 'user' },
				],
				default: 'asset',
			},
			// Operations
			...asset.operations,
			...album.operations,
			...search.operations,
			...person.operations,
			...tag.operations,
			...sharedLink.operations,
			...user.operations,
			...server.operations,
		],
	};
}
