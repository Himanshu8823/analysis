/**
 * The tests for the guard on user-supplied addresses.
 *
 * A file URL in a request body is an instruction to the server: "go and
 * fetch this". Without a check, that instruction can name anything —
 * including the addresses only the server can reach, such as the cloud
 * metadata service that hands out the instance's credentials.
 *
 * The guard is the difference between "fetch a document" and "a way to read
 * the inside of the network". Every test here is one address that must be
 * refused.
 */

import { BadRequestException } from '@nestjs/common';
import { UrlGuardService } from './url-guard.service';

/**
 * A guard whose names resolve to a fixed list of addresses.
 *
 * The guard asks the system to turn a name into an address. A name that
 * resolves to a public address is allowed; a name that resolves to a
 * private one is not — which is the half a name-only check always misses.
 */
function guardResolvingTo(addresses: string[]): UrlGuardService {
  return new UrlGuardService(async () => addresses.map((address) => ({ address })));
}

/**
 * A guard whose names never resolve.
 */
function guardWithNoResolution(): UrlGuardService {
  return new UrlGuardService(async () => {
    throw new Error('ENOTFOUND');
  });
}

describe('the address guard', () => {
  describe('an address on the local network', () => {
    it.each([
      ['the loopback address', 'http://127.0.0.1/secret'],
      ['another loopback address', 'http://127.5.5.5/secret'],
      ['the machine itself', 'http://localhost/secret'],
      ['the cloud metadata service', 'http://169.254.169.254/latest/meta-data/'],
      ['a private network', 'http://10.0.0.5/secret'],
      ['another private network', 'http://192.168.1.1/secret'],
      ['a private network in the middle range', 'http://172.16.4.4/secret'],
      ['a carrier-grade NAT address', 'http://100.64.0.1/secret'],
      ['the "this network" address', 'http://0.0.0.0/secret'],
      ['the last address in a range', 'http://10.255.255.255/secret'],
    ])('refuses %s', async (_name, url) => {
      const guard = new UrlGuardService();

      await expect(guard.assertFetchable(url)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('a name that resolves to a local address', () => {
    it('refuses it', async () => {
      const guard = guardResolvingTo(['10.1.2.3']);

      await expect(
        guard.assertFetchable('https://documents.example.com/notes.pdf')
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses it even when another address in the list is public', async () => {
      const guard = guardResolvingTo(['93.184.216.34', '127.0.0.1']);

      await expect(
        guard.assertFetchable('https://documents.example.com/notes.pdf')
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('an address the server may reach', () => {
    it('accepts a public address', async () => {
      const guard = guardResolvingTo(['93.184.216.34']);

      await expect(
        guard.assertFetchable('https://documents.example.com/notes.pdf')
      ).resolves.toBeInstanceOf(URL);
    });

    it('accepts an address written out in full', async () => {
      const guard = new UrlGuardService();

      await expect(
        guard.assertFetchable('https://93.184.216.34/notes.pdf')
      ).resolves.toBeInstanceOf(URL);
    });
  });

  describe('an address that is not a web address', () => {
    it.each([
      ['a file on the server', 'file:///etc/passwd'],
      ['a data payload', 'data:text/plain;base64,SGVsbG8='],
      ['nothing at all', 'not a url'],
      ['an empty string', ''],
    ])('refuses %s', async (_name, url) => {
      const guard = new UrlGuardService();

      await expect(guard.assertFetchable(url)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('a name that does not resolve', () => {
    it('is refused rather than left to fail later', async () => {
      const guard = guardWithNoResolution();

      await expect(
        guard.assertFetchable('https://nowhere.example.com/notes.pdf')
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('the message a user is shown', () => {
    it('says what to do instead', async () => {
      const guard = new UrlGuardService();

      await expect(guard.assertFetchable('http://127.0.0.1/secret')).rejects.toThrow(
        /upload the file/i
      );
    });

    it('does not repeat the address that was refused', async () => {
      const guard = new UrlGuardService();

      await expect(guard.assertFetchable('http://169.254.169.254/latest/')).rejects.not.toThrow(
        /169\.254\.169\.254/
      );
    });
  });
});
