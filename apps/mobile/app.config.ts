import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
	name: 'Studio Mobile',
	slug: 'studio-mobile',
	version: '0.1.0',
	orientation: 'portrait',
	scheme: 'studio-remote',
	userInterfaceStyle: 'automatic',
	// The app has no over-the-air updates.
	updates: { enabled: false },
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
		// The app has no biometric gate, so it asks for no Face ID permission.
		[ 'expo-secure-store', { faceIDPermission: false } ],
		[
			'expo-camera',
			{
				cameraPermission: 'Studio uses the camera to scan the pairing code shown by your computer.',
				// The camera only scans the pairing code. No microphone on either platform.
				microphonePermission: false,
				recordAudioAndroid: false,
			},
		],
	],
};

export default config;
