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
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			description: 'Username for Basic authentication',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Password for Basic authentication',
		},
	];

	authenticate: ICredentialType['authenticate'] = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.password}}',
			},
		},
	};
}
