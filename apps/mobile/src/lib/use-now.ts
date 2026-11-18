import { useEffect, useState } from 'react';

// The time now, in milliseconds, updated every second while `ticking`.
export function useNow( ticking: boolean ): number {
	const [ now, setNow ] = useState( Date.now );
	useEffect( () => {
		if ( ! ticking ) {
			return;
		}
		setNow( Date.now() );
		const timer = setInterval( () => setNow( Date.now() ), 1000 );
		return () => clearInterval( timer );
	}, [ ticking ] );
	return now;
}
