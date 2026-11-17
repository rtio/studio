const FIRST_DELAY_MS = 1_000;
const LONGEST_DELAY_MS = 30_000;

// How long to wait before the next try to reach the computer: 1 s, then double
// each time, up to 30 s. `failures` is how many tries failed in a row before
// this wait.
export function backoffDelay( failures: number ): number {
	return Math.min( LONGEST_DELAY_MS, FIRST_DELAY_MS * 2 ** Math.max( 0, failures ) );
}
