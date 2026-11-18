import { __ } from '@wordpress/i18n';

// Prompts the new-chat screen offers to start from. Tapping one puts it in the
// composer; the person still sends it.
export function starterPrompts(): string[] {
	return [
		__( 'Add a contact page with a form' ),
		__( 'Refresh the design of the homepage' ),
		__( 'Write an About page' ),
		__( 'Find out what slows the site down' ),
	];
}
