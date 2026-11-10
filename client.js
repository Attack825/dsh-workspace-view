window.__ModuleLoader__.load({
  id: 'dsh-workspace-view',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    const NS = 'dshWorkspaceView'
    const PANEL_ID = 'dsh-workspace-view'
    const STORAGE_KEY = 'dsh-workspace-view/groups/v1'
    const RECENT_LIMIT = 5
    const CARD_SESSION_LIMIT = 3

    // ---------------------------------------------------------------------
    // Dictionaries
    // ---------------------------------------------------------------------

    const zh = {
      panel: '工作区总览',
      title: '工作区总览',
      subtitle: '{workspaces} 个工作区 · {sessions} 条会话',
      searchPlaceholder: '搜索工作区、路径或会话',
      newGroup: '新建分组',
      newGroupDefault: '新分组',
      recent: '最近活动',
      ungrouped: '未分组',
      workspaces: '{n} 个工作区',
      'sessions.one': '{n} 条会话',
      'sessions.other': '{n} 条会话',
      moveTo: '移动到分组',
      rename: '重命名',
      deleteGroup: '删除分组',
      confirmDelete: '确认删除？',
      moveUp: '上移',
      moveDown: '下移',
      newSession: '新会话',
      showAll: '展开全部 {n} 条',
      collapse: '收起',
      emptyTitle: '还没有工作区',
      emptyBody: '先在左侧栏添加工作区，再回来这里分组查看。',
      emptyDrop: '把卡片拖到这里，移出分组',
      emptyGroup: '这个分组还没有工作区',
      noResults: '没有匹配的工作区或会话',
      untitled: '未命名',
      defaultWorkspace: '默认工作区',
      searchResults: '搜索结果',
      collapseAll: '全部收起',
      expandAll: '全部展开',
      loading: '正在加载工作区…',
      noSessions: '还没有会话',
      statusRunning: '运行中',
      statusWaiting: '等待处理',
      statusDone: '有新结果',
      'time.now': '刚刚',
      'time.minutes': '{n} 分钟前',
      'time.hours': '{n} 小时前',
      'time.days': '{n} 天前',
      'time.months': '{n} 个月前',
      'time.years': '{n} 年前',
      groupColor: '分组颜色',
      'color.lake': '湖蓝',
      'color.jade': '翠绿',
      'color.citron': '柠黄',
      'color.apricot': '杏橙',
      'color.magenta': '品红',
      'color.ember': '暖橙',
      'color.amber': '暖黄',
      'color.mint': '薄荷',
      'color.blush': '樱粉',
      'color.rose': '玫红',
    }

    const en = {
      panel: 'Workspace overview',
      title: 'Workspace overview',
      subtitle: '{workspaces} workspaces · {sessions} sessions',
      searchPlaceholder: 'Search workspaces, paths, or sessions',
      newGroup: 'New group',
      newGroupDefault: 'New group',
      recent: 'Recent activity',
      ungrouped: 'Ungrouped',
      workspaces: '{n} workspaces',
      'sessions.one': '{n} session',
      'sessions.other': '{n} sessions',
      moveTo: 'Move to group',
      rename: 'Rename',
      deleteGroup: 'Delete group',
      confirmDelete: 'Confirm delete?',
      moveUp: 'Move up',
      moveDown: 'Move down',
      newSession: 'New session',
      showAll: 'Show all {n}',
      collapse: 'Show less',
      emptyTitle: 'No workspaces yet',
      emptyBody: 'Add a workspace from the sidebar, then come back here to group them.',
      emptyDrop: 'Drop a card here to remove it from its group',
      emptyGroup: 'No workspaces in this group',
      noResults: 'No matching workspaces or sessions',
      untitled: 'Untitled',
      defaultWorkspace: 'Default workspace',
      searchResults: 'Search results',
      collapseAll: 'Collapse all',
      expandAll: 'Expand all',
      loading: 'Loading workspaces…',
      noSessions: 'No sessions yet',
      statusRunning: 'Running',
      statusWaiting: 'Waiting for you',
      statusDone: 'New result',
      'time.now': 'just now',
      'time.minutes': '{n} min ago',
      'time.hours': '{n} h ago',
      'time.days': '{n} d ago',
      'time.months': '{n} mo ago',
      'time.years': '{n} y ago',
      groupColor: 'Group color',
      'color.lake': 'Lake',
      'color.jade': 'Jade',
      'color.citron': 'Citron',
      'color.apricot': 'Apricot',
      'color.magenta': 'Magenta',
      'color.ember': 'Ember',
      'color.amber': 'Amber',
      'color.mint': 'Mint',
      'color.blush': 'Blush',
      'color.rose': 'Rose',
    }

    // ---------------------------------------------------------------------
    // Group state: pure functions, persisted as one localStorage value
    // ---------------------------------------------------------------------

    // Two reference palettes, kept as the pairs the user supplied: a cool set
    // and a warm set, five colors each, in the poster's own order. Group colors
    // walk the cool set first and then the warm one.
    const GROUP_PALETTES = [
      {
        id: 'cool',
        colors: [
          { id: 'lake', value: '#20B0DC' },
          { id: 'jade', value: '#3FCD41' },
          { id: 'citron', value: '#DFE446' },
          { id: 'apricot', value: '#FDA251' },
          { id: 'magenta', value: '#E82EB4' },
        ],
      },
      {
        id: 'warm',
        colors: [
          { id: 'ember', value: '#FD814E' },
          { id: 'amber', value: '#FCBC52' },
          { id: 'mint', value: '#A4D984' },
          { id: 'blush', value: '#F588AF' },
          { id: 'rose', value: '#F26386' },
        ],
      },
    ]
    const GROUP_COLORS = GROUP_PALETTES.flatMap((palette) => palette.colors)
    const GROUP_COLOR_IDS = GROUP_COLORS.map((entry) => entry.id)

    function isGroupColor(value) {
      return typeof value === 'string' && GROUP_COLOR_IDS.includes(value)
    }

    function colorValue(id) {
      const found = GROUP_COLORS.find((entry) => entry.id === id)
      return found === undefined ? GROUP_COLORS[0].value : found.value
    }

    /** Prefer a color no other group uses, so every section reads apart at a glance. */
    function nextGroupColor(groups) {
      const used = new Set(groups.map((group) => group.color))
      const free = GROUP_COLORS.find((entry) => !used.has(entry.id))
      if (free !== undefined) return free.id
      return GROUP_COLORS[groups.length % GROUP_COLORS.length].id
    }

    function emptyGroupState() {
      return { version: 1, groups: [], assignments: {}, collapsed: [] }
    }

    function isRecord(value) {
      return value !== null && typeof value === 'object' && !Array.isArray(value)
    }

    function normalizeGroupState(raw) {
      const next = emptyGroupState()
      if (!isRecord(raw) || raw.version !== 1) return next

      const seenIds = new Set()
      const seenTitles = new Set()
      if (Array.isArray(raw.groups)) {
        for (const entry of raw.groups) {
          if (!isRecord(entry)) continue
          const id = typeof entry.id === 'string' ? entry.id.trim() : ''
          const title = typeof entry.title === 'string' ? entry.title.trim() : ''
          if (id === '' || title === '' || seenIds.has(id) || seenTitles.has(title)) continue
          seenIds.add(id)
          seenTitles.add(title)
          const color = isGroupColor(entry.color) ? entry.color : nextGroupColor(next.groups)
          next.groups.push({ id, title, color })
        }
      }

      if (isRecord(raw.assignments)) {
        for (const workspaceId of Object.keys(raw.assignments)) {
          const groupId = raw.assignments[workspaceId]
          if (typeof groupId !== 'string' || !seenIds.has(groupId)) continue
          next.assignments[workspaceId] = groupId
        }
      }

      if (Array.isArray(raw.collapsed)) {
        const collapsed = new Set()
        for (const id of raw.collapsed) {
          if (typeof id === 'string' && seenIds.has(id) && !collapsed.has(id)) {
            collapsed.add(id)
            next.collapsed.push(id)
          }
        }
      }

      return next
    }

    function uniqueGroupTitle(groups, base, ignoreId) {
      const taken = new Set(groups.filter((group) => group.id !== ignoreId).map((group) => group.title))
      const trimmed = typeof base === 'string' && base.trim() !== '' ? base.trim() : 'Group'
      if (!taken.has(trimmed)) return trimmed
      for (let index = 2; index < 1000; index += 1) {
        const candidate = `${trimmed} ${index}`
        if (!taken.has(candidate)) return candidate
      }
      return `${trimmed} ${Date.now()}`
    }

    function createGroupState(state, id, baseTitle) {
      if (typeof id !== 'string' || id === '') return state
      if (state.groups.some((group) => group.id === id)) return state
      const title = uniqueGroupTitle(state.groups, baseTitle)
      const color = nextGroupColor(state.groups)
      return { ...state, groups: [...state.groups, { id, title, color }] }
    }

    function setGroupColor(state, id, colorId) {
      if (!isGroupColor(colorId)) return state
      const group = state.groups.find((entry) => entry.id === id)
      if (group === undefined || group.color === colorId) return state
      return { ...state, groups: state.groups.map((entry) => (entry.id === id ? { ...entry, color: colorId } : entry)) }
    }

    function renameGroup(state, id, baseTitle) {
      const group = state.groups.find((entry) => entry.id === id)
      if (group === undefined) return state
      const title = uniqueGroupTitle(state.groups, baseTitle, id)
      if (title === group.title) return state
      return { ...state, groups: state.groups.map((entry) => (entry.id === id ? { ...entry, title } : entry)) }
    }

    function deleteGroup(state, id) {
      if (!state.groups.some((group) => group.id === id)) return state
      const assignments = {}
      for (const workspaceId of Object.keys(state.assignments)) {
        if (state.assignments[workspaceId] !== id) assignments[workspaceId] = state.assignments[workspaceId]
      }
      return {
        ...state,
        groups: state.groups.filter((group) => group.id !== id),
        assignments,
        collapsed: state.collapsed.filter((entry) => entry !== id),
      }
    }

    function moveGroup(state, id, delta) {
      const index = state.groups.findIndex((group) => group.id === id)
      if (index === -1) return state
      const target = index + delta
      if (target < 0 || target >= state.groups.length) return state
      const groups = [...state.groups]
      const [moved] = groups.splice(index, 1)
      groups.splice(target, 0, moved)
      return { ...state, groups }
    }

    function reorderGroup(state, id, beforeId) {
      if (id === beforeId) return state
      const from = state.groups.findIndex((group) => group.id === id)
      const to = state.groups.findIndex((group) => group.id === beforeId)
      if (from === -1 || to === -1) return state
      const groups = [...state.groups]
      const [moved] = groups.splice(from, 1)
      const insertAt = groups.findIndex((group) => group.id === beforeId)
      groups.splice(insertAt === -1 ? groups.length : insertAt, 0, moved)
      return { ...state, groups }
    }

    function assignWorkspace(state, workspaceId, groupId) {
      const assignments = { ...state.assignments }
      if (groupId === null || groupId === undefined || !state.groups.some((group) => group.id === groupId)) {
        if (!(workspaceId in assignments)) return state
        delete assignments[workspaceId]
        return { ...state, assignments }
      }
      if (assignments[workspaceId] === groupId) return state
      assignments[workspaceId] = groupId
      return { ...state, assignments }
    }

    function toggleCollapsed(state, id) {
      if (!state.groups.some((group) => group.id === id)) return state
      const collapsed = state.collapsed.includes(id)
        ? state.collapsed.filter((entry) => entry !== id)
        : [...state.collapsed, id]
      return { ...state, collapsed }
    }

    function setAllCollapsed(state, collapsed) {
      return { ...state, collapsed: collapsed ? state.groups.map((group) => group.id) : [] }
    }

    function loadGroupState() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw === null) return emptyGroupState()
        return normalizeGroupState(JSON.parse(raw))
      } catch (_error) {
        return emptyGroupState()
      }
    }

    function saveGroupState(state) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch (_error) {
        /* A full or blocked storage keeps the in-memory state; nothing to surface. */
      }
    }

    // ---------------------------------------------------------------------
    // Session / workspace projection helpers
    // ---------------------------------------------------------------------

    function sessionVisible(summary, archivedSessionIds) {
      if (summary === null || summary === undefined) return false
      if (summary.origin === 'subagent') return false
      if (summary.blank === true) return false
      if (archivedSessionIds.has(summary.id)) return false
      return true
    }

    function sessionTitle(summary, t) {
      const title = typeof summary.title === 'string' ? summary.title.trim() : ''
      return title === '' ? t('untitled') : title
    }

    function basename(path) {
      if (typeof path !== 'string' || path === '') return ''
      const parts = path.split(/[\\/]+/).filter(Boolean)
      return parts.length === 0 ? path : parts[parts.length - 1]
    }

    function shortPath(path) {
      if (typeof path !== 'string' || path === '') return ''
      const parts = path.split(/[\\/]+/).filter(Boolean)
      if (path.length <= 44 || parts.length <= 2) return path
      return `…/${parts.slice(-2).join('/')}`
    }

    function workspaceName(workspace, t) {
      const title = typeof workspace.title === 'string' ? workspace.title.trim() : ''
      if (title === 'default-workspace') return t('defaultWorkspace')
      if (title !== '') return title
      return basename(workspace.path) || t('untitled')
    }

    function timeValue(value) {
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string' && value !== '') {
        const parsed = Date.parse(value)
        return Number.isFinite(parsed) ? parsed : 0
      }
      return 0
    }

    function sessionState(status) {
      if (status === undefined || status === null) return 'idle'
      if (status.pendingInteraction !== undefined && status.pendingInteraction !== null) return 'waiting'
      if (status.running === true) return 'running'
      if (status.completionUnread === true) return 'done'
      return 'idle'
    }

    function relativeTime(value, now, t) {
      const then = timeValue(value)
      if (then === 0) return ''
      const diff = Math.max(0, now - then)
      const minutes = Math.floor(diff / 60000)
      if (minutes < 1) return t('time.now')
      if (minutes < 60) return t('time.minutes', { n: minutes })
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return t('time.hours', { n: hours })
      const days = Math.floor(hours / 24)
      if (days < 30) return t('time.days', { n: days })
      const months = Math.floor(days / 30)
      if (months < 12) return t('time.months', { n: months })
      return t('time.years', { n: Math.floor(days / 365) })
    }

    /** Build one card per workspace, with visible member sessions newest-first. */
    function buildCards(workspaces, sessionsSnapshot, archivedSessionIds, pinnedSessionIds, t) {
      const byId = isRecord(sessionsSnapshot) && isRecord(sessionsSnapshot.byId) ? sessionsSnapshot.byId : {}
      const cards = []
      for (const workspace of Array.isArray(workspaces) ? workspaces : []) {
        const sessions = []
        for (const sessionId of Array.isArray(workspace.sessionIds) ? workspace.sessionIds : []) {
          const summary = byId[sessionId]
          if (!sessionVisible(summary, archivedSessionIds)) continue
          sessions.push({
            id: summary.id,
            title: sessionTitle(summary, t),
            updatedAt: timeValue(summary.updatedAt),
            pinned: pinnedSessionIds.has(summary.id),
          })
        }
        sessions.sort((left, right) => {
          if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
          return right.updatedAt - left.updatedAt
        })
        let lastActivity = 0
        for (const session of sessions) lastActivity = Math.max(lastActivity, session.updatedAt)
        if (sessions.length === 0) lastActivity = timeValue(workspace.updatedAt)
        cards.push({
          workspaceId: workspace.workspaceId,
          title: workspaceName(workspace, t),
          path: typeof workspace.path === 'string' ? workspace.path : '',
          sessions,
          count: sessions.length,
          lastActivity,
        })
      }
      cards.sort((left, right) => right.lastActivity - left.lastActivity || left.title.localeCompare(right.title))
      return cards
    }

    /** Keep cards whose workspace or any session matches the query. */
    function matchCards(cards, query) {
      const q = query.trim().toLowerCase()
      if (q === '') return cards.map((card) => ({ card, sessions: card.sessions, allSessions: false }))
      const matched = []
      for (const card of cards) {
        const workspaceMatch = card.title.toLowerCase().includes(q) || card.path.toLowerCase().includes(q)
        const hits = card.sessions.filter((session) => session.title.toLowerCase().includes(q))
        if (workspaceMatch) matched.push({ card, sessions: card.sessions, allSessions: false })
        else if (hits.length > 0) matched.push({ card, sessions: hits, allSessions: true })
      }
      return matched
    }

    function recentItems(cards, query, limit) {
      const q = query.trim().toLowerCase()
      const items = []
      for (const card of cards) {
        for (const session of card.sessions) {
          if (q !== '' && !session.title.toLowerCase().includes(q)) continue
          items.push({ ...session, workspaceId: card.workspaceId, workspaceTitle: card.title })
        }
      }
      items.sort((left, right) => right.updatedAt - left.updatedAt)
      return items.slice(0, limit)
    }

    // ---------------------------------------------------------------------
    // Styles
    // ---------------------------------------------------------------------

    const CSS = `
.dwv-page{height:100%;min-height:0;box-sizing:border-box;overflow:auto;padding:28px 36px 64px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:14px}
.dwv-inner{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:26px}
.dwv-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap}
.dwv-title{margin:0;font-size:22px;line-height:30px;font-weight:600;letter-spacing:-.01em}
.dwv-subtitle{margin:3px 0 0;font-size:13px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.dwv-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dwv-search{width:240px;height:32px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;font-size:13px;outline:none}
.dwv-search::placeholder{color:var(--dsw-alias-label-secondary)}
.dwv-search:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dwv-btn{height:32px;padding:0 12px;border-radius:8px;font:inherit;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.dwv-btn-primary{border:1px solid transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.dwv-btn-ghost{border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary)}
.dwv-btn-ghost:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent)}
.dwv-section{display:flex;flex-direction:column;gap:8px}
.dwv-section-title{margin:0;font-size:12px;line-height:18px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
.dwv-recent-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}
.dwv-recent-row{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dwv-recent-row:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent)}
.dwv-recent-ws{max-width:220px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:13px}
.dwv-recent-sep{color:var(--dsw-alias-label-secondary);flex:none}
.dwv-recent-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.dwv-recent-time{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dwv-group{display:flex;flex-direction:column;gap:10px;border-radius:12px;padding:4px;margin:-4px}
.dwv-group-drop{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,transparent);box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary)}
.dwv-group-head{display:flex;align-items:center;gap:8px;min-height:28px}
.dwv-group-toggle{width:20px;height:20px;flex:none;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0}
.dwv-group-toggle:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);color:var(--dsw-alias-label-primary)}
.dwv-chevron{display:inline-block;font-size:10px;line-height:1;transition:transform .15s ease}
.dwv-chevron-open{transform:rotate(90deg)}
.dwv-group-title{margin:0;font-size:14px;line-height:22px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:text}
.dwv-group-count{font-size:12px;color:var(--dsw-alias-label-secondary);flex:none}
.dwv-group-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dwv-color,var(--dsw-alias-state-idle-primary));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-bg-base) 42%,transparent)}
.dwv-group-dot-neutral{background:var(--dsw-alias-border-l2);box-shadow:none}
.dwv-head-spacer{width:20px;flex:none}
.dwv-grip{margin-left:auto;flex:none;padding:0 4px;color:var(--dsw-alias-label-secondary);cursor:grab;opacity:0;font-size:13px;line-height:20px;user-select:none}
.dwv-group-head:hover .dwv-grip,.dwv-group-head:focus-within .dwv-grip{opacity:1}
.dwv-rename{height:24px;min-width:120px;flex:1;padding:0 6px;border-radius:6px;border:1px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;font-size:14px;outline:none}
.dwv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(258px,1fr));gap:12px}
.dwv-card{position:relative;display:flex;flex-direction:column;gap:8px;min-width:0;padding:13px 14px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.dwv-card-tinted{background:color-mix(in srgb,var(--dwv-color) 6%,var(--dsw-alias-bg-layer-1));box-shadow:inset 0 2px 0 0 color-mix(in srgb,var(--dwv-color) 70%,transparent)}
.dwv-card-dragging{opacity:.45}
.dwv-card-head{display:flex;align-items:flex-start;gap:6px}
.dwv-card-title-block{flex:1;min-width:0}
.dwv-card-title{margin:0;font-size:14px;line-height:20px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dwv-card-path{margin:2px 0 0;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dwv-card-meta{margin:0;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary)}
.dwv-card-actions{display:flex;gap:0;flex:none;opacity:0}
.dwv-card:hover .dwv-card-actions,.dwv-card:focus-within .dwv-card-actions,.dwv-menu-open .dwv-card-actions{opacity:1}
.dwv-icon-btn{width:24px;height:24px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;padding:0}
.dwv-icon-btn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-primary)}
.dwv-session-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}
.dwv-session{display:flex;align-items:center;gap:6px;width:100%;height:28px;padding:0 6px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dwv-session:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent)}
.dwv-session-title{flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dwv-session-time{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary)}
.dwv-more{align-self:flex-start;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:20px;padding:0 6px;cursor:pointer}
.dwv-more:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);color:var(--dsw-alias-label-primary)}
.dwv-dot{width:6px;height:6px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary)}
.dwv-dot-running{background:var(--dsw-alias-brand-primary)}
.dwv-dot-waiting{background:var(--dsw-alias-state-warn-primary)}
.dwv-dot-done{background:var(--dsw-alias-state-success-primary)}
.dwv-menu-wrap{position:relative;display:inline-flex}
.dwv-menu{position:absolute;top:calc(100% + 4px);right:0;z-index:40;min-width:190px;max-height:320px;overflow:auto;padding:4px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);box-shadow:0 10px 28px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:1px}
.dwv-menu-label{padding:5px 8px 3px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}
.dwv-menu-item{display:flex;align-items:center;gap:6px;width:100%;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:13px;text-align:left;cursor:pointer}
.dwv-menu-item:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent)}
.dwv-menu-item[data-checked="true"]{color:var(--dsw-alias-brand-primary);font-weight:600}
.dwv-menu-item:disabled{opacity:.45;cursor:default}
.dwv-menu-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--sw)}
.dwv-swatch-rows{display:flex;flex-direction:column;gap:5px;padding:2px 8px 9px}
.dwv-swatches{display:flex;flex-wrap:wrap;gap:7px;padding:0}
.dwv-swatch{width:20px;height:20px;border:0;padding:0;border-radius:50%;cursor:pointer;background:var(--sw);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent)}
.dwv-swatch[data-selected="true"]{box-shadow:0 0 0 2px var(--dsw-alias-bg-overlay),0 0 0 3.5px var(--sw)}
.dwv-swatch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}
.dwv-menu-sep{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1)}
.dwv-drop{border:1px dashed var(--dsw-alias-border-l1);border-radius:10px;padding:14px;font-size:13px;color:var(--dsw-alias-label-secondary);text-align:center}
.dwv-drop-active{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 7%,transparent)}
.dwv-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:80px 16px;text-align:center}
.dwv-empty-title{margin:0;font-size:15px;font-weight:600}
.dwv-empty-body{margin:0;font-size:13px;color:var(--dsw-alias-label-secondary)}
.dwv-skeleton{height:132px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);background:linear-gradient(90deg,var(--dsw-alias-bg-layer-1),var(--dsw-alias-bg-layer-2),var(--dsw-alias-bg-layer-1));background-size:220% 100%;animation:dwv-shimmer 1.4s ease-in-out infinite}
@keyframes dwv-shimmer{0%{background-position:120% 0}100%{background-position:-20% 0}}
@media (prefers-reduced-motion:reduce){.dwv-chevron,.dwv-skeleton{transition:none;animation:none}}
`

    // ---------------------------------------------------------------------
    // Small components
    // ---------------------------------------------------------------------

    function useNow() {
      const [now, setNow] = useState(() => Date.now())
      useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30000)
        return () => clearInterval(timer)
      }, [])
      return now
    }

    function useDismiss(open, onDismiss) {
      const ref = useRef(null)
      useEffect(() => {
        if (!open) return undefined
        const onDown = (event) => {
          if (ref.current !== null && !ref.current.contains(event.target)) onDismiss()
        }
        const onKey = (event) => {
          if (event.key === 'Escape') onDismiss()
        }
        document.addEventListener('mousedown', onDown, true)
        document.addEventListener('keydown', onKey, true)
        return () => {
          document.removeEventListener('mousedown', onDown, true)
          document.removeEventListener('keydown', onKey, true)
        }
      }, [open, onDismiss])
      return ref
    }

    function StatusDot({ state, t }) {
      if (state === 'idle') return null
      const label = state === 'waiting' ? t('statusWaiting') : state === 'running' ? t('statusRunning') : t('statusDone')
      return h('span', { className: `dwv-dot dwv-dot-${state}`, title: label, 'aria-label': label })
    }

    function SessionRow({ session, now, t, state, onOpen }) {
      return h(
        'li',
        null,
        h(
          'button',
          {
            type: 'button',
            className: 'dwv-session',
            title: session.title,
            onClick: () => onOpen(session.id),
          },
          h(StatusDot, { state, t }),
          h('span', { className: 'dwv-session-title' }, session.title),
          h('span', { className: 'dwv-session-time' }, relativeTime(session.updatedAt, now, t)),
        ),
      )
    }

    function CardMenu({ card, groups, currentGroupId, t, onMove }) {
      const [open, setOpen] = useState(false)
      const close = useCallback(() => setOpen(false), [])
      const ref = useDismiss(open, close)
      const choices = [{ id: null, title: t('ungrouped'), color: undefined }, ...groups.map((group) => ({ id: group.id, title: group.title, color: group.color }))]
      return h(
        'div',
        { className: `dwv-menu-wrap${open ? ' dwv-menu-open' : ''}`, ref },
        h(
          'button',
          {
            type: 'button',
            className: 'dwv-icon-btn',
            'aria-haspopup': 'menu',
            'aria-expanded': open,
            title: t('moveTo'),
            onClick: () => setOpen((value) => !value),
          },
          '⋯',
        ),
        open
          ? h(
              'div',
              { className: 'dwv-menu', role: 'menu' },
              h('div', { className: 'dwv-menu-label' }, t('moveTo')),
              choices.map((choice) =>
                h(
                  'button',
                  {
                    key: choice.id === null ? '__ungrouped__' : choice.id,
                    type: 'button',
                    role: 'menuitemradio',
                    'aria-checked': (currentGroupId ?? null) === choice.id,
                    'data-checked': (currentGroupId ?? null) === choice.id ? 'true' : 'false',
                    className: 'dwv-menu-item',
                    onClick: () => {
                      close()
                      onMove(card.workspaceId, choice.id)
                    },
                  },
                  choice.color === undefined ? null : h('span', { className: 'dwv-menu-dot', style: { '--sw': colorValue(choice.color) } }),
                  choice.title,
                ),
              ),
            )
          : null,
      )
    }

    function WorkspaceCard({ entry, expanded, now, t, statuses, groups, currentGroupId, color, dragging, onOpenSession, onStartSession, onMove, onToggleExpand, onDragStart, onDragEnd }) {
      const card = entry.card
      const sessions = entry.allSessions ? entry.sessions : expanded ? card.sessions : card.sessions.slice(0, CARD_SESSION_LIMIT)
      const hidden = entry.allSessions ? 0 : Math.max(0, card.sessions.length - CARD_SESSION_LIMIT)
      return h(
        'article',
        {
          className: `dwv-card${color === undefined ? '' : ' dwv-card-tinted'}${dragging ? ' dwv-card-dragging' : ''}`,
          style: color === undefined ? undefined : { '--dwv-color': colorValue(color) },
          draggable: true,
          onDragStart: (event) => onDragStart(event, card.workspaceId),
          onDragEnd,
          'data-workspace-id': card.workspaceId,
        },
        h(
          'div',
          { className: 'dwv-card-head' },
          h(
            'div',
            { className: 'dwv-card-title-block' },
            h('h3', { className: 'dwv-card-title', title: card.title }, card.title),
            h('p', { className: 'dwv-card-path', title: card.path }, shortPath(card.path)),
          ),
          h(
            'div',
            { className: 'dwv-card-actions' },
            h(
              'button',
              { type: 'button', className: 'dwv-icon-btn', title: t('newSession'), 'aria-label': t('newSession'), onClick: () => onStartSession(card.workspaceId) },
              '＋',
            ),
            h(CardMenu, { card, groups, currentGroupId, t, onMove }),
          ),
        ),
        h('p', { className: 'dwv-card-meta' }, `${relativeTime(card.lastActivity, now, t)} · ${t(card.count === 1 ? 'sessions.one' : 'sessions.other', { n: card.count })}`),
        card.sessions.length === 0
          ? h('p', { className: 'dwv-card-meta' }, t('noSessions'))
          : h(
              'ul',
              { className: 'dwv-session-list' },
              sessions.map((session) =>
                h(SessionRow, {
                  key: session.id,
                  session,
                  now,
                  t,
                  state: sessionState(statuses.get(session.id)),
                  onOpen: onOpenSession,
                }),
              ),
            ),
        hidden > 0
          ? h(
              'button',
              {
                type: 'button',
                className: 'dwv-more',
                onClick: () => onToggleExpand(card.workspaceId),
                'aria-expanded': expanded,
              },
              expanded ? t('collapse') : t('showAll', { n: hidden }),
            )
          : null,
      )
    }

    function GroupSection({ group, entries, collapsed, dropActive, now, t, statuses, groups, assignments, expandedCards, onToggleCollapse, onRename, onColor, onDelete, onMoveUp, onMoveDown, onOpenSession, onStartSession, onMoveWorkspace, onToggleExpand, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onGroupDragStart, canMoveUp, canMoveDown }) {
      const [menuOpen, setMenuOpen] = useState(false)
      const [confirming, setConfirming] = useState(false)
      const [editing, setEditing] = useState(false)
      const [draft, setDraft] = useState(group.title)
      const closeMenu = useCallback(() => {
        setMenuOpen(false)
        setConfirming(false)
      }, [])
      const menuRef = useDismiss(menuOpen, closeMenu)

      useEffect(() => {
        if (!editing) setDraft(group.title)
      }, [group.title, editing])

      const commit = () => {
        const value = draft.trim()
        setEditing(false)
        if (value !== '' && value !== group.title) onRename(group.id, value)
      }

      return h(
        'section',
        {
          className: `dwv-group${dropActive ? ' dwv-group-drop' : ''}`,
          style: { '--dwv-color': colorValue(group.color) },
          onDragOver,
          onDragLeave,
          onDrop,
          'data-group-id': group.id,
        },
        h(
          'header',
          { className: 'dwv-group-head' },
          h(
            'button',
            {
              type: 'button',
              className: 'dwv-group-toggle',
              'aria-expanded': !collapsed,
              'aria-label': collapsed ? t('expandAll') : t('collapseAll'),
              onClick: () => onToggleCollapse(group.id),
            },
            h('span', { className: `dwv-chevron${collapsed ? '' : ' dwv-chevron-open'}` }, '▶'),
          ),
          h('span', { className: 'dwv-group-dot', 'aria-hidden': true, title: t('groupColor') }),
          editing
            ? h('input', {
                className: 'dwv-rename',
                value: draft,
                autoFocus: true,
                onChange: (event) => setDraft(event.target.value),
                onBlur: commit,
                onKeyDown: (event) => {
                  if (event.key === 'Enter') commit()
                  if (event.key === 'Escape') {
                    setDraft(group.title)
                    setEditing(false)
                  }
                },
              })
            : h(
                'h2',
                {
                  className: 'dwv-group-title',
                  title: group.title,
                  onDoubleClick: () => setEditing(true),
                },
                group.title,
              ),
          h('span', { className: 'dwv-group-count' }, t('workspaces', { n: entries.length })),
          h(
            'span',
            {
              className: 'dwv-grip',
              draggable: true,
              title: t('moveUp'),
              onDragStart: (event) => onGroupDragStart(event, group.id),
              onDragEnd,
            },
            '⠿',
          ),
          h(
            'div',
            { className: `dwv-menu-wrap${menuOpen ? ' dwv-menu-open' : ''}`, ref: menuRef },
            h(
              'button',
              {
                type: 'button',
                className: 'dwv-icon-btn',
                'aria-haspopup': 'menu',
                'aria-expanded': menuOpen,
                onClick: () => setMenuOpen((value) => !value),
              },
              '⋯',
            ),
            menuOpen
              ? h(
                  'div',
                  { className: 'dwv-menu', role: 'menu' },
                  h('button', { type: 'button', className: 'dwv-menu-item', onClick: () => { closeMenu(); setEditing(true) } }, t('rename')),
                  h('button', { type: 'button', className: 'dwv-menu-item', disabled: !canMoveUp, onClick: () => { closeMenu(); onMoveUp(group.id) } }, t('moveUp')),
                  h('button', { type: 'button', className: 'dwv-menu-item', disabled: !canMoveDown, onClick: () => { closeMenu(); onMoveDown(group.id) } }, t('moveDown')),
                  h('div', { className: 'dwv-menu-label' }, t('groupColor')),
                  h(
                    'div',
                    { className: 'dwv-swatch-rows' },
                    GROUP_PALETTES.map((palette) =>
                      h(
                        'div',
                        { key: palette.id, className: 'dwv-swatches' },
                        palette.colors.map((entry) =>
                          h('button', {
                            key: entry.id,
                            type: 'button',
                            className: 'dwv-swatch',
                            style: { '--sw': entry.value },
                            'data-selected': group.color === entry.id ? 'true' : 'false',
                            'aria-pressed': group.color === entry.id,
                            title: t(`color.${entry.id}`),
                            'aria-label': t(`color.${entry.id}`),
                            onClick: () => onColor(group.id, entry.id),
                          }),
                        ),
                      ),
                    ),
                  ),
                  h('div', { className: 'dwv-menu-sep' }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dwv-menu-item',
                      onClick: () => {
                        if (!confirming) {
                          setConfirming(true)
                          return
                        }
                        closeMenu()
                        onDelete(group.id)
                      },
                    },
                    confirming ? t('confirmDelete') : t('deleteGroup'),
                  ),
                )
              : null,
          ),
        ),
        collapsed
          ? null
          : entries.length === 0
            ? h('div', { className: `dwv-drop${dropActive ? ' dwv-drop-active' : ''}` }, t('emptyGroup'))
            : h(
                'div',
                { className: 'dwv-grid' },
                entries.map((entry) =>
                  h(WorkspaceCard, {
                    key: entry.card.workspaceId,
                    entry,
                    expanded: expandedCards.has(entry.card.workspaceId),
                    now,
                    t,
                    statuses,
                    groups,
                    currentGroupId: assignments[entry.card.workspaceId],
                    color: group.color,
                    dragging: false,
                    onOpenSession,
                    onStartSession,
                    onMove: onMoveWorkspace,
                    onToggleExpand,
                    onDragStart,
                    onDragEnd,
                  }),
                ),
              ),
      )
    }

    function OverviewPage(props) {
      const { t, useWorkspaces, useSessions, useSessionStatus, openSession, startSession } = props
      const workspaceSnapshot = useWorkspaces((state) => state)
      const sessionsSnapshot = useSessions((state) => state)
      const statusSnapshot = useSessionStatus((state) => state)
      const statuses = statusSnapshot instanceof Map ? statusSnapshot : new Map()
      const now = useNow()

      const [groups, setGroups] = useState(loadGroupState)
      const [query, setQuery] = useState('')
      const [expandedCards, setExpandedCards] = useState(() => new Set())
      const [dragging, setDragging] = useState(null)
      const [dropTarget, setDropTarget] = useState(undefined)

      const mutate = useCallback((change) => {
        setGroups((previous) => {
          const next = change(previous)
          if (next === previous) return previous
          saveGroupState(next)
          return next
        })
      }, [])

      const archived = useMemo(() => new Set(Array.isArray(workspaceSnapshot.archivedSessionIds) ? workspaceSnapshot.archivedSessionIds : []), [workspaceSnapshot.archivedSessionIds])
      const pinned = useMemo(() => new Set(Array.isArray(workspaceSnapshot.pinnedSessionIds) ? workspaceSnapshot.pinnedSessionIds : []), [workspaceSnapshot.pinnedSessionIds])

      const cards = useMemo(
        () => buildCards(workspaceSnapshot.items, sessionsSnapshot, archived, pinned, t),
        [workspaceSnapshot.items, sessionsSnapshot, archived, pinned, t],
      )

      const entries = useMemo(() => matchCards(cards, query), [cards, query])
      const recent = useMemo(() => recentItems(cards, query, RECENT_LIMIT), [cards, query])

      const sessionTotal = useMemo(() => cards.reduce((sum, card) => sum + card.count, 0), [cards])

      const grouped = useMemo(() => {
        const sections = groups.groups.map((group) => ({ group, entries: [] }))
        const byId = new Map(sections.map((section) => [section.group.id, section]))
        const loose = []
        for (const entry of entries) {
          const groupId = groups.assignments[entry.card.workspaceId]
          const section = groupId === undefined ? undefined : byId.get(groupId)
          if (section === undefined) loose.push(entry)
          else section.entries.push(entry)
        }
        for (const section of sections) section.entries.sort((left, right) => right.card.lastActivity - left.card.lastActivity)
        loose.sort((left, right) => right.card.lastActivity - left.card.lastActivity)
        return { sections, loose }
      }, [entries, groups])

      const allCollapsed = groups.groups.length > 0 && groups.groups.every((group) => groups.collapsed.includes(group.id))

      const toggleCard = useCallback((workspaceId) => {
        setExpandedCards((previous) => {
          const next = new Set(previous)
          if (next.has(workspaceId)) next.delete(workspaceId)
          else next.add(workspaceId)
          return next
        })
      }, [])

      const createGroup = () => {
        const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
        mutate((previous) => createGroupState(previous, id, t('newGroupDefault')))
      }

      const cardDragStart = (event, workspaceId) => {
        if (event.dataTransfer !== null && event.dataTransfer !== undefined) {
          event.dataTransfer.setData('text/plain', workspaceId)
          event.dataTransfer.effectAllowed = 'move'
        }
        setDragging({ kind: 'card', id: workspaceId })
      }

      const groupDragStart = (event, groupId) => {
        if (event.dataTransfer !== null && event.dataTransfer !== undefined) {
          event.dataTransfer.setData('text/plain', groupId)
          event.dataTransfer.effectAllowed = 'move'
        }
        setDragging({ kind: 'group', id: groupId })
      }

      const endDrag = () => {
        setDragging(null)
        setDropTarget(undefined)
      }

      const cardOver = (event, target) => {
        if (dragging === null) return
        // Any in-flight drag must accept the drop here, otherwise the browser
        // cancels it; only card drags paint a drop target.
        event.preventDefault()
        if (dragging.kind !== 'card') return
        if (dropTarget !== target) setDropTarget(target)
      }

      const cardLeave = (event, target) => {
        if (dropTarget !== target) return
        const related = event.relatedTarget
        if (related !== null && event.currentTarget.contains(related)) return
        setDropTarget(undefined)
      }

      const dropOnGroup = (event, groupId) => {
        event.preventDefault()
        if (dragging !== null && dragging.kind === 'card') {
          const workspaceId = dragging.id
          mutate((previous) => assignWorkspace(previous, workspaceId, groupId))
        }
        endDrag()
      }

      const dropOnHeader = (event, groupId) => {
        if (dragging !== null && dragging.kind === 'group') {
          event.preventDefault()
          const source = dragging.id
          mutate((previous) => reorderGroup(previous, source, groupId))
          endDrag()
          return
        }
        dropOnGroup(event, groupId)
      }

      const renderCard = (entry) =>
        h(WorkspaceCard, {
          key: entry.card.workspaceId,
          entry,
          expanded: expandedCards.has(entry.card.workspaceId),
          now,
          t,
          statuses,
          groups: groups.groups,
          currentGroupId: groups.assignments[entry.card.workspaceId],
          color: (groups.groups.find((group) => group.id === groups.assignments[entry.card.workspaceId]) ?? {}).color,
          dragging: dragging !== null && dragging.kind === 'card' && dragging.id === entry.card.workspaceId,
          onOpenSession: openSession,
          onStartSession: startSession,
          onMove: (workspaceId, groupId) => mutate((previous) => assignWorkspace(previous, workspaceId, groupId)),
          onToggleExpand: toggleCard,
          onDragStart: cardDragStart,
          onDragEnd: endDrag,
        })

      if (workspaceSnapshot.phase !== 'ready' && cards.length === 0) {
        return h(
          'div',
          { className: 'dwv-page' },
          h(
            'div',
            { className: 'dwv-inner' },
            h('div', { className: 'dwv-head' }, h('div', null, h('h1', { className: 'dwv-title' }, t('title')))),
            h('div', { className: 'dwv-grid' }, [0, 1, 2, 3].map((index) => h('div', { key: index, className: 'dwv-skeleton' }))),
          ),
        )
      }

      return h(
        'div',
        { className: 'dwv-page' },
        h(
          'div',
          { className: 'dwv-inner' },
          h(
            'header',
            { className: 'dwv-head' },
            h(
              'div',
              null,
              h('h1', { className: 'dwv-title' }, t('title')),
              h('p', { className: 'dwv-subtitle' }, t('subtitle', { workspaces: cards.length, sessions: sessionTotal })),
            ),
            h(
              'div',
              { className: 'dwv-tools' },
              h('input', {
                className: 'dwv-search',
                type: 'search',
                value: query,
                placeholder: t('searchPlaceholder'),
                'aria-label': t('searchPlaceholder'),
                onChange: (event) => setQuery(event.target.value),
              }),
              h(
                'button',
                { type: 'button', className: 'dwv-btn dwv-btn-ghost', onClick: () => mutate((previous) => setAllCollapsed(previous, !allCollapsed)) },
                allCollapsed ? t('expandAll') : t('collapseAll'),
              ),
              h('button', { type: 'button', className: 'dwv-btn dwv-btn-primary', onClick: createGroup }, t('newGroup')),
            ),
          ),

          recent.length > 0
            ? h(
                'section',
                { className: 'dwv-section' },
                h('h2', { className: 'dwv-section-title' }, t('recent')),
                h(
                  'ul',
                  { className: 'dwv-recent-list' },
                  recent.map((item) =>
                    h(
                      'li',
                      { key: item.id },
                      h(
                        'button',
                        { type: 'button', className: 'dwv-recent-row', title: item.title, onClick: () => openSession(item.id) },
                        h(StatusDot, { state: sessionState(statuses.get(item.id)), t }),
                        h('span', { className: 'dwv-recent-ws' }, item.workspaceTitle),
                        h('span', { className: 'dwv-recent-sep' }, '·'),
                        h('span', { className: 'dwv-recent-title' }, item.title),
                        h('span', { className: 'dwv-recent-time' }, relativeTime(item.updatedAt, now, t)),
                      ),
                    ),
                  ),
                ),
              )
            : null,

          cards.length === 0
            ? h(
                'div',
                { className: 'dwv-empty' },
                h('p', { className: 'dwv-empty-title' }, t('emptyTitle')),
                h('p', { className: 'dwv-empty-body' }, t('emptyBody')),
              )
            : query.trim() !== ''
              ? h(
                  'section',
                  { className: 'dwv-section' },
                  h('h2', { className: 'dwv-section-title' }, t('searchResults')),
                  entries.length === 0
                    ? h('div', { className: 'dwv-drop' }, t('noResults'))
                    : h('div', { className: 'dwv-grid' }, entries.map(renderCard)),
                )
              : h(
                  'div',
                  { className: 'dwv-section' },
                  grouped.sections.map((section, index) => {
                    const collapsed = groups.collapsed.includes(section.group.id)
                    const target = section.group.id
                    return h(GroupSection, {
                      key: section.group.id,
                      group: section.group,
                      entries: section.entries,
                      collapsed,
                      dropActive: dropTarget === 'group:' + section.group.id,
                      now,
                      t,
                      statuses,
                      groups: groups.groups,
                      assignments: groups.assignments,
                      expandedCards,
                      onToggleCollapse: (groupId) => mutate((previous) => toggleCollapsed(previous, groupId)),
                      onRename: (groupId, title) => mutate((previous) => renameGroup(previous, groupId, title)),
                      onColor: (groupId, colorId) => mutate((previous) => setGroupColor(previous, groupId, colorId)),
                      onDelete: (groupId) => mutate((previous) => deleteGroup(previous, groupId)),
                      onMoveUp: (groupId) => mutate((previous) => moveGroup(previous, groupId, -1)),
                      onMoveDown: (groupId) => mutate((previous) => moveGroup(previous, groupId, 1)),
                      onOpenSession: openSession,
                      onStartSession: startSession,
                      onMoveWorkspace: (workspaceId, groupId) => mutate((previous) => assignWorkspace(previous, workspaceId, groupId)),
                      onToggleExpand: toggleCard,
                      onDragStart: cardDragStart,
                      onDragEnd: endDrag,
                      onDragOver: (event) => cardOver(event, 'group:' + target),
                      onDragLeave: (event) => cardLeave(event, 'group:' + target),
                      onDrop: (event) => dropOnHeader(event, target),
                      onGroupDragStart: groupDragStart,
                      canMoveUp: index > 0,
                      canMoveDown: index < grouped.sections.length - 1,
                    })
                  }),
                  grouped.loose.length > 0 || cards.length > 0
                    ? h(
                        'section',
                        {
                          className: `dwv-group${dropTarget === 'ungrouped' ? ' dwv-group-drop' : ''}`,
                          onDragOver: (event) => cardOver(event, 'ungrouped'),
                          onDragLeave: (event) => cardLeave(event, 'ungrouped'),
                          onDrop: (event) => dropOnGroup(event, null),
                        },
                          h(
                            'header',
                            { className: 'dwv-group-head' },
                            h('span', { className: 'dwv-head-spacer', 'aria-hidden': true }),
                            h('span', { className: 'dwv-group-dot dwv-group-dot-neutral', 'aria-hidden': true }),
                            h('span', { className: 'dwv-group-title' }, t('ungrouped')),
                            h('span', { className: 'dwv-group-count' }, t('workspaces', { n: grouped.loose.length })),
                          ),
                        grouped.loose.length === 0
                          ? h('div', { className: `dwv-drop${dropTarget === 'ungrouped' ? ' dwv-drop-active' : ''}` }, t('emptyDrop'))
                          : h('div', { className: 'dwv-grid' }, grouped.loose.map(renderCard)),
                      )
                    : null,
                ),
        ),
      )
    }

    function PanelIcon({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 16
      return h(
        'svg',
        { width: edge, height: edge, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, focusable: 'false' },
        h('rect', { x: 1.6, y: 1.6, width: 5.1, height: 5.1, rx: 1.3, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('rect', { x: 9.3, y: 1.6, width: 5.1, height: 5.1, rx: 1.3, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('rect', { x: 1.6, y: 9.3, width: 12.8, height: 5.1, rx: 1.3, stroke: 'currentColor', strokeWidth: 1.3 }),
      )
    }

    // ---------------------------------------------------------------------
    // Plugin
    // ---------------------------------------------------------------------

    return {
      inject: ['slots', 'layout', 'uiWorkspace', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-workspace-view: dictionaries')
        const t = ctx.locale.bind(NS)

        ctx.effect(() => {
          const tag = document.createElement('style')
          tag.dataset.plugin = 'dsh-workspace-view'
          tag.textContent = CSS
          document.head.appendChild(tag)
          return () => tag.remove()
        }, 'dsh-workspace-view: styles')

        const openSession = (sessionId) => {
          ctx.layout.selectPanel(null)
          ctx.uiWorkspace.openSession(sessionId)
        }
        const startSession = (workspaceId) => {
          ctx.layout.selectPanel(null)
          ctx.uiWorkspace.startSession(workspaceId)
        }

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
              inject: () => ({ openSession, startSession }),
            },
            OverviewPage,
          ),
        )

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 30,
              label: () => t('panel'),
              locale: NS,
            },
            PanelIcon,
          ),
        )
      },
      _internal: {
        normalizeGroupState,
        createGroupState,
        renameGroup,
        deleteGroup,
        moveGroup,
        reorderGroup,
        assignWorkspace,
        toggleCollapsed,
        setAllCollapsed,
        uniqueGroupTitle,
        sessionVisible,
        buildCards,
        matchCards,
        recentItems,
        relativeTime,
        workspaceName,
        shortPath,
        emptyGroupState,
        GROUP_COLORS,
        colorValue,
        nextGroupColor,
        setGroupColor,
        OverviewPage,
        PanelIcon,
      },
    }
  },
})
