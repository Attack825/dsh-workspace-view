import test from 'node:test'
import assert from 'node:assert/strict'

let captured
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      captured = definition
    },
  },
}

await import('../client.js')

assert.equal(captured.id, 'dsh-workspace-view')

const fakeReact = {
  createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children } }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useMemo: (factory) => factory(),
  useRef: () => ({ current: null }),
  useCallback: (fn) => fn,
}

const api = captured.factory(() => fakeReact)
const {
  emptyGroupState,
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
  OverviewPage,
  GROUP_COLORS,
  colorValue,
  nextGroupColor,
  setGroupColor,
} = api._internal

const t = (key, values = {}) => {
  const dict = {
    untitled: '未命名',
    defaultWorkspace: '默认工作区',
    title: '工作区总览',
    subtitle: '{workspaces} 个工作区 · {sessions} 条会话',
    recent: '最近活动',
    ungrouped: '未分组',
    searchPlaceholder: '搜索',
    newGroup: '新建分组',
    collapseAll: '全部收起',
    expandAll: '全部展开',
    workspaces: '{n} 个工作区',
    'sessions.one': '{n} 条会话',
    'sessions.other': '{n} 条会话',
    moveTo: '移动到分组',
    newSession: '新会话',
    noSessions: '还没有会话',
    emptyTitle: '还没有工作区',
    emptyBody: '先在左侧栏添加工作区。',
    'time.now': '刚刚',
    'time.minutes': '{n} 分钟前',
    'time.hours': '{n} 小时前',
    'time.days': '{n} 天前',
    'time.months': '{n} 个月前',
    'time.years': '{n} 年前',
  }
  const text = dict[key] ?? key
  return text.replace(/\{(\w+)\}/g, (_match, name) => String(values[name] ?? `{${name}}`))
}

/** Flatten a virtual element tree into the strings a reader would see. */
function renderedText(node, out = []) {
  if (node === null || node === undefined || node === false || node === true) return out
  if (Array.isArray(node)) {
    for (const child of node) renderedText(child, out)
    return out
  }
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  if (typeof node.type === 'function') return renderedText(node.type(node.props), out)
  renderedText(node.props?.children ?? [], out)
  return out
}

function renderedClasses(node, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const child of node) renderedClasses(child, out)
    return out
  }
  if (typeof node.type === 'function') return renderedClasses(node.type(node.props), out)
  if (typeof node.props?.className === 'string') out.push(node.props.className)
  renderedClasses(node.props?.children ?? [], out)
  return out
}

const state = (groups = [], assignments = {}, collapsed = []) => ({
  version: 1,
  groups,
  assignments,
  collapsed,
})

test('normalizeGroupState rejects unknown versions and non objects', () => {
  assert.deepEqual(normalizeGroupState(null), emptyGroupState())
  assert.deepEqual(normalizeGroupState('x'), emptyGroupState())
  assert.deepEqual(normalizeGroupState({ version: 2, groups: [{ id: 'a', title: 'A' }] }), emptyGroupState())
})

test('normalizeGroupState drops malformed groups, duplicate titles and unknown assignments', () => {
  const normalized = normalizeGroupState({
    version: 1,
    groups: [
      { id: 'a', title: '毕业' },
      { id: 'b', title: '毕业' },
      { id: 'c', title: '   ' },
      { id: 'a', title: 'dup id' },
      { id: 'd', title: '实习' },
    ],
    assignments: { w1: 'a', w2: 'missing', w3: 42 },
    collapsed: ['a', 'missing', 'a'],
  })
  assert.deepEqual(normalized.groups, [
    { id: 'a', title: '毕业', color: 'lake' },
    { id: 'd', title: '实习', color: 'jade' },
  ])
  assert.deepEqual(normalized.assignments, { w1: 'a' })
  assert.deepEqual(normalized.collapsed, ['a'])
})

test('createGroupState appends and keeps titles unique', () => {
  const one = createGroupState(state(), 'g1', '毕业')
  const two = createGroupState(one, 'g2', '毕业')
  assert.deepEqual(two.groups.map((group) => group.title), ['毕业', '毕业 2'])
  assert.equal(createGroupState(two, 'g1', 'other'), two)
})

test('renameGroup keeps uniqueness and ignores unknown groups', () => {
  const before = state([{ id: 'g1', title: 'A' }, { id: 'g2', title: 'B' }])
  const renamed = renameGroup(before, 'g2', 'A')
  assert.equal(renamed.groups[1].title, 'A 2')
  assert.equal(renameGroup(before, 'nope', 'C'), before)
})

