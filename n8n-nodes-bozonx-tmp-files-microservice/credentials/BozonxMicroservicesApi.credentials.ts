import type { ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

export class BozonxMicroservicesApi implements ICredentialType {
	name = 'bozonxMicroservicesApi';
	displayName = 'Bozonx Microservices API';
	icon = 'fa:key' as Icon;
	documentationUrl = 'https://github.com/bozonx/tmp-files-microservice/tree/main/n8n#readme';
	properties: INodeProperties[] = [
		{
			displayName: 'Gateway URL',
			name: 'gatewayUrl',
			type: 'string',
			default: '',
			placeholder: 'https://api.example.com',
			required: true,
			description: 'Base URL of the API Gateway (without /api/v1)',
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Bearer token for Authorization header',
		},
	];

	authenticate: ICredentialType['authenticate'] = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{"Bearer " + $credentials.apiToken}}',
			},
		},
	};

	test: ICredentialType['test'] = {
		request: {
			baseURL: '={{$credentials.gatewayUrl}}',
			url: '/',
			method: 'GET',
		},
	};
}
