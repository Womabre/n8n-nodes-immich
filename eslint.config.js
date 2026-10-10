const { config } = require('@n8n/node-cli/eslint');

const baseConfig = Array.isArray(config) ? config : [config];

module.exports = [
	{ ignores: ['**/__tests__/**', 'vitest.config.ts'] },
	...baseConfig,
];
