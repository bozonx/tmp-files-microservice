import { Resolver, Query } from '@nestjs/graphql';

@Resolver()
export class HealthResolver {
  @Query(() => String, {
    description: 'Проверка работоспособности GraphQL API',
  })
  health(): string {
    return 'ok';
  }
}
