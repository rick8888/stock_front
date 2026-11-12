import type { Driver, RoleKey, User } from '@/types'
import type { AuthRepository, RoleRepository, UserInput, UserRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { assertCanAddUser } from '@/utils/planLimits'
import { db, mutate, withLatency } from './db'

const ROLE_TITLES: Record<RoleKey, string> = {
  SUPER_ADMIN: 'Super administrateur',
  TENANT_OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  WAREHOUSE_MANAGER: 'Gestionnaire d’entrepôt',
  PROCUREMENT: 'Approvisionnement',
  FINANCE: 'Finance',
  DISPATCHER: 'Dispatcher',
  DRIVER: 'Chauffeur',
  AUDITOR: 'Auditeur',
}

function emailFromName(firstName: string, lastName: string) {
  const slug = `${firstName}.${lastName}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '')
  const base = `${slug || 'utilisateur'}@bravo.stock`
  if (!db().users.some((user) => user.email.toLowerCase() === base)) return base
  return `${slug || 'utilisateur'}.${uid('n')}@bravo.stock`
}

function assertCreatableRole(creator: User | undefined, role: RoleKey) {
  if (role === 'SUPER_ADMIN' && creator?.role !== 'SUPER_ADMIN') {
    throw new Error('Seul BravoStock peut créer ce rôle.')
  }
  if (role === 'TENANT_OWNER' && creator?.role !== 'SUPER_ADMIN') {
    throw new Error('Seul BravoStock peut créer un propriétaire d’entreprise.')
  }
  if (creator?.role === 'TENANT_OWNER' && role !== 'ADMIN') {
    throw new Error('Le propriétaire ne crée que des administrateurs.')
  }
  if (creator?.role === 'ADMIN' && (role === 'SUPER_ADMIN' || role === 'TENANT_OWNER')) {
    throw new Error('Rôle non autorisé.')
  }
}

function assertUpdatableRole(actor: User | undefined, target: User, nextRole?: RoleKey) {
  if (actor?.role === 'TENANT_OWNER') {
    if (target.companyId !== actor.companyId || target.role !== 'ADMIN') {
      throw new Error('Vous ne pouvez modifier que les administrateurs de votre entreprise.')
    }
    if (nextRole && nextRole !== 'ADMIN') throw new Error('Le propriétaire ne gère que des administrateurs.')
  }
  if (nextRole) assertCreatableRole(actor, nextRole)
}

function emailTaken(email: string, exceptId?: string) {
  return db().users.some(
    (user) => user.email.toLowerCase() === email.toLowerCase() && user.id !== exceptId,
  )
}

function ensureDriver(user: User, phone?: string) {
  if (user.role !== 'DRIVER') return
  if (user.driverId) {
    const driver = db().drivers.find((item) => item.id === user.driverId)
    if (driver && phone?.trim()) driver.phone = phone.trim()
    return
  }
  const driver: Driver = {
    id: uid('drv'),
    userId: user.id,
    phone: phone?.trim() || '',
    status: 'available',
  }
  user.driverId = driver.id
  db().drivers.push(driver)
}

function audit(action: string, entityId: string, userId?: string) {
  db().auditLogs.unshift({
    id: uid('aud'),
    userId: userId ?? '',
    action,
    entity: 'user',
    entityId,
    createdAt: new Date().toISOString(),
  })
}

export class MockUserRepository implements UserRepository {
  list() {
    return withLatency(() => db().users)
  }

  getById(id: string) {
    return withLatency(() => db().users.find((item) => item.id === id) ?? null)
  }

  findByEmail(email: string) {
    return withLatency(
      () => db().users.find((item) => item.email.toLowerCase() === email.toLowerCase()) ?? null,
    )
  }

  create(input: UserInput) {
    return mutate(() => {
      const firstName = input.firstName.trim()
      const lastName = input.lastName.trim()
      if (firstName.length < 2 || lastName.length < 2) throw new Error('Le prénom et le nom sont requis')
      const email = (input.email?.trim() || emailFromName(firstName, lastName)).toLowerCase()
      if (emailTaken(email)) throw new Error('Cet email est déjà utilisé')
      const creator = input.createdByUserId
        ? db().users.find((item) => item.id === input.createdByUserId)
        : undefined
      assertCreatableRole(creator, input.role)
      const user: User = {
        id: uid('usr'),
        firstName,
        lastName,
        email,
        password: input.password?.trim() || 'demo',
        role: input.role,
        title: input.title?.trim() || ROLE_TITLES[input.role],
        avatarHue: 10 + (db().users.length % 40),
        warehouseIds: input.warehouseIds ?? [],
        productIds: input.productIds ?? [],
        regionIds: input.regionIds ?? [],
        companyId: input.companyId ?? creator?.companyId,
      }
      if (user.companyId && user.role !== 'SUPER_ADMIN' && user.role !== 'TENANT_OWNER') {
        assertCanAddUser(user.companyId)
      }
      db().users.push(user)
      if (user.companyId) {
        const company = db().companies.find((item) => item.id === user.companyId)
        if (company) company.usersCount += 1
      }
      ensureDriver(user, input.phone)
      audit('Utilisateur créé', user.id, input.createdByUserId)
      return user
    })
  }

  update(id: string, input: Partial<UserInput>) {
    return mutate(() => {
      const user = db().users.find((item) => item.id === id)
      if (!user) throw new Error('Utilisateur introuvable')
      const actor = input.createdByUserId
        ? db().users.find((item) => item.id === input.createdByUserId)
        : undefined
      assertUpdatableRole(actor, user, input.role)
      if (input.firstName) user.firstName = input.firstName.trim()
      if (input.lastName) user.lastName = input.lastName.trim()
      if (input.email) {
        const email = input.email.trim().toLowerCase()
        if (emailTaken(email, id)) throw new Error('Cet email est déjà utilisé')
        user.email = email
      }
      if (input.password?.trim()) user.password = input.password.trim()
      if (input.role) user.role = input.role
      if (input.title) user.title = input.title.trim()
      if (input.warehouseIds) user.warehouseIds = input.warehouseIds
      if (input.productIds) user.productIds = input.productIds
      if (input.regionIds) user.regionIds = input.regionIds
      ensureDriver(user, input.phone)
      audit('Utilisateur modifié', user.id, input.createdByUserId)
      return user
    })
  }
}

export class MockRoleRepository implements RoleRepository {
  list() {
    return withLatency(() => db().roles)
  }
}

export class MockAuthRepository implements AuthRepository {
  async login(email: string, password: string) {
    await withLatency(() => null, 320)
    const user = db().users.find(
      (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password,
    )
    if (!user) throw new Error('Identifiants incorrects')
    return user
  }

  async logout() {
    await withLatency(() => undefined, 80)
  }

  restore(userId: string) {
    return withLatency(() => db().users.find((item) => item.id === userId) ?? null, 40)
  }
}
