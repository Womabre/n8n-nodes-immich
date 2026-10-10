import type { INodeParameters, INodeProperties } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { ImmichApi } from '../../../credentials/ImmichApi.credentials';
import { evaluate, node, resolveRequest } from './helpers/routing';

const rl = (value: string) => ({ __rl: true, mode: 'id', value });

describe('base URL', () => {
	it.each(['https://photos.example.com', 'https://photos.example.com/', 'https://photos.example.com//'])(
		'strips trailing slashes from %s in requests and the credential test',
		(host) => {
			const keys = { $credentials: { host } };
			const params: INodeParameters = { resource: 'server', operation: 'ping' };
			const expected = 'https://photos.example.com/api';
			expect(evaluate(params, node.description.requestDefaults?.baseURL, keys)).toBe(expected);
			expect(evaluate(params, new ImmichApi().test.request.baseURL, keys)).toBe(expected);
		},
	);
});

describe('Asset > Get Statistics', () => {
	it('sends no filters by default, so every asset is counted', () => {
		const { qs } = resolveRequest({ resource: 'asset', operation: 'getStatistics' });
		expect(qs).toEqual({ isFavorite: undefined, isTrashed: undefined, visibility: undefined });
	});

	it('sends only the filters that were added', () => {
		const { qs } = resolveRequest({ resource: 'asset', operation: 'getStatistics', filters: { isFavorite: true } });
		expect(qs).toEqual({ isFavorite: true, isTrashed: undefined, visibility: undefined });
	});
});

describe('Asset > Update', () => {
	const update = (updateFields: INodeParameters) =>
		resolveRequest({ resource: 'asset', operation: 'update', assetId: 'a1', updateFields }).body;

	it('maps rating options, with Unrated clearing the rating', () => {
		expect(update({ rating: 3 }).rating).toBe(3);
		expect(update({ rating: -1 }).rating).toBe(-1);
		expect(update({ rating: 'unrated' }).rating).toBeNull();
		expect(update({}).rating).toBeUndefined();
	});

	it('sends dateTimeOriginal with an offset', () => {
		expect(update({ dateTimeOriginal: '2026-07-01T10:00:00' }).dateTimeOriginal).toBe(
			'2026-07-01T10:00:00.000+02:00',
		);
	});
});

describe('Shared Link > Create', () => {
	it('sends the album ID for album links', () => {
		const { body } = resolveRequest({
			resource: 'sharedLink',
			operation: 'create',
			linkType: 'ALBUM',
			albumId: rl('album-1'),
		});
		expect(body).toMatchObject({ type: 'ALBUM', albumId: 'album-1', assetIds: undefined });
	});

	it('sends the asset list for individual links', () => {
		const { body } = resolveRequest({
			resource: 'sharedLink',
			operation: 'create',
			linkType: 'INDIVIDUAL',
			assetIds: 'a1, a2',
		});
		expect(body).toMatchObject({ type: 'INDIVIDUAL', albumId: undefined, assetIds: ['a1', 'a2'] });
	});

	it('sends expiresAt with an offset', () => {
		const { body } = resolveRequest({
			resource: 'sharedLink',
			operation: 'create',
			linkType: 'ALBUM',
			albumId: rl('album-1'),
			additionalFields: { expiresAt: '2026-12-31T23:59:00' },
		});
		expect(body.expiresAt).toBe('2026-12-31T23:59:00.000+01:00');
	});
});

describe('Shared Link > Update', () => {
	it('clears password, expiry and description when added but left empty', () => {
		const { body } = resolveRequest({
			resource: 'sharedLink',
			operation: 'update',
			sharedLinkId: rl('link-1'),
			updateFields: { password: '', expiresAt: '', description: '' },
		});
		expect(body).toMatchObject({ password: null, expiresAt: null, description: null });
	});
});

describe('Album > Get Many', () => {
	it('uses the Immich 3 filters and never sends the removed `shared` param', () => {
		const { qs } = resolveRequest({
			resource: 'album',
			operation: 'getAll',
			filters: { isShared: true, isOwned: false, name: 'Holiday' },
		});
		expect(qs).toEqual({ isShared: true, isOwned: false, name: 'Holiday', assetId: undefined });
		expect(qs).not.toHaveProperty('shared');
	});
});

describe('Person > Update', () => {
	it('sends birthDate as a calendar date', () => {
		const { body } = resolveRequest({
			resource: 'person',
			operation: 'update',
			personId: rl('p1'),
			updateFields: { birthDate: '1990-05-01T00:00:00' },
		});
		expect(body.birthDate).toBe('1990-05-01');
	});
});

describe('Search', () => {
	it('sends ID lists and offset dates, without page/size in the operation body', () => {
		const { body } = resolveRequest({
			resource: 'search',
			operation: 'searchMetadata',
			filters: { personIds: 'p1,p2', takenAfter: '2026-01-01T00:00:00' },
		});
		expect(body.personIds).toEqual(['p1', 'p2']);
		expect(body.takenAfter).toBe('2026-01-01T00:00:00.000+01:00');
		expect(body).not.toHaveProperty('page');
		expect(body).not.toHaveProperty('size');
	});
});

describe('bulk operations', () => {
	it.each([
		['album', 'addAssets'],
		['album', 'removeAssets'],
		['tag', 'tagAssets'],
		['tag', 'untagAssets'],
		['sharedLink', 'addAssets'],
		['sharedLink', 'removeAssets'],
		['person', 'merge'],
	])('%s > %s checks per-ID results', (resource, operation) => {
		const { routing } = resolveRequest({ resource, operation });
		const postReceive = (routing.output?.postReceive ?? []) as Array<{ name?: string }>;
		expect(postReceive.map((action) => action.name)).toContain('assertBulkSuccess');
	});
});

describe('pagination', () => {
	it.each([
		['search', 'searchMetadata'],
		['search', 'searchSmart'],
		['person', 'getAll'],
	])('%s > %s offers Return All with a pagination handler and a Limit', (resource, operation) => {
		const { routing } = resolveRequest({ resource, operation });
		expect(typeof routing.operations?.pagination).toBe('function');
		const shownFor = (name: string) =>
			node.description.properties.some(
				(property) =>
					property.name === name &&
					property.displayOptions?.show?.resource?.includes(resource) &&
					property.displayOptions?.show?.operation?.includes(operation),
			);
		expect(shownFor('returnAll')).toBe(true);
		expect(shownFor('limit')).toBe(true);
	});
});

describe('parameter definitions', () => {
	it('never declares one parameter name with two different types', () => {
		const typesByName = new Map<string, Set<string>>();
		const visit = (properties: INodeProperties[], scope: string) => {
			for (const property of properties) {
				const key = `${scope}${property.name}`;
				typesByName.set(key, (typesByName.get(key) ?? new Set()).add(property.type));
				if (property.type === 'collection' && Array.isArray(property.options)) {
					visit(property.options as INodeProperties[], `${key}.`);
				}
			}
		};
		visit(node.description.properties, '');
		const conflicts = [...typesByName].filter(([, types]) => types.size > 1).map(([name]) => name);
		expect(conflicts).toEqual([]);
	});
});
