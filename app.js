import { Peer } from 'peerjs'

const app = document.querySelector('#app')

const icons = {
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0 1 4"/><path d="M20 5v6h-6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  wifi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5a14 14 0 0 1 18 0M6.5 12a8.5 8.5 0 0 1 11 0M10 15.5a3.2 3.2 0 0 1 4 0M12 19h.01"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z"/></svg>'
}

const initialState = {
  screen: 'home',
  phase: 'home',
  round: 1,
  hostName: '',
  guestName: '',
  hostWord: '',
  guestWord: '',
  hostSubmitted: false,
  guestSubmitted: false,
  roomCode: '',
  peerId: '',
  connected: false,
  role: '',
  connectionMessage: '',
  records: []
}

let state = { ...initialState }
let peer = null
let connection = null
let toastTimer = null

const params = new URLSearchParams(window.location.search)
const invitedCode = (params.get('join') || '').trim().toUpperCase()

function setState(patch) {
  state = { ...state, ...patch }
  render()
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char])
}

function getName() {
  return (document.querySelector('#player-name')?.value || localStorage.getItem('tongpin-name') || '').trim()
}

function saveName(name) {
  if (name) localStorage.setItem('tongpin-name', name)
}

function roomLink(code = state.roomCode) {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('join', code)
  return url.toString()
}

function randomRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return `RUN-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}`
}

function icon(name) {
  return icons[name] || ''
}

function playerAvatar(name, tone, active = false) {
  const letter = (name || '?').slice(0, 1).toUpperCase()
  return `<div class="player-avatar ${tone} ${active ? 'is-active' : ''}">${escapeHTML(letter)}</div>`
}

function headerMarkup({ room = false } = {}) {
  return `<header class="topbar">
    <button class="brand" data-action="home" aria-label="回到首页">
      <span class="brand-mark"><i></i><i></i></span>
      <span>同频</span>
    </button>
    ${room ? `<div class="topbar-room"><span class="online-dot"></span><span>双人房间</span></div>` : '<div class="topbar-note">两个人，想到一起</div>'}
  </header>`
}

function homeMarkup() {
  const storedName = escapeHTML(localStorage.getItem('tongpin-name') || '')
  const joinValue = escapeHTML(invitedCode || '')
  const isInvite = Boolean(invitedCode)
  return `${headerMarkup()}
    <main class="home-main">
      <section class="hero">
        <div class="hero-kicker"><span class="kicker-line"></span>${isInvite ? '收到朋友邀请' : '朋友互动 · 双人版'}</div>
        <h1>${isInvite ? '先留下名字，<br /><em>就能进场。</em>' : '猜到同一个词，<br /><em>才算抵达。</em>'}</h1>
        <p class="hero-copy">${isInvite ? '输入一个称呼，朋友会在房间里看到你。' : '各自写下第一直觉，等对方也提交，<br class="desktop-break" />再一起揭晓答案。'}</p>
        <div class="track-visual" aria-label="两条跑道在终点交汇">
          <div class="track-label left">你</div>
          <div class="track-lines">
            <span class="track-line coral"><b></b></span>
            <span class="track-line mint"><b></b></span>
            <span class="finish-mark">✦</span>
          </div>
          <div class="track-label right">朋友</div>
        </div>
      </section>

      <section class="home-panel">
        <div class="panel-heading">
          <span class="eyebrow">${isInvite ? '加入这一局' : '现在开始'}</span>
          <h2>${isInvite ? '你想用什么名字？' : '先告诉我，你是谁'}</h2>
        </div>
        <label class="field-label" for="player-name">你的称呼</label>
        <input id="player-name" class="text-input" maxlength="12" autocomplete="nickname" value="${storedName}" placeholder="比如：小周" />
        ${isInvite ? `<button class="primary-button full" data-action="join-invite">进入房间 ${icon('arrow')}</button>
        <p class="connection-note">无需验证码 · 名字只在这局里使用</p>` : `<button class="primary-button full" data-action="create">创建一局 ${icon('arrow')}</button>
        <div class="or-line"><span>或者</span></div>
        <div class="join-row">
          <input id="join-code" class="text-input code-input" maxlength="10" value="${joinValue}" placeholder="输入朋友的房间码" autocapitalize="characters" />
          <button class="secondary-button join-button" data-action="join">加入</button>
        </div>
        <p class="connection-note">无需注册 · 链接打开就能玩</p>`}
      </section>
    </main>
    <footer class="home-footer"><span>${icon('bolt')}</span> 这一局只属于你们两个人</footer>`
}

