import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class SttGatewayApi implements ICredentialType {
	name = 'bozonxMicroservicesApi';
	displayName = 'Bozonx Microservices API';
	documentationUrl = 'https://github.com/bozonx/stt-gateway-microservice/tree/main/n8n-nodes-bozonx-stt-gateway-microservice#readme';
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
}