test('deleteGroup drops the group and its assignments but keeps the rest', () => {
  const before = state(
    [{ id: 'g1', title: 'A' }, { id: 'g2', title: 'B' }],
    { w1: 'g1', w2: 'g2' },
    ['g1'],
  )
  const after = deleteGroup(before, 'g1')
  assert.deepEqual(after.groups, [{ id: 'g2', title: 'B' }])
  assert.deepEqual(after.assignments, { w2: 'g2' })
  assert.deepEqual(after.collapsed, [])
})

test('moveGroup and reorderGroup respect boundaries', () => {
  const before = state([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }])
  assert.deepEqual(moveGroup(before, 'a', -1), before)
  assert.deepEqual(moveGroup(before, 'c', 1), before)
  assert.deepEqual(moveGroup(before, 'c', -1).groups.map((group) => group.id), ['a', 'c', 'b'])
  assert.deepEqual(reorderGroup(before, 'c', 'a').groups.map((group) => group.id), ['c', 'a', 'b'])
  assert.equal(reorderGroup(before, 'a', 'a'), before)
})

test('assignWorkspace only accepts live groups and clears on null', () => {
  const before = state([{ id: 'g1', title: 'A' }])
  const assigned = assignWorkspace(before, 'w1', 'g1')
  assert.deepEqual(assigned.assignments, { w1: 'g1' })
  assert.equal(assignWorkspace(assigned, 'w1', 'g1'), assigned)
  assert.deepEqual(assignWorkspace(assigned, 'w1', null).assignments, {})
  assert.deepEqual(assignWorkspace(assigned, 'w1', 'gone').assignments, {})
})

test('collapse helpers toggle per group and across all groups', () => {
  const before = state([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }])
  const collapsed = toggleCollapsed(before, 'a')
  assert.deepEqual(collapsed.collapsed, ['a'])
  assert.deepEqual(toggleCollapsed(collapsed, 'a').collapsed, [])
  assert.deepEqual(setAllCollapsed(before, true).collapsed, ['a', 'b'])
  assert.deepEqual(setAllCollapsed(collapsed, false).collapsed, [])
})

test('uniqueGroupTitle falls back to a non-empty base', () => {
  assert.equal(uniqueGroupTitle([], '   '), 'Group')
  assert.equal(uniqueGroupTitle([{ id: 'x', title: 'Group' }], ''), 'Group 2')
})

test('the palette is the two supplied five-color sets, kept distinct', () => {
  assert.equal(GROUP_COLORS.length, 10)
  assert.equal(new Set(GROUP_COLORS.map((entry) => entry.id)).size, 10)
  assert.equal(new Set(GROUP_COLORS.map((entry) => entry.value)).size, 10)
  assert.deepEqual(GROUP_COLORS.map((entry) => entry.value), [
    '#20B0DC', '#3FCD41', '#DFE446', '#FDA251', '#E82EB4',
    '#FD814E', '#FCBC52', '#A4D984', '#F588AF', '#F26386',
  ])
  assert.equal(colorValue('apricot'), '#FDA251')
  assert.equal(colorValue('nope'), GROUP_COLORS[0].value)
})

test('new groups take the next unused palette color and cycle once all are used', () => {
  let next = emptyGroupState()
  for (let index = 0; index < 10; index += 1) next = createGroupState(next, `g${index}`, `G${index}`)
  assert.deepEqual(next.groups.map((group) => group.color), GROUP_COLORS.map((entry) => entry.id))
  const extra = createGroupState(next, 'g10', 'G10')
  assert.equal(extra.groups[10].color, GROUP_COLORS[0].id)
  assert.equal(nextGroupColor(next.groups), 'lake')
})

test('setGroupColor validates ids and keeps the state on unknown or equal values', () => {
  const before = state([{ id: 'g1', title: 'A', color: 'jade' }])
  assert.equal(setGroupColor(before, 'g1', 'nope'), before)
  assert.equal(setGroupColor(before, 'g1', 'jade'), before)
  assert.equal(setGroupColor(before, 'missing', 'lake'), before)
  assert.equal(setGroupColor(before, 'g1', 'lake').groups[0].color, 'lake')
})

test('normalizeGroupState keeps explicit colors and fills missing or unknown ones', () => {
  const normalized = normalizeGroupState({
    version: 1,
    groups: [
      { id: 'a', title: 'A', color: 'apricot' },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C', color: 'bogus' },
    ],
  })
  assert.deepEqual(normalized.groups.map((group) => group.color), ['apricot', 'lake', 'jade'])
})

