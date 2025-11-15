import { cache } from "react";
import {
  createTeamMember,
  deleteTeamMember,
  fetchAllTeamMembers,
  reorderTeamMembers,
  TeamMemberInput,
  TeamMemberRecord,
  updateTeamMember,
} from "./team-repository";

type TeamCacheEntry = {
  members: TeamMemberRecord[];
  expiresAt: number;
};

const CACHE_TTL = 60 * 1000;
let teamCache: TeamCacheEntry | null = null;

function readCache(): TeamMemberRecord[] | null {
  if (!teamCache || teamCache.expiresAt < Date.now()) {
    return null;
  }
  return teamCache.members;
}

function writeCache(members: TeamMemberRecord[]) {
  teamCache = { members, expiresAt: Date.now() + CACHE_TTL };
}

export const getTeamMembers = cache(async (): Promise<TeamMemberRecord[]> => {
  const cached = readCache();
  if (cached) {
    return cached;
  }
  const members = await fetchAllTeamMembers();
  writeCache(members);
  return members;
});

export async function createTeamMemberEntry(input: TeamMemberInput) {
  const member = await createTeamMember(input);
  await refreshTeamCache();
  return member;
}

export async function updateTeamMemberEntry(id: number, input: Partial<TeamMemberInput>) {
  const member = await updateTeamMember(id, input);
  await refreshTeamCache();
  return member;
}

export async function deleteTeamMemberEntry(id: number) {
  await deleteTeamMember(id);
  await refreshTeamCache();
}

export async function reorderTeamMembersEntries(order: number[]) {
  await reorderTeamMembers(order);
  await refreshTeamCache();
}

async function refreshTeamCache() {
  const members = await fetchAllTeamMembers();
  writeCache(members);
}

export function invalidateTeamCache() {
  teamCache = null;
}

