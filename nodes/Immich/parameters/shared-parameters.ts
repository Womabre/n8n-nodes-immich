import { INodePropertyMode } from 'n8n-workflow';

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
