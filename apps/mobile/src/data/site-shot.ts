import { z } from 'zod';

// Why the computer sent no image: the site is stopped, it has no browser to
// take one, or taking it failed.
type NoShotReason = 'stopped' | 'no-browser' | 'failed';

export type SiteShot = { image: string } | { image: null; reason: NoShotReason };

// Only an image inside the answer. The phone never loads an address the
// computer names: that request would carry nothing, but the page would.
const imageSchema = z.string().regex( /^data:image\/(?:jpeg|png|webp);base64,/ );

const shotSchema = z.union( [
	z.object( { image: imageSchema } ),
	z.object( {
		image: z.null(),
		reason: z.enum( [ 'stopped', 'no-browser', 'failed' ] ).catch( 'failed' ),
	} ),
] );

// Reads the computer's answer. An answer the phone cannot read counts as a
// failed shot. The computer also says when it took the shot, by its own clock;
// the phone times a shot by when the answer came.
export function parseShot( payload: unknown ): SiteShot {
	const parsed = shotSchema.safeParse( payload );
	return parsed.success ? parsed.data : { image: null, reason: 'failed' };
}

const storedSchema = z.object( { thumbnail: imageSchema.nullable().catch( null ) } );

// The screenshot the desktop app stored last, in its desktop layout, from
// `GET /api/sites/:id/thumbnail`. Null when there is none.
export function parseStoredShot( payload: unknown ): string | null {
	const parsed = storedSchema.safeParse( payload );
	return parsed.success ? parsed.data.thumbnail : null;
}
