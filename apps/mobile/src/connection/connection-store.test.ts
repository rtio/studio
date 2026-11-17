import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../lib/storage';
import { createConnectionStore } from './connection-store';
import type { Connection } from './connection-store';

const NOW = 1_800_000_000_000;

const CONNECTION: Connection = {
	baseUrl: 'http://10.0.0.5:8082',
	token: 'device-token',
	deviceId: 'device-1',
	instanceId: 'instance-1',
	label: 'Work laptop',
	expiresAt: NOW + 1_000,
};

const STORED = { 'studio.connection': JSON.stringify( CONNECTION ) };

describe( 'createConnectionStore', () => {
	it( 'is loading until the stored connection is read', () => {
		const store = createConnectionStore( createMemoryStorage(), () => NOW );

		expect( store.getState() ).toEqual( { status: 'loading' } );
	} );

	it( 'is ready with no connection when nothing is stored', async () => {
		const store = createConnectionStore( createMemoryStorage(), () => NOW );

		await store.load();

		expect( store.getState() ).toEqual( { status: 'ready', connection: null, notice: null } );
	} );

	it( 'loads a stored connection', async () => {
		const store = createConnectionStore( createMemoryStorage( STORED ), () => NOW );

		await store.load();

		expect( store.getState() ).toEqual( { status: 'ready', connection: CONNECTION, notice: null } );
	} );

	it( 'drops a stored connection whose token has expired, and says why', async () => {
		const storage = createMemoryStorage( STORED );
		const store = createConnectionStore( storage, () => CONNECTION.expiresAt );

		await store.load();

		expect( store.getState() ).toEqual( { status: 'ready', connection: null, notice: 'expired' } );
		expect( await storage.getItem( 'studio.connection' ) ).toBeNull();
	} );

	it( 'reads stored text that is not a connection as not paired', async () => {
		const broken = createConnectionStore(
			createMemoryStorage( { 'studio.connection': '{not json' } ),
			() => NOW
		);
		const incomplete = createConnectionStore(
			createMemoryStorage( { 'studio.connection': JSON.stringify( { baseUrl: 'http://x' } ) } ),
			() => NOW
		);

		await broken.load();
		await incomplete.load();

		expect( broken.getState() ).toEqual( { status: 'ready', connection: null, notice: null } );
		expect( incomplete.getState() ).toEqual( { status: 'ready', connection: null, notice: null } );
	} );

	it( 'saves a new connection and tells subscribers', async () => {
		const storage = createMemoryStorage();
		const store = createConnectionStore( storage, () => NOW );
		await store.load();
		const listener = vi.fn();
		store.subscribe( listener );

		await store.save( CONNECTION );

		expect( store.getState() ).toEqual( { status: 'ready', connection: CONNECTION, notice: null } );
		expect( JSON.parse( ( await storage.getItem( 'studio.connection' ) ) ?? '' ) ).toEqual(
			CONNECTION
		);
		expect( listener ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'clears the connection from memory and storage, with the reason', async () => {
		const storage = createMemoryStorage( STORED );
		const store = createConnectionStore( storage, () => NOW );
		await store.load();

		await store.clear( 'unpaired' );

		expect( store.getState() ).toEqual( { status: 'ready', connection: null, notice: 'unpaired' } );
		expect( await storage.getItem( 'studio.connection' ) ).toBeNull();
	} );

	it( 'reads as not paired when storage cannot be read', async () => {
		const storage = createMemoryStorage( STORED );
		storage.getItem = async () => {
			throw new Error( 'storage is locked' );
		};
		const store = createConnectionStore( storage, () => NOW );

		await store.load();

		expect( store.getState() ).toEqual( { status: 'ready', connection: null, notice: null } );
	} );

	it( 'does not report a connection it could not save', async () => {
		const storage = createMemoryStorage();
		storage.setItem = async () => {
			throw new Error( 'storage is locked' );
		};
		const store = createConnectionStore( storage, () => NOW );
		await store.load();

		await expect( store.save( CONNECTION ) ).rejects.toThrow( 'storage is locked' );
		expect( store.getState() ).toEqual( { status: 'ready', connection: null, notice: null } );
	} );

	it( 'clears the connection when the device that was refused is still the paired one', async () => {
		const storage = createMemoryStorage( STORED );
		const store = createConnectionStore( storage, () => NOW );
		await store.load();

		await store.clearIfCurrent( CONNECTION.deviceId, 'unpaired' );

		expect( store.getState() ).toEqual( { status: 'ready', connection: null, notice: 'unpaired' } );
		expect( await storage.getItem( 'studio.connection' ) ).toBeNull();
	} );

	it( 'keeps a newer pairing when an older device is refused', async () => {
		const storage = createMemoryStorage( STORED );
		const store = createConnectionStore( storage, () => NOW );
		await store.load();

		await store.clearIfCurrent( 'device-from-an-older-pairing', 'unpaired' );

		expect( store.getState() ).toEqual( { status: 'ready', connection: CONNECTION, notice: null } );
		expect( await storage.getItem( 'studio.connection' ) ).not.toBeNull();
	} );

	it( 'does not add a notice when a device is refused after the phone forgot the computer', async () => {
		const store = createConnectionStore( createMemoryStorage( STORED ), () => NOW );
		await store.load();
		await store.clear();

		await store.clearIfCurrent( CONNECTION.deviceId, 'unpaired' );

		expect( store.getState() ).toEqual( { status: 'ready', connection: null, notice: null } );
	} );

	it( 'keeps the notice when a forget ends after the phone was already unpaired', async () => {
		const store = createConnectionStore( createMemoryStorage( STORED ), () => NOW );
		await store.load();
		await store.clearIfCurrent( CONNECTION.deviceId, 'unpaired' );

		await store.clearIfCurrent( CONNECTION.deviceId, null );

		expect( store.getState() ).toEqual( { status: 'ready', connection: null, notice: 'unpaired' } );
	} );

	it( 'still clears the connection in memory when storage fails', async () => {
		const storage = createMemoryStorage( STORED );
		const store = createConnectionStore( storage, () => NOW );
		await store.load();
		storage.removeItem = async () => {
			throw new Error( 'storage is locked' );
		};

		await store.clear();

		expect( store.getState() ).toEqual( { status: 'ready', connection: null, notice: null } );
	} );
} );
