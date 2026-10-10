import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class ImmichApi implements ICredentialType {
	name = 'immichApi';
	displayName = 'Immich API';
	documentationUrl = 'https://immich.app/docs/api/getting-started/';
	icon: Icon = { light: 'file:../nodes/Immich/Immich.svg', dark: 'file:../nodes/Immich/Immich.svg' };
	properties: INodeProperties[] = [
		{
			displayName: 'Immich URL',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'https://immich.yourdomain.com',
			description: 'Base URL of your Immich instance, without a trailing slash',
			required: true,
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'Generate one under Account Settings > API Keys in Immich',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.host.replace(/[/]+$/, "")}}/api',
			url: '/server/ping',
			method: 'GET',
		},
	};
}
