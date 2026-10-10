import { describe, it, expect, vi } from 'vitest';
import { searchAlbums, searchPeople, searchSharedLinks, searchTags, searchUsers } from '../listSearch';
import { ILoadOptionsFunctions } from 'n8n-workflow';

function makeCtx(httpResponse: unknown, credentials: Record<string, unknown> = { host: 'https://immich.example.com' }) {
	const httpRequestWithAuthentication = vi.fn().mockResolvedValue(httpResponse);
	const ctx = {
		getCredentials: vi.fn().mockResolvedValue(credentials),
		helpers: { httpRequestWithAuthentication },
	} as unknown as ILoadOptionsFunctions;
	return { ctx, httpRequestWithAuthentication };
}

describe('searchAlbums', () => {
	it('maps and sorts albums by name, hitting GET /albums', async () => {
		const { ctx, httpRequestWithAuthentication } = makeCtx([
			{ id: '2', albumName: 'Vacation' },
			{ id: '1', albumName: 'Birthday' },
		]);

		const result = await searchAlbums.call(ctx);

		expect(result.results).toEqual([
			{ name: 'Birthday', value: '1' },
			{ name: 'Vacation', value: '2' },
		]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'immichApi',
			expect.objectContaining({ method: 'GET', url: 'https://immich.example.com/api/albums' }),
		);
	});

	it('filters client-side, case-insensitively', async () => {
		const { ctx } = makeCtx([
			{ id: '1', albumName: 'Birthday Party' },
			{ id: '2', albumName: 'Vacation' },
		]);

		const result = await searchAlbums.call(ctx, 'birth');

		expect(result.results).toEqual([{ name: 'Birthday Party', value: '1' }]);
	});
});

describe('searchTags', () => {
	it('labels by the hierarchical value, not the leaf name', async () => {
		const { ctx } = makeCtx([{ id: '1', name: 'Child', value: 'Parent/Child' }]);

		const result = await searchTags.call(ctx);

		expect(result.results).toEqual([{ name: 'Parent/Child', value: '1' }]);
	});
});

describe('searchUsers', () => {
	it('labels with name and email, hitting GET /users', async () => {
		const { ctx, httpRequestWithAuthentication } = makeCtx([
			{ id: '1', name: 'Ada Lovelace', email: 'ada@example.com' },
		]);

		const result = await searchUsers.call(ctx);

		expect(result.results).toEqual([{ name: 'Ada Lovelace <ada@example.com>', value: '1' }]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'immichApi',
			expect.objectContaining({ url: 'https://immich.example.com/api/users' }),
		);
	});
});

describe('searchSharedLinks', () => {
	it('falls back to a type + short-id label when there is no description', async () => {
		const { ctx } = makeCtx([{ id: 'abcdef12-3456-7890-abcd-ef1234567890', type: 'ALBUM', description: '' }]);

		const result = await searchSharedLinks.call(ctx);

		expect(result.results).toEqual([
			{ name: 'ALBUM link (abcdef12)', value: 'abcdef12-3456-7890-abcd-ef1234567890' },
		]);
	});

	it('prefers the description as the label when present', async () => {
		const { ctx } = makeCtx([{ id: '1', type: 'ALBUM', description: 'Family photos' }]);

		const result = await searchSharedLinks.call(ctx);

		expect(result.results).toEqual([{ name: 'Family photos', value: '1' }]);
	});
});

describe('searchPeople', () => {
	it('skips unnamed people and requests hidden ones', async () => {
		const { ctx, httpRequestWithAuthentication } = makeCtx({
			people: [
				{ id: '1', name: 'Grace Hopper' },
				{ id: '2', name: '' },
			],
			hasNextPage: false,
		});

		const result = await searchPeople.call(ctx);

		expect(result.results).toEqual([{ name: 'Grace Hopper', value: '1' }]);
		expect(result.paginationToken).toBeUndefined();
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'immichApi',
			expect.objectContaining({
				url: 'https://immich.example.com/api/people',
				qs: { page: 1, size: 250, withHidden: true },
			}),
		);
	});

	it('advances the pagination token when hasNextPage is true', async () => {
		const { ctx } = makeCtx({ people: [{ id: '1', name: 'Ada' }], hasNextPage: true });

		const result = await searchPeople.call(ctx, undefined, '3');

		expect(result.paginationToken).toBe('4');
	});
});
