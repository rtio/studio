import { defineProject, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared.ts';

export default mergeConfig(
	sharedConfig,
	defineProject( {
		test: {
			name: 'mobile',
			environment: 'node',
			include: [ 'src/**/*.test.ts' ],
		},
	} )
);
