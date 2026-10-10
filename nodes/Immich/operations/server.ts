import { INodeProperties } from 'n8n-workflow';

export const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['server'],
			},
		},
		options: [
			{
				name: 'Get About Info',
				value: 'getAboutInfo',
				action: 'Get server about info',
				description: 'Get build/version/repository metadata about the server',
				routing: {
					request: {
						method: 'GET',
						url: '/server/about',
					},
				},
			},
			{
				name: 'Get Statistics',
				value: 'getStatistics',
				action: 'Get server statistics',
				description: 'Get server-wide usage counts (admin-scoped data included when the API key allows it)',
				routing: {
					request: {
						method: 'GET',
						url: '/server/statistics',
					},
				},
			},
			{
				name: 'Get Storage',
				value: 'getStorage',
				action: 'Get server storage info',
				description: 'Get disk usage for the server storage',
				routing: {
					request: {
						method: 'GET',
						url: '/server/storage',
					},
				},
			},
			{
				name: 'Get Version',
				value: 'getVersion',
				action: 'Get server version',
				routing: {
					request: {
						method: 'GET',
						url: '/server/version',
					},
				},
			},
			{
				name: 'Ping',
				value: 'ping',
				action: 'Ping the server',
				description: 'Health check — confirms the server is reachable',
				routing: {
					request: {
						method: 'GET',
						url: '/server/ping',
					},
				},
			},
		],
		default: 'ping',
	},
];