test('sessionVisible hides subagents, blanks and archived sessions', () => {
  const archived = new Set(['archived'])
  assert.equal(sessionVisible({ id: 'a' }, archived), true)
  assert.equal(sessionVisible({ id: 'a', origin: 'subagent' }, archived), false)
  assert.equal(sessionVisible({ id: 'a', blank: true }, archived), false)
  assert.equal(sessionVisible({ id: 'archived' }, archived), false)
  assert.equal(sessionVisible(undefined, archived), false)
})

test('workspaceName falls back to the path basename and localizes the default workspace', () => {
  assert.equal(workspaceName({ title: 'default-workspace', path: 'D:\\ws' }, t), '默认工作区')
  assert.equal(workspaceName({ title: '  ', path: 'D:\\ws' }, t), 'ws')
  assert.equal(workspaceName({ title: '我的项目', path: 'D:\\ws' }, t), '我的项目')
})

test('shortPath keeps short paths and trims long ones to two segments', () => {
  assert.equal(shortPath('D:\\a\\b'), 'D:\\a\\b')
  assert.equal(shortPath('D:\\' + 'x'.repeat(50) + '\\deep\\project'), '…/deep/project')
  assert.equal(shortPath(''), '')
})

test('buildCards keeps pinned sessions first, counts visible sessions and sorts cards by activity', () => {
  const workspaces = [
    { workspaceId: 'w1', title: 'Alpha', path: 'D:\\alpha', sessionIds: ['s1', 's2', 's3'], updatedAt: '2026-01-01T00:00:00Z' },
    { workspaceId: 'w2', title: 'Beta', path: 'D:\\beta', sessionIds: ['s4'], updatedAt: '2026-06-01T00:00:00Z' },
  ]
  const snapshot = {
    ids: ['s1', 's2', 's3', 's4'],
    byId: {
      s1: { id: 's1', title: 'older', updatedAt: '2026-01-01T00:00:00Z' },
      s2: { id: 's2', title: 'pinned older', updatedAt: '2025-12-01T00:00:00Z' },
      s3: { id: 's3', title: 'child run', origin: 'subagent', updatedAt: '2026-05-01T00:00:00Z' },
      s4: { id: 's4', blank: true, updatedAt: '2026-05-20T00:00:00Z' },
    },
  }
  const cards = buildCards(workspaces, snapshot, new Set(['s1']), new Set(['s1', 's2']), t)
  assert.equal(cards.length, 2)
  const beta = cards.find((card) => card.workspaceId === 'w2')
  assert.equal(beta.count, 0)
  assert.equal(beta.sessions.length, 0)
  assert.equal(beta.lastActivity, Date.parse('2026-06-01T00:00:00Z'))
  // s1 is archived, so only the pinned-but-older s2 remains visible in Alpha.
  const alpha = cards.find((card) => card.workspaceId === 'w1')
  assert.deepEqual(alpha.sessions.map((session) => session.id), ['s2'])
  assert.equal(alpha.count, 1)
})

test('matchCards matches the workspace or narrows sessions to title hits', () => {
  const cards = [
    {
      workspaceId: 'w1',
      title: '车桩监测',
      path: 'D:\\car',
      sessions: [
        { id: 's1', title: '修充电桩', updatedAt: 3 },
        { id: 's2', title: '写文档', updatedAt: 2 },
      ],
      count: 2,
      lastActivity: 3,
    },
  ]
  assert.equal(matchCards(cards, '').length, 1)
  const byWorkspace = matchCards(cards, '车桩')
  assert.equal(byWorkspace[0].sessions.length, 2)
  const bySession = matchCards(cards, '文档')
  assert.deepEqual(bySession[0].sessions.map((session) => session.id), ['s2'])
  assert.equal(bySession[0].allSessions, true)
  assert.equal(matchCards(cards, 'nope').length, 0)
})

test('recentItems takes the newest sessions across workspaces and respects the query', () => {
  const cards = [
    {
      workspaceId: 'w1',
      title: 'A',
      path: '',
      sessions: [
        { id: 's1', title: 'one', updatedAt: 5 },
        { id: 's2', title: 'two', updatedAt: 1 },
      ],
      count: 2,
      lastActivity: 5,
    },
    {
      workspaceId: 'w2',
      title: 'B',
      path: '',
      sessions: [{ id: 's3', title: 'three', updatedAt: 9 }],
      count: 1,
      lastActivity: 9,
    },
  ]
  assert.deepEqual(recentItems(cards, '', 2).map((item) => item.id), ['s3', 's1'])
  assert.deepEqual(recentItems(cards, 'two', 5).map((item) => item.id), ['s2'])
})

