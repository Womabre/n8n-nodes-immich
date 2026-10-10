import { describe, expect, it, vi } from 'vitest';
import type { IExecuteSingleFunctions, IN8nHttpFullResponse, INodeExecutionData } from 'n8n-workflow';
import { processBinaryResponse } from '../binary';

function makeContext(prepared: { fileName: string; mimeType: string }) {
	const prepareBinaryData = vi.fn().mockResolvedValue(prepared);
	const context = {
		helpers: {
			prepareBinaryData,
		},
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

	it('defaults to a generic filename when Content-Disposition is missing', async () => {
		const { context, prepareBinaryData } = makeContext({ fileName: 'downloaded-file', mimeType: 'application/octet-stream' });
		const response = {
			headers: {},
			body: Buffer.from('binary-data'),
		} as unknown as IN8nHttpFullResponse;

		await processBinaryResponse.call(context, [{ json: {} }], response);

		expect(prepareBinaryData).toHaveBeenCalledWith(response.body, 'downloaded-file', 'application/octet-stream');
	});
});
