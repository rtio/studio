import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
	name: 'Studio Mobile',
	slug: 'studio-mobile',
	version: '0.1.0',
	orientation: 'portrait',
	scheme: 'studio-remote',
	userInterfaceStyle: 'automatic',
	ios: {
		bundleIdentifier: 'com.automattic.studio.mobile',
		supportsTablet: false,
		infoPlist: {
			NSLocalNetworkUsageDescription: 'Studio connects to your computer on your local network.',
			NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
		},
	},
	android: {
		package: 'com.automattic.studio.mobile',
	},
	plugins: [
		'expo-router',
		[ 'expo-build-properties', { android: { usesCleartextTraffic: true } } ],
	],
};

export default config;
