import {
    NodeOperationError,
    type IExecuteFunctions,
    type IDataObject,
    type INodeExecutionData,
    type INodeType,
    type INodeTypeDescription,
    type IHttpRequestOptions,
} from 'n8n-workflow';

export class TmpFiles implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Temporary Files',
		name: 'tmpFiles',
		group: ['input'],
		version: 1,
		description: 'Upload a binary file or a file URL to the temp-files microservice',
		defaults: { name: 'Temporary Files' },
		icon: 'file:tmp-files.svg',
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		requestDefaults: {
			baseURL: '={{$parameter.baseUrl}}',
			headers: {
				Accept: 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Source Type',
				name: 'sourceType',
				type: 'options',
				options: [
					{ name: 'Binary', value: 'binary' },
					{ name: 'URL', value: 'url' },
				],
				default: 'binary',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryProperty',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: { sourceType: ['binary'] },
				},
				description: 'Name of the binary property to upload from the input item',
			},
			{
				displayName: 'File URL',
				name: 'fileUrl',
				type: 'string',
				default: '',
				displayOptions: {
					show: { sourceType: ['url'] },
				},
				description: 'Direct URL to the file to be saved temporarily',
			},
			{
				displayName: 'Base URL',
				name: 'baseUrl',
				type: 'string',
				default: '={{$env.TMP_FILES_BASE_URL}}',
				description: 'Base URL of the temp-files microservice',
			},
			{
				displayName: 'TTL (Minutes)',
				name: 'ttl',
				type: 'number',
				default: 60,
				description: 'Time to live before the file is removed',
			},
			{
				displayName: 'Bearer Token',
				name: 'token',
				type: 'string',
				typeOptions: { password: true },
				default: '={{$env.TMP_FILES_TOKEN}}',
				description: 'Bearer token for authorization; leave empty if not required',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const sourceType = this.getNodeParameter('sourceType', i) as string;
			const baseUrl = this.getNodeParameter('baseUrl', i) as string;
			const ttl = this.getNodeParameter('ttl', i) as number;
			const token = (this.getNodeParameter('token', i) as string) || '';

			if (!baseUrl) {
				throw new NodeOperationError(this.getNode(), 'Base URL is required (set parameter or TMP_FILES_BASE_URL env var)', { itemIndex: i });
			}

			const endpoint = `${baseUrl.replace(/\/$/, '')}/api/v1/tmp-files`;

			const options: IHttpRequestOptions = {
				method: 'POST',
				url: endpoint,
				json: true,
				headers: {
					Accept: 'application/json',
				},
			};

			if (token) {
				(options.headers as IDataObject)['Authorization'] = `Bearer ${token}`;
			}

			if (sourceType === 'url') {
				const fileUrl = this.getNodeParameter('fileUrl', i) as string;
				if (!fileUrl) {
					throw new NodeOperationError(this.getNode(), 'File URL is required when source type is "URL"', { itemIndex: i });
				}
				options.body = { url: fileUrl, ttl } as IDataObject;
				(options.headers as IDataObject)['Content-Type'] = 'application/json';
			} else if (sourceType === 'binary') {
				const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
				const item = items[i];
				if (!item.binary || !item.binary[binaryProperty]) {
					throw new NodeOperationError(this.getNode(), `Binary property "${binaryProperty}" is missing`, { itemIndex: i });
				}
				const dataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
				const { fileName, mimeType } = item.binary[binaryProperty]!;

				const optionsAny = options as unknown as Record<string, unknown> & { formData?: unknown };
				optionsAny.formData = {
					file: {
						value: dataBuffer,
						options: {
							filename: fileName || 'file',
							contentType: mimeType || 'application/octet-stream',
						},
					},
					ttl: String(ttl),
				};
			} else {
				throw new NodeOperationError(this.getNode(), `Unsupported source type: ${sourceType}`, { itemIndex: i });
			}

			const response = await this.helpers.httpRequest(options);
			returnData.push({ json: response as IDataObject });
		}

		return [returnData];
	}
}
