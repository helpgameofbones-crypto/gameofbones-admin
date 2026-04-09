'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DEFAULT_TASKS = [
  { id: 'pack',     label: 'Pack all pending orders',         category: 'orders',    done: false },
  { id: 'labels',   label: 'Print shipping labels',           category: 'orders',    done: false },
  { id: 'pickup',   label: 'Mark orders as pickup ready',     category: 'orders',    done: false },
  { id: 'stock',    label: 'Check low stock products',        category: 'inventory', done: false },
  { id: 'replies',  label: 'Reply to customer messages',      category: 'customer',  done: false },
  { id: 'insta',    label: 'Post on Instagram',               category: 'marketing', done: false },
  { id: 'review',   label: 'Check new reviews',               category: 'customer',  done: false },
  { id: 'rto',      label: 'Check RTO orders and restock',    category: 'inventory', done: false },
]

export default function TasksPage() {
  const [tasks, setTasks]       = useState(DEFAULT_TASKS)
  const [newTask, setNewTask]   = useState('')
  const [pendingOrders, setPendingOrders] = useState(0)
  const [lowStock, setLowStock] = useState(0)

  useEffect(() => {
    fetchStats()
    const saved = localStorage.getItem('gob_tasks_' + new Date().toDateString())
    if (saved) setTasks(JSON.parse(saved))
  }, [])

  async function fetchStats() {
    const { count: orders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['placed', 'confirmed', 'packed', 'labelled'])

    const { count: stock } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .lt('stock', 10)
      .eq('is_active', true)

    setPendingOrders(orders || 0)
    setLowStock(stock || 0)
  }

  function toggleTask(id: string) {
    const updated = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)
    setTasks(updated)
    localStorage.setItem('gob_tasks_' + new Date().toDateString(), JSON.stringify(updated))
  }

  function addTask() {
    if (!newTask.trim()) return
    const updated = [...tasks, { id: Date.now().toString(), label: newTask, category: 'other', done: false }]
    setTasks(updated)
    localStorage.setItem('gob_tasks_' + new Date().toDateString(), JSON.stringify(updated))
    setNewTask('')
  }

  function resetTasks() {
    setTasks(DEFAULT_TASKS)
    localStorage.removeItem('gob_tasks_' + new Date().toDateString())
  }

  const doneCount = tasks.filter(t => t.done).length
  const pct = Math.round((doneCount / tasks.length) * 100)

  const categoryColors: Record<string, string> = {
    orders: '#3b82f6', inventory: '#f59e0b',
    customer: '#8b5cf6', marketing: '#10b981', other: '#6b7280'
  }

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Products',  href: '/products' },
    { label: 'Customers', href: '/customers' },
    { label: 'Tasks',     href: '/tasks' },
    { label: 'Analytics', href: '/analytics' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">ðŸ¾</span>
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>Game of Bones</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin Panel</div>
          </div>
        </div>
        <nav className="flex gap-1 flex-wrap">
          {navLinks.map(item => (
            <a key={item.href} href={item.href}
              className="px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.8)' }}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>
              Daily Tasks
            </h1>
            <p className="text-sm mt-1" style={{ color: '#1a1008' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button onClick={resetTasks}
            className="text-xs px-3 py-2 rounded-lg"
            style={{ background: '#f3f4f6', color: '#1a1008' }}>
            Reset for today
          </button>
        </div>

        {/* Alerts */}
        {(pendingOrders > 0 || lowStock > 0) && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {pendingOrders > 0 && (
              <a href="/orders"
                className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ background: '#eff6ff', borderColor: '#bfdbfe', textDecoration: 'none' }}>
                <span className="text-2xl">ðŸ“¦</span>
                <div>
                  <div className="font-bold" style={{ color: '#1e40af' }}>{pendingOrders} pending orders</div>
                  <div className="text-xs" style={{ color: '#3b82f6' }}>Need to be packed</div>
                </div>
              </a>
            )}
            {lowStock > 0 && (
              <a href="/inventory"
                className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ background: '#fefce8', borderColor: '#fde68a', textDecoration: 'none' }}>
                <span className="text-2xl">âš ï¸</span>
                <div>
                  <div className="font-bold" style={{ color: '#92400e' }}>{lowStock} low stock items</div>
                  <div className="text-xs" style={{ color: '#f59e0b' }}>Need restocking</div>
                </div>
              </a>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium" style={{ color: '#111827' }}>
              Today's Progress
            </span>
            <span className="font-bold" style={{ color: '#c8973a' }}>
              {doneCount}/{tasks.length} done
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className="h-3 rounded-full transition-all"
              style={{ width: pct + '%', background: pct === 100 ? '#10b981' : '#c8973a' }} />
          </div>
          {pct === 100 && (
            <div className="text-center mt-3 text-sm font-medium" style={{ color: '#10b981' }}>
              ðŸŽ‰ All done for today!
            </div>
          )}
        </div>

        {/* Task list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
          {tasks.map((task, i) => (
            <div key={task.id}
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ borderBottom: i < tasks.length - 1 ? '1px solid #f9fafb' : 'none' }}
              onClick={() => toggleTask(task.id)}>
              <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  borderColor: task.done ? '#10b981' : '#d1d5db',
                  background: task.done ? '#10b981' : 'white'
                }}>
                {task.done && <span style={{ color: 'white', fontSize: 12 }}>âœ“</span>}
              </div>
              <div className="flex-1">
                <div className="text-sm" style={{
                  color: task.done ? '#9ca3af' : '#111827',
                  textDecoration: task.done ? 'line-through' : 'none'
                }}>
                  {task.label}
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                style={{
                  background: categoryColors[task.category] + '20',
                  color: categoryColors[task.category]
                }}>
                {task.category}
              </span>
            </div>
          ))}
        </div>

        {/* Add task */}
        <div className="flex gap-3">
          <input
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Add a custom task..."
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none bg-white"
            style={{ color: '#111827' }}
          />
          <button onClick={addTask}
            className="text-white px-4 py-2 rounded-lg font-medium text-sm"
            style={{ background: '#c8973a' }}>
            Add
          </button>
        </div>
      </div>
    </div>
  )
}