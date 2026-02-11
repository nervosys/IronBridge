// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
package io.chasm.plugin.services

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Application-level Chasm service for managing connections and data.
 */
@Service
class ChasmService {
    private val logger = Logger.getInstance(ChasmService::class.java)
    private val gson: Gson = GsonBuilder().setPrettyPrinting().create()
    
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    var serverUrl: String = "http://localhost:8787"
        private set
    
    var isConnected: Boolean = false
        private set

    companion object {
        fun getInstance(): ChasmService =
            ApplicationManager.getApplication().getService(ChasmService::class.java)
    }

    /**
     * Configure the server URL
     */
    fun configure(url: String) {
        serverUrl = url.trimEnd('/')
        logger.info("Chasm server configured: $serverUrl")
    }

    /**
     * Check server health
     */
    fun checkHealth(): HealthStatus {
        return try {
            val request = Request.Builder()
                .url("$serverUrl/api/health")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    isConnected = true
                    val body = response.body?.string() ?: "{}"
                    gson.fromJson(body, HealthStatus::class.java)
                } else {
                    isConnected = false
                    HealthStatus("unhealthy", null, null)
                }
            }
        } catch (e: Exception) {
            isConnected = false
            logger.warn("Health check failed: ${e.message}")
            HealthStatus("error", null, e.message)
        }
    }

    /**
     * Get all workspaces
     */
    fun getWorkspaces(): List<Workspace> {
        return try {
            val request = Request.Builder()
                .url("$serverUrl/api/workspaces")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "[]"
                    gson.fromJson(body, Array<Workspace>::class.java).toList()
                } else {
                    emptyList()
                }
            }
        } catch (e: Exception) {
            logger.error("Failed to get workspaces: ${e.message}")
            emptyList()
        }
    }

    /**
     * Get sessions with optional filters
     */
    fun getSessions(
        workspaceId: String? = null,
        provider: String? = null,
        limit: Int = 50,
        offset: Int = 0
    ): SessionList {
        return try {
            val urlBuilder = StringBuilder("$serverUrl/api/sessions?limit=$limit&offset=$offset")
            workspaceId?.let { urlBuilder.append("&workspace_id=$it") }
            provider?.let { urlBuilder.append("&provider=$it") }

            val request = Request.Builder()
                .url(urlBuilder.toString())
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "{}"
                    gson.fromJson(body, SessionList::class.java)
                } else {
                    SessionList(emptyList(), 0, limit, offset)
                }
            }
        } catch (e: Exception) {
            logger.error("Failed to get sessions: ${e.message}")
            SessionList(emptyList(), 0, limit, offset)
        }
    }

    /**
     * Get a specific session by ID
     */
    fun getSession(sessionId: String): Session? {
        return try {
            val request = Request.Builder()
                .url("$serverUrl/api/sessions/$sessionId")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "{}"
                    gson.fromJson(body, Session::class.java)
                } else {
                    null
                }
            }
        } catch (e: Exception) {
            logger.error("Failed to get session: ${e.message}")
            null
        }
    }

    /**
     * Search sessions
     */
    fun searchSessions(query: String, limit: Int = 20): List<Session> {
        return try {
            val request = Request.Builder()
                .url("$serverUrl/api/search/sessions?q=${java.net.URLEncoder.encode(query, "UTF-8")}&limit=$limit")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "[]"
                    gson.fromJson(body, Array<Session>::class.java).toList()
                } else {
                    emptyList()
                }
            }
        } catch (e: Exception) {
            logger.error("Failed to search sessions: ${e.message}")
            emptyList()
        }
    }

    /**
     * Trigger a harvest operation
     */
    fun harvest(providers: List<String>? = null): HarvestResult {
        return try {
            val jsonBody = if (providers != null) {
                gson.toJson(mapOf("providers" to providers))
            } else {
                gson.toJson(mapOf("all" to true))
            }

            val request = Request.Builder()
                .url("$serverUrl/harvest")
                .post(jsonBody.toRequestBody("application/json".toMediaType()))
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "{}"
                    gson.fromJson(body, HarvestResult::class.java)
                } else {
                    HarvestResult(0, 0, emptyList(), listOf("HTTP ${response.code}"))
                }
            }
        } catch (e: Exception) {
            logger.error("Harvest failed: ${e.message}")
            HarvestResult(0, 0, emptyList(), listOf(e.message ?: "Unknown error"))
        }
    }

    /**
     * Get statistics overview
     */
    fun getStats(): StatsOverview? {
        return try {
            val request = Request.Builder()
                .url("$serverUrl/api/stats/overview")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "{}"
                    gson.fromJson(body, StatsOverview::class.java)
                } else {
                    null
                }
            }
        } catch (e: Exception) {
            logger.error("Failed to get stats: ${e.message}")
            null
        }
    }
}

// Data classes
data class HealthStatus(
    val status: String,
    val version: String?,
    val error: String?
)

data class Workspace(
    val id: String,
    val name: String,
    val path: String,
    val provider: String,
    val sessionCount: Int,
    val lastHarvested: String?
)

data class Session(
    val id: String,
    val title: String,
    val workspaceId: String?,
    val provider: String,
    val model: String?,
    val messageCount: Int,
    val tokenCount: Int,
    val archived: Boolean,
    val tags: List<String>,
    val createdAt: String,
    val updatedAt: String
)

data class SessionList(
    val sessions: List<Session>,
    val total: Int,
    val limit: Int,
    val offset: Int
)

data class Message(
    val id: String,
    val sessionId: String,
    val role: String,
    val content: String,
    val model: String?,
    val tokenCount: Int,
    val createdAt: String
)

data class HarvestResult(
    val sessionsCount: Int,
    val messagesCount: Int,
    val providersScanned: List<String>,
    val errors: List<String>
)

data class StatsOverview(
    val totalSessions: Int,
    val totalMessages: Int,
    val totalTokens: Long,
    val activeProviders: Int,
    val workspaces: Int,
    val sessionsToday: Int,
    val messagesToday: Int
)
