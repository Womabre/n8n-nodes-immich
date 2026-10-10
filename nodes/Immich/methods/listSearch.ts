import { IDataObject, ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

type SearchResultItem = { name: string; value: string };

/** Performs an authenticated GET against the Immich API and returns the parsed body. */
async function immichGet(ctx: ILoadOptionsFunctions, path: string, qs: IDataObject = {}): Promise<unknown> {
	const credentials = await ctx.getCredentials('immichApi');
	const baseUrl = String(credentials.host).replace(/\/+$/, '');
	return ctx.helpers.httpRequestWithAuthentication.call(ctx, 'immichApi', {
		method: 'GET',
		url: `${baseUrl}/api${path}`,
		qs,
		json: true,
	});
}

/**
 * Filters already-mapped results by label, case-insensitively. None of the list
 * endpoints below accept a free-text query parameter, so typeahead filtering
 * happens client-side against whatever page was fetched.
 */
function clientFilter(results: SearchResultItem[], filter?: string): SearchResultItem[] {
	if (!filter) {
		return results;
	}
	const needle = filter.toLowerCase();
	return results.filter((item) => item.name.toLowerCase().includes(needle));
}

function sortByName(results: SearchResultItem[]): SearchResultItem[] {
	return [...results].sort((a, b) => a.name.localeCompare(b.name));
}

/** Album search backing the resource-locator on `albumId` / shared-link `targetId` (Album mode). */
export async function searchAlbums(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
	const albums = (await immichGet(this, '/albums')) as IDataObject[];
	const results = sortByName(
		albums.map((album) => ({ name: String(album.albumName), value: String(album.id) })),
	);
	return { results: clientFilter(results, filter) };
}

/**
 * Tag search. Uses the hierarchical `value` (e.g. "Parent/Child") as the label
 * rather than the leaf `name`, since two tags with different parents can share
 * the same leaf name.
 */
export async function searchTags(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
	const tags = (await immichGet(this, '/tags')) as IDataObject[];
	const results = sortByName(
		tags.map((tag) => ({ name: String(tag.value ?? tag.name), value: String(tag.id) })),
	);
	return { results: clientFilter(results, filter) };
}

/** User search backing the resource-locator on `userId` (album sharing, `user.get`). */
export async function searchUsers(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
	const users = (await immichGet(this, '/users')) as IDataObject[];
	const results = sortByName(
		users.map((user) => ({ name: `${String(user.name)} <${String(user.email)}>`, value: String(user.id) })),
	);
	return { results: clientFilter(results, filter) };
}

/** Shared-link search backing the resource-locator on `sharedLinkId`. */
export async function searchSharedLinks(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const links = (await immichGet(this, '/shared-links')) as IDataObject[];
	const results = sortByName(
		links.map((link) => ({
			name: (link.description as string) || `${String(link.type)} link (${String(link.id).slice(0, 8)})`,
			value: String(link.id),
		})),
	);
	return { results: clientFilter(results, filter) };
}

/**
 * Person search backing the resource-locator on `personId`. Paginated via
 * `page`/`size` since a library can have hundreds of recognized faces;
 * `withHidden` is always sent so hidden people stay selectable. People without
 * a name (unconfirmed faces) are skipped — nothing meaningful to search or
 * display — but remain reachable via the "By ID" mode.
 */
export async function searchPeople(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const page = paginationToken ? Number(paginationToken) : 1;
	const body = (await immichGet(this, '/people', { page, size: 250, withHidden: true })) as IDataObject;
	const people = (body.people as IDataObject[]) ?? [];
	const results = people
		.filter((person) => person.name)
		.map((person) => ({ name: String(person.name), value: String(person.id) }));
	return {
		results: clientFilter(results, filter),
		paginationToken: body.hasNextPage ? String(page + 1) : undefined,
	};
}
