import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../lib/storage';
import { createColorSchemePreference } from './color-scheme-preference';

describe( 'createColorSchemePreference', () => {
	it( 'follows the system until a choice is loaded or made', () => {
		const apply = vi.fn();
		const preference = createColorSchemePreference( createMemoryStorage(), apply );

		expect( preference.get() ).toBe( 'system' );
		expect( apply ).not.toHaveBeenCalled();
	} );

	it( 'loads a saved choice and applies it', async () => {
		const apply = vi.fn();
		const storage = createMemoryStorage( { 'studio.color-scheme': 'dark' } );
		const preference = createColorSchemePreference( storage, apply );

		await preference.load();

		expect( preference.get() ).toBe( 'dark' );
		expect( apply ).toHaveBeenCalledWith( 'dark' );
	} );

	it( 'ignores a saved value it does not know', async () => {
		const apply = vi.fn();
		const storage = createMemoryStorage( { 'studio.color-scheme': 'sepia' } );
		const preference = createColorSchemePreference( storage, apply );

		await preference.load();

		expect( preference.get() ).toBe( 'system' );
		expect( apply ).not.toHaveBeenCalled();
	} );

	it( 'applies and saves a new choice', async () => {
		const apply = vi.fn();
		const storage = createMemoryStorage();
		const preference = createColorSchemePreference( storage, apply );

		await preference.set( 'light' );

		expect( preference.get() ).toBe( 'light' );
		expect( apply ).toHaveBeenCalledWith( 'light' );
		expect( await storage.getItem( 'studio.color-scheme' ) ).toBe( 'light' );
	} );
} );
