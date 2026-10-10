import type { DeclarativeRestApiSettings, IExecutePaginationFunctions, INodeExecutionData } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { MAX_PAGE_SIZE, paginateByPage } from '../pagination';

const page = (start: number, count: number): INodeExecutionData[] =>
	Array.from({ length: count }, (_, i) => ({ json: { id: `id-${start + i}` } }));

function run(location: 'body' | 'qs', pages: INodeExecutionData[][]) {
	const requests: Array<Record<string, unknown>> = [];
	const makeRoutingRequest = vi.fn(async (requestData: DeclarativeRestApiSettings.ResultOptions) => {
		requests.push({ ...(requestData.options[location] as object) });
		return pages[requests.length - 1] ?? [];
	});
	const context = { makeRoutingRequest } as unknown as IExecutePaginationFunctions;
	const requestData = {
		options: { body: { query: 'dog' }, qs: {} },
	} as unknown as DeclarativeRestApiSettings.ResultOptions;
	return { result: paginateByPage(location).call(context, requestData), requests };
}

describe('paginateByPage', () => {
	it('requests full pages until a short one, keeping the other body fields', async () => {
		const { result, requests } = run('body', [page(0, MAX_PAGE_SIZE), page(MAX_PAGE_SIZE, 3)]);
		expect(await result).toHaveLength(MAX_PAGE_SIZE + 3);
		expect(requests).toEqual([
			{ query: 'dog', page: 1, size: MAX_PAGE_SIZE },
			{ query: 'dog', page: 2, size: MAX_PAGE_SIZE },
		]);
	});

	it('pages through the query string for GET endpoints', async () => {
		const { result, requests } = run('qs', [page(0, 2)]);
		expect(await result).toHaveLength(2);
		expect(requests).toEqual([{ page: 1, size: MAX_PAGE_SIZE }]);
	});

	it('stops after one extra empty request when the last page is exactly full', async () => {
		const { result, requests } = run('body', [page(0, MAX_PAGE_SIZE), []]);
		expect(await result).toHaveLength(MAX_PAGE_SIZE);
		expect(requests).toHaveLength(2);
	});

	it('stops if the server ignores `page` and repeats the first page', async () => {
		const { result, requests } = run('body', [page(0, MAX_PAGE_SIZE), page(0, MAX_PAGE_SIZE)]);
		expect(await result).toHaveLength(MAX_PAGE_SIZE);
		expect(requests).toHaveLength(2);
	});
});
