import { eq, or } from "drizzle-orm";
import { db } from "./db";
import {
  teams,
  teamMembers,
  users,
  type Team,
  type TeamMember,
} from "../shared/schema";
import crypto from "crypto";

export const teamStore = {
  create: async (name: string, ownerId: string): Promise<Team> => {
    const id = crypto.randomUUID();
    const [team] = await db
      .insert(teams)
      .values({ id, name, ownerId })
      .returning();
    
    await db.insert(teamMembers).values({
      id: crypto.randomUUID(),
      teamId: id,
      userId: ownerId,
      role: "owner",
    });
    
    return team;
  },

  get: async (teamId: string): Promise<Team | undefined> => {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    return team;
  },

  listForUser: async (userId: string): Promise<Team[]> => {
    const memberTeamIds = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    if (memberTeamIds.length === 0) {
      return [];
    }

    const teamIds = memberTeamIds.map((m) => m.teamId);
    const result = await db
      .select()
      .from(teams)
      .where(or(...teamIds.map((id) => eq(teams.id, id))));

    return result;
  },

  addMember: async (
    teamId: string,
    userIdOrEmail: string,
    role: string = "member"
  ): Promise<TeamMember> => {
    let userId = userIdOrEmail;
    
    if (userIdOrEmail.includes("@")) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, userIdOrEmail));
      if (!user) {
        throw new Error("User not found with that email");
      }
      userId = user.id;
    }

    const [member] = await db
      .insert(teamMembers)
      .values({
        id: crypto.randomUUID(),
        teamId,
        userId,
        role,
      })
      .returning();

    return member;
  },

  getMembers: async (teamId: string): Promise<TeamMember[]> => {
    return db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));
  },

  isMember: async (teamId: string, userId: string): Promise<boolean> => {
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));
    
    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));
    
    return members.some((m) => m.userId === userId);
  },
};
