import type { ActiveRun } from './remote-schemas';

// What a chat is doing now. A chat that waits for an answer is also working,
// but the answer is what the person must act on, so it wins.
export type ChatActivity = 'working' | 'needs-answer';

// By chat id. A chat that is idle has no entry.
export type ActivityMap = Readonly< Record< string, ChatActivity > >;

// The state when the stream opens, from `GET /api/runs/active`. The stream
// cannot replay what it missed, so this is read again at every reconnect.
export function activityFromActiveRuns( runs: ActiveRun[] ): ActivityMap {
	const activity: Record< string, ChatActivity > = {};
	for ( const run of runs ) {
		activity[ run.sessionId ] = run.pendingQuestions?.length ? 'needs-answer' : 'working';
	}
	return activity;
}

function withActivity(
	activity: ActivityMap,
	sessionId: string,
	next: ChatActivity | null
): ActivityMap {
	if ( ( activity[ sessionId ] ?? null ) === next ) {
		// The same object, so nothing that reads it draws again. Most events of a
		// run are text arriving, which changes nothing here.
		return activity;
	}
	const { [ sessionId ]: _removed, ...rest } = activity;
	return next ? { ...rest, [ sessionId ]: next } : rest;
}

// Applies one event of the `agent` channel. `eventType` is `event.type`.
export function applyAgentEvent(
	activity: ActivityMap,
	sessionId: string,
	eventType: string
): ActivityMap {
	switch ( eventType ) {
		case 'run.started':
		case 'turn.started':
			return withActivity( activity, sessionId, 'working' );
		case 'question.asked':
			return withActivity( activity, sessionId, 'needs-answer' );
		case 'message':
			// The computer sends no event when a question is answered there. Text
			// arriving after a question means the agent got its answer.
			return activity[ sessionId ] === 'needs-answer'
				? withActivity( activity, sessionId, 'working' )
				: activity;
		case 'turn.completed':
		case 'run.interrupting':
		case 'run.interrupted':
		case 'run.exited':
			return withActivity( activity, sessionId, null );
		default:
			return activity;
	}
}
