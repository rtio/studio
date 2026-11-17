export type SurfaceMode = 'liquid' | 'blur' | 'material' | 'solid';

interface SurfaceEnvironment {
	// React Native's Platform.OS.
	os: string;
	// True when this build and this iOS version have the Liquid Glass API.
	glassApiAvailable: boolean;
	// The system's Reduce Transparency accessibility setting.
	reduceTransparency: boolean;
}

// Each platform follows its own design system. Android gets an opaque Material 3
// surface. iOS 26 and later get Liquid Glass, older iOS blurs what is behind the
// surface, and Reduce Transparency makes it solid. Any other platform is solid.
export function resolveSurfaceMode( {
	os,
	glassApiAvailable,
	reduceTransparency,
}: SurfaceEnvironment ): SurfaceMode {
	if ( os === 'android' ) {
		return 'material';
	}
	if ( os !== 'ios' || reduceTransparency ) {
		return 'solid';
	}
	return glassApiAvailable ? 'liquid' : 'blur';
}
