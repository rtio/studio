// What the phone needs to pair: where the computer is and the one-time code.
// `instanceId` is in a scanned code only. It lets the phone check that the
// computer that answers is the one that showed the code.
export interface PairingLink {
	baseUrl: string;
	code: string;
	instanceId?: string;
}

// `studio remote` shows this as a QR code:
// studio-remote://pair?url=<base URL>&code=<code>&id=<instance id>
const PAIRING_URL_PREFIX = 'studio-remote://pair?';
const PAIRING_CODE_LENGTH = 12;

// Accepts what a person types ("192.168.1.20:8082") and what the QR code holds
// ("http://192.168.1.20:8082"). Returns scheme, host and port only, or null.
export function normalizeBaseUrl( input: string ): string | null {
	const trimmed = input.trim().replace( /\/+$/, '' );
	if ( ! trimmed ) {
		return null;
	}
	const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test( trimmed ) ? trimmed : `http://${ trimmed }`;
	const match = /^(https?):\/\/([^\s/?#@]+)$/i.exec( withScheme );
	if ( ! match ) {
		return null;
	}
	return `${ match[ 1 ].toLowerCase() }://${ match[ 2 ].toLowerCase() }`;
}

// The code is 12 letters and digits, shown as XXXX-XXXX-XXXX. The computer
// decides whether it is right; this only removes the separators.
export function normalizePairingCode( input: string ): string | null {
	const code = input.replace( /[\s-]/g, '' ).toUpperCase();
	return code.length === PAIRING_CODE_LENGTH && /^[0-9A-Z]+$/.test( code ) ? code : null;
}

// Builds a link from separate parts: the fields a person typed, or the query
// values of a pairing URL that the router already split.
export function pairingLinkFromParts( parts: {
	url?: string;
	code?: string;
	id?: string;
} ): PairingLink | null {
	const baseUrl = normalizeBaseUrl( parts.url ?? '' );
	const code = normalizePairingCode( parts.code ?? '' );
	if ( ! baseUrl || ! code ) {
		return null;
	}
	return parts.id ? { baseUrl, code, instanceId: parts.id } : { baseUrl, code };
}

function decodeQueryValue( value: string ): string | null {
	try {
		// The computer builds the URL with URLSearchParams, which writes a space as "+".
		return decodeURIComponent( value.replace( /\+/g, ' ' ) );
	} catch {
		return null;
	}
}

// Reads the text of a scanned QR code. Returns null for anything that is not a
// Studio pairing URL.
export function parsePairingUrl( input: string ): PairingLink | null {
	const trimmed = input.trim();
	if ( ! trimmed.toLowerCase().startsWith( PAIRING_URL_PREFIX ) ) {
		return null;
	}

	const values = new Map< string, string >();
	for ( const part of trimmed.slice( PAIRING_URL_PREFIX.length ).split( '&' ) ) {
		const separator = part.indexOf( '=' );
		if ( separator <= 0 ) {
			continue;
		}
		const value = decodeQueryValue( part.slice( separator + 1 ) );
		if ( value === null ) {
			return null;
		}
		values.set( part.slice( 0, separator ), value );
	}

	return pairingLinkFromParts( {
		url: values.get( 'url' ),
		code: values.get( 'code' ),
		id: values.get( 'id' ),
	} );
}
