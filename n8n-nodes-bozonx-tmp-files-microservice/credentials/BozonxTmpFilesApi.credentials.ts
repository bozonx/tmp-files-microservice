import type { ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

export class BozonxTmpFilesApi implements ICredentialType {
	name = 'bozonxTmpFilesApi';
	displayName = 'Tmp Files API';
	documentationUrl =
		'https://github.com/bozonx/tmp-files-microservice/tree/main/n8n-nodes-bozonx-tmp-files-microservice#readme';
	icon = 'file:../nodes/TmpFiles/tmp-files.svg' as unknown as Icon;
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://tmp-files-microservice:8080',
			placeholder: 'https://tmp-files.example.com',
			required: true,
			description:
				'Base URL of the Tmp Files microservice. The /api/v1 prefix is added automatically.',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'options',
			options: [
				{
					name: 'None',
					value: 'none',
				},
				{
					name: 'Basic Auth',
					value: 'basic',
				},
				{
					name: 'Bearer Token',
					value: 'bearer',
				},
			],
			default: 'none',
			description: 'Authentication method to use',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'Username for Basic authentication',
			displayOptions: {
				show: {
					authentication: ['basic'],
				},
			},
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Password for Basic authentication',
			displayOptions: {
				show: {
					authentication: ['basic'],
				},
			},
		},
		{
			displayName: 'Token',
			name: 'token',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Bearer token for Authorization header',
			displayOptions: {
				show: {
					authentication: ['bearer'],
				},
			},
		},
	];

	authenticate: ICredentialType['authenticate'] = {
		type: 'generic',
		properties: {
			headers: {
				Authorization:
					'={{$credentials.authentication === "bearer" ? ("Bearer " + $credentials.token) : ($credentials.authentication === "basic" ? ("Basic " + Buffer.from($credentials.username + ":" + $credentials.password).toString("base64")) : undefined)}}',
			},
		},
	};

	test: ICredentialType['test'] = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/v1/health',
		},
	};
}
