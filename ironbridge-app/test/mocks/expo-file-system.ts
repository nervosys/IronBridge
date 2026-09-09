export const Paths = { document: '/tmp/documents', cache: '/tmp/cache' };

export class File {
  uri: string;
  constructor(...segments: unknown[]) {
    this.uri = segments.map(String).join('/');
  }
  create() {}
  write(_contents: string) {}
  delete() {}
}
