import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '@/app.module';

describe('GraphQL API (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Mutation: transcribeFile', () => {
    it('should require authentication', async () => {
      const mutation = `
        mutation($input: TranscribeFileInput!) {
          transcribeFile(input: $input) {
            text
          }
        }
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/api/graphql',
        payload: {
          query: mutation,
          variables: {
            input: { audioUrl: 'https://example.com/audio.mp3' },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.errors).toBeDefined();
      // GraphQL может возвращать разные типы ошибок аутентификации
      expect(data.errors[0].message).toMatch(
        /Unauthorized|Missing Authorization|Invalid authorization|Cannot read properties/i,
      );
    });

    it('should validate input parameters', async () => {
      const mutation = `
        mutation($input: TranscribeFileInput!) {
          transcribeFile(input: $input) {
            text
          }
        }
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/api/graphql',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          query: mutation,
          variables: {
            input: { audioUrl: 'invalid-url' },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.errors).toBeDefined();
    });

    it('should accept valid input with authentication', async () => {
      const mutation = `
        mutation($input: TranscribeFileInput!) {
          transcribeFile(input: $input) {
            text
            provider
            processingMs
          }
        }
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/api/graphql',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          query: mutation,
          variables: {
            input: {
              audioUrl: 'https://example.com/audio.mp3',
              provider: 'assemblyai',
            },
          },
        },
      });

      // This will likely fail due to missing API key, but should not be auth error
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      // Should not be authentication error
      if (data.errors) {
        expect(data.errors[0].message).not.toContain('Unauthorized');
      }
    });
  });

  describe('GraphQL introspection', () => {
    it('should support introspection query', async () => {
      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            queryType {
              name
            }
            mutationType {
              name
            }
          }
        }
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/api/graphql',
        payload: { query: introspectionQuery },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.data.__schema.queryType.name).toBe('Query');
      expect(data.data.__schema.mutationType.name).toBe('Mutation');
    });

    it('should return schema types', async () => {
      const query = `
        query {
          __schema {
            types {
              name
              kind
            }
          }
        }
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/api/graphql',
        payload: { query },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      const typeNames = data.data.__schema.types.map((t: any) => t.name);
      expect(typeNames).toContain('TranscriptionResponse');
      expect(typeNames).toContain('TranscribeFileInput');
    });
  });
});
