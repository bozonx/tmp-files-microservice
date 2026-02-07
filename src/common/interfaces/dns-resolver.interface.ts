export interface DnsResolver {
  lookupAll(hostname: string): Promise<string[]>
}

export class NullDnsResolver implements DnsResolver {
  public async lookupAll(): Promise<string[]> {
    return []
  }
}
