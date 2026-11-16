import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { lookup } from 'dns/promises';

/**
 * The injection token for the name resolver.
 *
 * The resolver is a collaborator, not a constant, so it is given a token
 * rather than being read from a module-level variable. That keeps the
 * service testable — a test supplies a resolver that answers with fixed
 * addresses — without leaving Nest to guess what a `Function`-typed
 * constructor parameter means.
 */
export const URL_RESOLVER = Symbol('URL_RESOLVER');

/**
 * The shape of a name resolver: a hostname, and the addresses it points at.
 */
export type HostResolver = (hostname: string) => Promise<Array<{ address: string }>>;

/**
 * The addresses a server-side fetch must never reach.
 *
 * A file URL in a request body is an address the server is told to visit.
 * Without a check, that address can be anything: the cloud metadata service
 * (`169.254.169.254`, which hands out the instance's credentials), a
 * database on the same network, or the machine the server itself runs on.
 * The response comes back to the caller, so the server becomes a proxy for
 * whatever is reachable from where it stands.
 *
 * The ranges below are the ones that cannot be a public document host. A
 * document the exam cell wants to read is on the open internet.
 */
const BLOCKED_ADDRESS_RANGES = [
  // 0.0.0.0/8 — "this network"
  { start: '0.0.0.0', end: '0.255.255.255' },
  // 10.0.0.0/8 — private
  { start: '10.0.0.0', end: '10.255.255.255' },
  // 100.64.0.0/10 — carrier-grade NAT
  { start: '100.64.0.0', end: '100.127.255.255' },
  // 127.0.0.0/8 — loopback
  { start: '127.0.0.0', end: '127.255.255.255' },
  // 169.254.0.0/16 — link-local, which includes the cloud metadata address
  { start: '169.254.0.0', end: '169.254.255.255' },
  // 172.16.0.0/12 — private
  { start: '172.16.0.0', end: '172.31.255.255' },
  // 192.0.0.0/24 — IETF protocol assignments
  { start: '192.0.0.0', end: '192.0.0.255' },
  // 192.168.0.0/16 — private
  { start: '192.168.0.0', end: '192.168.255.255' },
  // 198.18.0.0/15 — benchmarking
  { start: '198.18.0.0', end: '198.19.255.255' },
  // 224.0.0.0/4 and 240.0.0.0/4 — multicast and reserved
  { start: '224.0.0.0', end: '255.255.255.255' },
] as const;

/**
 * The hosts that are refused outright, whatever they resolve to.
 *
 * `localhost` and its many spellings are refused by name so that a name
 * that is not in DNS at all still fails loudly rather than resolving
 * somewhere unexpected.
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.goog',
]);

/**
 * The message shown when an address is refused.
 *
 * It is the same message for every refusal, so the check cannot be used to
 * discover which addresses exist. It says what to do instead, because a
 * refusal the user cannot act on is a dead end.
 */
const REFUSED_MESSAGE =
  'That file address cannot be read. Please upload the file instead of linking to it.';

/**
 * A URL the server may fetch.
 *
 * The check has two halves, and both matter:
 *
 *  - the *name* is checked before the request is made, so an obvious
 *    attempt is refused with a clear message;
 *  - the *address* the name resolves to is checked as well, because a name
 *    that looks public can resolve to a private address. This is the half
 *    that a name-only check always misses.
 */
@Injectable()
export class UrlGuardService {
  /**
   * Turns a name into the addresses it points at.
   *
   * The resolver is injected under {@link URL_RESOLVER} and is optional: in
   * the running application it is the system's own resolver, and in the
   * tests it is a stub that answers with fixed addresses. The default is
   * applied here when nothing was supplied, so the service works whether it
   * is built by the framework or by hand.
   */
  private readonly resolveAddresses: HostResolver;

  constructor(
    @Optional()
    @Inject(URL_RESOLVER)
    resolveAddresses?: HostResolver
  ) {
    this.resolveAddresses = resolveAddresses ?? ((hostname) => lookup(hostname, { all: true }));
  }

  /**
   * Whether the URL may be fetched.
   *
   * Throws with a message the user can act on.
   */
  async assertFetchable(fileUrl: string): Promise<URL> {
    const url = this.parse(fileUrl);

    const addresses = await this.resolve(url.hostname);
    const blocked = addresses.find((address) => this.isBlockedAddress(address));

    if (blocked) {
      throw new BadRequestException(REFUSED_MESSAGE);
    }

    return url;
  }

  /**
   * Parses the URL and refuses anything that is not a plain web address.
   */
  private parse(fileUrl: string): URL {
    let url: URL;
    try {
      url = new URL(fileUrl);
    } catch {
      throw new BadRequestException(
        'That file address is not valid. Please upload the file instead of linking to it.'
      );
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException(
        'Only a web address (http or https) can be read. Please upload the file instead.'
      );
    }

    if (!url.hostname) {
      throw new BadRequestException(
        'That file address is not valid. Please upload the file instead of linking to it.'
      );
    }

    return url;
  }

  /**
   * The addresses a hostname resolves to.
   *
   * A name that does not resolve is refused: the fetch would fail anyway,
   * and failing here keeps the error message in the user's own words.
   */
  private async resolve(hostname: string): Promise<string[]> {
    const name = hostname.replace(/^\[|\]$/g, '').toLowerCase();

    if (BLOCKED_HOSTNAMES.has(name)) {
      throw new BadRequestException(REFUSED_MESSAGE);
    }

    // An address written out in full does not need to be resolved.
    if (isIpv4(name)) {
      return [name];
    }

    let records: Array<{ address: string }>;
    try {
      records = await this.resolveAddresses(name);
    } catch {
      throw new BadRequestException(
        'That file address could not be found. Please upload the file instead of linking to it.'
      );
    }

    if (records.length === 0) {
      throw new BadRequestException(
        'That file address could not be found. Please upload the file instead of linking to it.'
      );
    }

    return records.map((record) => record.address);
  }

  /**
   * Whether an address is one the server must not reach.
   *
   * An IPv6 address is treated by its shape: `::1` is loopback and
   * `fc00::/7` is the private range. A link-local `fe80::/10` is refused
   * as well, because it is the IPv6 equivalent of the metadata address.
   */
  private isBlockedAddress(address: string): boolean {
    const value = address.toLowerCase();

    if (isIpv4(value)) {
      return BLOCKED_ADDRESS_RANGES.some(
        (range) => compareIpv4(value, range.start) >= 0 && compareIpv4(value, range.end) <= 0
      );
    }

    if (value === '::' || value === '::1') return true;
    // fc00::/7 — unique local
    if (/^f[cd]/.test(value)) return true;
    // fe80::/10 — link-local
    if (/^fe[89ab]/.test(value)) return true;

    return false;
  }
}

/** Whether a string is written as an IPv4 address. */
function isIpv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

/**
 * Compares two IPv4 addresses.
 *
 * The addresses are compared as numbers rather than as text, because
 * `10.0.0.9` sorts before `10.0.0.10` as text but after it as a number.
 */
function compareIpv4(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);

  for (let i = 0; i < 4; i++) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l !== r) return l - r;
  }
  return 0;
}
