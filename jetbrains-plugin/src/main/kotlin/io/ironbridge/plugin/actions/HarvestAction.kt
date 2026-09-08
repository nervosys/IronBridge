// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
package io.ironbridge.plugin.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import io.ironbridge.plugin.services.IronBridgeService
import io.ironbridge.plugin.settings.IronBridgeSettings

/**
 * Action to harvest sessions from all connected AI providers.
 */
class HarvestAction : AnAction("Harvest Sessions", "Harvest sessions from AI providers", null) {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Harvesting Sessions", false) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Connecting to IronBridge server..."
                indicator.fraction = 0.1

                val service = IronBridgeService.getInstance()
                val health = service.checkHealth()

                if (!health.healthy) {
                    showNotification(
                        "Harvest Failed",
                        "Could not connect to IronBridge server: ${health.error}",
                        NotificationType.ERROR
                    )
                    return
                }

                indicator.text = "Harvesting sessions..."
                indicator.fraction = 0.3

                val result = service.harvest()

                indicator.fraction = 1.0

                if (result.errors.isEmpty()) {
                    showNotification(
                        "Harvest Complete",
                        "Harvested ${result.sessionsCount} sessions with ${result.messagesCount} messages",
                        NotificationType.INFORMATION
                    )
                } else {
                    showNotification(
                        "Harvest Completed with Errors",
                        "Harvested ${result.sessionsCount} sessions. Errors: ${result.errors.joinToString(", ")}",
                        NotificationType.WARNING
                    )
                }
            }
        })
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }

    private fun showNotification(title: String, content: String, type: NotificationType) {
        if (!IronBridgeSettings.getInstance().showNotifications) return

        ApplicationManager.getApplication().invokeLater {
            NotificationGroupManager.getInstance()
                .getNotificationGroup("IronBridge Notifications")
                .createNotification(title, content, type)
                .notify(null)
        }
    }
}
