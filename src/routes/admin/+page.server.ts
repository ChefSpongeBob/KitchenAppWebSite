import type { Actions, PageServerLoad } from './$types';
import {
  addNodeName,
  approveUser,
  approveWhiteboard,
  createTodo,
  deleteNodeName,
  deleteTodo,
  deleteWhiteboard,
  loadAdminAnnouncement,
  loadAdminNodeNames,
  loadAdminTodos,
  loadAdminUsers,
  loadAdminWhiteboardIdeas,
  rejectWhiteboard,
  makeUserAdmin,
  requireAdmin,
  saveAnnouncement,
  toggleSpecialsAccess
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
      summary: {
        pendingUsers: 0,
        openTodos: 0,
        pendingIdeas: 0,
        nodeCount: 0
      }
    };
  }

  const [todos, users, nodeNames, whiteboardIdeas, announcement] = await Promise.all([
    loadAdminTodos(db),
    loadAdminUsers(db),
    loadAdminNodeNames(db),
    loadAdminWhiteboardIdeas(db),
    loadAdminAnnouncement(db)
  ]);

  return {
    todos,
    users,
    nodeNames,
    whiteboardIdeas,
    announcement,
    summary: {
      pendingUsers: users.filter((user) => user.is_active !== 1).length,
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
  make_user_admin: ({ request, locals }) => makeUserAdmin(request, locals),
  approve_user: ({ request, locals }) => approveUser(request, locals),
  toggle_specials_access: ({ request, locals }) => toggleSpecialsAccess(request, locals)
};
