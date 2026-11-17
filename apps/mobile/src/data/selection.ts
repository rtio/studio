import { useSyncExternalStore } from 'react';
import { createValueStore } from '../lib/value-store';

// What the person chose in the drawer. A site id of null means "All chats".
const selectedSiteStore = createValueStore< string | null >( null );
const selectedChatStore = createValueStore< string | null >( null );

export const selectSite = selectedSiteStore.set;
export const selectedSiteId = selectedSiteStore.get;
export const selectChat = selectedChatStore.set;

export function resetSelection(): void {
	selectedSiteStore.set( null );
	selectedChatStore.set( null );
}

export function useSelectedSiteId(): string | null {
	return useSyncExternalStore( selectedSiteStore.subscribe, selectedSiteStore.get );
}

export function useSelectedChatId(): string | null {
	return useSyncExternalStore( selectedChatStore.subscribe, selectedChatStore.get );
}
