import { initialAgentRunState } from '@studio/agent/protocol/transcript/run-state';
import { useSyncExternalStore } from 'react';
import { runControl } from './live-connection';
import type { RunNotice } from './run-control';
import type { AgentRunState } from '@studio/agent/protocol/transcript/run-state';

const NO_ANSWERS: Readonly< Record< string, string > > = {};

// The run state of a chat, or the idle state for none.
export function useRunState( chatId: string | null ): AgentRunState {
	const states = useSyncExternalStore( runControl.store.subscribe, runControl.store.getState );
	return ( chatId ? states[ chatId ] : undefined ) ?? initialAgentRunState;
}

// What went wrong in the chat outside the composer's own send, if anything.
export function useRunNotice( chatId: string | null ): RunNotice | null {
	const notices = useSyncExternalStore( runControl.notices.subscribe, runControl.notices.get );
	return ( chatId ? notices[ chatId ] : undefined ) ?? null;
}

// The answers the phone sent last in the chat, until a read has them.
export function useSentAnswers( chatId: string | null ): Readonly< Record< string, string > > {
	const sent = useSyncExternalStore( runControl.sentAnswers.subscribe, runControl.sentAnswers.get );
	return ( chatId ? sent[ chatId ] : undefined ) ?? NO_ANSWERS;
}
