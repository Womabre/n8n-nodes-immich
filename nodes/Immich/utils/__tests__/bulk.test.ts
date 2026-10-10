import type { IExecuteSingleFunctions, INodeExecutionData } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { assertBulkSuccess } from '../bulk';

const context = { getNode: () => ({ name: 'Immich' }) } as unknown as IExecuteSingleFunctions;
const items = (...results: object[]): INodeExecutionData[] => results.map((json) => ({ json: json as never }));

describe('assertBulkSuccess', () => {
	it('passes items through when every ID succeeded', async () => {
		const input = items({ id: 'a', success: true }, { id: 'b', success: true });
		await expect(assertBulkSuccess.call(context, input)).resolves.toBe(input);
	});

	it('treats duplicate as success so re-runs stay idempotent', async () => {
		const input = items({ id: 'a', success: false, error: 'duplicate' });
		await expect(assertBulkSuccess.call(context, input)).resolves.toBe(input);
	});

	it('throws naming every failed ID and reason, for both id and assetId shapes', async () => {
		const input = items(
			{ id: 'a', success: true },
			{ id: 'b', success: false, error: 'no_permission' },
			{ assetId: 'c', success: false, error: 'not_found' },
		);
		const error = await assertBulkSuccess.call(context, input).catch((e: unknown) => e);
		expect(error).toMatchObject({ message: '2 of 3 IDs failed' });
		expect((error as { description: string }).description).toBe('b: no_permission\nc: not_found');
	});
});
