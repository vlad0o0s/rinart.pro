import {
  createTeamMember,
  deleteTeamMember,
  fetchAllTeamMembers,
  reorderTeamMembers,
  TeamMemberInput,
  TeamMemberRecord,
  updateTeamMember,
} from "./team-repository";

export async function getTeamMembers(): Promise<TeamMemberRecord[]> {
  // Always read fresh to reflect admin changes immediately across the site
  const members = await fetchAllTeamMembers();
  return members;
}

export async function createTeamMemberEntry(input: TeamMemberInput) {
  const member = await createTeamMember(input);
  return member;
}

export async function updateTeamMemberEntry(id: number, input: Partial<TeamMemberInput>) {
  const member = await updateTeamMember(id, input);
  return member;
}

export async function deleteTeamMemberEntry(id: number) {
  await deleteTeamMember(id);
}

export async function reorderTeamMembersEntries(order: number[]) {
  await reorderTeamMembers(order);
}

// Cache removed to ensure immediate propagation