function waitingMarkup() {
  const isHost = state.role === 'host'
  const code = escapeHTML(state.roomCode)
  return `${headerMarkup({ room: true })}
    <main class="room-main waiting-main">
      <section class="room-intro">
        <span class="eyebrow">房间已创建</span>
        <h1>把朋友叫来，<br /><em>一起开跑。</em></h1>
        <p>${isHost ? '把下面的链接或房间码发给朋友。' : '正在和房主建立连接，请稍等。'}</p>
      </section>
      <section class="invite-card">
        <div class="invite-card-top"><span>房间码</span><span class="invite-status"><i></i>${isHost ? '等待加入' : '连接中'}</span></div>
        <div class="room-code">${code || '——'}</div>
        ${isHost ? `<div class="invite-actions">
          <button class="secondary-button" data-action="copy-link">${icon('copy')} 复制邀请链接</button>
          <button class="icon-button" data-action="share" aria-label="分享邀请链接">${icon('share')}</button>
        </div>` : '<div class="connecting-loader"><span></span><span></span><span></span>正在进入房间</div>'}
      </section>
      <div class="waiting-players">
        ${playerAvatar(state.hostName || '你', 'coral', true)}
        <span class="versus">×</span>
        <div class="player-avatar waiting-avatar"><span class="plus">+</span></div>
      </div>
      <p class="tip-line">${isHost ? '朋友加入后，第一轮会自动开始。' : '连接成功后就可以开始第一轮。'}</p>
      <button class="text-button" data-action="leave">退出房间</button>
    </main>`
}

function playerStrip() {
  const localIsHost = state.role !== 'guest'
  const leftName = localIsHost ? state.hostName : state.guestName
  const rightName = localIsHost ? state.guestName : state.hostName
  const leftTone = localIsHost ? 'coral' : 'mint'
  const rightTone = localIsHost ? 'mint' : 'coral'
  const leftDot = localIsHost ? 'coral-dot' : 'mint-dot'
  const rightDot = localIsHost ? 'mint-dot' : 'coral-dot'
  return `<div class="player-strip">
    <div class="player-chip"><span class="chip-avatar ${leftTone}">${escapeHTML((leftName || '你').slice(0, 1).toUpperCase())}</span><span>${escapeHTML(leftName || '你')}</span><i class="chip-dot ${leftDot}"></i></div>
    <div class="round-badge">第 ${state.round} 轮</div>
    <div class="player-chip guest-chip"><i class="chip-dot ${rightDot}"></i><span>${escapeHTML(rightName || '朋友')}</span><span class="chip-avatar ${rightTone}">${escapeHTML((rightName || '朋').slice(0, 1).toUpperCase())}</span></div>
  </div>`
}

function roundRecord(hostWord, guestWord) {
  const cleanHostWord = String(hostWord || '').trim()
  const cleanGuestWord = String(guestWord || '').trim()
  return {
    round: state.round,
    hostWord: cleanHostWord,
    guestWord: cleanGuestWord,
    matched: cleanHostWord.toLocaleLowerCase() === cleanGuestWord.toLocaleLowerCase()
  }
}

function historyMarkup() {
  const records = Array.isArray(state.records) ? state.records : []
  const localIsHost = state.role !== 'guest'
  return `<section class="history-panel ${records.length ? 'has-records' : 'is-empty'}">
    <div class="history-heading">
      <div><span class="history-title">本局记录</span><span class="history-caption">每一轮都算数</span></div>
      <span class="history-count">${records.length ? `${records.length} 轮` : '等待第一轮'}</span>
    </div>
    ${records.length ? `<div class="history-list">${records.map((record) => {
      const leftWord = localIsHost ? record.hostWord : record.guestWord
      const rightWord = localIsHost ? record.guestWord : record.hostWord
      return `<div class="history-row">
      <span class="history-round">第 ${escapeHTML(record.round)} 轮</span>
      <span class="history-word ${localIsHost ? 'coral-word' : 'mint-word'}">${escapeHTML(leftWord)}</span>
      <span class="history-arrow">↔</span>
      <span class="history-word ${localIsHost ? 'mint-word' : 'coral-word'}">${escapeHTML(rightWord)}</span>
      <span class="history-status ${record.matched ? 'match' : 'near'}">${record.matched ? '同频' : '靠近'}</span>
    </div>`
    }).join('')}</div>` : '<p class="history-empty">双方都提交后，这里会留下这一轮。</p>'}
  </section>`
}

