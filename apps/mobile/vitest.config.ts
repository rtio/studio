import path from 'path';
import { defineProject, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared.ts';

const __dirname = import.meta.dirname;

export default mergeConfig(
	sharedConfig,
	defineProject( {
		test: {
			name: 'mobile',
			environment: 'node',
			include: [ 'src/**/*.test.ts' ],
		},
		resolve: {
			alias: {
				// The shared transcript code, read from source as Metro reads it.
				'@studio/agent': path.resolve( __dirname, '../../packages/agent' ),
			},
		},
	} )
);
