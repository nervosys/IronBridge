// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: Apache-2.0
package io.chasm.plugin.services

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import io.chasm.plugin.settings.ChasmSettings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

/**
 * Project-level service for Chasm integration.
 */
@Service(Service.Level.PROJECT)
class ChasmProjectService(private val project: Project) : Disposable {

    private val scope = CoroutineScope(Dispatchers.IO)
    private var syncJob: Job? = null

    /**
     * Initialize the project service.
     */
    fun initialize() {
        val settings = ChasmSettings.getInstance()

        // Harvest on startup if enabled
        if (settings.harvestOnStartup) {
            harvestOnStartup()
        }

        // Start auto-sync if enabled
        if (settings.autoSync) {
            startAutoSync()
        }
    }

    private fun harvestOnStartup() {
        scope.launch {
            val service = ChasmService.getInstance()
            val health = service.checkHealth()

            if (health.healthy) {
                val result = service.harvest()
                showNotification(
                    "Chasm Harvest",
                    "Harvested ${result.sessionsCount} sessions on startup",
                    NotificationType.INFORMATION
                )
            }
        }
    }

    /**
     * Start automatic synchronization.
     */
    fun startAutoSync() {
        syncJob?.cancel()

        val settings = ChasmSettings.getInstance()
        val intervalMs = TimeUnit.MINUTES.toMillis(settings.syncIntervalMinutes.toLong())

        syncJob = scope.launch {
            while (isActive) {
                delay(intervalMs)
                performSync()
            }
        }
    }

    /**
     * Stop automatic synchronization.
     */
    fun stopAutoSync() {
        syncJob?.cancel()
        syncJob = null
    }

    private suspend fun performSync() {
        val service = ChasmService.getInstance()
        val health = service.checkHealth()

        if (!health.healthy) {
            return
        }

        val sessions = service.getSessions()
        // TODO: Implement actual sync logic
    }

    private fun showNotification(title: String, content: String, type: NotificationType) {
        if (!ChasmSettings.getInstance().showNotifications) return

        ApplicationManager.getApplication().invokeLater {
            NotificationGroupManager.getInstance()
                .getNotificationGroup("Chasm Notifications")
                .createNotification(title, content, type)
                .notify(project)
        }
    }

    override fun dispose() {
        syncJob?.cancel()
    }

    companion object {
        @JvmStatic
        fun getInstance(project: Project): ChasmProjectService {
            return project.getService(ChasmProjectService::class.java)
        }
    }
}

/**
 * Startup activity to initialize project service.
 */
class ChasmStartupActivity : ProjectActivity {
    override suspend fun execute(project: Project) {
        ChasmProjectService.getInstance(project).initialize()
    }
}
