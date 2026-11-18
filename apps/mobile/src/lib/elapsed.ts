// A duration as a clock shows it: `0:42`, `12:05`, `1:02:03`. A negative
// duration (a clock on the computer ahead of the phone's) shows as `0:00`.
export function formatElapsed( ms: number ): string {
	const seconds = Math.max( 0, Math.floor( ms / 1000 ) );
	const hours = Math.floor( seconds / 3600 );
	const minutes = Math.floor( ( seconds % 3600 ) / 60 );
	const rest = String( seconds % 60 ).padStart( 2, '0' );
	return hours > 0
		? `${ hours }:${ String( minutes ).padStart( 2, '0' ) }:${ rest }`
		: `${ minutes }:${ rest }`;
}
