import { z } from 'zod';
import type { entriesToTranscriptItems } from '@studio/agent/protocol/transcript/transcript-items';

// A saved entry of a chat, as the shared transcript code takes it. Read from
// that code, so the phone depends on the agent package and not on the agent
// library behind it.
export type SessionEntry = Parameters< typeof entriesToTranscriptItems >[ 0 ][ number ];

// The shapes remote mode sends, cut down to what the phone uses. zod drops
// every other key, so the computer's file paths in a chat summary (`filePath`,
// `ownerSitePath`) never stay in the phone's memory.

const siteSchema = z.object( {
	id: z.string(),
	name: z.string(),
	running: z.boolean(),
} );
export type Site = z.infer< typeof siteSchema >;

const sessionSchema = z.object( {
	id: z.string(),
	// ISO 8601, UTC. The computer sorts chats by it, newest first.
	updatedAt: z.string(),
	// A name the person gave the chat on the computer.
	title: z.string().optional(),
	firstPrompt: z.string().optional(),
	archived: z.boolean().optional(),
	ownerSiteId: z.string().optional(),
	ownerSiteName: z.string().optional(),
	// 'local' or 'live'. Read as text, so a target a newer Studio adds does not
	// make the chat vanish from the list.
	activeEnvironment: z.string().optional(),
} );
export type Session = z.infer< typeof sessionSchema >;

const activeRunSchema = z.object( {
	runId: z.string(),
	sessionId: z.string(),
	pendingQuestions: z.array( z.unknown() ).optional(),
} );
export type ActiveRun = z.infer< typeof activeRunSchema >;

// Reads a list the computer sent. An item with the wrong shape is skipped, so
// one odd item does not empty the whole list.
function parseList< Item >( schema: z.ZodType< Item >, payload: unknown ): Item[] {
	if ( ! Array.isArray( payload ) ) {
		return [];
	}
	const items: Item[] = [];
	for ( const entry of payload ) {
		const parsed = schema.safeParse( entry );
		if ( parsed.success ) {
			items.push( parsed.data );
		}
	}
	return items;
}

export const parseSites = ( payload: unknown ) => parseList( siteSchema, payload );
export const parseSessions = ( payload: unknown ) => parseList( sessionSchema, payload );
export const parseActiveRuns = ( payload: unknown ) => parseList( activeRunSchema, payload );

// The saved entries of one chat, from `GET /api/sessions/:id`. The transcript
// code reads them as the agent library wrote them, so they are kept as they
// are, except what tools returned (see `withoutToolOutput`).
const chatSchema = z.object( { entries: z.array( z.unknown() ) } );

function isRecord( value: unknown ): value is Record< string, unknown > {
	return typeof value === 'object' && value !== null;
}

// An entry with what the transcript code relies on: an id and a time, a
// custom entry's kind, and the content of an assistant message or a tool
// result.
function isReadableEntry( entry: unknown ): entry is SessionEntry {
	if (
		! isRecord( entry ) ||
		typeof entry.type !== 'string' ||
		typeof entry.id !== 'string' ||
		typeof entry.timestamp !== 'string'
	) {
		return false;
	}
	if ( entry.type === 'custom' ) {
		return typeof entry.customType === 'string';
	}
	if ( entry.type !== 'message' ) {
		return true;
	}
	const { message } = entry;
	if ( ! isRecord( message ) || typeof message.role !== 'string' ) {
		return false;
	}
	return (
		( message.role !== 'assistant' && message.role !== 'toolResult' ) ||
		Array.isArray( message.content )
	);
}

// What a tool returned can be long (a screenshot in base64) and can hold
// secrets (the password of a site the agent created). The phone shows a step
// as one line and needs only whether it failed, so it keeps nothing else.
function withoutToolOutput( entry: SessionEntry ): SessionEntry {
	if ( entry.type !== 'message' || entry.message.role !== 'toolResult' ) {
		return entry;
	}
	const { details: _details, ...message } = entry.message;
	return { ...entry, message: { ...message, content: [] } };
}

// Returns null when the answer is not a chat at all. An entry the transcript
// cannot read is skipped, so one odd entry does not hide the chat.
export function parseChatEntries( payload: unknown ): SessionEntry[] | null {
	const parsed = chatSchema.safeParse( payload );
	return parsed.success
		? parsed.data.entries.filter( isReadableEntry ).map( withoutToolOutput )
		: null;
}

// An agent event. `message` events wrap an event of the agent library
// (`message_update`, `message_end`, `tool_execution_end`, ...): `inner` is that
// event's type and the message it carries. For `info` and `error`, `message`
// is plain text, kept as `text`.
const agentEventSchema = z
	.object( {
		type: z.string(),
		timestamp: z.string().optional(),
		message: z.unknown().optional(),
	} )
	.transform( ( event ) => {
		const wrapped = event.message;
		const inner =
			typeof wrapped === 'object' &&
			wrapped !== null &&
			'type' in wrapped &&
			typeof wrapped.type === 'string'
				? { type: wrapped.type, message: 'message' in wrapped ? wrapped.message : undefined }
				: undefined;
		return {
			type: event.type,
			timestamp: event.timestamp,
			inner,
			text: typeof wrapped === 'string' ? wrapped : undefined,
		};
	} );

const streamMessageSchema = z.discriminatedUnion( 'channel', [
	z.object( {
		channel: z.literal( 'agent' ),
		payload: z.object( {
			runId: z.string(),
			sessionId: z.string(),
			event: agentEventSchema,
		} ),
	} ),
	z.object( {
		channel: z.literal( 'site-event' ),
		payload: z.object( {
			event: z.string(),
			siteId: z.string(),
			// Absent when the site is gone.
			site: siteSchema.optional(),
		} ),
	} ),
] );
export type StreamMessage = z.infer< typeof streamMessageSchema >;

// Reads one event of the stream: `{"channel": ..., "payload": ...}`. Returns
// null for a channel the phone does not use and for anything it cannot read.
export function parseStreamMessage( data: string ): StreamMessage | null {
	let json: unknown;
	try {
		json = JSON.parse( data );
	} catch {
		return null;
	}
	const parsed = streamMessageSchema.safeParse( json );
	return parsed.success ? parsed.data : null;
}
