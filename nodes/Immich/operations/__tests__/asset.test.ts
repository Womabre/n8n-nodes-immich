import { createHash } from 'crypto';
import type { IExecuteSingleFunctions, PreSendAction } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { buildMultipartBody, operations, toOffsetDateTime } from '../asset';

describe('buildMultipartBody', () => {
	const file = { name: 'assetData', filename: 'photo.jpg', contentType: 'image/jpeg', buffer: Buffer.from([1, 2, 3]) };

	it('encodes fields and the file between matching boundaries', () => {
		const { body, contentType } = buildMultipartBody([{ key: 'fileCreatedAt', value: '2026-01-01T00:00:00Z' }], file);
		const boundary = contentType.replace('multipart/form-data; boundary=', '');
		const text = body.toString('latin1');

		expect(text.startsWith(`--${boundary}\r\nContent-Disposition: form-data; name="fileCreatedAt"\r\n\r\n2026-01-01T00:00:00Z\r\n`)).toBe(true);
		expect(text).toContain('Content-Disposition: form-data; name="assetData"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n');
		expect(text.endsWith(`\x01\x02\x03\r\n--${boundary}--\r\n`)).toBe(true);
	});

	it('escapes quotes and line breaks in the filename so it cannot break out of the header', () => {
		const { body } = buildMultipartBody([], { ...file, filename: 'a"b\r\nX-Evil: 1.jpg' });
		const text = body.toString('latin1');

		expect(text).toContain('filename="a%22b%0D%0AX-Evil: 1.jpg"\r\n');
		expect(text).not.toContain('\r\nX-Evil');
	});

	it('keeps non-ASCII filenames intact as UTF-8', () => {
		const { body } = buildMultipartBody([], { ...file, filename: 'café.jpg' });
		expect(body.toString('utf-8')).toContain('filename="café.jpg"');
	});
});

describe('toOffsetDateTime', () => {
	it('adds the workflow timezone offset to offset-less input', () => {
		expect(toOffsetDateTime('2026-07-01T10:00:00', 'Europe/Amsterdam')).toBe('2026-07-01T10:00:00.000+02:00');
	});

	it('keeps the instant of input that already has an offset', () => {
		expect(toOffsetDateTime('2026-07-01T08:00:00Z', 'Europe/Amsterdam')).toBe('2026-07-01T10:00:00.000+02:00');
	});

	it('passes unparseable input through', () => {
		expect(toOffsetDateTime('yesterday', 'Europe/Amsterdam')).toBe('yesterday');
	});
});

describe('Upload pre-send', () => {
	const uploadOption = (
		operations[0].options as Array<{ value: string; routing: { send: { preSend: PreSendAction[] } } }>
	).find((option) => option.value === 'upload');
	const preSend = uploadOption!.routing.send.preSend[0];

	const fileBuffer = Buffer.from('jpeg-bytes');
	const parameters: Record<string, unknown> = {
		binaryPropertyName: 'data',
		fileCreatedAt: '2026-07-01T10:00:00',
		fileModifiedAt: '2026-07-01T10:05:00Z',
		additionalFields: { isFavorite: true },
	};
	const context = {
		getNodeParameter: (name: string, fallback?: unknown) => parameters[name] ?? fallback,
		getTimezone: () => 'Europe/Amsterdam',
		helpers: {
			assertBinaryData: () => ({ fileName: 'IMG "1".jpg', mimeType: 'image/jpeg' }),
			getBinaryDataBuffer: async () => fileBuffer,
		},
	} as unknown as IExecuteSingleFunctions;

	it('builds the multipart body with offset dates, the filename field and a SHA-1 checksum header', async () => {
		const result = await preSend.call(context, {
			url: '/assets',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		});
		const headers = result.headers as Record<string, string>;
		const text = (result.body as Buffer).toString('utf-8');

		expect(headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);
		expect(headers.Accept).toBe('application/json');
		expect(headers['x-immich-checksum']).toBe(createHash('sha1').update(fileBuffer).digest('hex'));
		expect(text).toContain('name="fileCreatedAt"\r\n\r\n2026-07-01T10:00:00.000+02:00\r\n');
		expect(text).toContain('name="fileModifiedAt"\r\n\r\n2026-07-01T12:05:00.000+02:00\r\n');
		expect(text).toContain('name="filename"\r\n\r\nIMG "1".jpg\r\n');
		expect(text).toContain('name="isFavorite"\r\n\r\ntrue\r\n');
		expect(text).toContain('name="assetData"; filename="IMG %221%22.jpg"\r\nContent-Type: image/jpeg');
	});
});
