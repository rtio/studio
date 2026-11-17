import { describe, expect, it, vi } from 'vitest';
import { createValueStore } from './value-store';

describe( 'createValueStore', () => {
	it( 'returns the initial value', () => {
		expect( createValueStore( 'first' ).get() ).toBe( 'first' );
	} );

	it( 'tells subscribers when the value changes', () => {
		const store = createValueStore( 1 );
		const listener = vi.fn();
		store.subscribe( listener );

		store.set( 2 );

		expect( store.get() ).toBe( 2 );
		expect( listener ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'does not tell subscribers when the value is the same', () => {
		const store = createValueStore( 1 );
		const listener = vi.fn();
		store.subscribe( listener );

		store.set( 1 );

		expect( listener ).not.toHaveBeenCalled();
	} );

	it( 'stops telling a subscriber after it unsubscribes', () => {
		const store = createValueStore( 1 );
		const listener = vi.fn();
		const unsubscribe = store.subscribe( listener );

		unsubscribe();
		store.set( 2 );

		expect( listener ).not.toHaveBeenCalled();
	} );
} );
