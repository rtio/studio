// From this usable width the drawer sits beside the chat.
const WIDE_MIN_WIDTH = 720;
// The widest the chat's messages and the composer get, and the widest a plain
// screen's content gets. Wider, they sit centered.
export const READING_MAX_WIDTH = 720;
export const PLAIN_MAX_WIDTH = 560;

interface WindowMetrics {
	width: number;
	insets: { left: number; right: number };
}

export interface Layout {
	// The window's width without its side safe areas, where the system draws:
	// the status column of an iPhone Duo, for example.
	usableWidth: number;
	drawerPinned: boolean;
	// The side safe areas that the screen beside the drawer keeps out of. The
	// pinned drawer covers the left one.
	sideInsets: { left: number; right: number };
}

// What the window's width allows. No screen asks which device it runs on.
export function deriveLayout( { width, insets }: WindowMetrics ): Layout {
	const usableWidth = width - insets.left - insets.right;
	const drawerPinned = usableWidth >= WIDE_MIN_WIDTH;
	return {
		usableWidth,
		drawerPinned,
		sideInsets: { left: drawerPinned ? 0 : insets.left, right: insets.right },
	};
}
