// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
package io.ironbridge.plugin.services

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import io.ironbridge.plugin.settings.IronBridgeSettings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

/**
 * Project-level service for IronBridge integration.
 */
@Service(Service.Level.PROJECT)
class IronBridgeProjectService(private val project: Project) : Disposable {

    private val scope = CoroutineScope(Dispatchers.IO)
    private var syncJob: Job? = null

    /**
     * Initialize the project service.
     */
    fun initialize() {
        val settings = IronBridgeSettings.getInstance()

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
            val service = IronBridgeService.getInstance()
            val health = service.checkHealth()

            if (health.healthy) {
                val result = service.harvest()
                showNotification(
                    "IronBridge Harvest",
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

        val settings = IronBridgeSettings.getInstance()
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
        val service = IronBridgeService.getInstance()
        val health = service.checkHealth()

        if (!health.healthy) {
            return
        }

        val sessions = service.getSessions()
        // TODO: Implement actual sync logic
    }

    private fun showNotification(title: String, content: String, type: NotificationType) {
        if (!IronBridgeSettings.getInstance().showNotifications) return

        ApplicationManager.getApplication().invokeLater {
            NotificationGroupManager.getInstance()
                .getNotificationGroup("IronBridge Notifications")
                .createNotification(title, content, type)
                .notify(project)
        }
    }

    override fun dispose() {
        syncJob?.cancel()
    }

    companion object {
        @JvmStatic
        fun getInstance(project: Project): IronBridgeProjectService {
            return project.getService(IronBridgeProjectService::class.java)
        }
    }
}

/**
 * Startup activity to initialize project service.
 */
class IronBridgeStartupActivity : ProjectActivity {
    override suspend fun execute(project: Project) {
        IronBridgeProjectService.getInstance(project).initialize()
    }
}
