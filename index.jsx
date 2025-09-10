import React, { useEffect, useState } from "react";

// TickTick-like single-file React app (Tailwind CSS expected in the host project)
// Drop this component into a Create React App / Vite React project and include Tailwind.

const PRIORITIES = ["Low", "Medium", "High"];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function todayISO() {
  return new Date().toISOString().slice(0, 16); // yyyy-mm-ddThh:mm
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("inbox");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    title: "",
    notes: "",
    due: "",
    priority: "Medium",
    tags: "",
    repeat: "none",
  });

  // Load from localStorage
  useEffect(() => {
    const raw = localStorage.getItem("tt_tasks_v1");
    if (raw) {
      try {
        setTasks(JSON.parse(raw));
      } catch (e) {
        console.error(e);
      }
    } else {
      // seed example
      const seed = [
        {
          id: uid(),
          title: "Pay rent",
          notes: "Collect cash from tenant",
          due: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          priority: "High",
          tags: ["rent", "monthly"],
          completed: false,
          completedAt: null,
          repeat: "monthly",
          createdAt: new Date().toISOString(),
        },
        {
          id: uid(),
          title: "Fix sink in Apt 204",
          notes: "Call plumber",
          due: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
          priority: "Medium",
          tags: ["maintenance"],
          completed: false,
          completedAt: null,
          repeat: "none",
          createdAt: new Date().toISOString(),
        },
      ];
      setTasks(seed);
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem("tt_tasks_v1", JSON.stringify(tasks));
  }, [tasks]);

  // Utilities
  const addTask = () => {
    if (!form.title.trim()) return;
    const t = {
      id: uid(),
      title: form.title.trim(),
      notes: form.notes.trim(),
      due: form.due ? new Date(form.due).toISOString() : null,
      priority: form.priority,
      tags: form.tags ? form.tags.split(",").map(s => s.trim()).filter(Boolean) : [],
      completed: false,
      completedAt: null,
      repeat: form.repeat || "none",
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => [t, ...prev]);
    setForm({ title: "", notes: "", due: "", priority: "Medium", tags: "", repeat: "none" });
  };

  const toggleComplete = id => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id !== id) return t;
        if (t.completed) {
          // un-complete
          return { ...t, completed: false, completedAt: null };
        } else {
          // complete and handle recurrence
          const now = new Date().toISOString();
          const updated = { ...t, completed: true, completedAt: now };
          if (t.repeat && t.repeat !== "none") {
            // create next instance
            const nextDue = computeNextDue(t.due, t.repeat);
            if (nextDue) {
              const next = {
                ...t,
                id: uid(),
                completed: false,
                completedAt: null,
                due: nextDue,
                createdAt: new Date().toISOString(),
              };
              // Insert next instance before returning updated list
              // We'll return updated list with next added
              setTasks(list => [next, ...list]);
            }
          }
          return updated;
        }
      })
    );
  };

  const computeNextDue = (iso, repeat) => {
    if (!iso) return null;
    const dt = new Date(iso);
    if (repeat === "daily") dt.setDate(dt.getDate() + 1);
    else if (repeat === "weekly") dt.setDate(dt.getDate() + 7);
    else if (repeat === "monthly") dt.setMonth(dt.getMonth() + 1);
    else if (repeat === "yearly") dt.setFullYear(dt.getFullYear() + 1);
    return dt.toISOString();
  };

  const snooze = (id, days = 1) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, due: t.due ? new Date(new Date(t.due).getTime() + days * 24 * 3600 * 1000).toISOString() : new Date(Date.now() + days * 24 * 3600 * 1000).toISOString() } : t)));
  };

  const deleteTask = id => setTasks(prev => prev.filter(t => t.id !== id));

  const editTask = (id, patch) => setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));

  // Filters
  const isToday = iso => {
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  const filtered = tasks.filter(t => {
    if (query && !(`${t.title} ${t.notes} ${t.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()))) return false;
    if (filter === "inbox") return !t.due && !t.completed;
    if (filter === "today") return isToday(t.due) && !t.completed;
    if (filter === "upcoming") return t.due && new Date(t.due) > new Date() && !t.completed;
    if (filter === "completed") return t.completed;
    return true; // all
  });

  // Notification helper (optional)
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission();
  }, []);

  const sendNotification = (title, body) => {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  };

  // Simple scheduled check for due reminders when app is open
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      tasks.forEach(t => {
        if (!t.completed && t.due) {
          const dueT = new Date(t.due).getTime();
          // If due within next minute, notify once
          if (dueT - now <= 60_000 && dueT - now > -60_000) {
            sendNotification("Task due soon: " + t.title, t.notes || "");
          }
        }
      });
    }, 30_000);
    return () => clearInterval(id);
  }, [tasks]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Tick-lite</h1>
            <p className="text-sm text-gray-600">A lightweight TickTick-like webapp — local, private, fast.</p>
          </div>
          <div className="flex items-center gap-3">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tasks..." className="px-3 py-2 border rounded shadow-sm" />
            <button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={() => { localStorage.removeItem('tt_tasks_v1'); setTasks([]); }}>Clear All</button>
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <aside className="space-y-4">
            <div className="bg-white p-3 rounded shadow-sm">
              <h3 className="font-semibold mb-2">Views</h3>
              <nav className="flex flex-col gap-1">
                <button className={`text-left px-2 py-1 rounded ${filter==='all'?'bg-gray-100':''}`} onClick={() => setFilter('all')}>All</button>
                <button className={`text-left px-2 py-1 rounded ${filter==='inbox'?'bg-gray-100':''}`} onClick={() => setFilter('inbox')}>Inbox</button>
                <button className={`text-left px-2 py-1 rounded ${filter==='today'?'bg-gray-100':''}`} onClick={() => setFilter('today')}>Today</button>
                <button className={`text-left px-2 py-1 rounded ${filter==='upcoming'?'bg-gray-100':''}`} onClick={() => setFilter('upcoming')}>Upcoming</button>
                <button className={`text-left px-2 py-1 rounded ${filter==='completed'?'bg-gray-100':''}`} onClick={() => setFilter('completed')}>Completed</button>
              </nav>
            </div>

            <div className="bg-white p-3 rounded shadow-sm">
              <h3 className="font-semibold mb-2">Quick add</h3>
              <div className="space-y-2">
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" className="w-full px-2 py-1 border rounded" />
                <input value={form.due} onChange={e => setForm(f => ({ ...f, due: e.target.value }))} type="datetime-local" className="w-full px-2 py-1 border rounded" />
                <div className="flex gap-2">
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="px-2 py-1 border rounded">
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select value={form.repeat} onChange={e => setForm(f => ({ ...f, repeat: e.target.value }))} className="px-2 py-1 border rounded">
                    <option value="none">No repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="tags,comma,separated" className="w-full px-2 py-1 border rounded" />
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className="w-full px-2 py-1 border rounded" rows={2} />
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={addTask}>Add</button>
                  <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setForm({ title: "", notes: "", due: "", priority: "Medium", tags: "", repeat: "none" })}>Reset</button>
                </div>
              </div>
            </div>

            <div className="bg-white p-3 rounded shadow-sm">
              <h3 className="font-semibold mb-2">Stats</h3>
              <p className="text-sm">Total: <strong>{tasks.length}</strong></p>
              <p className="text-sm">Pending: <strong>{tasks.filter(t=>!t.completed).length}</strong></p>
              <p className="text-sm">Completed: <strong>{tasks.filter(t=>t.completed).length}</strong></p>
            </div>
          </aside>

          <section className="md:col-span-2">
            <div className="bg-white p-4 rounded shadow-sm mb-4">
              <h2 className="font-semibold text-lg mb-2">{filter === 'all' ? 'All tasks' : filter.charAt(0).toUpperCase()+filter.slice(1)}</h2>

              <div className="space-y-3">
                {filtered.length === 0 && <p className="text-gray-500">No tasks here.</p>}
                {filtered.map(task => (
                  <article key={task.id} className="border rounded p-3 flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <input type="checkbox" checked={task.completed} onChange={() => toggleComplete(task.id)} className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className={`font-medium ${task.completed ? 'line-through text-gray-400' : ''}`}>{task.title}</h3>
                          <p className="text-xs text-gray-500">{task.notes}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">{task.due ? new Date(task.due).toLocaleString() : 'No due'}</div>
                          <div className="text-xs mt-1">{task.priority}</div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex gap-2 items-center">
                          {task.tags && task.tags.map(tag => (
                            <span key={tag} className="text-xs px-2 py-0.5 border rounded-full">{tag}</span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button className="text-xs px-2 py-1 border rounded" onClick={() => snooze(task.id, 1)}>Snooze 1d</button>
                          <button className="text-xs px-2 py-1 border rounded" onClick={() => editTask(task.id, { priority: task.priority === 'High' ? 'Medium' : 'High' })}>Toggle Priority</button>
                          <button className="text-xs px-2 py-1 border rounded" onClick={() => deleteTask(task.id)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded shadow-sm">
              <h3 className="font-semibold mb-2">Completed</h3>
              <div className="space-y-2">
                {tasks.filter(t=>t.completed).slice(0,8).map(t => (
                  <div key={t.id} className="text-sm text-gray-600 flex justify-between">
                    <div>{t.title}</div>
                    <div>{t.completedAt ? new Date(t.completedAt).toLocaleString() : ''}</div>
                  </div>
                ))}
                {tasks.filter(t=>t.completed).length === 0 && <div className="text-gray-500">No completed tasks yet.</div>}
              </div>
            </div>

          </section>
        </main>

        <footer className="text-center text-sm text-gray-500 mt-6">Made with ❤️ — local-only. Export data from dev console (localStorage).</footer>
      </div>
    </div>
  );
}
