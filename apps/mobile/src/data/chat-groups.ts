import type { ChatRow } from './chat-list';

// What the drawer puts first: chats whose agent waits for an answer, then
// chats at work, then the rest. A search has one group of its own.
export type ChatGroup = 'needs-you' | 'working' | 'rest' | 'results';

export interface ChatSection {
	group: ChatGroup;
	chats: ChatRow[];
}

// The chats in the drawer's groups, each in the order it came (newest first).
// Search results stay in one group. A group with no chat is left out.
export function groupChats( chats: ChatRow[], searching: boolean ): ChatSection[] {
	const sections: ChatSection[] = searching
		? [ { group: 'results', chats } ]
		: [
				{ group: 'needs-you', chats: chats.filter( ( chat ) => chat.activity === 'needs-answer' ) },
				{ group: 'working', chats: chats.filter( ( chat ) => chat.activity === 'working' ) },
				{ group: 'rest', chats: chats.filter( ( chat ) => chat.activity === null ) },
		  ];
	return sections.filter( ( section ) => section.chats.length > 0 );
}
