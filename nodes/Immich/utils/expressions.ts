/**
 * Builders for the n8n expressions used in declarative `routing` blocks.
 *
 * Routing values are expression strings evaluated by n8n at run time, so these
 * helpers generate the expression text rather than doing the work in
 * TypeScript. Paths are dot-separated parameter paths, e.g. `filters.albumIds`.
 *
 * IMPORTANT: the `$parameter["a"]["b"]` proxy in n8n-workflow returns nested
 * property values verbatim — it does NOT recursively resolve `={{ }}` or
 * `{{ }}` interpolation that the user entered in a nested field. So any
 * `routing.request.{qs,body}` value that reads back a user-fillable string
 * field via `$parameter` ships the raw text to the API instead of the
 * resolved value (filter `name = {{ $json.name }}` is sent literally, so the
 * search returns nothing).
 *
 * The fix is `routing.send` per field: n8n resolves the parameter via
 * `getNodeParameter` (which DOES resolve expressions) into `$value`, and the
 * `send.value` expression then operates on the already-resolved value. The
 * helpers below produce the `send` block + a `value` expression for that
 * pattern; use them instead of the `$parameter`-based `*Expr` helpers
 * whenever the field accepts user-entered string/date/id-list input.
 */

import type { INodeProperties } from 'n8n-workflow';

function ref(path: string): string {
	return '$parameter' + path.split('.').map((part) => `["${part}"]`).join('');
}

/** `$value` reference used inside `routing.send.value` expressions. */
const VALUE = '$value';

/**
 * List of IDs from a field that holds either a comma-separated string or an
 * array (e.g. `{{ $json.ids }}`). Entries are trimmed and empty ones dropped.
 * Resolves to `undefined` when the field is unset or empty.
 *
 * Returns the bare JavaScript, for embedding in a larger expression; use
 * `idListExpr` for a complete routing value.
 */
export function idListJs(path: string): string {
	const v = ref(path);
	return (
		`(${v} === undefined || ${v} === null || ${v} === "" ? undefined : ` +
		`(Array.isArray(${v}) ? ${v} : String(${v}).split(",")).map(id => String(id).trim()).filter(id => id))`
	);
}

/** Routing value for `idListJs`. */
export function idListExpr(path: string): string {
	return `={{ ${idListJs(path)} }}`;
}

/**
 * ISO 8601 date-time with an explicit offset. Immich 3 rejects offset-less
 * timestamps, which is what n8n's date picker produces, so offset-less input
 * is read in the workflow timezone. Unparseable input is passed through
 * untouched so the server reports it, rather than being sent as `null`.
 *
 * An unset field resolves to `undefined`; a field that was added but left
 * empty resolves to `null` when `clearable`, otherwise `undefined`.
 */
export function dateTimeExpr(path: string, { clearable = false } = {}): string {
	const v = ref(path);
	const parsed = `DateTime.fromISO(String(${v}), { zone: $now.zone })`;
	return (
		`={{ ${v} === undefined ? undefined : ${v} === "" ? ${clearable ? 'null' : 'undefined'} : ` +
		`${parsed}.isValid ? ${parsed}.toISO() : ${v} }}`
	);
}

/** Calendar date (`YYYY-MM-DD`). Empty clears the value (`null`). */
export function dateExpr(path: string): string {
	const v = ref(path);
	return `={{ ${v} === undefined ? undefined : ${v} === "" ? null : String(${v}).slice(0, 10) }}`;
}

/**
 * Optional string that the user can clear: unset is omitted, added-but-empty
 * sends `null`.
 */
export function clearableExpr(path: string): string {
	const v = ref(path);
	return `={{ ${v} === undefined ? undefined : ${v} === "" ? null : ${v} }}`;
}

/** Optional value sent as-is when the user added the field, omitted otherwise. */
export function optionalExpr(path: string): string {
	const v = ref(path);
	return `={{ ${v} === "" ? undefined : ${v} }}`;
}

// ----------------------------------------------------------------------------
// `routing.send` builders (preferred over the `*Expr` helpers above for any
// field that accepts user-entered string/date/id-list input — see the header
// comment for why). Each returns the full `send` block to spread onto the
// parameter definition.
// ----------------------------------------------------------------------------

type SendLocation = 'body' | 'query';

/** Body or query name to set under `routing.send`. */
function sendBlock(location: SendLocation, property: string, value: string): INodeProperties['routing'] {
	return {
		send: {
			type: location,
			property,
			value,
		},
	};
}

/**
 * Optional string sent as-is when set, omitted when empty/unset. Use for
 * filter and additional-field strings the user can fill with an expression.
 */
export function optionalSend(location: SendLocation, property: string): INodeProperties['routing'] {
	return sendBlock(location, property, `={{ ${VALUE} === "" ? undefined : ${VALUE} }}`);
}

/**
 * Clearable string: unset is omitted, added-but-empty sends `null` (to remove
 * the value server-side), otherwise the value is sent as-is.
 */
export function clearableSend(location: SendLocation, property: string): INodeProperties['routing'] {
	return sendBlock(location, property, `={{ ${VALUE} === undefined ? undefined : ${VALUE} === "" ? null : ${VALUE} }}`);
}

/**
 * Calendar date (`YYYY-MM-DD`) from a dateTime picker. Empty clears the value
 * (`null`); the date portion is sliced out so a time component is ignored.
 */
export function dateSend(location: SendLocation, property: string): INodeProperties['routing'] {
	return sendBlock(location, property, `={{ ${VALUE} === undefined ? undefined : ${VALUE} === "" ? null : String(${VALUE}).slice(0, 10) }}`);
}

/**
 * ISO 8601 date-time with an explicit offset. Immich 3 rejects offset-less
 * timestamps, so offset-less input is read in the workflow timezone. Unset is
 * omitted; added-but-empty is `null` when `clearable`, otherwise `undefined`.
 */
export function dateTimeSend(
	location: SendLocation,
	property: string,
	{ clearable = false } = {},
): INodeProperties['routing'] {
	const parsed = `DateTime.fromISO(String(${VALUE}), { zone: $now.zone })`;
	return sendBlock(
		location,
		property,
		`={{ ${VALUE} === undefined ? undefined : ${VALUE} === "" ? ${clearable ? 'null' : 'undefined'} : ${parsed}.isValid ? ${parsed}.toISO() : ${VALUE} }}`,
	);
}

/**
 * Comma-separated string OR array of IDs → trimmed array with empties dropped.
 * Unset or empty resolves to `undefined`. For the bare JS form (embedded in a
 * larger expression) use `idListJs`.
 */
export function idListSend(location: SendLocation, property: string): INodeProperties['routing'] {
	return sendBlock(
		location,
		property,
		`={{ ${VALUE} === undefined || ${VALUE} === null || ${VALUE} === "" ? undefined : (Array.isArray(${VALUE}) ? ${VALUE} : String(${VALUE}).split(",")).map(id => String(id).trim()).filter(id => id) }}`,
	);
}
