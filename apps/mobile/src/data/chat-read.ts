import { parseChatEntries } from './remote-schemas';
import type { SessionEntry } from './remote-schemas';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

export interface ChatRead {
	entries: SessionEntry[];
	// The open chat's mark when the read started (open-chat.ts).
	readAt: number;
}

type Get = ( path: string, options: { signal?: AbortSignal } ) => Promise< unknown >;

// Reads one chat from the computer. The mark is noted before the request: a
// reply shown from the stream is replaced only by a read that started after
// it was complete.
export function createChatReader( get: Get, mark: () => number ) {
	return async ( chatId: string, signal?: AbortSignal ): Promise< ChatRead > => {
		const readAt = mark();
		const payload = await get( `/api/sessions/${ encodeURIComponent( chatId ) }`, { signal } );
		const entries = parseChatEntries( payload );
		if ( ! entries ) {
			throw new Error( 'The computer did not send a chat.' );
		}
		return { entries, readAt };
	};
}

// Asks the query cache to read a chat again. Only a query that is enabled
// reads, and the chat's query is enabled only while the link is live, so this
// sends nothing with the device token otherwise. A read on its way is not
// stopped; the open chat asks again if it started too early.
export function requestChatRead( queryClient: QueryClient, queryKey: QueryKey ): Promise< void > {
	return queryClient.invalidateQueries( { queryKey }, { cancelRefetch: false } );
}
