import type { INodeParameters } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../__tests__/helpers/routing';
import { clearableExpr, dateExpr, dateTimeExpr, idListExpr, optionalExpr } from '../expressions';

// Evaluated by n8n's own Expression engine (Europe/Amsterdam workflow
// timezone) against real fields of the node: n8n drops parameters that are
// not displayed for the selected operation, so made-up fields would vanish.
const shareUpdate = (updateFields: INodeParameters): INodeParameters => ({
	resource: 'sharedLink',
	operation: 'update',
	sharedLinkId: { __rl: true, mode: 'id', value: 'x' },
	updateFields,
});
const personUpdate = (updateFields: INodeParameters): INodeParameters => ({
	resource: 'person',
	operation: 'update',
	personId: { __rl: true, mode: 'id', value: 'x' },
	updateFields,
});

describe('idListExpr', () => {
	const expr = idListExpr('assetIds');
	const addAssets = (assetIds: unknown): INodeParameters => ({
		resource: 'album',
		operation: 'addAssets',
		albumId: { __rl: true, mode: 'id', value: 'x' },
		assetIds: assetIds as string,
	});

	it('splits, trims and drops empty entries from a comma string', () => {
		expect(evaluate(addAssets(' a, b,,c , '), expr)).toEqual(['a', 'b', 'c']);
	});

	it('accepts an array (e.g. from {{ $json.ids }})', () => {
		expect(evaluate(addAssets([' a ', '', 'b']), expr)).toEqual(['a', 'b']);
	});

	it('is undefined when empty', () => {
		expect(evaluate(addAssets(''), expr)).toBeUndefined();
	});
});

describe('dateTimeExpr', () => {
	const expr = dateTimeExpr('updateFields.expiresAt');
	const clearable = dateTimeExpr('updateFields.expiresAt', { clearable: true });

	it('reads offset-less input in the workflow timezone, DST-aware', () => {
		expect(evaluate(shareUpdate({ expiresAt: '2026-07-01T10:00:00' }), expr)).toBe('2026-07-01T10:00:00.000+02:00');
		expect(evaluate(shareUpdate({ expiresAt: '2026-01-15T10:00:00' }), expr)).toBe('2026-01-15T10:00:00.000+01:00');
	});

	it('keeps the instant of input that already has an offset', () => {
		expect(evaluate(shareUpdate({ expiresAt: '2026-07-01T08:00:00Z' }), expr)).toBe(
			'2026-07-01T10:00:00.000+02:00',
		);
	});

	it('produces values matching the Immich 3 date-time pattern', () => {
		expect(evaluate(shareUpdate({ expiresAt: '2026-07-01T10:00:00' }), expr)).toMatch(/(Z|[+-]\d\d:\d\d)$/);
	});

	it('is undefined when unset, and null for an emptied clearable field', () => {
		expect(evaluate(shareUpdate({}), expr)).toBeUndefined();
		expect(evaluate(shareUpdate({ expiresAt: '' }), expr)).toBeUndefined();
		expect(evaluate(shareUpdate({ expiresAt: '' }), clearable)).toBeNull();
	});

	it('passes unparseable input through instead of sending null', () => {
		expect(evaluate(shareUpdate({ expiresAt: 'not a date' }), expr)).toBe('not a date');
	});
});

describe('dateExpr', () => {
	const expr = dateExpr('updateFields.birthDate');

	it('sends only the calendar date', () => {
		expect(evaluate(personUpdate({ birthDate: '1990-05-01T00:00:00' }), expr)).toBe('1990-05-01');
	});

	it('clears with null when emptied and is omitted when unset', () => {
		expect(evaluate(personUpdate({ birthDate: '' }), expr)).toBeNull();
		expect(evaluate(personUpdate({}), expr)).toBeUndefined();
	});
});

describe('clearableExpr / optionalExpr', () => {
	it('clearable: unset omitted, empty null, value kept', () => {
		const expr = clearableExpr('updateFields.password');
		expect(evaluate(shareUpdate({}), expr)).toBeUndefined();
		expect(evaluate(shareUpdate({ password: '' }), expr)).toBeNull();
		expect(evaluate(shareUpdate({ password: 'secret' }), expr)).toBe('secret');
	});

	it('optional: unset and empty omitted, value kept', () => {
		const expr = optionalExpr('updateFields.name');
		expect(evaluate(personUpdate({}), expr)).toBeUndefined();
		expect(evaluate(personUpdate({ name: '' }), expr)).toBeUndefined();
		expect(evaluate(personUpdate({ name: 'Bob' }), expr)).toBe('Bob');
	});
});