function inputMarkup() {
  const localSubmitted = state.role === 'host' ? state.hostSubmitted : state.guestSubmitted
  const otherSubmitted = state.role === 'host' ? state.guestSubmitted : state.hostSubmitted
  const otherName = state.role === 'host' ? state.guestName : state.hostName
  return `${headerMarkup({ room: true })}
    <main class="room-main game-main">
      ${playerStrip()}
      <section class="round-copy">
        <span class="eyebrow"><span class="live-dot"></span>同时输入 · 互相不可见</span>
        <h1>这一轮，<br /><em>你想到什么？</em></h1>
        <p>别想太久，写下此刻最先冒出来的词。</p>
      </section>
      <section class="word-panel ${localSubmitted ? 'is-locked' : ''}">
        <label class="field-label" for="word-input">你的词</label>
        <div class="word-input-wrap">
          <input id="word-input" class="word-input" maxlength="24" autocomplete="off" placeholder="输入一个词" ${localSubmitted ? 'disabled' : ''} />
          ${localSubmitted ? `<span class="input-lock">${icon('lock')}</span>` : ''}
        </div>
        <button class="primary-button full" data-action="submit-word" ${localSubmitted ? 'disabled' : ''}>${localSubmitted ? `${icon('check')} 已提交，等${escapeHTML(otherName || '对方')}` : `锁定我的答案 ${icon('arrow')}`}</button>
        <div class="privacy-note">${icon('lock')} 只有双方都提交后，词语才会同时揭晓</div>
      </section>
      ${otherSubmitted && !localSubmitted ? '<p class="opponent-note">对方已经写好了，现在轮到你。</p>' : ''}
      ${historyMarkup()}
      <button class="text-button" data-action="leave">退出房间</button>
    </main>`
}

function revealMarkup() {
  const matched = state.hostWord.trim().toLocaleLowerCase() === state.guestWord.trim().toLocaleLowerCase()
  const localIsHost = state.role !== 'guest'
  const leftName = localIsHost ? state.hostName : state.guestName
  const rightName = localIsHost ? state.guestName : state.hostName
  const leftWord = localIsHost ? state.hostWord : state.guestWord
  const rightWord = localIsHost ? state.guestWord : state.hostWord
  const leftCard = localIsHost ? 'coral-card' : 'mint-card'
  const rightCard = localIsHost ? 'mint-card' : 'coral-card'
  return `${headerMarkup({ room: true })}
    <main class="room-main game-main reveal-main">
      ${playerStrip()}
      <section class="reveal-heading">
        <span class="eyebrow"><span class="reveal-spark">✦</span>同时揭晓</span>
        <h1>${matched ? '你们想到了一起。' : '答案揭晓。'}</h1>
        <p>${matched ? '这就是传说中的同频时刻。' : '有一点距离，下一轮再靠近一点。'}</p>
      </section>
      <section class="answer-grid ${matched ? 'is-match' : ''}">
        <div class="answer-card ${leftCard}"><span class="answer-name">${escapeHTML(leftName || '你')} · 你的词</span><strong>${escapeHTML(leftWord)}</strong></div>
        <div class="answer-connector">${matched ? '✦' : '≠'}</div>
        <div class="answer-card ${rightCard}"><span class="answer-name">${escapeHTML(rightName || '朋友')} · 对方的词</span><strong>${escapeHTML(rightWord)}</strong></div>
      </section>
      ${matched ? `<div class="match-stamp">MATCH <span>同频</span></div>` : '<div class="distance-note">每一轮，答案都会更近一点</div>'}
      <button class="primary-button full next-button" data-action="${matched ? 'again' : 'next'}">${matched ? `${icon('refresh')} 再玩一局` : `下一轮 ${icon('arrow')}`}</button>
      ${historyMarkup()}
      <button class="text-button" data-action="leave">结束这局</button>
    </main>`
}

function render() {
  if (state.phase === 'home') app.innerHTML = homeMarkup()
  else if (state.phase === 'waiting') app.innerHTML = waitingMarkup()
  else if (state.phase === 'input') app.innerHTML = inputMarkup()
  else if (state.phase === 'reveal') app.innerHTML = revealMarkup()
  bindEvents()
}

