import { z } from 'zod';

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
	activeEnvironment: z.enum( [ 'local', 'live' ] ).optional(),
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

// An agent event. `message` events wrap an event of the agent library, and
// `detail` is the type of that inner event (`message_start`, `turn_start`,
// `tool_execution_end`, ...). For `info` and `error`, `message` is plain text
// and there is no detail.
const agentEventSchema = z
	.object( { type: z.string(), message: z.unknown().optional() } )
	.transform( ( event ) => {
		const inner = event.message;
		const detail =
			typeof inner === 'object' &&
			inner !== null &&
			'type' in inner &&
			typeof inner.type === 'string'
				? inner.type
				: undefined;
		return { type: event.type, detail };
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
