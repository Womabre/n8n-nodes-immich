import type { IDataObject, INodeParameters, INodeProperties, INodeTypes } from 'n8n-workflow';
import { Workflow } from 'n8n-workflow';
import { Immich } from '../../Immich.node';

export const node = new Immich();

const nodeTypes = {
	getByName: () => node,
	getByNameAndVersion: () => node,
	getKnownTypes: () => ({}),
} as unknown as INodeTypes;

/**
 * Evaluates an n8n expression with n8n's own Expression engine, against an
 * Immich node holding `parameters`, in the Europe/Amsterdam workflow timezone.
 */
export function evaluate(parameters: INodeParameters, expression: unknown, additionalKeys: IDataObject = {}): unknown {
	const workflow = new Workflow({
		id: 'test',
		nodes: [
			{
				id: 'immich',
				name: 'Immich',
				type: 'immich',
				typeVersion: 1,
				position: [0, 0],
				parameters,
			},
		],
		connections: {},
		active: false,
		nodeTypes,
		settings: { timezone: 'Europe/Amsterdam' },
	});
	return workflow.expression.getParameterValue(
		expression as string,
		null,
		0,
		0,
		'Immich',
		[{ json: {} }],
		'manual',
		additionalKeys,
		undefined,
		false,
	);
}

function findOperation(resource: string, operation: string) {
	const operationProperty = node.description.properties.find(
		(property) =>
			property.name === 'operation' && property.displayOptions?.show?.resource?.includes(resource),
	) as INodeProperties;
	const option = (operationProperty.options as Array<{ value: string; routing?: IDataObject }>).find(
		(candidate) => candidate.value === operation,
	);
	if (!option?.routing) {
		throw new Error(`No routing for ${resource}.${operation}`);
	}
	return option.routing as {
		request: { method: string; url: string; body?: IDataObject; qs?: IDataObject };
		output?: IDataObject;
		operations?: IDataObject;
	};
}

function evaluateObject(parameters: INodeParameters, values: IDataObject | undefined): IDataObject {
	const result: IDataObject = {};
	for (const [key, value] of Object.entries(values ?? {})) {
		result[key] = evaluate(parameters, value) as IDataObject[keyof IDataObject];
	}
	return result;
}

/**
 * Resolves the request an operation would send: URL, method, and every
 * body/query value as n8n would evaluate it. `undefined` values are omitted
 * from the JSON request, `null` values are sent.
 */
export function resolveRequest(parameters: INodeParameters) {
	const routing = findOperation(parameters.resource as string, parameters.operation as string);
	return {
		method: routing.request.method,
		url: evaluate(parameters, routing.request.url) as string,
		body: evaluateObject(parameters, routing.request.body),
		qs: evaluateObject(parameters, routing.request.qs),
		routing,
	};
}
