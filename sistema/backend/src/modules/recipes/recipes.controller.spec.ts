import { GUARDS_METADATA } from '@nestjs/common/constants'
import { ROLES_KEY } from '../../common/decorators/roles.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard'
import { RecipesController } from './recipes.controller'

function guardTypes(methodName: keyof RecipesController) {
  const guards = Reflect.getMetadata(GUARDS_METADATA, RecipesController.prototype[methodName]) || []
  return guards
}

function rolesFor(methodName: keyof RecipesController) {
  return Reflect.getMetadata(ROLES_KEY, RecipesController.prototype[methodName]) || []
}

describe('RecipesController security metadata', () => {
  it.each(['createCategory', 'updateCategory', 'deleteCategory', 'create', 'update', 'remove'] as Array<keyof RecipesController>)(
    'protects %s mutations with admin guards',
    (methodName) => {
      expect(guardTypes(methodName)).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]))
      expect(rolesFor(methodName)).toEqual(['admin'])
    },
  )

  it('keeps listCategories public read endpoint without guards', () => {
    expect(guardTypes('listCategories')).toHaveLength(0)
  })

  // JON-156 (Auditoria 360, Low): list/findBySlug continuam alcancaveis sem
  // login, mas agora com OptionalJwtAuthGuard -- admin autenticado preserva
  // visibilidade de inativas pra gerenciar; anonimo fica sempre em active=true.
  it.each(['list', 'findBySlug'] as Array<keyof RecipesController>)(
    'keeps %s public but resolves optional admin identity',
    (methodName) => {
      expect(guardTypes(methodName)).toEqual(expect.arrayContaining([OptionalJwtAuthGuard]))
    },
  )
})
