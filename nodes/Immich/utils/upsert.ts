import { IDataObject, IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';

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
