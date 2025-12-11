
import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";


// Create a client to send and receive events
export const inngest = new Inngest({ id: "project-management-main" });

/* ---------------------------------------------------------
   USER CREATED
--------------------------------------------------------- */
const syncUserCreation = inngest.createFunction(
  { id: "sync-user-from-clerk" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    try {
      const data = event.data;

      await prisma.user.create({
        data: {
          id: data.id,
          email: data?.email_addresses?.[0]?.email_address || "",
          name: `${data?.first_name || ""} ${data?.last_name || ""}`.trim(),
          image: data?.image_url || "",
        },
      });

      return { status: "User Created Successfully" };
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }
);

/* ---------------------------------------------------------
   USER DELETED
--------------------------------------------------------- */
const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-with-clerk" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    try {
      const data = event.data;

      await prisma.user.delete({
        where: { id: data.id },
      });

      return { status: "User Deleted Successfully" };
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  }
);

/* ---------------------------------------------------------
   USER UPDATED
--------------------------------------------------------- */
const syncUserUpdation = inngest.createFunction(
  { id: "update-user-from-clerk" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    try {
      const data = event.data;

      await prisma.user.update({
        where: { id: data.id },
        data: {
          email: data?.email_addresses?.[0]?.email_address || "",
          name: `${data?.first_name || ""} ${data?.last_name || ""}`.trim(),
          image: data?.image_url || "",
        },
      });

      return { status: "User Updated Successfully" };
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }
);

/* ---------------------------------------------------------
   WORKSPACE CREATED
--------------------------------------------------------- */
const syncWorkspaceCreation = inngest.createFunction(
  { id: "sync-workspace-from-clerk" },
  { event: "clerk/organization.created" },
  async ({ event }) => {
    try {
      const { data } = event;

      await prisma.workspace.create({
        data: {
          id: data.id,
          name: data.name,
          slug: data.slug,
          ownerId: data.created_by,
          image_url: data.image_url,
        },
      });

      // Add creator as Admin
      await prisma.workspaceMember.create({
        data: {
          userId: data.created_by,
          workspaceId: data.id,
          role: "ADMIN",
        },
      });

      return { status: "Workspace Created Successfully" };
    } catch (error) {
      console.error("Error creating workspace:", error);
      throw error;
    }
  }
);

/* ---------------------------------------------------------
   WORKSPACE UPDATED
--------------------------------------------------------- */
const syncWorkspaceUpdation = inngest.createFunction(
  { id: "update-workspace-from-clerk" },
  { event: "clerk/organization.updated" },
  async ({ event }) => {
    const { data } = event;

    try {
      await prisma.workspace.upsert({
        where: { id: data.id },
        update: {
          name: data.name,
          slug: data.slug,
          image_url: data.image_url,
        },
        create: {
          id: data.id,
          name: data.name,
          slug: data.slug,
          ownerId: data.created_by,
          image_url: data.image_url,
        },
      });

      return { status: "Workspace Upserted Successfully" };
    } catch (error) {
      console.error("Workspace update failed:", error);
      throw error;
    }
  }
);


/* ---------------------------------------------------------
   WORKSPACE DELETED
--------------------------------------------------------- */
const syncWorkspaceDeletion = inngest.createFunction(
  { id: "delete-workspace-with-clerk" },
  { event: "clerk/organization.deleted" },
  async ({ event }) => {
    const { data } = event;

    await prisma.workspace.delete({
      where: { id: data.id },
    });
  }
);

/* ---------------------------------------------------------
   WORKSPACE MEMBER CREATED
--------------------------------------------------------- */
const syncWorkspaceMemberCreation = inngest.createFunction(
  { id: "sync-workspace-member-from-clerk" },
  { event: "clerk/organizationInvitation.accepted" },
  async ({ event }) => {
    const { data } = event;

    await prisma.workspaceMember.create({
      data: {
        userId: data.user_id,
        workspaceId: data.organization_id,
        role: String(data.role_name).toUpperCase(),
      },
    });
  }
);

/* ---------------------------------------------------------
   EXPORT FUNCTIONS
--------------------------------------------------------- */
export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  syncWorkspaceCreation,
  syncWorkspaceUpdation,
  syncWorkspaceDeletion,
  syncWorkspaceMemberCreation,
];
