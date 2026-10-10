import { IExecuteSingleFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';

/**
 * Immich's bulk endpoints (album/tag/shared-link asset lists, person merge)
 * answer HTTP 200 with one `{ id | assetId, success, error }` entry per ID, so
 * a request where every ID failed still looks successful. This turns failed
 * entries into a node error. `duplicate` (the ID was already there) counts as
 * success, which keeps re-runs idempotent.
 */
export async function assertBulkSuccess(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const failures = items
		.map((item) => item.json)
		.filter((result) => result.success === false && result.error !== 'duplicate');

	if (failures.length > 0) {
		const details = failures.map((result) => {
			const id = String(result.id ?? result.assetId ?? 'unknown');
			const reason = String(result.error ?? 'unknown');
			return result.errorMessage ? `${id}: ${reason} (${String(result.errorMessage)})` : `${id}: ${reason}`;
		});
		throw new NodeOperationError(this.getNode(), `${failures.length} of ${items.length} IDs failed`, {
			description: details.join('\n'),
		});
	}

	return items;
}
