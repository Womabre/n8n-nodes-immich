import { IDataObject, IExecuteSingleFunctions, IHttpRequestOptions, INodeProperties } from 'n8n-workflow';
import { processBinaryResponse } from '../utils/binary';

interface MultipartField {
	name: string;
	value: string;
}

interface MultipartFile {
	name: string;
	filename: string;
	contentType: string;
	buffer: Buffer;
}

// Hand-rolled multipart/form-data encoding — n8n Cloud disallows community
// nodes from shipping npm dependencies, so the `form-data` package is off
// the table for a single upload endpoint.
function buildMultipartBody(fields: MultipartField[], file: MultipartFile): { body: Buffer; contentType: string } {
	const boundary = `n8nImmichBoundary${Math.random().toString(16).slice(2)}`;
	const chunks: Buffer[] = [];
	const push = (text: string) => chunks.push(Buffer.from(text, 'utf-8'));

	for (const { name, value } of fields) {
		push(`--${boundary}\r\n`);
		push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
		push(`${value}\r\n`);
	}

	push(`--${boundary}\r\n`);
	push(`Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n`);
	push(`Content-Type: ${file.contentType}\r\n\r\n`);
	chunks.push(file.buffer);
	push(`\r\n--${boundary}--\r\n`);

	return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function prepareUploadFormData(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName') as string;
	const fileCreatedAt = this.getNodeParameter('fileCreatedAt') as string;
	const fileModifiedAt = this.getNodeParameter('fileModifiedAt') as string;
	const additionalFields = this.getNodeParameter('additionalFields', {}) as IDataObject;

	const item = this.getInputData();
	const binaryData = item.binary?.[binaryPropertyName];
	this.helpers.assertBinaryData(binaryPropertyName);
	const buffer = await this.helpers.getBinaryDataBuffer(binaryPropertyName);

	const fields: MultipartField[] = [
		{ name: 'fileCreatedAt', value: fileCreatedAt },
		{ name: 'fileModifiedAt', value: fileModifiedAt },
	];
	if (additionalFields.isFavorite !== undefined) {
		fields.push({ name: 'isFavorite', value: String(additionalFields.isFavorite) });
	}
	if (additionalFields.duration !== undefined) {
		fields.push({ name: 'duration', value: String(additionalFields.duration) });
	}
	if (additionalFields.visibility) {
		fields.push({ name: 'visibility', value: additionalFields.visibility as string });
	}

	const { body, contentType } = buildMultipartBody(fields, {
		name: 'assetData',
		filename: (additionalFields.filename as string) || binaryData?.fileName || 'upload',
		contentType: binaryData?.mimeType || 'application/octet-stream',
		buffer,
	});

	const headers = { ...requestOptions.headers };
	delete headers['Content-Type'];
	delete headers['content-type'];

	requestOptions.body = body;
	requestOptions.headers = {
		...headers,
		'Content-Type': contentType,
	};
	return requestOptions;
}

export const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['asset'],
			},
		},
		options: [
			{
				name: 'Upload',
				value: 'upload',
				action: 'Upload an asset',
				description: 'Upload a photo or video to Immich',
				routing: {
					request: {
						method: 'POST',
						url: '/assets',
					},
					send: {
						preSend: [prepareUploadFormData],
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an asset',
				description: 'Retrieve asset info by ID',
				routing: {
					request: {
						method: 'GET',
						url: '=/assets/{{$parameter["assetId"]}}',
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update an asset',
				description:
					'Update favorite/description/rating/visibility on an asset (uses the single-asset update endpoint, which Immich currently marks deprecated with no non-deprecated single-asset replacement)',
				routing: {
					request: {
						method: 'PUT',
						url: '=/assets/{{$parameter["assetId"]}}',
						body: {
							description: '={{$parameter["updateFields"]["description"] || undefined}}',
							isFavorite: '={{$parameter["updateFields"]["isFavorite"]}}',
							rating: '={{$parameter["updateFields"]["rating"]}}',
							visibility: '={{$parameter["updateFields"]["visibility"] || undefined}}',
							dateTimeOriginal: '={{$parameter["updateFields"]["dateTimeOriginal"] || undefined}}',
							latitude: '={{$parameter["updateFields"]["latitude"]}}',
							longitude: '={{$parameter["updateFields"]["longitude"]}}',
						},
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete assets',
				description: 'Permanently delete one or more assets by ID',
				routing: {
					request: {
						method: 'DELETE',
						url: '/assets',
						body: {
							ids: '={{$parameter["assetIds"].split(",").map(id => id.trim())}}',
							force: '={{$parameter["force"]}}',
						},
					},
				},
			},
			{
				name: 'Download',
				value: 'download',
				action: 'Download an asset',
				description: 'Download the original file for an asset',
				routing: {
					request: {
						method: 'GET',
						url: '=/assets/{{$parameter["assetId"]}}/original',
						returnFullResponse: true,
						encoding: 'arraybuffer',
					},
					output: {
						postReceive: [processBinaryResponse],
					},
				},
			},
			{
				name: 'View',
				value: 'view',
				action: 'View an asset thumbnail',
				description: 'Retrieve the thumbnail or preview image for an asset',
				routing: {
					request: {
						method: 'GET',
						url: '=/assets/{{$parameter["assetId"]}}/thumbnail',
						qs: {
							size: '={{$parameter["size"]}}',
						},
						returnFullResponse: true,
						encoding: 'arraybuffer',
					},
					output: {
						postReceive: [processBinaryResponse],
					},
				},
			},
			{
				name: 'Get Statistics',
				value: 'getStatistics',
				action: 'Get asset statistics',
				description: 'Get counts of images/videos for the current user, optionally filtered',
				routing: {
					request: {
						method: 'GET',
						url: '/assets/statistics',
						qs: {
							isFavorite: '={{$parameter["isFavorite"]}}',
							isTrashed: '={{$parameter["isTrashed"]}}',
							visibility: '={{$parameter["visibility"] || undefined}}',
						},
					},
				},
			},
		],
		default: 'upload',
	},

	// Upload
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		description: 'Name of the input binary property containing the file to upload',
		displayOptions: { show: { resource: ['asset'], operation: ['upload'] } },
	},
	{
		displayName: 'File Created At',
		name: 'fileCreatedAt',
		type: 'dateTime',
		default: '={{$now.toISO()}}',
		required: true,
		displayOptions: { show: { resource: ['asset'], operation: ['upload'] } },
	},
	{
		displayName: 'File Modified At',
		name: 'fileModifiedAt',
		type: 'dateTime',
		default: '={{$now.toISO()}}',
		required: true,
		displayOptions: { show: { resource: ['asset'], operation: ['upload'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['asset'], operation: ['upload'] } },
		options: [
			{ displayName: 'Duration (Ms)', name: 'duration', type: 'number', default: 0 },
			{ displayName: 'Filename', name: 'filename', type: 'string', default: '' },
			{ displayName: 'Is Favorite', name: 'isFavorite', type: 'boolean', default: false },
			{
				displayName: 'Visibility',
				name: 'visibility',
				type: 'options',
				options: [
					{ name: 'Archive', value: 'archive' },
					{ name: 'Hidden', value: 'hidden' },
					{ name: 'Locked', value: 'locked' },
					{ name: 'Timeline', value: 'timeline' },
				],
				default: 'timeline',
			},
		],
	},

	// Get / Update / Delete / Download / View — Asset ID
	{
		displayName: 'Asset ID',
		name: 'assetId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['asset'], operation: ['get', 'update', 'download', 'view'] } },
	},

	// Update fields
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['asset'], operation: ['update'] } },
		options: [
			{ displayName: 'Date Time Original', name: 'dateTimeOriginal', type: 'dateTime', default: '' },
			{ displayName: 'Description', name: 'description', type: 'string', default: '' },
			{ displayName: 'Is Favorite', name: 'isFavorite', type: 'boolean', default: false },
			{ displayName: 'Latitude', name: 'latitude', type: 'number', default: 0 },
			{ displayName: 'Longitude', name: 'longitude', type: 'number', default: 0 },
			{
				displayName: 'Rating',
				name: 'rating',
				type: 'number',
				typeOptions: { minValue: -1, maxValue: 5 },
				default: 1,
				description: '1-5 stars, -1 rejected (0 is not a valid rating)',
			},
			{
				displayName: 'Visibility',
				name: 'visibility',
				type: 'options',
				options: [
					{ name: 'Archive', value: 'archive' },
					{ name: 'Hidden', value: 'hidden' },
					{ name: 'Locked', value: 'locked' },
					{ name: 'Timeline', value: 'timeline' },
				],
				default: 'timeline',
			},
		],
	},

	// Delete
	{
		displayName: 'Asset IDs',
		name: 'assetIds',
		type: 'string',
		default: '',
		required: true,
		description: 'Comma-separated list of asset IDs to delete',
		displayOptions: { show: { resource: ['asset'], operation: ['delete'] } },
	},
	{
		displayName: 'Force',
		name: 'force',
		type: 'boolean',
		default: false,
		description: 'Whether to permanently delete immediately instead of moving to trash',
		displayOptions: { show: { resource: ['asset'], operation: ['delete'] } },
	},

	// View
	{
		displayName: 'Size',
		name: 'size',
		type: 'options',
		options: [
			{ name: 'Thumbnail', value: 'thumbnail' },
			{ name: 'Preview', value: 'preview' },
		],
		default: 'thumbnail',
		displayOptions: { show: { resource: ['asset'], operation: ['view'] } },
	},

	// Get Statistics
	{
		displayName: 'Is Favorite',
		name: 'isFavorite',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['asset'], operation: ['getStatistics'] } },
	},
	{
		displayName: 'Is Trashed',
		name: 'isTrashed',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['asset'], operation: ['getStatistics'] } },
	},
	{
		displayName: 'Visibility',
		name: 'visibility',
		type: 'options',
		options: [
			{ name: 'Any', value: '' },
			{ name: 'Archive', value: 'archive' },
			{ name: 'Hidden', value: 'hidden' },
			{ name: 'Locked', value: 'locked' },
			{ name: 'Timeline', value: 'timeline' },
		],
		default: '',
		displayOptions: { show: { resource: ['asset'], operation: ['getStatistics'] } },
	},
];
