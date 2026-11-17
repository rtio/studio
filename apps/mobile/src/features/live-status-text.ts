import { __, sprintf } from '@wordpress/i18n';
import type { LiveStatus } from '../data/live-status';
import type { ThemeColors } from '../theme/theme';

// What the app says about its link to the paired computer, in one line.
export function liveStatusText( status: LiveStatus, computer: string ): string {
	switch ( status ) {
		case 'live':
			/* translators: %s: the name of the paired computer. */
			return sprintf( __( 'Connected to %s' ), computer );
		case 'reconnecting':
			return __( 'Can’t reach your computer. Trying again…' );
		case 'wrong-computer':
			return __( 'Another computer answers at this address.' );
		case 'connecting':
		case 'off':
			/* translators: %s: the name of the paired computer. */
			return sprintf( __( 'Connecting to %s…' ), computer );
	}
}

// The color of the dot next to that line.
export function liveStatusColor( status: LiveStatus ): keyof ThemeColors {
	switch ( status ) {
		case 'live':
			return 'statusRunning';
		case 'reconnecting':
		case 'wrong-computer':
			return 'destructiveFill';
		case 'connecting':
		case 'off':
			return 'statusTransitioning';
	}
}
