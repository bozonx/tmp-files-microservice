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
		name: 'bozonxTmpFiles',
		group: ['output'],
		version: 1,
		description: 'Upload a binary file or a file URL to the temp-files microservice',
		defaults: { name: 'Temporary Files' },
		icon: 'file:tmp-files.svg',
		documentationUrl: 'https://github.com/bozonx/tmp-files-microservice/tree/main/n8n#readme',
		subtitle: '={{$parameter.sourceType === "binary" ? "Upload binary" : "Upload URL"}}',
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}',
			headers: {
				Accept: 'application/json',
			},
		},
		credentials: [
			{
				name: 'tmpFilesApi',
				required: true,
			},
		],
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
				displayName: 'TTL (Minutes)',
				name: 'ttl',
				type: 'number',
				default: 60,
				required: true,
				typeOptions: { minValue: 1 },
				description: 'Time to live before the file is removed',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const sourceType = this.getNodeParameter('sourceType', i) as string;
				const ttl = this.getNodeParameter('ttl', i) as number;
				const ttlSeconds = Math.max(1, Math.floor(ttl * 60));

				const options: IHttpRequestOptions = {
					method: 'POST',
					url: '/api/v1/files',
				};

				if (sourceType === 'url') {
					const fileUrl = this.getNodeParameter('fileUrl', i) as string;
					if (!fileUrl) {
						throw new NodeOperationError(this.getNode(), 'File URL is required when source type is "URL"', { itemIndex: i });
					}
					options.json = true;
					options.body = { url: fileUrl, ttl: ttlSeconds } as IDataObject;
				} else if (sourceType === 'binary') {
					const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
					const item = items[i];
					if (!item.binary || !item.binary[binaryProperty]) {
						throw new NodeOperationError(this.getNode(), `Binary property "${binaryProperty}" is missing`, { itemIndex: i });
					}
					const dataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
					const { fileName, mimeType } = item.binary[binaryProperty]!;

					// Ensure multipart/form-data without forcing json
					const opts = options as unknown as Record<string, unknown> & { formData?: unknown };
					opts.formData = {
						file: {
							value: dataBuffer,
							options: {
								filename: fileName || 'file',
								contentType: mimeType || 'application/octet-stream',
							},
						},
						ttl: String(ttlSeconds),
					};
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported source type: ${sourceType}`, { itemIndex: i });
				}

				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'tmpFilesApi', options);
				returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message } as IDataObject, pairedItem: { item: i } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
