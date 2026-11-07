import { IDataObject, IExecuteSingleFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';

/**
 * Immich's bulk endpoints (album/tag/shared-link asset lists, person merge)
 * answer HTTP 200 with one `{ id | assetId, success, error }` entry per ID, so
 * a request where every ID failed still looks successful. `duplicate` (the ID
 * was already there) counts as success, which keeps re-runs idempotent.
 *
 * `collectBulkFailures` is the pure predicate; `assertBulkSuccess` is the
 * `postReceive` wrapper that turns it into a node error. The tag upsert preSend
 * reuses the predicate directly because it makes its bulk calls itself.
 */
export function collectBulkFailures(results: IDataObject[]): IDataObject[] {
	return results.filter((result) => result.success === false && result.error !== 'duplicate');
}

/** Formats a bulk failure entry for the node error description. */
function formatFailure(result: IDataObject): string {
	const id = String(result.id ?? result.assetId ?? 'unknown');
	const reason = String(result.error ?? 'unknown');
	return result.errorMessage ? `${id}: ${reason} (${String(result.errorMessage)})` : `${id}: ${reason}`;
}

export async function assertBulkSuccess(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const results = items.map((item) => item.json);
	const failures = collectBulkFailures(results);

	if (failures.length > 0) {
		throw new NodeOperationError(this.getNode(), `${failures.length} of ${items.length} IDs failed`, {
			description: failures.map(formatFailure).join('\n'),
		});
	}

	return items;
}
