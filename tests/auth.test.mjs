import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createElement, useContext } from "react"
import { renderToString } from "react-dom/server"
import { createServer } from "vite"

const storageKey = "my-savings-session"
let vite
let AuthProvider
let AuthContext

before(async () => {
  process.env.VITE_API_URL = "https://api.example.test"
  vite = await createServer({
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  })
  ;({ AuthProvider } = await vite.ssrLoadModule("/src/lib/auth.tsx"))
  ;({ AuthContext } = await vite.ssrLoadModule("/src/lib/auth-context.ts"))
})

after(async () => {
  await vite?.close()
  delete process.env.VITE_API_URL
})

function tokens(name) {
  return {
    access_token: name,
    refresh_token: `refresh-${name}`,
    expires_in: 60,
    token_type: "bearer",
    user: { username: name },
  }
}

function startSession(t) {
  const storage = new Map([[storageKey, JSON.stringify(tokens("initial"))]])
  t.mock.method(globalThis, "fetch", async () => {
    assert.fail("Unexpected API request")
  })
  const calls = []
  globalThis.fetch.mock.mockImplementation((url, init) => {
    const response = Promise.withResolvers()
    calls.push({
      path: new URL(url).pathname,
      authorization: init.headers.get("Authorization"),
      reply(body, status = 200) {
        response.resolve(Response.json(body, { status }))
      },
    })
    return response.promise
  })

  const originalWindow = globalThis.window
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  }
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  })

  let auth
  function CaptureAuth() {
    auth = useContext(AuthContext)
    return null
  }
  renderToString(createElement(AuthProvider, null, createElement(CaptureAuth)))

  return {
    auth,
    stored: () => JSON.parse(storage.get(storageKey) ?? "null"),
    async next(path, token) {
      await new Promise((resolve) => setImmediate(resolve))
      const call = calls.shift()
      assert.equal(call?.path, path)
      assert.equal(call.authorization, token ? `Bearer ${token}` : null)
      return call
    },
  }
}

test("simultaneous 401 responses share one refresh", async (t) => {
  const { auth, next, stored } = startSession(t)
  const first = auth.request("first")
  const second = auth.request("second")
  ;(await next("/first", "initial")).reply({}, 401)
  ;(await next("/second", "initial")).reply({}, 401)
  ;(await next("/auth/refresh")).reply(tokens("renewed"))
  ;(await next("/first", "renewed")).reply({ ok: true })
  ;(await next("/second", "renewed")).reply({ ok: true })

  assert.deepEqual(await Promise.all([first, second]), [{ ok: true }, { ok: true }])
  assert.deepEqual(stored(), tokens("renewed"))
})

test("logout during refresh leaves the session closed", async (t) => {
  const { auth, next, stored } = startSession(t)
  const request = auth.request("resource")
  const rejection = assert.rejects(request, { status: 401 })
  ;(await next("/resource", "initial")).reply({}, 401)
  const refresh = await next("/auth/refresh")
  const logout = auth.signOut()
  assert.equal(stored(), null)
  refresh.reply(tokens("renewed"))

  ;(await next("/auth/logout", "initial")).reply({}, 401)
  ;(await next("/auth/logout", "renewed")).reply({})
  await Promise.all([logout, rejection])
  assert.equal(stored(), null)
})

test("a delayed 401 reuses newer credentials and a stale retry cannot clear them", async (t) => {
  const { auth, next, stored } = startSession(t)
  const first = auth.request("first")
  const rejection = assert.rejects(first, { status: 401 })
  const delayed = auth.request("delayed")
  ;(await next("/first", "initial")).reply({}, 401)
  const delayedResponse = await next("/delayed", "initial")
  ;(await next("/auth/refresh")).reply(tokens("renewed"))
  const firstRetry = await next("/first", "renewed")
  delayedResponse.reply({}, 401)
  const delayedRetry = await next("/delayed", "renewed")

  const third = auth.request("third")
  ;(await next("/third", "renewed")).reply({}, 401)
  ;(await next("/auth/refresh")).reply(tokens("latest"))
  ;(await next("/third", "latest")).reply({ ok: true })
  await third

  firstRetry.reply({}, 401)
  delayedRetry.reply({ ok: true })
  await rejection
  await delayed
  assert.deepEqual(stored(), tokens("latest"))
})

test("a new login refreshes independently of an older pending session", async (t) => {
  const { auth, next, stored } = startSession(t)
  const old = auth.request("old")
  const rejection = assert.rejects(old, { status: 401 })
  ;(await next("/old", "initial")).reply({}, 401)
  const oldRefresh = await next("/auth/refresh")

  const login = auth.signIn("new", "password")
  ;(await next("/auth/login")).reply(tokens("new"))
  await login

  const request = auth.request("resource")
  ;(await next("/resource", "new")).reply({}, 401)
  const newRefresh = await next("/auth/refresh")
  oldRefresh.reply({}, 401)
  await rejection
  assert.deepEqual(stored(), tokens("new"))

  newRefresh.reply(tokens("new-renewed"))
  ;(await next("/resource", "new-renewed")).reply({ ok: true })
  await request
  assert.deepEqual(stored(), tokens("new-renewed"))
})
