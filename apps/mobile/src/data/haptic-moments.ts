import type { ChatEvent } from './chat-reply';

// The moments of a run the person feels on the phone.
export type HapticMoment = 'needs-answer' | 'finished' | 'failed';

// Which events of the live stream the person feels: the agent asked a
// question, or its turn ended, well or not. A turn that ends after the computer
// said the run is stopping (`run.interrupting`) is felt as nothing: a stopped
// turn ends with an error. A run that exits with an error before its turn
// ended (the agent crashed) is felt as a failure when it exits, unless the
// computer stopped it (`run.interrupted` comes right before a stopped run
// exits).
export function createHapticMoments() {
	// Runs the computer said it is stopping, or stopped.
	const stopping = new Set< string >();
	// Runs whose turn ended for good (not paused for answers).
	const turnEnded = new Set< string >();

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
					// `paused`: the turn waits for answers, felt when it asked.
					if ( event.status === 'paused' ) {
						return null;
					}
					turnEnded.add( runId );
					if ( stopping.has( runId ) ) {
						return null;
					}
					if ( event.status === 'success' ) {
						return 'finished';
					}
					return event.status === 'error' || event.status === 'max_turns' ? 'failed' : null;
				case 'run.exited': {
					// The computer's last event of a run.
					const crashed =
						event.status === 'error' && ! turnEnded.has( runId ) && ! stopping.has( runId );
					stopping.delete( runId );
					turnEnded.delete( runId );
					return crashed ? 'failed' : null;
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
