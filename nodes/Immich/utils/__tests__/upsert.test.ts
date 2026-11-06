import type { IDataObject, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { resolveUpsertAlbum, resolveUpsertTagAssets } from '../upsert';

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

describe('resolveUpsertTagAssets', () => {
	type Call = { method: string; url: string; body?: IDataObject };

	/** Builds a ctx whose HTTP mock dispatches on method + path. */
	function makeTagCtx(opts: {
		tagNames: unknown;
		assetIds: unknown;
		/** Existing tags returned by GET /tags (with `id` and `value`). */
		tags: IDataObject[];
		/** Per-tag bulk result returned by PUT /tags/{id}/assets. */
		bulkResult?: IDataObject[];
	}) {
		const calls: Call[] = [];
		const httpCall = vi.fn(async (_ctx: unknown, _cred: string, options: Call) => {
			calls.push(options);
			const path = options.url.replace('https://immich.test/api', '');
			if (options.method === 'GET') return opts.tags;
			if (options.method === 'POST' && path === '/tags') {
				// Return a created tag whose id derives from the name for assertions.
				return { id: `created-${options.body!.name}`, name: options.body!.name, value: options.body!.name };
			}
			if (options.method === 'PUT') return opts.bulkResult ?? [];
			return [];
		});
		const ctx = {
			getNodeParameter: (name: string) => (name === 'tagNames' ? opts.tagNames : opts.assetIds),
			getNode: () => ({ name: 'Immich' }),
			getCredentials: async () => ({ host: 'https://immich.test' }),
			helpers: { httpRequestWithAuthentication: { call: httpCall } },
		} as unknown as Parameters<typeof resolveUpsertTagAssets>[0];
		return { ctx, calls };
	}

	it('creates missing tags and tags assets with every tag, keeping the final GET request', async () => {
		const { ctx, calls } = makeTagCtx({
			tagNames: 'Summer, Winter',
			assetIds: 'a1, a2',
			tags: [{ id: 'summer-id', value: 'Summer' }],
		});
		const req: IHttpRequestOptions = { method: 'GET', url: '/tags', headers: {} };
		const out = await resolveUpsertTagAssets.call(ctx, req);

		// Final request is left untouched (the declared GET /tags output).
		expect(out).toEqual(req);

		// POST only for the missing tag (Winter), not the existing Summer.
		const posts = calls.filter((c) => c.method === 'POST');
		expect(posts).toHaveLength(1);
		expect(posts[0].body).toEqual({ name: 'Winter' });

		// PUT assets for both tags (existing + created).
		const puts = calls.filter((c) => c.method === 'PUT');
		expect(puts.map((c) => c.url)).toEqual([
			'https://immich.test/api/tags/summer-id/assets',
			'https://immich.test/api/tags/created-Winter/assets',
		]);
		expect(puts[0].body).toEqual({ ids: ['a1', 'a2'] });
	});

	it('treats duplicate bulk results as success (does not throw)', async () => {
		const { ctx } = makeTagCtx({
			tagNames: 'Holiday',
			assetIds: 'a1',
			tags: [{ id: 't1', value: 'Holiday' }],
			bulkResult: [{ id: 'a1', success: false, error: 'duplicate' }],
		});
		await expect(resolveUpsertTagAssets.call(ctx, { method: 'GET', url: '/tags', headers: {} })).resolves.toBeTruthy();
	});

	it('throws a NodeOperationError when a tag call fails', async () => {
		const { ctx } = makeTagCtx({
			tagNames: 'Holiday',
			assetIds: 'a1',
			tags: [{ id: 't1', value: 'Holiday' }],
			bulkResult: [{ id: 'a1', success: false, error: 'not found' }],
		});
		await expect(
			resolveUpsertTagAssets.call(ctx, { method: 'GET', url: '/tags', headers: {} }),
		).rejects.toThrow(/asset tags failed/);
	});

	it('throws when no tag names are given', async () => {
		const { ctx } = makeTagCtx({ tagNames: '  ', assetIds: 'a1', tags: [] });
		await expect(resolveUpsertTagAssets.call(ctx, { method: 'GET', url: '/tags', headers: {} })).rejects.toThrow(
			/No tag names/,
		);
	});

	it('throws when no asset IDs are given', async () => {
		const { ctx } = makeTagCtx({ tagNames: 'Holiday', assetIds: '', tags: [{ id: 't1', value: 'Holiday' }] });
		await expect(resolveUpsertTagAssets.call(ctx, { method: 'GET', url: '/tags', headers: {} })).rejects.toThrow(
			/No asset IDs/,
		);
	});

	it('splits and trims tag names and asset IDs', async () => {
		const { ctx, calls } = makeTagCtx({
			tagNames: ' a, b,,c ',
			assetIds: [' x ', '', 'y'],
			tags: [],
		});
		await resolveUpsertTagAssets.call(ctx, { method: 'GET', url: '/tags', headers: {} });
		const posts = calls.filter((c) => c.method === 'POST').map((c) => c.body!.name);
		expect(posts).toEqual(['a', 'b', 'c']);
		const puts = calls.filter((c) => c.method === 'PUT');
		expect(puts[0].body).toEqual({ ids: ['x', 'y'] });
	});
});
