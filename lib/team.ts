import {
  createTeamMember,
  deleteTeamMember,
  fetchAllTeamMembers,
  reorderTeamMembers,
  TeamMemberInput,
  TeamMemberRecord,
  updateTeamMember,
} from "./team-repository";

/**
 * Кеш здесь когда-то убрали ради мгновенного появления правок из админки. Теперь он вернулся
 * вместе с инвалидацией: каждая функция записи ниже сбрасывает кеш сразу после изменения,
 * а весь админский API ходит только через них. Правки видны так же мгновенно, но страницы
 * с составом команды перестали ходить в удалённую базу на каждый рендер.
 */
type TeamCache = { value: TeamMemberRecord[]; expiresAt: number };
const TEAM_CACHE_TTL = 60 * 1000;
let teamCache: TeamCache | null = null;

export function invalidateTeamCache() {
  teamCache = null;
}

export async function getTeamMembers(): Promise<TeamMemberRecord[]> {
  if (teamCache && teamCache.expiresAt > Date.now()) {
    return teamCache.value;
  }

  const members = await fetchAllTeamMembers();
  teamCache = { value: members, expiresAt: Date.now() + TEAM_CACHE_TTL };
  return members;
}

export async function createTeamMemberEntry(input: TeamMemberInput) {
  const member = await createTeamMember(input);
  invalidateTeamCache();
  return member;
}

export async function updateTeamMemberEntry(id: number, input: Partial<TeamMemberInput>) {
  const member = await updateTeamMember(id, input);
  invalidateTeamCache();
  return member;
}

export async function deleteTeamMemberEntry(id: number) {
  await deleteTeamMember(id);
  invalidateTeamCache();
}

export async function reorderTeamMembersEntries(order: number[]) {
  await reorderTeamMembers(order);
  invalidateTeamCache();
}

