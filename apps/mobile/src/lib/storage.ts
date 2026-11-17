// The small part of a key-value store that the app needs. On a phone it is the
// secure storage of the system (lib/secure-storage.ts). Tests pass a Map.
export interface KeyValueStorage {
	getItem: ( key: string ) => Promise< string | null >;
	setItem: ( key: string, value: string ) => Promise< void >;
	removeItem: ( key: string ) => Promise< void >;
}

export function createMemoryStorage( initial: Record< string, string > = {} ): KeyValueStorage {
	const items = new Map( Object.entries( initial ) );

	return {
		getItem: async ( key ) => items.get( key ) ?? null,
		setItem: async ( key, value ) => {
			items.set( key, value );
		},
		removeItem: async ( key ) => {
			items.delete( key );
		},
	};
}