test('relativeTime buckets follow the documented wording', () => {
  const now = Date.parse('2026-11-10T12:00:00Z')
  const at = (iso) => relativeTime(iso, now, t)
  assert.equal(at('2026-11-10T11:59:40Z'), '刚刚')
  assert.equal(at('2026-11-10T11:30:00Z'), '30 分钟前')
  assert.equal(at('2026-11-10T09:00:00Z'), '3 小时前')
  assert.equal(at('2026-11-07T12:00:00Z'), '3 天前')
  assert.equal(at('2026-09-01T12:00:00Z'), '2 个月前')
  assert.equal(at('2024-01-01T12:00:00Z'), '2 年前')
  assert.equal(at(undefined), '')
})

// ---------------------------------------------------------------------------
// Page render smoke tests: the real component tree runs against fake hooks.
// ---------------------------------------------------------------------------

const nowIso = () => new Date().toISOString()

function pageProps(groupsValue) {
  const localStorage = new Map()
  if (groupsValue !== undefined) localStorage.set('dsh-workspace-view/groups/v1', JSON.stringify(groupsValue))
  globalThis.window.localStorage = {
    getItem: (key) => (localStorage.has(key) ? localStorage.get(key) : null),
    setItem: (key, value) => localStorage.set(key, value),
    removeItem: (key) => localStorage.delete(key),
  }
  return {
    t,
    useWorkspaces: () => ({
      items: [
        { workspaceId: 'w1', title: '车桩监测', path: 'D:\\Project\\car', sessionIds: ['s1', 's2'], createdAt: nowIso(), updatedAt: nowIso() },
        { workspaceId: 'w2', title: '实习2026', path: 'D:\\Project\\intern', sessionIds: ['s3'], createdAt: nowIso(), updatedAt: nowIso() },
      ],
      phase: 'ready',
      archivedSessionIds: [],
      pinnedSessionIds: [],
    }),
    useSessions: () => ({
      ids: ['s1', 's2', 's3'],
      byId: {
        s1: { id: 's1', title: '本地启动与功能文档编写', updatedAt: nowIso() },
        s2: { id: 's2', title: '修复充电桩超时', updatedAt: nowIso() },
        s3: { id: 's3', title: '简历制作规则整理', updatedAt: nowIso() },
      },
      projectionsBySession: {},
    }),
    useSessionStatus: () => new Map([['s2', { running: true }]]),
    openSession: () => {},
    startSession: () => {},
  }
}

test('the overview page renders recent activity, cards and the ungrouped bucket', () => {
  const element = OverviewPage(pageProps())
  const text = renderedText(element)
  const classes = renderedClasses(element)
  for (const expected of ['工作区总览', '最近活动', '未分组', '车桩监测', '实习2026', '本地启动与功能文档编写', '修复充电桩超时']) {
    assert.ok(text.includes(expected), `missing text: ${expected}`)
  }
  assert.equal(classes.filter((name) => name.split(' ').includes('dwv-card')).length, 2)
  assert.ok(classes.includes('dwv-dot dwv-dot-running'), 'running session should carry the running dot')
})

test('the overview page renders saved groups and leaves the rest ungrouped', () => {
  const element = OverviewPage(pageProps({ version: 1, groups: [{ id: 'g1', title: '毕设' }], assignments: { w1: 'g1' }, collapsed: [] }))
  const text = renderedText(element)
  const classes = renderedClasses(element)
  assert.ok(text.includes('毕设'), 'group title should render')
  assert.ok(text.includes('实习2026'), 'unassigned workspace should stay in the ungrouped section')
  assert.ok(text.includes('1 个工作区'), 'group header should count its workspaces')
  assert.ok(classes.includes('dwv-group-dot'), 'group header should carry a color dot')
  assert.ok(classes.filter((name) => name.split(' ').includes('dwv-card-tinted')).length === 1, 'grouped cards should be tinted')
})

test('the overview page survives a live-updated status map and empty workspaces', () => {
  const props = pageProps()
  props.useWorkspaces = () => ({ items: [], phase: 'ready', archivedSessionIds: [], pinnedSessionIds: [] })
  props.useSessionStatus = () => undefined
  const element = OverviewPage(props)
  const text = renderedText(element)
  assert.ok(text.includes('还没有工作区'), 'empty state should render')
})
