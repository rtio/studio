import type { ChatEvent } from './chat-reply';

// The moments of a run the person feels on the phone.
export type HapticMoment = 'needs-answer' | 'finished' | 'failed';

// Which events of the live stream the person feels: the agent asked a
// question, or its run ended. A turn that ends well is felt at once. A failure
// is felt only when the run exits, the computer's last event of a run: a
// stopped turn also ends with an error, and the computer says the run was
// stopped (`run.interrupted`) right before it exits, also when an earlier
// `run.interrupting` was lost in a reconnect. A run that exits with an error
// before its turn ended (the agent crashed) is felt as a failure too.
export function createHapticMoments() {
	// Runs the computer stopped: their end is felt as nothing.
	const stopping = new Set< string >();
	// Runs whose turn ended for good (not paused for answers), and how.
	const turnEnded = new Map< string, 'success' | 'failure' >();

	return {
		moment( event: ChatEvent ): HapticMoment | null {
			const { runId } = event;
			switch ( event.type ) {
				case 'question.asked':
					return 'needs-answer';
				case 'run.interrupting':
				case 'run.interrupted':
					stopping.add( runId );
					return null;
				case 'turn.completed':
					if ( event.status === 'success' ) {
						turnEnded.set( runId, 'success' );
						return stopping.has( runId ) ? null : 'finished';
					}
					// `paused`: the turn waits for answers, felt when it asked.
					if ( event.status === 'error' || event.status === 'max_turns' ) {
						turnEnded.set( runId, 'failure' );
					}
					return null;
				case 'run.exited': {
					const ended = turnEnded.get( runId );
					const failed =
						! stopping.has( runId ) &&
						( ended === 'failure' || ( ended === undefined && event.status === 'error' ) );
					stopping.delete( runId );
					turnEnded.delete( runId );
					return failed ? 'failed' : null;
				}
				default:
					return null;
			}
		},
		// Another computer, or none.
		clear() {
			stopping.clear();
			turnEnded.clear();
		},
	};
}
