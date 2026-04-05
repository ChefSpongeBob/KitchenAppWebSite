import type { Actions, PageServerLoad } from './$types';
import {
  addNodeName,
  loadAdminAssignableUsers,
  approveUser,
  approveWhiteboard,
  cleanupExpiredRejectedWhiteboardIdeas,
  createTodo,
  deleteUser,
  deleteNodeName,
  deleteTodo,
  deleteWhiteboard,
  denyUser,
  loadAdminAnnouncement,
  loadAdminEmployeeSpotlight,
  loadAdminNodeNames,
  loadAdminTodos,
  loadAdminWhiteboardIdeas,
  rejectWhiteboard,
  makeUserAdmin,
  requireAdmin,
  saveAnnouncement,
  saveEmployeeSpotlight,
  toggleSpecialsAccess,
  usersHasIsActiveColumn
} from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return {
      todos: [],
    users: [],
      nodeNames: [],
      whiteboardIdeas: [],
      announcement: { content: '', updatedAt: 0 },
      employeeSpotlight: { employeeName: '', shoutout: '', updatedAt: 0 },
      summary: {
        pendingUsers: 0,
        openTodos: 0,
        pendingIdeas: 0,
        nodeCount: 0
      }
    };
  }

  await cleanupExpiredRejectedWhiteboardIdeas(db);

  const [todos, users, nodeNames, whiteboardIdeas, announcement, employeeSpotlight, hasIsActive] = await Promise.all([
    loadAdminTodos(db),
    loadAdminAssignableUsers(db),
    loadAdminNodeNames(db),
    loadAdminWhiteboardIdeas(db),
    loadAdminAnnouncement(db),
    loadAdminEmployeeSpotlight(db),
    usersHasIsActiveColumn(db)
  ]);

  const pendingUsers = hasIsActive
    ? (
        await db
          .prepare(`SELECT COUNT(*) AS count FROM users WHERE COALESCE(is_active, 1) != 1`)
          .first<{ count: number }>()
      )?.count ?? 0
    : 0;

  return {
    todos,
    users,
    nodeNames,
    whiteboardIdeas,
    announcement,
    employeeSpotlight,
    summary: {
      pendingUsers,
      openTodos: todos.filter((todo) => !todo.completed_at).length,
      pendingIdeas: whiteboardIdeas.filter((idea) => idea.status === 'pending').length,
      nodeCount: nodeNames.length
    }
  };
};

export const actions: Actions = {
  create_todo: ({ request, locals }) => createTodo(request, locals),
  delete_todo: ({ request, locals }) => deleteTodo(request, locals),
  add_node_name: ({ request, locals }) => addNodeName(request, locals),
  delete_node_name: ({ request, locals }) => deleteNodeName(request, locals),
  approve_whiteboard: ({ request, locals }) => approveWhiteboard(request, locals),
  reject_whiteboard: ({ request, locals }) => import('$lib/server/admin').then(({ rejectWhiteboard }) => rejectWhiteboard(request, locals)),
  delete_whiteboard: ({ request, locals }) => deleteWhiteboard(request, locals),
  save_announcement: ({ request, locals }) => saveAnnouncement(request, locals),
  save_employee_spotlight: ({ request, locals }) => saveEmployeeSpotlight(request, locals),
  make_user_admin: ({ request, locals }) => makeUserAdmin(request, locals),
  approve_user: ({ request, locals }) => approveUser(request, locals),
  deny_user: ({ request, locals }) => denyUser(request, locals),
  delete_user: ({ request, locals }) => deleteUser(request, locals),
  toggle_specials_access: ({ request, locals }) => toggleSpecialsAccess(request, locals)
};
