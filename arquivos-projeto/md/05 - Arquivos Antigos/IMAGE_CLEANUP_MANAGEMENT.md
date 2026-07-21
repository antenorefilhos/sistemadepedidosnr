# Gerenciamento de Limpeza de Imagens

## Resumo
Implementado sistema de limpeza automática de imagens do disco quando:
1. Um banner é deletado
2. Um banner é atualizado e uma imagem anterior é substituída
3. Qualquer entidade com campo de imagem (como Produtos) é atualizada/deletada

## Implementação

### 1. Utility Service (Reutilizável)
Localização: `src/common/services/uploads.service.ts`

Provides:
- `extractFilenameFromUrl(url)`: Extrai nome do arquivo de `/uploads/uuid.jpg`
- `deleteFile(filename)`: Deleta um arquivo de disco
- `deleteFiles(filenames[])`: Deleta múltiplos arquivos
- `deleteFileFromUrl(url)`: Deleta arquivo a partir de URL
- `deleteFilesFromUrls(urls[])`: Deleta múltiplos arquivos a partir de URLs

### 2. Store Banners Service
Localização: `src/modules/cms/store-banners/store-banners.service.ts`

Implementado:
```typescript
// Ao atualizar banner:
async update(id, data) {
  const existing = await findUnique(id);
  
  // Limpar imagem anterior se substituída
  if (data.imageUrl !== undefined && existing.imageUrl !== data.imageUrl) {
    await uploadsService.deleteFileFromUrl(existing.imageUrl);
  }
  
  // Limpar imagem mobile anterior se substituída
  if (data.mobileImageUrl !== undefined && existing.mobileImageUrl !== data.mobileImageUrl) {
    await uploadsService.deleteFileFromUrl(existing.mobileImageUrl);
  }
  
  return update(id, data);
}

// Ao deletar banner:
async deleteWithCleanup(id) {
  const banner = await findUnique(id);
  
  // Limpar arquivos de disco
  await uploadsService.deleteFilesFromUrls([
    banner.imageUrl,
    banner.mobileImageUrl,
  ]);
  
  // Deletar do BD
  return delete(id);
}
```

### 3. Próximas Entidades (Padrão a Seguir)

**Para Produtos** (quando adicionar campo de imagem):
- Seguir o mesmo padrão implementado em Store Banners
- Injetar `UploadsManagementService` no constructor
- No método `update()`: Verificar se `imageUrl` foi alterado e deletar anterior
- No método `remove()` ou `delete()`: Limpar todas as imagens associadas

**Para Outras Entidades com Imagens**:
- Promover a chamada de `uploadsService.deleteFileFromUrl()` nos métodos de update/delete
- Registrar o `UploadsManagementService` no módulo

### 4. Estrutura de Disco
```
./uploads/
  ├── uuid1.jpg   <- Salvo automaticamente via upload endpoint
  ├── uuid2.png   <- Deletado automaticamente quando:
  │                   - Banner é deletado
  │                   - Banner é atualizado com nova imagem
  │                   - Produto é deletado
  │                   - Produto é atualizado com nova imagem
  └── uuid3.webp
```

### 5. Registro em Módulos

Exemplo (Store Banners Module):
```typescript
@Module({
  controllers: [StoreBannersController],
  providers: [StoreBannersService, UploadsManagementService],
  imports: [PrismaModule],
})
export class StoreBannersModule {}
```

---

**Status**: ✅ Implementado para Store Banners  
**Próximo Passo**: Aplicar mesmo padrão a Produtos quando campo de imagem for criado
