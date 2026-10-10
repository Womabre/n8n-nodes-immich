import { INodeProperties, INodePropertyMode } from 'n8n-workflow';
import { MAX_PAGE_SIZE } from '../utils/pagination';

/**
 * "Return All" + "Limit" pair for a paginated operation. Return All switches
 * on the operation's `routing.operations.pagination`; otherwise Limit is sent
 * as the page `size` and also caps the output.
 *
 * @param sizeLocation Where the operation expects `size`: the JSON body or the query string
 */
export function returnAllAndLimit(
	resource: string,
	operations: string[],
	sizeLocation: 'body' | 'query',
): INodeProperties[] {
	const displayOptions = { show: { resource: [resource], operation: operations } };
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions,
			routing: { send: { paginate: '={{ $value }}' } },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: MAX_PAGE_SIZE },
			default: 50,
			description: 'Max number of results to return',
			displayOptions: { show: { ...displayOptions.show, returnAll: [false] } },
			routing: {
				send: { type: sizeLocation, property: 'size', value: '={{ $value }}' },
				output: { maxResults: '={{ $value }}' },
			},
		},
	];
}

/** Immich resource IDs are UUIDs (v4). */
const UUID_REGEX = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

/**
 * Builds the "From List" / "By ID" modes for a resource-locator field backed by
 * a searchable listSearch method.
 *
 * @param searchListMethod Name of the registered listSearch method
 * @param idPlaceholder    Placeholder for the manual "By ID" input
 */
export function resourceLocatorModes(searchListMethod: string, idPlaceholder: string): INodePropertyMode[] {
	// Resource-locator modes are not node parameters and have no `default`; the
	// lint rule cannot tell them apart when they are built in a helper function.
	/* eslint-disable n8n-nodes-base/node-param-default-missing */
	return [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod,
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: idPlaceholder,
			validation: [
				{
					type: 'regex',
					properties: {
						regex: UUID_REGEX,
						errorMessage: 'Enter a valid UUID',
					},
				},
			],
		},
	];
	/* eslint-enable n8n-nodes-base/node-param-default-missing */
}
