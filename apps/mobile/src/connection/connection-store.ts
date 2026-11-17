import { z } from 'zod';
import { createValueStore } from '../lib/value-store';
import type { KeyValueStorage } from '../lib/storage';

// The paired computer. The token is a secret: it is kept in secure storage and
// never shown or logged.
export interface Connection {
	baseUrl: string;
	token: string;
	deviceId: string;
	instanceId: string;
	label: string;
	// Milliseconds since the epoch. The computer refuses the token after this.
	expiresAt: number;
}

// Something the Pair screen must say about how the last pairing ended.
// - `unpaired`: the computer removed this phone.
// - `expired`: the device token passed its expiry.
// - `not-revoked`: the person forgot the computer while it did not answer, so
//   the computer still lists this phone.
export type ConnectionNotice = 'unpaired' | 'expired' | 'not-revoked';

export type ConnectionState =
	| { status: 'loading' }
	| { status: 'ready'; connection: Connection | null; notice: ConnectionNotice | null };

const STORAGE_KEY = 'studio.connection';

const connectionSchema = z.object( {
	baseUrl: z.string().min( 1 ),
	token: z.string().min( 1 ),
	deviceId: z.string().min( 1 ),
	instanceId: z.string().min( 1 ),
	label: z.string(),
	expiresAt: z.number(),
} );

// Holds the one paired computer and keeps it across app starts. v1 pairs with
// one computer at a time.
export function createConnectionStore(
	storage: KeyValueStorage,
	now: () => number = () => Date.now()
) {
	const state = createValueStore< ConnectionState >( { status: 'loading' } );

	// Forgets the computer. The screen changes at once; storage follows.
	async function clear( notice: ConnectionNotice | null = null ): Promise< void > {
		state.set( { status: 'ready', connection: null, notice } );
		try {
			await storage.removeItem( STORAGE_KEY );
		} catch {
			// Nothing more to do: the app already behaves as not paired.
		}
	}

	return {
		getState: state.get,
		subscribe: state.subscribe,

		// Reads the stored connection. Call once when the app starts.
		async load(): Promise< void > {
			let connection: Connection | null = null;
			let notice: ConnectionNotice | null = null;
			try {
				const raw = await storage.getItem( STORAGE_KEY );
				const parsed = raw ? connectionSchema.safeParse( JSON.parse( raw ) ) : null;
				if ( parsed?.success ) {
					if ( parsed.data.expiresAt > now() ) {
						connection = parsed.data;
					} else {
						notice = 'expired';
						await storage.removeItem( STORAGE_KEY );
					}
				}
			} catch {
				// Storage that cannot be read, or holds something else, means not paired.
			}
			state.set( { status: 'ready', connection, notice } );
		},

		async save( connection: Connection ): Promise< void > {
			await storage.setItem( STORAGE_KEY, JSON.stringify( connection ) );
			state.set( { status: 'ready', connection, notice: null } );
		},

		clear,

		// Forgets the computer because it refused `deviceId`, but only while that
		// device is still the paired one. An answer that arrives late, for a pairing
		// the phone already forgot or replaced, changes nothing.
		async clearIfCurrent( deviceId: string, notice: ConnectionNotice ): Promise< void > {
			const current = state.get();
			if ( current.status === 'ready' && current.connection?.deviceId === deviceId ) {
				await clear( notice );
			}
		},
	};
}
