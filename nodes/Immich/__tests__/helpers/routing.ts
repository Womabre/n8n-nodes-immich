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

/** Reads a nested parameter value out of `parameters` by dot path. */
function getParamByPath(parameters: INodeParameters, path: string): unknown {
	return path.split('.').reduce<unknown>((acc, key) => {
		if (acc && typeof acc === 'object') {
			return (acc as Record<string, unknown>)[key];
		}
		return undefined;
	}, parameters);
}

/**
 * Finds a property definition by dot path within the node's `properties`,
 * descending into `collection` options. Returns `undefined` if not found.
 */
function findPropertyByPath(path: string): INodeProperties | undefined {
	const parts = path.split('.');
	let properties = node.description.properties;
	let current: INodeProperties | undefined;
	for (let i = 0; i < parts.length; i++) {
		current = properties.find((p) => p.name === parts[i]);
		if (!current) return undefined;
		if (i < parts.length - 1) {
			properties = (current.options as INodeProperties[] | undefined) ?? [];
		}
	}
	return current;
}

/**
 * Walks the displayed parameter tree for the selected resource/operation and
 * resolves every `routing.send` it finds. `$value` is the parameter value as
 * `getNodeParameter` would return it: the raw stored value, with `={{ }}`
 * expressions resolved via the engine (mustache `{{ }}` is left as-is, which
 * matches `getNodeParameter`'s real behaviour for a plain string field).
 *
 * Returns the accumulated `body` and `qs` payloads those sends would produce.
 */
function collectSends(parameters: INodeParameters): { body: IDataObject; qs: IDataObject } {
	const body: IDataObject = {};
	const qs: IDataObject = {};

	const visit = (property: INodeProperties, path: string) => {
		// Display check: only include the field if it is shown for the current
		// resource/operation/parent selection. For collection children the
		// parent's displayOptions already cover the resource/operation gates;
		// children only become "active" when their key is present in the value.
		const display = property.displayOptions?.show;
		if (display) {
			for (const [key, allowed] of Object.entries(display)) {
				if (!allowed) continue;
				const actual = parameters[key as keyof INodeParameters];
				// `returnAll` defaults to false when unset, matching n8n's behaviour.
				const effective = actual === undefined ? false : actual;
				if (!allowed.includes(effective as string | boolean)) return;
			}
		}

		const fullPath = path ? `${path}.${property.name}` : property.name;
		const send = property.routing?.send as
			| { type: 'body' | 'query'; property: string; value: string }
			| undefined;

		if (send) {
			const prop = findPropertyByPath(fullPath);
			const rawValue = getParamByPath(parameters, fullPath);
			// When the user never set the field, fall back to the property's
			// declared default — n8n does this when the node is created in the
			// editor, so a missing parameter behaves as its default.
			const effectiveRaw = rawValue === undefined ? prop?.default : rawValue;
			// `$value` mirrors getNodeParameter: resolve `={{ }}` expressions via
			// the engine; plain strings and mustache literals pass through.
			const resolvedValue =
				typeof effectiveRaw === 'string' && effectiveRaw.startsWith('=')
					? evaluate(parameters, effectiveRaw, { $value: effectiveRaw })
					: effectiveRaw;
			const finalValue = evaluate(parameters, send.value, { $value: resolvedValue });
			const target = send.type === 'body' ? body : qs;
			target[send.property] = finalValue as unknown;
		}

		if (property.type === 'collection' && Array.isArray(property.options)) {
			const collectionValue = getParamByPath(parameters, fullPath) as
				| Record<string, unknown>
				| undefined;
			if (collectionValue && typeof collectionValue === 'object') {
				for (const child of property.options as INodeProperties[]) {
					if (Object.prototype.hasOwnProperty.call(collectionValue, child.name)) {
						visit(child, fullPath);
					}
				}
			}
		}
	};

	for (const property of node.description.properties) {
		visit(property, '');
	}

	return { body, qs };
}

/**
 * Resolves the request an operation would send: URL, method, every body/query
 * value declared inline in `routing.request`, plus every per-field `routing.send`
 * contribution (which is how user-fillable string/date/id-list fields reach the
 * request, so their `{{ }}` expressions resolve correctly). `undefined` values
 * are omitted from the JSON request, `null` values are sent.
 */
export function resolveRequest(parameters: INodeParameters) {
	const routing = findOperation(parameters.resource as string, parameters.operation as string);
	const inlineBody = evaluateObject(parameters, routing.request.body);
	const inlineQs = evaluateObject(parameters, routing.request.qs);
	const { body: sendBody, qs: sendQs } = collectSends(parameters);
	return {
		method: routing.request.method,
		url: evaluate(parameters, routing.request.url) as string,
		body: { ...inlineBody, ...sendBody },
		qs: { ...inlineQs, ...sendQs },
		routing,
	};
}
