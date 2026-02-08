import prisma from "../configs/prisma.js";
import { inngest } from "../inngest/index.js";

// Create Task
export const createTask = async (req, res) => {
  try {
    const { userId } = await req.auth();

    const {
      projectId,
      title,
      type,
      description,
      status,
      priority,
      assigneeId,
      due_date
    } = req.body;

    // Check project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { include: { user: true } } }
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (project.team_lead !== userId) {
      return res.status(403).json({ message: "You don't have admin privileges for this project" });
    }

    // Check assignee belongs to project
    if (
      assigneeId &&
      !project.members.some(member => member.user.id === assigneeId)
    ) {
      return res.status(400).json({
        message: "Assignee is not a member of the project"
      });
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        description,
        status,
        priority,
        assigneeId,
        due_date: due_date ? new Date(due_date) : null
      }
    });

    const taskWithAssignee = await prisma.task.findUnique({
      where: { id: task.id },
      include: { assignee: true }
    });

    await inngest.send({
      name: "app/task.assigned",
      data: {
         taskId: task.id, origin 
        }
    });

    res.json({
      task: taskWithAssignee,
      message: "Task created successfully"
    });

  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ message: error.code || error.message });
  }
};

// Update Task
export const updateTask = async (req, res) => {
  try {
    const taskId = req.params.id;

    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const { userId } = await req.auth();

    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
      include: { members: { include: { user: true } } }
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (project.team_lead !== userId) {
      return res.status(403).json({ message: "You don't have admin privileges for this project" });
    }

    const {
      title,
      description,
      status,
      priority,
      assigneeId,
      due_date
    } = req.body;

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        title,
        description,
        status,
        priority,
        assigneeId,
        due_date: due_date ? new Date(due_date) : null
      }
    });

    res.json({
      task: updatedTask,
      message: "Task updated successfully"
    });

  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ message: error.code || error.message });
  }
};

// Delete Task
export const deleteTask = async (req, res) => {
  try {
    
    const {userId} = await req.auth();
    const {tasksIds} = req.body;

    const tasks = await prisma.task.findMany({
      where: { id: { in: tasksIds } }
    });


    if(tasks.length === 0){
      return res.status(404).json({ message: "Tasks not found" });
    }

    const project = await prisma.project.findUnique({
      where: { id: tasks[0].projectId },
      include: { members: { include: { user: true } } }
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    } else if (project.team_lead !== userId) {
      return res.status(403).json({ message: "You don't have admin privileges for this project" });
    }

    await prisma.task.deleteMany({
      where: { id: { in: tasksIds } }
    });

    res.json({ message: "Task deleted successfully" });

  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ message: error.code || error.message });
  }
};