function toast(message, tone = '') {
  clearTimeout(toastTimer)
  document.querySelector('.toast')?.remove()
  const node = document.createElement('div')
  node.className = `toast ${tone}`
  node.innerHTML = message
  document.body.appendChild(node)
  requestAnimationFrame(() => node.classList.add('show'))
  toastTimer = window.setTimeout(() => {
    node.classList.remove('show')
    window.setTimeout(() => node.remove(), 220)
  }, 2600)
}

function setConnectionMessage(message) {
  setState({ connectionMessage: message })
  if (message) toast(message, 'error')
}

function broadcast() {
  if (connection?.open) connection.send({ type: 'state', state: sharedState() })
}

function sharedState() {
  return {
    phase: state.phase,
    round: state.round,
    hostName: state.hostName,
    guestName: state.guestName,
    hostWord: state.hostWord,
    guestWord: state.guestWord,
    hostSubmitted: state.hostSubmitted,
    guestSubmitted: state.guestSubmitted,
    roomCode: state.roomCode,
    connected: state.connected,
    records: Array.isArray(state.records) ? state.records : []
  }
}

function updateGame(patch, { send = true } = {}) {
  setState(patch)
  if (send) broadcast()
}

function closeConnection() {
  try { connection?.close() } catch {}
  try { peer?.destroy() } catch {}
  connection = null
  peer = null
}

function leaveRoom() {
  closeConnection()
  const cleanUrl = new URL(window.location.href)
  cleanUrl.search = ''
  window.history.replaceState({}, '', cleanUrl)
  state = { ...initialState }
  render()
}

function setupHost(name) {
  saveName(name)
  const roomCode = randomRoomCode()
  state = { ...initialState, phase: 'waiting', role: 'host', roomCode, hostName: name, peerId: roomCode }
  render()
  peer = new Peer(roomCode, { debug: 0 })
  peer.on('open', (id) => {
    setState({ peerId: id, roomCode: id })
    const url = new URL(window.location.href)
    url.searchParams.set('join', id)
    window.history.replaceState({}, '', url)
  })
  peer.on('connection', (incoming) => {
    if (connection?.open) {
      incoming.close()
      toast('这局已经有两位玩家了。', 'error')
      return
    }
    connection = incoming
    connection.on('open', () => {
      connection.send({ type: 'hello-ack', state: sharedState() })
    })
    connection.on('data', onHostData)
    connection.on('close', () => {
      connection = null
      updateGame({ phase: 'waiting', connected: false, guestName: '', guestWord: '', guestSubmitted: false, hostWord: '', hostSubmitted: false }, { send: false })
      toast('朋友离开了房间。邀请链接仍然有效。', 'error')
    })
    connection.on('error', () => toast('连接出现波动，请让朋友重新打开邀请链接。', 'error'))
  })
  peer.on('error', (error) => {
    if (error.type === 'unavailable-id') {
      closeConnection()
      setupHost(name)
      return
    }
    const message = error.type === 'network' ? '暂时连不上联机服务，请检查网络。' : '房间创建失败，请重试。'
    toast(message, 'error')
  })
}

function onHostData(data) {
  if (!data || typeof data !== 'object') return
  if (data.type === 'hello') {
    const guestName = String(data.name || '朋友').trim().slice(0, 12) || '朋友'
    updateGame({ guestName, connected: true, phase: 'input' })
    return
  }
  if (data.type === 'submit') {
    const guestWord = String(data.word || '').trim().slice(0, 24)
    if (!guestWord || state.phase !== 'input') return
    const next = { guestWord, guestSubmitted: true }
    if (state.hostSubmitted) {
      next.phase = 'reveal'
      next.records = [...(Array.isArray(state.records) ? state.records : []), roundRecord(state.hostWord, guestWord)]
    }
    updateGame(next)
    return
  }
  if (data.type === 'next' && state.phase === 'reveal') {
    updateGame({ phase: 'input', round: state.round + 1, hostWord: '', guestWord: '', hostSubmitted: false, guestSubmitted: false })
    return
  }
  if (data.type === 'again' && state.phase === 'reveal') {
    updateGame({ phase: 'input', round: 1, hostWord: '', guestWord: '', hostSubmitted: false, guestSubmitted: false, records: [] })
  }
}

