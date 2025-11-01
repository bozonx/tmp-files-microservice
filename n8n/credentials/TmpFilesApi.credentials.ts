import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class TmpFilesApi implements ICredentialType {
	name = 'tmpFilesApi';
	displayName = 'Tmp Files API';
	documentationUrl = 'https://github.com/bozonx/tmp-files-microservice/tree/main/n8n#readme';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://tmp-files.example.com',
			required: true,
			description: 'Base URL of the temp-files microservice',
		},
		{
			displayName: 'Bearer Token',
			name: 'token',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Optional Bearer token for authorization',
		},
	];

	authenticate: ICredentialType['authenticate'] = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: "={{$credentials.token ? 'Bearer ' + $credentials.token : undefined}}",
			},
		},
	};
}
