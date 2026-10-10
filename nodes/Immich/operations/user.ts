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
				resource: ['user'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many users',
				description: 'Search/list users on the server (useful for album/shared-link sharing)',
				routing: {
					request: {
						method: 'GET',
						url: '/users',
					},
				},
			},
			{
				name: 'Get Me',
				value: 'getMe',
				action: 'Get my user',
				description: 'Get the user profile for the authenticated API key',
				routing: {
					request: {
						method: 'GET',
						url: '/users/me',
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a user',
				routing: {
					request: {
						method: 'GET',
						url: '=/users/{{$parameter["userId"]}}',
					},
				},
			},
		],
		default: 'getMe',
	},

	{
		displayName: 'User',
		name: 'userId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The user to use. Select one from the list, or provide the user ID directly.',
		modes: resourceLocatorModes('searchUsers', 'e.g. 5c9d8f3a-2b1e-4c7a-9f4d-1a2b3c4d5e6f'),
		displayOptions: { show: { resource: ['user'], operation: ['get'] } },
	},
];
