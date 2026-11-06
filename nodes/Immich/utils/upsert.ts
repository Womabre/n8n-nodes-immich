import { IDataObject, IExecuteSingleFunctions, IHttpRequestOptions, NodeOperationError } from 'n8n-workflow';
import { collectBulkFailures } from './bulk';

/**
 * GET /albums helper for the upsert preSend. Mirrors `immichGet` in
 * methods/listSearch.ts but runs in the execute (not load-options) context.
 */
async function listAlbums(ctx: IExecuteSingleFunctions, qs: IDataObject = {}): Promise<IDataObject[]> {
	const credentials = await ctx.getCredentials('immichApi');
	const baseUrl = String(credentials.host).replace(/\/+$/, '');
	return (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'immichApi', {
		method: 'GET',
		url: `${baseUrl}/api/albums`,
		qs,
		json: true,
	})) as IDataObject[];
}

/** Authenticated JSON request against the Immich API in the execute context. */
async function immichRequest(
	ctx: IExecuteSingleFunctions,
	options: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; body?: IDataObject },
): Promise<IDataObject | IDataObject[]> {
	const credentials = await ctx.getCredentials('immichApi');
	const baseUrl = String(credentials.host).replace(/\/+$/, '');
	return (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'immichApi', {
		method: options.method,
		url: `${baseUrl}/api${options.path}`,
		body: options.body,
		json: true,
	})) as IDataObject | IDataObject[];
}

/**
 * Splits a comma-separated string or passes an array through, trimming and
 * dropping empties. Mirrors `idListJs` from utils/expressions.ts but runs in
 * TypeScript (the upsert body is built in the preSend, not via an expression).
 */
function toIdList(value: unknown): string[] {
	if (value === undefined || value === null || value === '') return [];
	const arr = Array.isArray(value) ? value : String(value).split(',');
	return arr.map((id) => String(id).trim()).filter((id) => id);
}

/**
 * preSend for Album > Create or Add Assets (upsert).
 *
 * Default request is `POST /albums` (create). If an album with exactly this
 * name already exists, switch the request to `PUT /albums/{id}/assets` to add
 * the assets instead of creating a duplicate album.
 *
 * The `assetIds` field is consumed here (not via `routing.send`) because the
 * body shape differs between the two branches: create sends `{ albumName,
 * assetIds }`, add-assets sends `{ ids }`. Reading it through
 * `getNodeParameter` keeps expression-mode values (e.g. `={{ $json.ids }}`)
 * working — same property that makes `routing.send` safe.
 */
export async function resolveUpsertAlbum(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const albumName = String(this.getNodeParameter('albumName'));
	const assetIds = toIdList(this.getNodeParameter('assetIds'));

	const albums = await listAlbums(this, { name: albumName });
	const existing = albums.find((album) => String(album.albumName) === albumName);

	if (existing) {
		requestOptions.method = 'PUT';
		requestOptions.url = `/albums/${String(existing.id)}/assets`;
		requestOptions.body = { ids: assetIds };
	} else {
		requestOptions.method = 'POST';
		requestOptions.url = '/albums';
		requestOptions.body = { albumName, assetIds };
	}

	return requestOptions;
}

/**
 * preSend for Tag > Create or Update (upsert tags + assets).
 *
 * The routing request is a plain `GET /tags` (the node's output is the current
 * tag list). All side effects happen here:
 *
 * 1. For each comma-separated tag name, find the existing tag by its full
 *    `value` (e.g. `Holiday` or `Holiday/Summer`); create it via `POST /tags`
 *    when missing.
 * 2. Tag the assets with every tag via `PUT /tags/{id}/assets`, asserting each
 *    bulk response — `duplicate` counts as success so re-runs stay idempotent.
 *
 * So the declared `GET /tags` request is left untouched and simply reports the
 * tags now on the server after the work is done.
 */
export async function resolveUpsertTagAssets(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const tagNames = toIdList(this.getNodeParameter('tagNames'));
	const assetIds = toIdList(this.getNodeParameter('assetIds'));

	if (tagNames.length === 0) {
		throw new NodeOperationError(this.getNode(), 'No tag names provided');
	}
	if (assetIds.length === 0) {
		throw new NodeOperationError(this.getNode(), 'No asset IDs provided');
	}

	const tags = (await immichRequest(this, { method: 'GET', path: '/tags' })) as IDataObject[];
	const tagIds: string[] = [];

	for (const name of tagNames) {
		const existing = tags.find((tag) => String(tag.value) === name);
		if (existing) {
			tagIds.push(String(existing.id));
			continue;
		}
		const created = (await immichRequest(this, {
			method: 'POST',
			path: '/tags',
			body: { name },
		})) as IDataObject;
		tagIds.push(String(created.id));
	}

	const failures: IDataObject[] = [];
	for (const tagId of tagIds) {
		const results = (await immichRequest(this, {
			method: 'PUT',
			path: `/tags/${tagId}/assets`,
			body: { ids: assetIds },
		})) as IDataObject[];
		failures.push(...collectBulkFailures(results));
	}

	if (failures.length > 0) {
		throw new NodeOperationError(this.getNode(), `${failures.length} asset tags failed`, {
			description: failures
				.map((result) => {
					const id = String(result.id ?? result.assetId ?? 'unknown');
					const reason = String(result.error ?? 'unknown');
					return result.errorMessage ? `${id}: ${reason} (${String(result.errorMessage)})` : `${id}: ${reason}`;
				})
				.join('\n'),
		});
	}

	// Leave the declared GET /tags request untouched as the node output.
	return requestOptions;
}
