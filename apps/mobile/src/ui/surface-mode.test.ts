import { describe, expect, it } from 'vitest';
import { resolveSurfaceMode } from './surface-mode';

describe( 'resolveSurfaceMode', () => {
	it( 'uses Liquid Glass on iOS when the glass API is available', () => {
		expect(
			resolveSurfaceMode( { os: 'ios', glassApiAvailable: true, reduceTransparency: false } )
		).toBe( 'liquid' );
	} );

	it( 'blurs on iOS versions without the glass API', () => {
		expect(
			resolveSurfaceMode( { os: 'ios', glassApiAvailable: false, reduceTransparency: false } )
		).toBe( 'blur' );
	} );

	it( 'uses a Material surface on Android', () => {
		expect(
			resolveSurfaceMode( { os: 'android', glassApiAvailable: false, reduceTransparency: false } )
		).toBe( 'material' );
	} );

	it( 'never uses glass on Android, whatever the availability flag says', () => {
		expect(
			resolveSurfaceMode( { os: 'android', glassApiAvailable: true, reduceTransparency: false } )
		).toBe( 'material' );
	} );

	it( 'uses a solid surface on iOS when Reduce Transparency is on', () => {
		expect(
			resolveSurfaceMode( { os: 'ios', glassApiAvailable: true, reduceTransparency: true } )
		).toBe( 'solid' );
		// A Material surface is already opaque, so the setting changes nothing on Android.
		expect(
			resolveSurfaceMode( { os: 'android', glassApiAvailable: false, reduceTransparency: true } )
		).toBe( 'material' );
	} );

	it( 'uses a solid surface on any other platform', () => {
		expect(
			resolveSurfaceMode( { os: 'web', glassApiAvailable: false, reduceTransparency: false } )
		).toBe( 'solid' );
	} );
} );
