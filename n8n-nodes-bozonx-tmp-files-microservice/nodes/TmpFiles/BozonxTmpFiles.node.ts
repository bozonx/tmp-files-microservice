import {
	NodeOperationError,
	type IExecuteFunctions,
	type IDataObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IHttpRequestOptions,
} from 'n8n-workflow';
import FormData from 'form-data';

export class BozonxTmpFiles implements INodeType {
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
				name: 'bozonxTmpFilesApi',
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
				displayName: 'TTL Unit',
				name: 'ttlUnit',
				type: 'options',
				options: [
					{ name: 'Minutes', value: 'minutes' },
					{ name: 'Hours', value: 'hours' },
					{ name: 'Days', value: 'days' },
				],
				default: 'hours',
				description: 'Time unit for TTL',
			},
			{
				displayName: 'TTL Value',
				name: 'ttlValue',
				type: 'number',
				default: 1,
				required: true,
				typeOptions: { minValue: 1 },
				description: 'Time to live value before the file is removed',
			},
			{
				displayName: 'Metadata (JSON, Optional)',
				name: 'metadata',
				type: 'string',
				default: '',
				typeOptions: { rows: 6 },
				description: 'Optional JSON string with custom metadata to associate with the file',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const sourceType = this.getNodeParameter('sourceType', i) as string;
				const ttlValueParam = this.getNodeParameter('ttlValue', i) as number;
				const ttlUnit = this.getNodeParameter('ttlUnit', i) as string;
				const ttlValue = Math.max(1, ttlValueParam);
				let ttlMins = 1;
				if (ttlUnit === 'minutes') {
					ttlMins = Math.max(1, Math.floor(ttlValue));
				} else if (ttlUnit === 'hours') {
					ttlMins = Math.max(1, Math.floor(ttlValue * 60));
				} else if (ttlUnit === 'days') {
					ttlMins = Math.max(1, Math.floor(ttlValue * 1440));
				} else {
					ttlMins = Math.max(1, Math.floor(ttlValue * 60));
				}
				const metadata = (this.getNodeParameter('metadata', i) as string) || '';

				const creds = await this.getCredentials('bozonxTmpFilesApi');
				let baseURL = ((creds?.baseUrl as string) || '').trim();
				if (!baseURL) {
					throw new NodeOperationError(this.getNode(), 'Base URL is required in credentials', {
						itemIndex: i,
					});
				}
				if (!/^https?:\/\//i.test(baseURL)) {
					throw new NodeOperationError(
						this.getNode(),
						'Base URL must include protocol (http:// or https://)',
						{ itemIndex: i },
					);
				}
				baseURL = baseURL.replace(/\/+$/g, '');

				const apiPrefix = 'api/v1';
				baseURL = `${baseURL}/${apiPrefix}`;

				const options: IHttpRequestOptions = {
					method: 'POST',
					url: 'files',
				};
				(options as unknown as { baseURL?: string }).baseURL = baseURL;

				if (sourceType === 'url') {
					const fileUrl = (this.getNodeParameter('fileUrl', i) as string)?.trim();
					if (!fileUrl) {
						throw new NodeOperationError(
							this.getNode(),
							'File URL is required when source type is "URL"',
							{ itemIndex: i },
						);
					}
					options.json = true;
					const body: IDataObject = { url: fileUrl, ttlMins };
					if (metadata && metadata.trim() !== '') body.metadata = metadata;
					options.url = 'files/url';
					options.body = body;
				} else if (sourceType === 'binary') {
					const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
					const item = items[i];
					if (!item.binary || !item.binary[binaryProperty]) {
						throw new NodeOperationError(
							this.getNode(),
							`Binary property "${binaryProperty}" is missing`,
							{ itemIndex: i },
						);
					}
					const dataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
					const { fileName, mimeType } = item.binary[binaryProperty]!;

					// Ensure multipart/form-data using FormData body
					if (metadata && metadata.trim() !== '') {
						try {
							JSON.parse(metadata);
						} catch {
							throw new NodeOperationError(this.getNode(), 'Metadata must be a valid JSON string', {
								itemIndex: i,
							});
						}
					}

					const form = new FormData();
					form.append('ttlMins', String(ttlMins));
					if (metadata && metadata.trim() !== '') form.append('metadata', metadata);
					form.append('file', dataBuffer, {
						filename: fileName || 'file',
						contentType: mimeType || 'application/octet-stream',
					});

					// Assign body and merge headers so boundary is included
					(options as unknown as { body?: unknown }).body = form as unknown as IDataObject;
					const formHeaders =
						(form as unknown as { getHeaders?: () => Record<string, string> }).getHeaders?.() ?? {};
					(options as unknown as { headers?: Record<string, string> }).headers = {
						...(options as unknown as { headers?: Record<string, string> }).headers,
						...formHeaders,
					};
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported source type: ${sourceType}`, {
						itemIndex: i,
					});
				}

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'bozonxTmpFilesApi',
					options,
				);
				returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message } as IDataObject,
						pairedItem: { item: i },
					});
				} else {
					throw error;
				}
			}
		}

		return [returnData];
	}
}
