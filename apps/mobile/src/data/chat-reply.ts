import { streamingReplyEntry } from '@studio/agent/protocol/transcript/streaming-reply';
import type { SessionEntry } from './remote-schemas';

// One event of a run in the open chat, cut down to what the chat needs.
export interface ChatEvent {
	runId: string;
	// `event.type`: `run.started`, `message`, `question.asked`, ...
	type: string;
	timestamp?: string;
	// For a `message` event: the agent library's own event (`message_update`,
	// `message_end`, ...) and the message it carries.
	inner?: { type: string; message?: unknown };
	// For an `error` event: its text.
	text?: string;
}

// An assistant message the stream showed. `endedAt` is the mark of its
// `message_end` (see `applyChatEvent`). The computer has saved the message by
// then, so a read of the chat that started at that mark or later has it.
export interface LiveReply {
	runId: string;
	timestamp: string;
	message: unknown;
	endedAt: number | null;
}

// What the stream adds to the open chat on top of what the computer saved.
export interface ChatLive {
	// The run the chat follows. An event of another run is a late event of a
	// run that was stopped. Null when the followed run ended, or when the stream
	// opened again and may have missed the start of the next one: the next
	// event that is not an end takes its run.
	runId: string | null;
	// The replies a read may not have yet, oldest first. Only the last one can
	// still be written.
	replies: LiveReply[];
	// The last error of the run. The computer saves an error of the agent with
	// its turn, but not an error that kept the run from starting.
	error: string | null;
}

export const NOTHING_LIVE: ChatLive = { runId: null, replies: [], error: null };

function isRecord( value: unknown ): value is Record< string, unknown > {
	return typeof value === 'object' && value !== null;
}

// An assistant message the transcript code can read: its content is a list of
// blocks, and a text block has text.
function isAssistantMessage( message: unknown ): boolean {
	return (
		isRecord( message ) &&
		message.role === 'assistant' &&
		Array.isArray( message.content ) &&
		message.content.every(
			( block ) =>
				isRecord( block ) &&
				typeof block.type === 'string' &&
				( block.type !== 'text' || typeof block.text === 'string' )
		)
	);
}

// The events after which the chat on the computer has new entries. The agent
// library saves a message right after `message_end`; Studio saves questions
// and artifacts before it sends their events, and closes the turn before
// `turn.completed`.
const SAVED_BEFORE = new Set( [
	'question.asked',
	'chat.artifact',
	'turn.completed',
	'run.interrupted',
	'run.exited',
] );

function endLast( replies: LiveReply[], mark: number ): LiveReply[] {
	const last = replies.at( -1 );
	return last && last.endedAt === null
		? [ ...replies.slice( 0, -1 ), { ...last, endedAt: mark } ]
		: replies;
}

// Applies one event of the open chat. `mark` is a number that goes up with
// each event; a read of the chat notes the mark it started at. `read` says the
// chat changed on the computer, so the phone should read it again.
export function applyChatEvent(
	live: ChatLive,
	event: ChatEvent,
	mark: number
): { live: ChatLive; read: boolean } {
	if ( event.type === 'run.started' ) {
		return { live: { ...NOTHING_LIVE, runId: event.runId }, read: false };
	}
	if ( live.runId !== null && event.runId !== live.runId ) {
		return { live, read: false };
	}
	const follow = ( next: Partial< ChatLive > ): ChatLive => ( {
		...live,
		runId: event.runId,
		...next,
	} );

	if ( event.type === 'error' ) {
		return { live: follow( { error: event.text ?? null } ), read: false };
	}
	if ( event.type === 'message' && event.inner ) {
		const { type, message } = event.inner;
		const last = live.replies.at( -1 );
		const writing = last !== undefined && last.endedAt === null;
		const rest = writing ? live.replies.slice( 0, -1 ) : live.replies;
		const timestamp = event.timestamp ?? last?.timestamp ?? new Date( 0 ).toISOString();
		if ( type === 'message_update' && isAssistantMessage( message ) ) {
			const reply = { runId: event.runId, timestamp, message, endedAt: null };
			return { live: follow( { replies: [ ...rest, reply ] } ), read: false };
		}
		if ( type === 'message_end' && isAssistantMessage( message ) ) {
			const reply = {
				runId: event.runId,
				timestamp: writing ? last.timestamp : timestamp,
				message,
				endedAt: mark,
			};
			return { live: follow( { replies: [ ...rest, reply ] } ), read: true };
		}
		// The person's prompt and tool results are saved at their end too.
		return { live, read: type === 'message_end' };
	}
	if ( SAVED_BEFORE.has( event.type ) ) {
		const ending = event.type === 'run.exited' || event.type === 'run.interrupted';
		// The error the agent hit is saved with the turn and shows there.
		const error = event.type === 'turn.completed' ? null : live.error;
		// A run that ends while a reply streams does not finish that reply. The
		// next read shows what was saved.
		const replies = ending ? endLast( live.replies, mark ) : live.replies;
		const runId = ending ? null : event.runId;
		return { live: { ...live, runId, replies, error }, read: true };
	}
	return { live, read: false };
}

// For a stream that opened again after it missed events: the reply being
// written is treated as complete, so the next read replaces it, and the chat
// follows whichever run sends events next.
export function endReply( live: ChatLive, mark: number ): ChatLive {
	const replies = endLast( live.replies, mark );
	return replies === live.replies && live.runId === null ? live : { ...live, runId: null, replies };
}

function isCovered( reply: LiveReply, readAt: number ): boolean {
	return reply.endedAt !== null && readAt >= reply.endedAt;
}

// Drops the replies that a read which started at `readAt` has.
export function withoutRead( live: ChatLive, readAt: number ): ChatLive {
	const replies = live.replies.filter( ( reply ) => ! isCovered( reply, readAt ) );
	return replies.length === live.replies.length ? live : { ...live, replies };
}

// The chat as the phone shows it: what the computer saved, read at `readAt`,
// and the replies the stream has shown since, until a read has them.
export function visibleEntries(
	saved: SessionEntry[],
	readAt: number,
	replies: LiveReply[]
): SessionEntry[] {
	const shown = replies.filter( ( reply ) => ! isCovered( reply, readAt ) );
	if ( shown.length === 0 ) {
		return saved;
	}
	return [
		...saved,
		...shown.map( ( reply, index ) => {
			const entryId = `live-${ reply.runId }-${ index }`;
			if ( reply.endedAt === null ) {
				return streamingReplyEntry( {
					entryId,
					timestamp: reply.timestamp,
					message: reply.message,
				} );
			}
			// Complete, but not read yet: shown as the saved message will be.
			return {
				type: 'message',
				id: entryId,
				parentId: null,
				timestamp: reply.timestamp,
				message: reply.message,
			} as unknown as SessionEntry;
		} ),
	];
}
