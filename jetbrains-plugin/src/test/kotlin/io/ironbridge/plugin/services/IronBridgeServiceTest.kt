// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
package io.ironbridge.plugin.services

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/**
 * The plugin's whole contact with IronBridge is this class: a set of URLs and a
 * Gson mapping. Both halves fail silently — a wrong path 404s and every method
 * here answers with an empty list, a null or a zeroed result, which the tool
 * window renders as "no sessions" rather than as an error.
 *
 * Two paths were already wrong when these tests were written: `searchSessions`
 * asked for `/api/search/sessions` and `harvest` posted to `/harvest`, neither
 * of which the server routes. The request-path assertions below are what stops
 * that recurring.
 */
class IronBridgeServiceTest {

    private lateinit var server: MockWebServer
    private lateinit var service: IronBridgeService

    @BeforeEach
    fun setUp() {
        server = MockWebServer()
        server.start()
        service = IronBridgeService()
        service.configure(server.url("/").toString())
    }

    @AfterEach
    fun tearDown() {
        server.shutdown()
    }

    private fun json(body: String, code: Int = 200) =
        MockResponse().setResponseCode(code).setHeader("Content-Type", "application/json").setBody(body)

    // ---------------------------------------------------------------- configure

    @Test
    fun `configure strips the trailing slash so paths do not double up`() {
        service.configure("http://localhost:8787/")

        // Left in place, every request would go to //api/... which the server
        // does not route.
        assertEquals("http://localhost:8787", service.serverUrl)
    }

    // ------------------------------------------------------------------- health

    @Test
    fun `checkHealth reads the server's status and marks the connection live`() {
        server.enqueue(json("""{"status":"ok","version":"2.0.1"}"""))

        val health = service.checkHealth()

        assertEquals("/api/health", server.takeRequest().path)
        assertEquals("ok", health.status)
        assertEquals("2.0.1", health.version)
        assertTrue(health.healthy)
        assertTrue(service.isConnected)
    }

    @Test
    fun `checkHealth accepts the richer endpoint's spelling`() {
        server.enqueue(json("""{"status":"healthy","version":"2.0.1"}"""))

        assertTrue(service.checkHealth().healthy)
    }

    @Test
    fun `checkHealth reports unhealthy on a non-2xx answer`() {
        server.enqueue(json("""{"error":"nope"}""", code = 503))

        val health = service.checkHealth()

        assertEquals("unhealthy", health.status)
        assertFalse(health.healthy)
        assertFalse(service.isConnected)
    }

    @Test
    fun `a degraded server is not called healthy`() {
        server.enqueue(json("""{"status":"degraded","version":"2.0.1"}"""))

        assertFalse(service.checkHealth().healthy)
    }

    // --------------------------------------------------------------- workspaces

    @Test
    fun `getWorkspaces maps the array the server returns`() {
        server.enqueue(
            json(
                """[{"id":"ws-1","name":"IronBridge","path":"C:/src/IronBridge",
                   "provider":"copilot","sessionCount":42,"lastHarvested":"2026-01-15T09:00:00Z"}]"""
            )
        )

        val workspaces = service.getWorkspaces()

        assertEquals("/api/workspaces", server.takeRequest().path)
        assertEquals(1, workspaces.size)
        assertEquals("ws-1", workspaces[0].id)
        assertEquals(42, workspaces[0].sessionCount)
    }

    @Test
    fun `getWorkspaces answers empty on a server error rather than throwing`() {
        server.enqueue(json("""{"error":"boom"}""", code = 500))

        assertTrue(service.getWorkspaces().isEmpty())
    }

    // ----------------------------------------------------------------- sessions

    @Test
    fun `getSessions sends paging, and filters only when given`() {
        server.enqueue(json("""{"sessions":[],"total":0,"limit":50,"offset":0}"""))
        service.getSessions()
        val plain = server.takeRequest().path!!
        assertTrue(plain.startsWith("/api/sessions?"), "unexpected path: $plain")
        assertTrue(plain.contains("limit=50"))
        assertTrue(plain.contains("offset=0"))
        assertFalse(plain.contains("workspace_id"))
        assertFalse(plain.contains("provider"))

        server.enqueue(json("""{"sessions":[],"total":0,"limit":10,"offset":20}"""))
        service.getSessions(workspaceId = "ws-1", provider = "copilot", limit = 10, offset = 20)
        val filtered = server.takeRequest().path!!
        assertTrue(filtered.contains("limit=10"))
        assertTrue(filtered.contains("offset=20"))
        assertTrue(filtered.contains("workspace_id=ws-1"))
        assertTrue(filtered.contains("provider=copilot"))
    }

    @Test
    fun `getSessions maps the envelope`() {
        server.enqueue(
            json(
                """{"sessions":[{"id":"s-1","title":"Recovering a lost session","workspaceId":"ws-1",
                   "provider":"copilot","model":"gpt-4","messageCount":2,"tokenCount":128,
                   "archived":false,"tags":["recovery"],"createdAt":"2026-01-15T09:00:00Z",
                   "updatedAt":"2026-01-15T10:00:00Z"}],"total":1,"limit":50,"offset":0}"""
            )
        )

        val list = service.getSessions()

        assertEquals(1, list.total)
        assertEquals("Recovering a lost session", list.sessions[0].title)
        assertEquals(listOf("recovery"), list.sessions[0].tags)
    }

