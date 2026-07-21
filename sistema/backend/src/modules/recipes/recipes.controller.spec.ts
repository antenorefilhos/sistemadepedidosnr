import { GUARDS_METADATA } from '@nestjs/common/constants'
import { ROLES_KEY } from '../../common/decorators/roles.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
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

  it.each(['listCategories', 'list', 'findBySlug'] as Array<keyof RecipesController>)(
    'keeps %s public read endpoint without guards',
    (methodName) => {
      expect(guardTypes(methodName)).toHaveLength(0)
    },
  )
})
