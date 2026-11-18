import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../lib/storage';
import { createHapticsPreference } from './haptics-preference';

describe( 'createHapticsPreference', () => {
	it( 'is on until a choice is loaded or made', () => {
		expect( createHapticsPreference( createMemoryStorage() ).get() ).toBe( true );
	} );

	it( 'loads a saved choice, and ignores a value it does not know', async () => {
		const off = createHapticsPreference( createMemoryStorage( { 'studio.haptics': 'off' } ) );
		const odd = createHapticsPreference( createMemoryStorage( { 'studio.haptics': 'loud' } ) );

		await off.load();
		await odd.load();

		expect( off.get() ).toBe( false );
		expect( odd.get() ).toBe( true );
	} );

	it( 'saves a new choice', async () => {
		const storage = createMemoryStorage();
		const preference = createHapticsPreference( storage );

		await preference.set( false );

		expect( preference.get() ).toBe( false );
		expect( await storage.getItem( 'studio.haptics' ) ).toBe( 'off' );
	} );
} );
