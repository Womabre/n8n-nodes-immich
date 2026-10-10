/**
 * Builders for the n8n expressions used in declarative `routing` blocks.
 *
 * Routing values are expression strings evaluated by n8n at run time, so these
 * helpers generate the expression text rather than doing the work in
 * TypeScript. Paths are dot-separated parameter paths, e.g. `filters.albumIds`.
 */

function ref(path: string): string {
	return '$parameter' + path.split('.').map((part) => `["${part}"]`).join('');
}

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
