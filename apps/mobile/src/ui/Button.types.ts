type ButtonVariant = 'primary' | 'secondary' | 'destructive';

export interface ButtonProps {
	label: string;
	onPress: () => void;
	variant?: ButtonVariant;
	disabled?: boolean;
}
