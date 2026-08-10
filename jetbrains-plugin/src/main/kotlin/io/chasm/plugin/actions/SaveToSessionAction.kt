// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
package io.chasm.plugin.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.Messages
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.JBUI
import io.chasm.plugin.services.ChasmService
import io.chasm.plugin.settings.ChasmSettings
import java.awt.BorderLayout
import java.awt.Dimension
import javax.swing.JComponent
import javax.swing.JPanel

/**
 * Action to save selected text to a Chasm session.
 */
class SaveToSessionAction : AnAction("Save to Chasm Session", "Save selected text to a Chasm session", null) {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val selectedText = editor.selectionModel.selectedText

        if (selectedText.isNullOrBlank()) {
            Messages.showWarningDialog(project, "Please select some text to save.", "No Selection")
            return
        }

        val file = e.getData(CommonDataKeys.VIRTUAL_FILE)
        val fileName = file?.name ?: "Unknown File"

        val dialog = SaveToSessionDialog(selectedText, fileName)
        if (dialog.showAndGet()) {
            saveToSession(dialog.sessionTitle, dialog.content)
        }
    }

    override fun update(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR)
        e.presentation.isEnabledAndVisible = editor != null && editor.selectionModel.hasSelection()
    }

    private fun saveToSession(title: String, content: String) {
        // TODO: Implement API call to save to session
        // For now, just show success notification
        ApplicationManager.getApplication().invokeLater {
            if (ChasmSettings.getInstance().showNotifications) {
                NotificationGroupManager.getInstance()
                    .getNotificationGroup("Chasm Notifications")
                    .createNotification(
                        "Saved to Session",
                        "Content saved to session: $title",
                        NotificationType.INFORMATION
                    )
                    .notify(null)
            }
        }
    }
}

/**
 * Dialog for saving content to a session.
 */
class SaveToSessionDialog(
    private val initialContent: String,
    private val fileName: String
) : DialogWrapper(null) {

    private val titleField = JBTextField("Code from $fileName")
    private val contentArea = JBTextArea(initialContent)

    val sessionTitle: String
        get() = titleField.text

    val content: String
        get() = contentArea.text

    init {
        title = "Save to Chasm Session"
        init()
    }

    override fun createCenterPanel(): JComponent {
        val panel = JPanel(BorderLayout(8, 8))
        panel.preferredSize = Dimension(500, 400)
        panel.border = JBUI.Borders.empty(8)

        // Title field
        val titlePanel = JPanel(BorderLayout(8, 0))
        titlePanel.add(JBLabel("Session Title:"), BorderLayout.WEST)
        titlePanel.add(titleField, BorderLayout.CENTER)
        panel.add(titlePanel, BorderLayout.NORTH)

        // Content area
        contentArea.lineWrap = true
        contentArea.wrapStyleWord = true
        val scrollPane = JBScrollPane(contentArea)
        panel.add(scrollPane, BorderLayout.CENTER)

        return panel
    }

    override fun getPreferredFocusedComponent(): JComponent = titleField
}
