// A value that code outside React can change and React can read with
// useSyncExternalStore. The connection, the theme choice and the Reduce
// Transparency setting each keep one.
export interface ValueStore< T > {
	get: () => T;
	set: ( next: T ) => void;
	subscribe: ( listener: () => void ) => () => void;
}

export function createValueStore< T >( initial: T ): ValueStore< T > {
	let value = initial;
	const listeners = new Set< () => void >();

	return {
		get: () => value,
		set: ( next ) => {
			if ( Object.is( next, value ) ) {
				return;
			}
			value = next;
			for ( const listener of [ ...listeners ] ) {
				listener();
			}
		},
		subscribe: ( listener ) => {
			listeners.add( listener );
			return () => {
				listeners.delete( listener );
			};
		},
	};
}
