import { NestFactory } from '@nestjs/core'
import { ValidationPipe, BadRequestException, Logger } from '@nestjs/common'
import helmet from 'helmet'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { winstonLogger } from './common/logger'
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor'

function traduzirMensagem(msg: string): string {
  return msg
    .replace(/^property (\S+) should not exist$/, 'o campo "$1" não é permitido nesta operação')
    .replace(/^(\S+) should not be empty$/, 'o campo "$1" é obrigatório')
    .replace(/^(\S+) must be a string$/, 'o campo "$1" deve ser um texto')
    .replace(/^(\S+) must be an email$/, 'o campo "$1" deve ser um e-mail válido')
    .replace(/^(\S+) must be a number.*$/, 'o campo "$1" deve ser um número')
    .replace(/^(\S+) must be an array$/, 'o campo "$1" deve ser uma lista')
    .replace(/^(\S+) must be longer than or equal to (\d+) characters$/, 'o campo "$1" deve ter pelo menos $2 caracteres')
    .replace(/^(\S+) must be shorter than or equal to (\d+) characters$/, 'o campo "$1" deve ter no máximo $2 caracteres')
    .replace(/^(\S+) must be a boolean value$/, 'o campo "$1" deve ser verdadeiro ou falso')
    .replace(/^(\S+) must be a positive number$/, 'o campo "$1" deve ser um número positivo')
    .replace(/^each value in (\S+) must be a string$/, 'cada item de "$1" deve ser um texto')
}

function resolveCorsOrigins() {
  const raw = String(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '').trim()
  if (raw) {
    return raw.split(',').map((origin) => origin.trim()).filter(Boolean)
  }

  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error('CORS_ORIGIN deve ser configurado explicitamente em producao.')
  }

  return [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:3001',
    'http://localhost:3003',
    'http://localhost:3004',
  ]
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false })

  app.useGlobalInterceptors(new HttpLoggingInterceptor())

  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Desativado para facilitar dev/staging com Swagger e imagens locais
  }))

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      const mensagens = errors.flatMap((err) =>
        Object.values(err.constraints || {}).map(traduzirMensagem)
      )
      return new BadRequestException({
        statusCode: 400,
        message: mensagens,
        error: 'Requisicao invalida',
      })
    },
  }))

  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  })

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Mercado Antenor API')
    .setDescription('API REST para gerenciamento de pedidos e produtos - Mercado Antenor')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth', 'Autenticação de usuários')
    .addTag('Products', 'Gerenciamento de produtos')
    .addTag('Orders', 'Gerenciamento de pedidos')
    .addTag('Customers', 'Gerenciamento de clientes')
    .addTag('Addresses', 'Gerenciamento de endereços')
    .addTag('Integrations', 'Integrações com sistemas externos')
    .build()
  
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  const port = process.env.PORT || 3001
  await app.listen(port)
  winstonLogger.info('server_started', { port, swagger: `http://localhost:${port}/api` })
}

bootstrap()
