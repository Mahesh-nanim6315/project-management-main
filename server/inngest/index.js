
import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";
import sendEmail from "../configs/nodemailer.js";


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

// Inngest Function to send Email on Task creation
// Inngest Function to send Email on Task creation
const sendTaskAssignmentEmail = inngest.createFunction(
  { id: "send-task-assignment-email" },
  { event: "app/task.assigned" },
  async ({ event, step }) => {
    const { taskId, origin } = event.data;

    // 1️⃣ Fetch task details
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: true,
        project: true,
      },
    });

    if (!task || !task.assignee) return;

    // 2️⃣ Send Task Assignment Email
    await step.run("send-task-assignment-email", async () => {
      await sendEmail({
        to: task.assignee.email,
        subject: `New Task Assignment in ${task.project.name}`,
        body: `
        <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#333;">
          <h2>Hi ${task.assignee.name}, 👋</h2>

          <p>You have been assigned a new task in the project
            <strong>${task.project.name}</strong>.
          </p>

          <p style="font-size:18px;font-weight:bold;">
            ${task.title}
          </p>

          <div style="background:#f9f9f9;padding:12px 15px;border-radius:6px;">
            <p>
              <strong>Description:</strong><br/>
              ${task.description || "No description provided"}
            </p>

            <p>
              <strong>Due Date:</strong>
              ${task.due_date
                ? new Date(task.due_date).toLocaleDateString()
                : "No due date"}
            </p>
          </div>

          <a href="${origin}"
             style="display:inline-block;margin-top:15px;
                    padding:10px 20px;
                    background:#007bff;
                    color:#fff;
                    text-decoration:none;
                    border-radius:5px;">
            View Task
          </a>

          <p style="margin-top:20px;font-size:14px;color:#666;">
            Please make sure to review and complete it before the due date.
          </p>
        </div>
        `,
      });
    });

    // ❌ No due date → stop here
    if (!task.due_date) return;

    // 3️⃣ Wait until due date
    await step.sleepUntil(
      "wait-until-due-date",
      new Date(task.due_date)
    );

    // 4️⃣ Check task status after due date
    await step.run("check-task-status", async () => {
      const updatedTask = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          assignee: true,
          project: true,
        },
      });

      if (!updatedTask) return;

      // 5️⃣ Send reminder if task is NOT completed
      if (updatedTask.status !== "COMPLETED") {
        await step.run("send-due-date-reminder-email", async () => {
          await sendEmail({
            to: updatedTask.assignee.email,
            subject: `Task Overdue: ${updatedTask.title}`,
            body: `
            <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#333;">
              <h2>Hi ${updatedTask.assignee.name}, ⏰</h2>

              <p>
                This is a reminder that the following task is
                <strong>past its due date</strong>.
              </p>

              <p style="font-size:18px;font-weight:bold;color:#d9534f;">
                ${updatedTask.title}
              </p>

              <p>
                Project: <strong>${updatedTask.project.name}</strong>
              </p>

              <a href="${origin}"
                 style="display:inline-block;margin-top:15px;
                        padding:10px 20px;
                        background:#dc3545;
                        color:#fff;
                        text-decoration:none;
                        border-radius:5px;">
                View Task
              </a>

              <p style="margin-top:20px;font-size:14px;color:#666;">
                Please update the task status as soon as possible.
              </p>
            </div>
            `,
          });
        });
      }
    });
  }
);

export default sendTaskAssignmentEmail;




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
  sendTaskAssignmentEmail
];
