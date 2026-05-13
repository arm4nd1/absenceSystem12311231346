import { useState } from "react";
import { ShieldCheck, UserPlus, Pencil, Trash2, Search, Mail } from "lucide-react";
import toast           from "react-hot-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader      from "../components/PageHeader";
import LoadingSpinner  from "../components/LoadingSpinner";
import Modal           from "../components/Modal";
import api             from "../lib/api";
import { useStudents } from "../hooks/useStudents";
import { useSubjects } from "../hooks/useSubjects";

const ROLES = ["admin", "instructor", "student"];

function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then(r => r.data) });
}

const ROLE_BADGE = {
  admin:      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400",
  instructor: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-400",
  student:    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/20 text-slate-400",
};

export default function UsersPage() {
  const [search,     setSearch]     = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editUser,   setEditUser]   = useState(null);

  const qc = useQueryClient();
  const { data: users    = [], isLoading } = useUsers();
  const { data: subjects = [] }            = useSubjects();
  const { data: students = [] }            = useStudents();

  const createMutation = useMutation({
    mutationFn: async (d) => {
      const user = await api.post("/users", d).then(r => r.data);
      // Auto-send password reset so new users can set their own password
      try {
        const reset = await api.post(`/users/${user.uid}/send-reset-email`).then(r => r.data);
        return { ...user, reset };
      } catch {
        return user;
      }
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      if (d.reset?.sent) {
        toast.success("User created & password reset email sent!");
      } else if (d.reset?.resetLink) {
        toast.success("User created! Copy the reset link to send manually.");
        setTimeout(() => prompt("Password reset link (send to user):", d.reset.resetLink), 300);
      } else {
        toast.success("User created. Send them a reset email from the table.");
      }
      setShowCreate(false);
      setCf({ email: "", password: "", name: "", role: "student", subjectIds: [], studentId: "" });
    },
    onError: (e) => toast.error(e.response?.data?.error || "Failed to create user."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ uid, ...d }) => api.patch(`/users/${uid}/role`, d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("User updated."); setEditUser(null); },
    onError:   (e) => toast.error(e.response?.data?.error || "Failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: (uid) => api.delete(`/users/${uid}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("User deleted."); },
    onError:   (e) => toast.error(e.response?.data?.error || "Failed."),
  });

  const resetMutation = useMutation({
    mutationFn: (uid) => api.post(`/users/${uid}/send-reset-email`).then(r => r.data),
    onSuccess: (d) => {
      if (d.sent) toast.success("Password reset email sent!");
      else {
        toast.success("Reset link generated (email not configured).");
        if (d.resetLink) {
          prompt("Copy this reset link and send it to the user:", d.resetLink);
        }
      }
    },
    onError: (e) => toast.error(e.response?.data?.error || "Failed."),
  });

  const filtered = users.filter(u =>
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.name  || "").toLowerCase().includes(search.toLowerCase())
  );

  // ── Create form state ──────────────────────────────────────────────────────
  const [cf, setCf] = useState({ email: "", password: "", name: "", role: "student", subjectIds: [], studentId: "" });
  const setCfK = k => v => setCf(f => ({ ...f, [k]: v }));

  // ── Edit form state ────────────────────────────────────────────────────────
  const [ef, setEf] = useState({});

  function openEdit(u) {
    setEf({ uid: u.uid || u.id, role: u.role, subjectIds: u.subjectIds || [], studentId: u.studentId || "", name: u.name || "" });
    setEditUser(u);
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Users"
        subtitle="Manage system accounts and roles"
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <UserPlus size={16} /> Add User
          </button>
        }
      />

      <div className="relative mb-6 max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-10" placeholder="Search by name or email…"
               value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <LoadingSpinner className="py-20" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No users found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/40 border-b border-slate-800">
              <tr>
                <th className="table-header">Name / Email</th>
                <th className="table-header">Role</th>
                <th className="table-header">Subjects / Student</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(u => (
                <tr key={u.uid || u.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="table-cell">
                    <p className="font-medium text-white">{u.name || "—"}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="table-cell">
                    <span className={ROLE_BADGE[u.role] || ROLE_BADGE.student}>{u.role}</span>
                  </td>
                  <td className="table-cell text-slate-400 text-xs">
                    {u.role === "instructor"
                      ? (u.subjectIds || []).map(id => subjects.find(s => s.id === id)?.name || id).join(", ") || "—"
                      : u.role === "student"
                        ? students.find(s => s.id === u.studentId)?.name || u.studentId || "—"
                        : "—"}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2 justify-end">
                      <button title="Send password reset email"
                              onClick={() => resetMutation.mutate(u.uid || u.id)}
                              disabled={resetMutation.isPending}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                        <Mail size={15} />
                      </button>
                      <button onClick={() => openEdit(u)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => { if (confirm("Delete this user?")) deleteMutation.mutate(u.uid || u.id); }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add User">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(cf); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full Name</label>
              <input className="input" value={cf.name} onChange={e => setCfK("name")(e.target.value)} placeholder="Dr. Juan dela Cruz" />
            </div>
            <div className="col-span-2">
              <label className="label">Email *</label>
              <input className="input" type="email" required value={cf.email} onChange={e => setCfK("email")(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Password *</label>
              <input className="input" type="password" required minLength={6} value={cf.password} onChange={e => setCfK("password")(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Role</label>
              <select className="input" value={cf.role} onChange={e => setCfK("role")(e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {cf.role === "instructor" && (
              <div className="col-span-2">
                <label className="label">Assign Subjects</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 rounded-xl border border-slate-700">
                  {subjects.map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input type="checkbox"
                             checked={cf.subjectIds.includes(s.id)}
                             onChange={e => setCfK("subjectIds")(
                               e.target.checked ? [...cf.subjectIds, s.id] : cf.subjectIds.filter(x => x !== s.id)
                             )}
                             className="accent-blue-500" />
                      {s.name} ({s.code})
                    </label>
                  ))}
                </div>
              </div>
            )}
            {cf.role === "student" && (
              <div className="col-span-2">
                <label className="label">Link to Student Record</label>
                <select className="input" value={cf.studentId} onChange={e => setCfK("studentId")(e.target.value)}>
                  <option value="">None</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} – {s.studentNumber}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>Create</button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User Role">
        {editUser && (
          <form onSubmit={e => { e.preventDefault(); updateMutation.mutate(ef); }} className="space-y-4">
            <p className="text-sm text-slate-400">
              Editing: <span className="text-white font-medium">{editUser.email}</span>
            </p>
            <div>
              <label className="label">Name</label>
              <input className="input" value={ef.name} onChange={e => setEf(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={ef.role} onChange={e => setEf(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {ef.role === "instructor" && (
              <div>
                <label className="label">Subjects</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 rounded-xl border border-slate-700">
                  {subjects.map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input type="checkbox"
                             checked={(ef.subjectIds || []).includes(s.id)}
                             onChange={e => setEf(f => ({
                               ...f,
                               subjectIds: e.target.checked
                                 ? [...(f.subjectIds || []), s.id]
                                 : (f.subjectIds || []).filter(x => x !== s.id)
                             }))}
                             className="accent-blue-500" />
                      {s.name} ({s.code})
                    </label>
                  ))}
                </div>
              </div>
            )}
            {ef.role === "student" && (
              <div>
                <label className="label">Link to Student Record</label>
                <select className="input" value={ef.studentId || ""}
                        onChange={e => setEf(f => ({ ...f, studentId: e.target.value }))}>
                  <option value="">None</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} – {s.studentNumber}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>Save</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
