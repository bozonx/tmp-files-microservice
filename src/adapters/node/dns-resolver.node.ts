import { lookup } from 'node:dns/promises'
import type { DnsResolver } from '../../common/interfaces/dns-resolver.interface.js'

export class NodeDnsResolver implements DnsResolver {
  public async lookupAll(hostname: string): Promise<string[]> {
    const res = await lookup(hostname, { all: true, verbatim: true })
    const addresses = Array.isArray(res) ? res : [res]
    return addresses
      .map((a) => String((a as { address?: unknown }).address ?? ''))
      .filter((a) => a.trim() !== '')
  }
}
