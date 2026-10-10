import { createHash } from 'crypto';
import { DateTime } from 'luxon';
import { IDataObject, IExecuteSingleFunctions, IHttpRequestOptions, INodeProperties } from 'n8n-workflow';
import { processBinaryResponse } from '../utils/binary';
import { dateTimeExpr, idListExpr, optionalExpr } from '../utils/expressions';

interface MultipartField {
	key: string;
	value: string;
}

interface MultipartFile {
	name: string;
	filename: string;
	contentType: string;
	buffer: Buffer;
}

/**
 * Escapes a value for a quoted Content-Disposition parameter (WHATWG form
 * encoding): `"` and line breaks are percent-encoded so a filename cannot end
 * the quoted string or inject a header line.
 */
function escapeQuoted(value: string): string {
	return value.replace(/"/g, '%22').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

// Hand-rolled multipart/form-data encoding — n8n Cloud disallows community
// nodes from shipping npm dependencies, so the `form-data` package is off
// the table for a single upload endpoint.
export function buildMultipartBody(fields: MultipartField[], file: MultipartFile): { body: Buffer; contentType: string } {
	const boundary = `n8nImmichBoundary${Math.random().toString(16).slice(2)}`;
	const chunks: Buffer[] = [];
	const push = (text: string) => chunks.push(Buffer.from(text, 'utf-8'));

	for (const { key, value } of fields) {
		push(`--${boundary}\r\n`);
		push(`Content-Disposition: form-data; name="${escapeQuoted(key)}"\r\n\r\n`);
		push(`${value}\r\n`);
	}

	push(`--${boundary}\r\n`);
	push(`Content-Disposition: form-data; name="${escapeQuoted(file.name)}"; filename="${escapeQuoted(file.filename)}"\r\n`);
	push(`Content-Type: ${file.contentType.replace(/[\r\n]/g, '')}\r\n\r\n`);
	chunks.push(file.buffer);
	push(`\r\n--${boundary}--\r\n`);

	return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

/**
 * ISO 8601 with an explicit offset; offset-less input (what n8n's date picker
 * produces) is read in the workflow timezone. Immich 3 rejects timestamps
 * without an offset. Unparseable input is passed through for the server to
 * report.
 */
export function toOffsetDateTime(value: unknown, timeZone: string): string {
	const text = String(value);
	const parsed = DateTime.fromISO(text, { zone: timeZone });
	return parsed.isValid ? (parsed.toISO() ?? text) : text;
}

async function prepareUploadFormData(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName') as string;
	const timeZone = this.getTimezone();
	const fileCreatedAt = toOffsetDateTime(this.getNodeParameter('fileCreatedAt'), timeZone);
	const fileModifiedAt = toOffsetDateTime(this.getNodeParameter('fileModifiedAt'), timeZone);
	const additionalFields = this.getNodeParameter('additionalFields', {}) as IDataObject;

	const binaryData = this.helpers.assertBinaryData(binaryPropertyName);
	const buffer = await this.helpers.getBinaryDataBuffer(binaryPropertyName);
	const filename = (additionalFields.filename as string) || binaryData.fileName || 'upload';

	const fields: MultipartField[] = [
		{ key: 'fileCreatedAt', value: fileCreatedAt },
		{ key: 'fileModifiedAt', value: fileModifiedAt },
		{ key: 'filename', value: filename },
	];
	if (additionalFields.isFavorite !== undefined) {
		fields.push({ key: 'isFavorite', value: String(additionalFields.isFavorite) });
	}
	if (additionalFields.duration !== undefined) {
		fields.push({ key: 'duration', value: String(additionalFields.duration) });
	}
	if (additionalFields.visibility) {
		fields.push({ key: 'visibility', value: additionalFields.visibility as string });
	}

	const { body, contentType } = buildMultipartBody(fields, {
		name: 'assetData',
		filename,
		contentType: binaryData.mimeType || 'application/octet-stream',
		buffer,
	});

	const headers = { ...requestOptions.headers };
	delete headers['Content-Type'];
	delete headers['content-type'];

	requestOptions.body = body;
	requestOptions.headers = {
		...headers,
		'Content-Type': contentType,
		// Lets Immich recognise a file it already has and answer `duplicate`.
		'x-immich-checksum': createHash('sha1').update(buffer).digest('hex'),
	};
	return requestOptions;
}

const visibilityOptions = [
	{ name: 'Archive', value: 'archive' },
	{ name: 'Hidden', value: 'hidden' },
	{ name: 'Locked', value: 'locked' },
	{ name: 'Timeline', value: 'timeline' },
];

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
				description: 'Update the description, favorite, rating, visibility, date or location of an asset',
				routing: {
					request: {
						method: 'PUT',
						url: '=/assets/{{$parameter["assetId"]}}',
						body: {
							// An added-but-empty description clears it ("" is how Immich stores no description).
							description: '={{$parameter["updateFields"]["description"]}}',
							isFavorite: '={{$parameter["updateFields"]["isFavorite"]}}',
							rating:
								'={{$parameter["updateFields"]["rating"] === undefined ? undefined : $parameter["updateFields"]["rating"] === "unrated" ? null : Number($parameter["updateFields"]["rating"])}}',
							visibility: optionalExpr('updateFields.visibility'),
							dateTimeOriginal: dateTimeExpr('updateFields.dateTimeOriginal'),
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
				description: 'Move one or more assets to the trash, or delete them permanently with Force',
				routing: {
					request: {
						method: 'DELETE',
						url: '/assets',
						body: {
							ids: idListExpr('assetIds'),
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
							isFavorite: '={{$parameter["filters"]["isFavorite"]}}',
							isTrashed: '={{$parameter["filters"]["isTrashed"]}}',
							visibility: optionalExpr('filters.visibility'),
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
				options: visibilityOptions,
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
				type: 'options',
				options: [
					{ name: '1 Star', value: 1 },
					{ name: '2 Stars', value: 2 },
					{ name: '3 Stars', value: 3 },
					{ name: '4 Stars', value: 4 },
					{ name: '5 Stars', value: 5 },
					{ name: 'Rejected', value: -1 },
					{ name: 'Unrated', value: 'unrated' },
				],
				default: 1,
				description: 'Star rating, Rejected, or Unrated to clear the rating',
			},
			{
				displayName: 'Visibility',
				name: 'visibility',
				type: 'options',
				options: visibilityOptions,
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
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		description: 'Without filters, all assets are counted',
		displayOptions: { show: { resource: ['asset'], operation: ['getStatistics'] } },
		options: [
			{
				displayName: 'Is Favorite',
				name: 'isFavorite',
				type: 'boolean',
				default: true,
				description: 'Whether to count only favorites (true) or only non-favorites (false)',
			},
			{
				displayName: 'Is Trashed',
				name: 'isTrashed',
				type: 'boolean',
				default: true,
				description: 'Whether to count only trashed assets (true) or only non-trashed ones (false)',
			},
			{
				displayName: 'Visibility',
				name: 'visibility',
				type: 'options',
				options: visibilityOptions,
				default: 'timeline',
			},
		],
	},
];
