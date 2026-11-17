import { describe, expect, it } from 'vitest';
import { studioThemes, withMaterialRoles } from './theme';
import type { MaterialRoles } from './theme';

const MATERIAL: MaterialRoles = {
	surface: '#fbf8ff',
	onSurface: '#1b1b21',
	onSurfaceVariant: '#45464f',
	outlineVariant: '#c6c5d0',
	surfaceContainerHigh: '#e9e7ef',
	surfaceContainerHighest: '#e3e1e9',
	secondaryContainer: '#dfe1f9',
};

describe( 'studioThemes', () => {
	it( 'has a light page with dark text, and a dark page with light text', () => {
		expect( studioThemes.light.colors.background ).toBe( '#ffffff' );
		expect( studioThemes.dark.colors.background ).toBe( '#111111' );
		expect( studioThemes.light.scheme ).toBe( 'light' );
		expect( studioThemes.dark.scheme ).toBe( 'dark' );
	} );

	it( 'reads the floating surface from the popover tokens', () => {
		expect( studioThemes.dark.colors.floating ).not.toBe( studioThemes.dark.colors.background );
	} );
} );

describe( 'withMaterialRoles', () => {
	const theme = withMaterialRoles( studioThemes.light, MATERIAL );

	it( 'takes surfaces, text and borders from the Material palette', () => {
		expect( theme.colors.background ).toBe( MATERIAL.surface );
		expect( theme.colors.foreground ).toBe( MATERIAL.onSurface );
		expect( theme.colors.mutedForeground ).toBe( MATERIAL.onSurfaceVariant );
		expect( theme.colors.placeholder ).toBe( MATERIAL.onSurfaceVariant );
		expect( theme.colors.border ).toBe( MATERIAL.outlineVariant );
		expect( theme.colors.muted ).toBe( MATERIAL.surfaceContainerHighest );
		expect( theme.colors.selected ).toBe( MATERIAL.secondaryContainer );
		expect( theme.colors.floating ).toBe( MATERIAL.surfaceContainerHigh );
		expect( theme.colors.floatingForeground ).toBe( MATERIAL.onSurface );
		expect( theme.colors.floatingBorder ).toBe( MATERIAL.outlineVariant );
	} );

	it( 'keeps Studio brand, status and feedback colors', () => {
		const studio = studioThemes.light.colors;

		expect( theme.colors.accent ).toBe( studio.accent );
		expect( theme.colors.primary ).toBe( studio.primary );
		expect( theme.colors.statusRunning ).toBe( studio.statusRunning );
		expect( theme.colors.destructive ).toBe( studio.destructive );
		expect( theme.scheme ).toBe( 'light' );
	} );
} );
