import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

// JON-56 (Auditoria 360, Medium): cada modulo declarava PrismaService como
// provider proprio -- sem modulo global compartilhado, cada um instanciava
// seu proprio PrismaClient (pool de conexao separado). @Global aqui + import
// unico no AppModule garante uma unica instancia compartilhada em toda a
// aplicacao; os providers locais nos demais modulos foram removidos.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
