import { entriesToTranscriptItems } from '@studio/agent/protocol/transcript/transcript-items';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createConnectionClient } from '../connection/connection';
import { createChatReader } from './chat-read';
import { NOTHING_LIVE, visibleEntries } from './chat-reply';
import { chatRows } from './chat-rows';
import { activityStore, liveStatusStore, openChat } from './live-connection';
import { chatKey } from './query-keys';
import type { LivePrompt } from './chat-reply';
import type { ChatRow } from './chat-rows';
import type { Connection } from '../connection/connection-store';

const NO_PROMPTS: LivePrompt[] = [];

export interface ChatView {
	rows: ChatRow[];
	// The error that kept a run from starting, which the computer does not keep
	// in the chat.
	runError: string | null;
	needsAnswer: boolean;
	isPending: boolean;
	isError: boolean;
	// Reads the chat again. Does nothing while the link is not live.
	refetch: () => void;
	toggleTurn: ( key: string ) => void;
}

// One chat as the phone shows it. Mount it once per chat (a `key` on the
// screen), so opening a chat always reads it again: the stream may have
// missed its events while another chat was open. What the stream adds follows
// the chosen chat (data/live-connection.ts).
export function useChat( connection: Connection, chatId: string ): ChatView {
	const status = useSyncExternalStore( liveStatusStore.subscribe, liveStatusStore.get );
	const query = useQuery( {
		// The read sends the device token: only while the link is live.
		enabled: status === 'live',
		staleTime: Infinity,
		// What tools returned can hold secrets. Keep a chat only while it is open.
		gcTime: 0,
		refetchOnMount: 'always',
		queryKey: chatKey( connection, chatId ),
		queryFn: ( { signal } ) =>
			createChatReader( createConnectionClient( connection ).get, openChat.mark )( chatId, signal ),
	} );

	const { data } = query;
	useEffect( () => {
		if ( data ) {
			openChat.settled( chatId, data.readAt );
		}
	}, [ chatId, data ] );

	const state = useSyncExternalStore( openChat.store.subscribe, openChat.store.get );
	const live = state.chatId === chatId ? state.live : NOTHING_LIVE;
	const prompts = state.chatId === chatId ? state.prompts : NO_PROMPTS;
	const activity = useSyncExternalStore( activityStore.subscribe, activityStore.get );
	const run = activity[ chatId ];
	const running = run !== undefined;
	const [ expandedTurns, setExpandedTurns ] = useState< ReadonlySet< string > >( () => new Set() );

	const rows = useMemo( () => {
		if ( ! data && live.replies.length === 0 && prompts.length === 0 ) {
			return [];
		}
		const entries = visibleEntries( data?.entries ?? [], data?.readAt ?? 0, live.replies, prompts );
		return chatRows(
			entriesToTranscriptItems( entries, { running, startedAt: null } ),
			expandedTurns
		);
	}, [ data, live.replies, prompts, running, expandedTurns ] );

	const toggleTurn = useCallback( ( key: string ) => {
		setExpandedTurns( ( current ) => {
			const next = new Set( current );
			if ( ! next.delete( key ) ) {
				next.add( key );
			}
			return next;
		} );
	}, [] );

	return {
		rows,
		runError: live.error,
		needsAnswer: run?.activity === 'needs-answer',
		isPending: query.isPending,
		isError: query.isError,
		refetch: () => {
			// `refetch` ignores `enabled`: check the link here.
			if ( liveStatusStore.get() === 'live' ) {
				void query.refetch();
			}
		},
		toggleTurn,
	};
}
