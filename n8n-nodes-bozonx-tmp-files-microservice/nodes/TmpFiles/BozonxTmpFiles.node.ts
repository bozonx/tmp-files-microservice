import {
    NodeOperationError,
    type IExecuteFunctions,
    type IDataObject,
    type INodeExecutionData,
    type INodeType,
    type INodeTypeDescription,
    type IHttpRequestOptions,
} from 'n8n-workflow';

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
            baseURL: '={{$credentials.gatewayUrl}}',
            headers: {
                Accept: 'application/json',
            },
        },
        credentials: [
            {
                name: 'bozonxMicroservicesApi',
                required: true,
            },
        ],
        properties: [
            {
                displayName: 'Base Path',
                name: 'basePath',
                type: 'string',
                default: 'tmp-files/api/v1',
                description: 'API base path appended to the Gateway URL (leading/trailing slashes are ignored)'
            },
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
                name: 'ttlMins',
                type: 'number',
                default: 1440,
                required: true,
                typeOptions: { minValue: 1 },
                description: 'Time to live before the file is removed',
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
                const ttlMinsParam = this.getNodeParameter('ttlMins', i) as number;
                const ttlMins = Math.max(1, Math.floor(ttlMinsParam));
                const metadata = (this.getNodeParameter('metadata', i) as string) || '';
                const basePathParam = (this.getNodeParameter('basePath', i) as string) || '';
                const normalizedBasePath = basePathParam.replace(/^\/+|\/+$/g, '');
                const pathPrefix = normalizedBasePath ? `${normalizedBasePath}/` : '';

                const creds = await this.getCredentials('bozonxMicroservicesApi');
                let baseURL = ((creds?.gatewayUrl as string) || '').trim();
                if (!baseURL) {
                    throw new NodeOperationError(this.getNode(), 'Gateway URL is required in credentials', { itemIndex: i });
                }
                if (!/^https?:\/\//i.test(baseURL)) {
                    throw new NodeOperationError(this.getNode(), 'Gateway URL must include protocol (http:// or https://)', { itemIndex: i });
                }
                baseURL = baseURL.replace(/\/+$/g, '');

                const options: IHttpRequestOptions = {
                    method: 'POST',
                    url: `${pathPrefix}files`,
                };
                (options as unknown as { baseURL?: string }).baseURL = baseURL;

                if (sourceType === 'url') {
                    const fileUrl = (this.getNodeParameter('fileUrl', i) as string)?.trim();
                    if (!fileUrl) {
                        throw new NodeOperationError(this.getNode(), 'File URL is required when source type is "URL"', { itemIndex: i });
                    }
                    options.json = true;
                    const body: IDataObject = { url: fileUrl, ttlMins };
                    if (metadata && metadata.trim() !== '') body.metadata = metadata;
                    options.url = `${pathPrefix}files/url`;
                    options.body = body;
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
                        ttlMins: String(ttlMins),
                        ...(metadata && metadata.trim() !== '' ? { metadata } : {}),
                    };
                } else {
                    throw new NodeOperationError(this.getNode(), `Unsupported source type: ${sourceType}`, { itemIndex: i });
                }

                const response = await this.helpers.httpRequestWithAuthentication.call(this, 'bozonxMicroservicesApi', options);
                returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
            } catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({ json: { error: (error as Error).message } as IDataObject, pairedItem: { item: i } });
                } else {
                    throw error;
                }
            }
        }

        return [returnData];
    }
}
