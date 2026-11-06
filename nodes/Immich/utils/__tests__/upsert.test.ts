import type { IDataObject, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { resolveUpsertAlbum } from '../upsert';

/** Builds a fake IExecuteSingleFunctions for the upsert preSend. */
function makeCtx(opts: {
	albumName: string;
	assetIds: unknown;
	albums: IDataObject[];
	credentials?: { host: string };
}) {
	const httpCall = vi.fn(async () => opts.albums);
	const ctx = {
		getNodeParameter: (name: string) => (name === 'albumName' ? opts.albumName : opts.assetIds),
		getCredentials: async () => opts.credentials ?? { host: 'https://immich.test' },
		helpers: { httpRequestWithAuthentication: { call: httpCall } },
	} as unknown as Parameters<typeof resolveUpsertAlbum>[0] & {
		__http: typeof httpCall;
	};
	return { ctx, httpCall };
}

describe('resolveUpsertAlbum', () => {
	it('creates a new album when no album with that name exists', async () => {
		const { ctx } = makeCtx({ albumName: 'Holiday', assetIds: 'a1, a2', albums: [] });
		const req: IHttpRequestOptions = { method: 'POST', url: '/albums', headers: {} };
		const out = await resolveUpsertAlbum.call(ctx, req);
		expect(out.method).toBe('POST');
		expect(out.url).toBe('/albums');
		expect(out.body).toEqual({ albumName: 'Holiday', assetIds: ['a1', 'a2'] });
	});

	it('switches to PUT /albums/{id}/assets when the album already exists', async () => {
		const { ctx } = makeCtx({
			albumName: 'Holiday',
			assetIds: 'a1, a2',
			albums: [{ id: 'album-123', albumName: 'Holiday' }],
		});
		const req: IHttpRequestOptions = { method: 'POST', url: '/albums', headers: {} };
		const out = await resolveUpsertAlbum.call(ctx, req);
		expect(out.method).toBe('PUT');
		expect(out.url).toBe('/albums/album-123/assets');
		expect(out.body).toEqual({ ids: ['a1', 'a2'] });
	});

	it('does not match albums with a different name', async () => {
		const { ctx } = makeCtx({
			albumName: 'Holiday',
			assetIds: 'a1',
			albums: [
				{ id: 'album-x', albumName: 'Holidays' },
				{ id: 'album-y', albumName: 'holiday' },
			],
		});
		const out = await resolveUpsertAlbum.call(ctx, { method: 'POST', url: '/albums', headers: {} });
		// No exact name match → create branch
		expect(out.method).toBe('POST');
		expect(out.body).toEqual({ albumName: 'Holiday', assetIds: ['a1'] });
	});

	it('picks the first matching album when several share the name', async () => {
		const { ctx } = makeCtx({
			albumName: 'Holiday',
			assetIds: 'a1',
			albums: [
				{ id: 'first', albumName: 'Holiday' },
				{ id: 'second', albumName: 'Holiday' },
			],
		});
		const out = await resolveUpsertAlbum.call(ctx, { method: 'POST', url: '/albums', headers: {} });
		expect(out.url).toBe('/albums/first/assets');
	});

	it('accepts an array of asset IDs (e.g. from an expression)', async () => {
		const { ctx } = makeCtx({
			albumName: 'Holiday',
			assetIds: [' a ', '', 'b'],
			albums: [{ id: 'album-1', albumName: 'Holiday' }],
		});
		const out = await resolveUpsertAlbum.call(ctx, { method: 'POST', url: '/albums', headers: {} });
		expect(out.body).toEqual({ ids: ['a', 'b'] });
	});

	it('queries /albums with the name filter and the configured host', async () => {
		const { ctx, httpCall } = makeCtx({
			albumName: 'Holiday',
			assetIds: 'a1',
			albums: [],
			credentials: { host: 'https://photos.example.com/' },
		});
		await resolveUpsertAlbum.call(ctx, { method: 'POST', url: '/albums', headers: {} });
		// `httpRequestWithAuthentication.call(ctx, 'immichApi', options)` — assert on the options arg.
		const [, credentialType, options] = httpCall.mock.calls[0];
		expect(credentialType).toBe('immichApi');
		expect(options).toMatchObject({
			method: 'GET',
			url: 'https://photos.example.com/api/albums',
			qs: { name: 'Holiday' },
		});
	});
});
