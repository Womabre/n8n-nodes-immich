import {
	DeclarativeRestApiSettings,
	IDataObject,
	IExecutePaginationFunctions,
	INodeExecutionData,
} from 'n8n-workflow';

/** Largest page Immich accepts on `/search/*` and `/people`. */
export const MAX_PAGE_SIZE = 1000;

/**
 * Pagination for Immich's `page`/`size` endpoints, used when "Return All" is
 * on. Requests pages of `MAX_PAGE_SIZE` until one comes back short. Works on
 * the items left after `postReceive`, so it does not depend on a response
 * field (`nextPage` is deprecated on search since Immich 3.2).
 *
 * @param location Where `page`/`size` are sent: the JSON body or the query string
 */
export function paginateByPage(location: 'body' | 'qs') {
	return async function (
		this: IExecutePaginationFunctions,
		requestData: DeclarativeRestApiSettings.ResultOptions,
	): Promise<INodeExecutionData[]> {
		const results: INodeExecutionData[] = [];
		let previousFirstId: unknown;

		for (let page = 1; ; page++) {
			requestData.options[location] = {
				...(requestData.options[location] as IDataObject | undefined),
				page,
				size: MAX_PAGE_SIZE,
			};
			const items = await this.makeRoutingRequest(requestData);

			// Guard against a server that ignores `page` and keeps returning page 1.
			const firstId = items[0]?.json.id;
			if (items.length > 0 && firstId !== undefined && firstId === previousFirstId) {
				break;
			}
			previousFirstId = firstId;

			results.push(...items);
			if (items.length < MAX_PAGE_SIZE) {
				break;
			}
		}

		return results;
	};
}