    @Test
    fun `getSessions degrades to an empty page, keeping the caller's paging`() {
        server.enqueue(json("""{"error":"boom"}""", code = 500))

        val list = service.getSessions(limit = 10, offset = 20)

        assertTrue(list.sessions.isEmpty())
        assertEquals(0, list.total)
        assertEquals(10, list.limit)
        assertEquals(20, list.offset)
    }

    @Test
    fun `getSession asks for the session by id`() {
        server.enqueue(
            json(
                """{"id":"s-1","title":"One","workspaceId":null,"provider":"claude","model":null,
                   "messageCount":0,"tokenCount":0,"archived":false,"tags":[],
                   "createdAt":"2026-01-15T09:00:00Z","updatedAt":"2026-01-15T09:00:00Z"}"""
            )
        )

        val session = service.getSession("s-1")

        assertEquals("/api/sessions/s-1", server.takeRequest().path)
        assertNotNull(session)
        assertEquals("s-1", session!!.id)
    }

    @Test
    fun `getSession answers null for a session that is not there`() {
        server.enqueue(json("""{"error":"not found"}""", code = 404))

        assertNull(service.getSession("missing"))
    }

    // ------------------------------------------------------------------- search

    @Test
    fun `searchSessions asks the path the server actually routes`() {
        // Regression: this used to be /api/search/sessions, which is not a
        // route. The 404 came back as an empty result, so search looked like a
        // library with nothing in it.
        server.enqueue(json("[]"))

        service.searchSessions("auth")

        val path = server.takeRequest().path!!
        assertTrue(path.startsWith("/api/sessions/search?"), "unexpected path: $path")
    }

    @Test
    fun `searchSessions encodes the query and passes the limit`() {
        server.enqueue(json("[]"))

        service.searchSessions("auth bypass & CSV", limit = 5)

        val path = server.takeRequest().path!!
        assertTrue(path.contains("q=auth+bypass+%26+CSV"), "query not encoded: $path")
        assertTrue(path.contains("limit=5"))
    }

    @Test
    fun `searchSessions maps the results`() {
        server.enqueue(
            json(
                """[{"id":"s-9","title":"auth bypass","workspaceId":null,"provider":"claude",
                   "model":null,"messageCount":3,"tokenCount":0,"archived":false,"tags":[],
                   "createdAt":"2026-01-15T09:00:00Z","updatedAt":"2026-01-15T09:00:00Z"}]"""
            )
        )

        val results = service.searchSessions("auth")

        assertEquals(1, results.size)
        assertEquals("auth bypass", results[0].title)
    }

    // ------------------------------------------------------------------ harvest

    @Test
    fun `harvest posts to the api scope`() {
        // Regression: this used to post to /harvest at the server root. Only
        // auth, sync, recording and webhooks are mounted there; harvest is not.
        server.enqueue(json("""{"sessionsCount":3,"messagesCount":30,"providersScanned":["copilot"],"errors":[]}"""))

        val result = service.harvest()

        val request = server.takeRequest()
        assertEquals("/api/harvest", request.path)
        assertEquals("POST", request.method)
        assertEquals(3, result.sessionsCount)
        assertEquals(listOf("copilot"), result.providersScanned)
    }

    @Test
    fun `harvest asks for everything when given no providers`() {
        server.enqueue(json("""{"sessionsCount":0,"messagesCount":0,"providersScanned":[],"errors":[]}"""))

        service.harvest()

        // The service's Gson is configured with setPrettyPrinting, so compare
        // the parsed shape rather than the exact bytes.
        val body = server.takeRequest().body.readUtf8()
        assertEquals("{\"all\":true}", body.filterNot { it.isWhitespace() })
    }

    @Test
    fun `harvest passes the providers it was given`() {
        server.enqueue(json("""{"sessionsCount":0,"messagesCount":0,"providersScanned":[],"errors":[]}"""))

        service.harvest(listOf("copilot", "cursor"))

        val body = server.takeRequest().body.readUtf8()
        assertTrue(body.contains("\"providers\""), "unexpected body: $body")
        assertTrue(body.contains("copilot") && body.contains("cursor"), "unexpected body: $body")
    }

    @Test
    fun `harvest reports the status code when the server refuses`() {
        server.enqueue(json("""{"error":"nope"}""", code = 401))

        val result = service.harvest()

        assertEquals(0, result.sessionsCount)
        assertEquals(listOf("HTTP 401"), result.errors)
    }

    // -------------------------------------------------------------------- stats

    @Test
    fun `getStats maps the overview`() {
        server.enqueue(
            json(
                """{"totalSessions":10,"totalMessages":200,"totalTokens":123456789,
                   "activeProviders":3,"workspaces":4,"sessionsToday":1,"messagesToday":9}"""
            )
        )

        val stats = service.getStats()

        assertEquals("/api/stats/overview", server.takeRequest().path)
        assertNotNull(stats)
        assertEquals(10, stats!!.totalSessions)
        // Token counts outgrow Int on a real database, which is why the field
        // is a Long.
        assertEquals(123456789L, stats.totalTokens)
    }

    @Test
    fun `getStats answers null on a server error`() {
        server.enqueue(json("""{"error":"boom"}""", code = 500))

        assertNull(service.getStats())
    }
}