function setupGuest(name, code) {
  saveName(name)
  const normalizedCode = code.trim().toUpperCase()
  state = { ...initialState, phase: 'waiting', role: 'guest', roomCode: normalizedCode, guestName: name }
  render()
  peer = new Peer({ debug: 0 })
  peer.on('open', () => {
    connection = peer.connect(normalizedCode, { reliable: true })
    connection.on('open', () => connection.send({ type: 'hello', name }))
    connection.on('data', onGuestData)
    connection.on('close', () => {
      toast('和房主的连接断开了，请重新打开邀请链接。', 'error')
      setState({ connected: false, connectionMessage: '连接已断开' })
    })
    connection.on('error', () => toast('加入失败，请确认房间码正确。', 'error'))
  })
  peer.on('error', (error) => {
    const message = error.type === 'peer-unavailable' ? '找不到这个房间，检查一下房间码。' : '暂时连不上联机服务，请检查网络。'
    toast(message, 'error')
  })
}

function onGuestData(data) {
  if (!data || typeof data !== 'object') return
  if (data.type === 'hello-ack' || data.type === 'state') {
    const nextState = data.state || {}
    setState({ ...nextState, records: Array.isArray(nextState.records) ? nextState.records : [], role: 'guest', connected: true, phase: nextState.phase || 'input' })
  }
}

function submitWord() {
  const input = document.querySelector('#word-input')
  const word = input?.value.trim().slice(0, 24)
  if (!word) {
    input?.focus()
    toast('先写下一个词。', 'error')
    return
  }
  if (state.role === 'host') {
    const next = { hostWord: word, hostSubmitted: true }
    if (state.guestSubmitted) {
      next.phase = 'reveal'
      next.records = [...(Array.isArray(state.records) ? state.records : []), roundRecord(word, state.guestWord)]
    }
    updateGame(next)
  } else if (connection?.open) {
    connection.send({ type: 'submit', word })
    setState({ guestWord: word, guestSubmitted: true })
  } else {
    toast('连接还没准备好，请稍等。', 'error')
  }
}

async function copyInvite() {
  const link = roomLink()
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link)
    } else throw new Error('clipboard unavailable')
    toast('邀请链接已复制，发给朋友就好。', 'success')
  } catch {
    try {
      const helper = document.createElement('textarea')
      helper.value = link
      helper.setAttribute('readonly', '')
      helper.style.position = 'fixed'
      helper.style.opacity = '0'
      document.body.appendChild(helper)
      helper.select()
      const copied = document.execCommand('copy')
      helper.remove()
      if (!copied) throw new Error('copy failed')
      toast('邀请链接已复制，发给朋友就好。', 'success')
    } catch {
      toast(`复制受限，房间码是 ${escapeHTML(state.roomCode)}`, 'success')
    }
  }
}

async function shareInvite() {
  const link = roomLink()
  if (navigator.share) {
    try {
      await navigator.share({ title: '来和我玩同频', text: '打开链接，和我一起想到同一个词。', url: link })
      return
    } catch (error) {
      if (error?.name === 'AbortError') return
    }
  }
  copyInvite()
}

function nextRound() {
  if (state.role === 'host') {
    updateGame({ phase: 'input', round: state.round + 1, hostWord: '', guestWord: '', hostSubmitted: false, guestSubmitted: false })
  } else if (connection?.open) {
    connection.send({ type: 'next' })
  }
}

function again() {
  if (state.role === 'host') {
    updateGame({ phase: 'input', round: 1, hostWord: '', guestWord: '', hostSubmitted: false, guestSubmitted: false, records: [] })
  } else if (connection?.open) {
    connection.send({ type: 'again' })
  }
}

function bindEvents() {
  document.querySelectorAll('[data-action]').forEach((element) => {
    element.addEventListener('click', () => {
      const action = element.dataset.action
      if (action === 'home') leaveRoom()
      if (action === 'create') {
        const name = getName() || '我'
        setupHost(name)
      }
      if (action === 'join') {
        const name = getName() || '我'
        const code = document.querySelector('#join-code')?.value || ''
        if (!code.trim()) {
          document.querySelector('#join-code')?.focus()
          toast('输入朋友发来的房间码。', 'error')
        } else setupGuest(name, code)
      }
      if (action === 'copy-link') copyInvite()
      if (action === 'share') shareInvite()
      if (action === 'submit-word') submitWord()
      if (action === 'next') nextRound()
      if (action === 'again') again()
      if (action === 'leave') leaveRoom()
    })
  })
  document.querySelector('#word-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitWord()
  })
  document.querySelector('#join-code')?.addEventListener('input', (event) => {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
  })
}

render()

