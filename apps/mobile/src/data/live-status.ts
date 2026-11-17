// How the phone stands with the paired computer.
// - `off`: not paired.
// - `connecting`: the first try after the app starts or pairs.
// - `live`: the event stream is open.
// - `reconnecting`: the computer does not answer; the phone keeps trying.
// - `wrong-computer`: something else answers at the paired address. The phone
//   keeps trying and never sends its token there.
export type LiveStatus = 'off' | 'connecting' | 'live' | 'reconnecting' | 'wrong-computer';
