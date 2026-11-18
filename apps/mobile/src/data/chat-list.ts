import type { Session, Site } from './remote-schemas';
import type { ActivityMap, ChatActivity } from './run-activity';

// One chat as the drawer shows it.
export interface ChatRow {
	id: string;
	title: string;
	siteId: string | null;
	siteName: string | null;
	activity: ChatActivity | null;
	// When the chat's run started, by the computer's clock, if it has one.
	since?: number;
	// The chat acts on the live site, not on the local one.
	live: boolean;
}

// The name of a chat: the name the person gave it, else its first prompt, else
// `untitled`. The same rule as Studio on the computer.
export function chatTitle( session: Session, untitled: string ): string {
	const title = session.title?.trim() || session.firstPrompt?.trim() || untitled;
	return title.charAt( 0 ).toLocaleUpperCase() + title.slice( 1 );
}

// The chats the drawer lists, newest first. The computer also sends archived
// chats and drafts that have no prompt yet. They are left out, as on the
// computer. A draft that is working stays in, so a run is never hidden.
export function listChats(
	sessions: Session[],
	activity: ActivityMap,
	untitled: string
): ChatRow[] {
	return sessions
		.filter(
			( session ) => ! session.archived && ( session.firstPrompt || activity[ session.id ] )
		)
		.sort( ( a, b ) => ( a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0 ) )
		.map( ( session ) => ( {
			id: session.id,
			title: chatTitle( session, untitled ),
			siteId: session.ownerSiteId ?? null,
			siteName: session.ownerSiteName ?? null,
			activity: activity[ session.id ]?.activity ?? null,
			since: activity[ session.id ]?.since,
			live: session.activeEnvironment === 'live',
		} ) );
}

// The chats of one site. `siteId` null means all chats.
export function chatsOfSite( chats: ChatRow[], siteId: string | null ): ChatRow[] {
	return siteId === null ? chats : chats.filter( ( chat ) => chat.siteId === siteId );
}

// Search over all chats, by title: a chat matches when every word of the query
// is in its title. An empty query matches nothing.
export function searchChats( chats: ChatRow[], query: string ): ChatRow[] {
	const words = query.toLocaleLowerCase().split( /\s+/ ).filter( Boolean );
	if ( words.length === 0 ) {
		return [];
	}
	return chats.filter( ( chat ) => {
		const title = chat.title.toLocaleLowerCase();
		return words.every( ( word ) => title.includes( word ) );
	} );
}

// Applies the site of a `site-updated` event to the loaded list. A site the
// list does not have yet is added at the end.
export function withUpdatedSite( sites: Site[], updated: Site ): Site[] {
	return sites.some( ( site ) => site.id === updated.id )
		? sites.map( ( site ) => ( site.id === updated.id ? updated : site ) )
		: [ ...sites, updated ];
}
