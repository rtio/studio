# Remote mode

`studio remote` lets a phone that has been paired with this computer drive Studio Code over the network. It is a proof of concept.

## What it is

Remote mode is the `studio ui` server (`apps/local`) started with a `remote` option. `studio ui` itself does not change: it still listens on loopback only and has no authentication. The server refuses to listen on a network address unless remote mode is on.

In remote mode the server:

- listens on one network address (`--host`, by default the first IPv4 address that is not internal) and port 8082;
- answers only the routes listed in `apps/local/src/remote-mode.ts`, and 403 for every other route under `/api`;
- asks for a device token on each of them, except pairing;
- rejects any request that has an `Origin` header, since a phone app sends none;
- accepts request bodies up to 256 KB;
- accepts a text prompt only when a phone sends a message: no images, files or annotations;
- sends only `id`, `name`, `running` and `url` for each site;
- sends only the `agent` and `site-event` channels on the event stream, and closes a device's stream when the device is revoked or its token expires;
- answers errors without details;
- does not serve the browser UI or the sign-in callback page;
- listens for CLI events on a socket of its own (`_events --listener remote`).

`GET /.well-known/studio/remote` needs no token. It returns the instance id, the computer's name, the protocol version and the Studio version, so a phone can check which computer answers before it pairs.

## Pairing

1. `studio remote` prints a QR code that holds `studio-remote://pair?url=<address>&code=<code>&id=<instance id>`. The code has 12 characters, works once, lasts 5 minutes, and is dropped after 5 wrong attempts. `studio remote pair` prints a new one.
2. The phone reads the descriptor and checks the instance id and protocol version.
3. The phone sends the code to `POST /api/remote/pair` and gets a device token that lasts 30 days.

Codes and tokens are stored as SHA-256 hashes in `~/.studio/remote.json`, through `@studio/common/lib/remote-access.ts`. The server reads the file on each request, so `studio remote devices revoke <id>` applies at once, from any process. An open event stream of a device revoked that way closes within a few seconds.

## Limits

- A device token lets its holder send prompts, and the agent can run commands. Treat a paired device like a shell on this computer.
- On a plain network the connection is HTTP and not encrypted: the pairing code and the token can be read by anyone on that network. Use Tailscale or another VPN.
- The run manager lives in the server process. A run started in the Desktop app does not stream to a phone, and the reverse. The chat appears on both after a reload.
- A site's `url` is its `localhost` address, which a phone cannot open.
