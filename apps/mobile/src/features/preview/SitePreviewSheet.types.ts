import type { Connection } from '../../connection/connection-store';
import type { Site } from '../../data/remote-schemas';

export interface SitePreviewSheetProps {
	connection: Connection;
	site: Site;
	open: boolean;
	onClose: () => void;
}
