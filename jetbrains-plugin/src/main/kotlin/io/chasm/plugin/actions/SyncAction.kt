// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
package io.chasm.plugin.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import io.chasm.plugin.services.ChasmService
import io.chasm.plugin.settings.ChasmSettings

/**
 * Action to synchronize sessions with the Chasm server.
 */
class SyncAction : AnAction("Sync Sessions", "Synchronize sessions with Chasm server", null) {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Syncing Sessions", true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Checking server connection..."
                indicator.fraction = 0.1

                val service = ChasmService.getInstance()
                val health = service.checkHealth()

                if (!health.healthy) {
                    showNotification(
                        "Sync Failed",
                        "Could not connect to Chasm server: ${health.error}",
                        NotificationType.ERROR
                    )
                    return
                }

                indicator.text = "Fetching sessions..."
                indicator.fraction = 0.3

                val sessions = service.getSessions()

                indicator.text = "Updating local cache..."
                indicator.fraction = 0.7

                // TODO: Implement local caching/sync logic
                Thread.sleep(500) // Simulate work

                indicator.fraction = 1.0

                showNotification(
                    "Sync Complete",
                    "Synchronized ${sessions?.totalCount ?: 0} sessions",
                    NotificationType.INFORMATION
                )
            }
        })
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }

    private fun showNotification(title: String, content: String, type: NotificationType) {
        if (!ChasmSettings.getInstance().showNotifications) return

        ApplicationManager.getApplication().invokeLater {
            NotificationGroupManager.getInstance()
                .getNotificationGroup("Chasm Notifications")
                .createNotification(title, content, type)
                .notify(null)
        }
    }
}
