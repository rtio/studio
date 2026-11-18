import { useSyncExternalStore } from 'react';
import { createValueStore } from '../../lib/value-store';

// The question whose own "Other" option the person chose: the composer then
// answers it with what they type.
const armedStore = createValueStore< { chatId: string; question: string } | null >( null );

export function armQuestion( chatId: string, question: string ): void {
	armedStore.set( { chatId, question } );
}

export function disarmQuestion(): void {
	armedStore.set( null );
}

export function useArmedQuestion( chatId: string | null ): string | null {
	const armed = useSyncExternalStore( armedStore.subscribe, armedStore.get );
	return armed && armed.chatId === chatId ? armed.question : null;
}
