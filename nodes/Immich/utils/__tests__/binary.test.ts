import { describe, expect, it, vi } from 'vitest';
import type { IExecuteSingleFunctions, IN8nHttpFullResponse, INodeExecutionData } from 'n8n-workflow';
import { processBinaryResponse } from '../binary';

function makeContext(
	prepared: { fileName: string; mimeType: string },
	parameters: Record<string, string> = { operation: 'download', assetId: 'asset-1' },
) {
	const prepareBinaryData = vi.fn().mockResolvedValue(prepared);
	const context = {
		helpers: {
			prepareBinaryData,
		},
		getNodeParameter: (name: string, fallback?: string) => parameters[name] ?? fallback,
	} as unknown as IExecuteSingleFunctions;
	return { context, prepareBinaryData };
}

describe('processBinaryResponse', () => {
	it('extracts a quoted filename from Content-Disposition and infers MIME from extension', async () => {
		const { context, prepareBinaryData } = makeContext({ fileName: 'photo.jpg', mimeType: 'image/jpeg' });
		const response = {
			headers: {
				'content-type': 'application/octet-stream',
				'content-disposition': 'attachment; filename="photo.jpg"',
			},
			body: Buffer.from('binary-data'),
		} as unknown as IN8nHttpFullResponse;

		const items: INodeExecutionData[] = [{ json: {} }];
		const result = await processBinaryResponse.call(context, items, response);

		expect(prepareBinaryData).toHaveBeenCalledWith(response.body, 'photo.jpg', 'image/jpeg');
		expect(result[0].binary?.data).toEqual({ fileName: 'photo.jpg', mimeType: 'image/jpeg' });
		expect(result[0].json).toEqual({});
	});

	it('falls back to the response Content-Type when the extension is unrecognized', async () => {
		const { context, prepareBinaryData } = makeContext({ fileName: 'clip.webm', mimeType: 'video/webm' });
		const response = {
			headers: {
				'content-type': 'video/webm',
				'content-disposition': 'attachment; filename="clip.webm"',
			},
			body: Buffer.from('binary-data'),
		} as unknown as IN8nHttpFullResponse;

		await processBinaryResponse.call(context, [{ json: {} }], response);

		expect(prepareBinaryData).toHaveBeenCalledWith(response.body, 'clip.webm', 'video/webm');
	});

	it('prefers the server Content-Type over the file extension', async () => {
		const { context, prepareBinaryData } = makeContext({ fileName: 'x', mimeType: 'x' });
		const response = {
			headers: {
				'content-type': 'image/heic; charset=binary',
				'content-disposition': 'attachment; filename="IMG_0001.jpg"',
			},
			body: Buffer.from('binary-data'),
		} as unknown as IN8nHttpFullResponse;

		await processBinaryResponse.call(context, [{ json: {} }], response);

		expect(prepareBinaryData).toHaveBeenCalledWith(response.body, 'IMG_0001.jpg', 'image/heic');
	});

	it('names a download without Content-Disposition after the asset ID and MIME type', async () => {
		const { context, prepareBinaryData } = makeContext({ fileName: 'x', mimeType: 'x' });
		const response = {
			headers: { 'content-type': 'image/jpeg' },
			body: Buffer.from('binary-data'),
		} as unknown as IN8nHttpFullResponse;

		await processBinaryResponse.call(context, [{ json: {} }], response);

		expect(prepareBinaryData).toHaveBeenCalledWith(response.body, 'asset-1.jpg', 'image/jpeg');
	});

	it('adds the thumbnail size suffix for the View operation', async () => {
		const { context, prepareBinaryData } = makeContext(
			{ fileName: 'x', mimeType: 'x' },
			{ operation: 'view', assetId: 'asset-1', size: 'preview' },
		);
		const response = {
			headers: { 'content-type': 'image/webp' },
			body: Buffer.from('binary-data'),
		} as unknown as IN8nHttpFullResponse;

		await processBinaryResponse.call(context, [{ json: {} }], response);

		expect(prepareBinaryData).toHaveBeenCalledWith(response.body, 'asset-1-preview.webp', 'image/webp');
	});

	it('falls back to octet-stream and no extension when nothing identifies the type', async () => {
		const { context, prepareBinaryData } = makeContext({ fileName: 'x', mimeType: 'x' });
		const response = {
			headers: {},
			body: Buffer.from('binary-data'),
		} as unknown as IN8nHttpFullResponse;

		await processBinaryResponse.call(context, [{ json: {} }], response);

		expect(prepareBinaryData).toHaveBeenCalledWith(response.body, 'asset-1', 'application/octet-stream');
	});
});
