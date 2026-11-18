import { createValueStore } from '../lib/value-store';

interface SheetAction {
	label: string;
	onPress: () => void;
}

export interface SheetRequest {
	actions: SheetAction[];
}

// The actions to offer now, if any. `ActionSheetHost` shows them the way the
// platform does.
export const actionSheetStore = createValueStore< SheetRequest | null >( null );

export function openActionSheet( request: SheetRequest ): void {
	actionSheetStore.set( request );
}

export function closeActionSheet(): void {
	actionSheetStore.set( null );
}
