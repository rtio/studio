import { __, sprintf } from '@wordpress/i18n';
import type { ConnectionHistory } from '../../data/connection-history';
import type { LiveStatus } from '../../data/live-status';

export interface DiagnosticsInput {
	appVersion: string;
	platform: string;
	computer: string;
	// The computer's address, without the token.
	address: string;
	status: LiveStatus;
	history: ConnectionHistory;
}

function time( ms: number | null ): string {
	return ms === null ? __( 'never' ) : new Date( ms ).toISOString();
}

function lastLive( input: DiagnosticsInput ): string {
	return input.status === 'live' ? __( 'now' ) : time( input.history.lastLiveAt );
}

// What "Copy diagnostics" copies: enough to tell what the phone tried and when,
// and no secret (no pairing code, no device token).
export function diagnosticsText( input: DiagnosticsInput ): string {
	const { history } = input;
	const problem = history.lastProblem
		? `${ history.lastProblem.status } ${ time( history.lastProblem.at ) }`
		: __( 'none' );
	return [
		/* translators: 1: app version, 2: platform and system version. */
		sprintf( __( 'Studio Mobile %1$s on %2$s' ), input.appVersion, input.platform ),
		/* translators: 1: name of the computer, 2: its address. */
		sprintf( __( 'Computer: %1$s at %2$s' ), input.computer, input.address ),
		/* translators: %s: a link state such as live or reconnecting. */
		sprintf( __( 'Link: %s' ), input.status ),
		/* translators: %s: a date and time, now, or never. */
		sprintf( __( 'Last live: %s' ), lastLive( input ) ),
		/* translators: %s: a link state and its time, or none. */
		sprintf( __( 'Last problem: %s' ), problem ),
	].join( '\n' );
}
