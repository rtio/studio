export interface ConfirmDialogProps {
	visible: boolean;
	title: string;
	message: string;
	confirmLabel: string;
	cancelLabel: string;
	// The confirm action removes something.
	destructive?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}
