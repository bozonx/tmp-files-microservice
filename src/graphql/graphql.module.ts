import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ConfigService } from '@nestjs/config';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { TranscriptionModule } from '@modules/transcription/transcription.module';
import { TranscriptionResolver } from './resolvers/transcription.resolver';
import { HealthResolver } from './resolvers/health.resolver';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: (configService: ConfigService) => {
        const appConfig = configService.get('app')!;
        const basePath = `/${appConfig.apiBasePath}`;
        const isDev = appConfig.nodeEnv === 'development';

        return {
          autoSchemaFile: true,
          sortSchema: true,
          path: `${basePath}/graphql`,
          // Apollo Sandbox (заменяет GraphiQL) в development
          playground: false,
          plugins: isDev ? [ApolloServerPluginLandingPageLocalDefault()] : [],
          // Включаем introspection для development и federation
          introspection: true,
          // Federation конфигурация для WunderGraph
          buildSchemaOptions: {
            numberScalarMode: 'integer',
            // Добавляем Federation директивы через SDL
            typeDefs: `
              extend type TranscriptionResponse @key(fields: "requestId") @shareable
            `,
          },
        };
      },
      inject: [ConfigService],
    }),
    TranscriptionModule,
  ],
  providers: [TranscriptionResolver, HealthResolver],
})
export class GraphqlApiModule {}
