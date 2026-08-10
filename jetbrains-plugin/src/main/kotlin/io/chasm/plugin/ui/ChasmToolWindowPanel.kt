// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
package io.chasm.plugin.ui

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.SimpleToolWindowPanel
import com.intellij.ui.JBColor
import com.intellij.ui.SearchTextField
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBList
import com.intellij.ui.components.JBScrollPane
import com.intellij.util.ui.JBUI
import io.chasm.plugin.services.ChasmService
import io.chasm.plugin.services.Session
import java.awt.BorderLayout
import java.awt.Component
import java.awt.FlowLayout
import javax.swing.*
import javax.swing.event.DocumentEvent
import javax.swing.event.DocumentListener

/**
 * Main panel for the Chasm tool window.
 */
class ChasmToolWindowPanel(private val project: Project) : SimpleToolWindowPanel(true, true) {

    private val service = ChasmService.getInstance()
    private val sessionListModel = DefaultListModel<Session>()
    private val sessionList = JBList(sessionListModel)
    private val searchField = SearchTextField()
    private val statusLabel = JBLabel("Not connected")
    private val statsLabel = JBLabel("")

    init {
        setupUI()
        refreshData()
    }

    private fun setupUI() {
        // Toolbar
        val toolbar = createToolbar()
        setToolbar(toolbar)

        // Main content
        val mainPanel = JPanel(BorderLayout())
        mainPanel.border = JBUI.Borders.empty(8)

        // Search bar
        val searchPanel = JPanel(BorderLayout())
        searchPanel.border = JBUI.Borders.emptyBottom(8)
        searchField.textEditor.document.addDocumentListener(object : DocumentListener {
            override fun insertUpdate(e: DocumentEvent?) = onSearchChanged()
            override fun removeUpdate(e: DocumentEvent?) = onSearchChanged()
            override fun changedUpdate(e: DocumentEvent?) = onSearchChanged()
        })
        searchPanel.add(searchField, BorderLayout.CENTER)
        mainPanel.add(searchPanel, BorderLayout.NORTH)

        // Session list
        sessionList.cellRenderer = SessionListCellRenderer()
        sessionList.selectionMode = ListSelectionModel.SINGLE_SELECTION
        sessionList.addListSelectionListener { e ->
            if (!e.valueIsAdjusting) {
                onSessionSelected(sessionList.selectedValue)
            }
        }
        val scrollPane = JBScrollPane(sessionList)
        mainPanel.add(scrollPane, BorderLayout.CENTER)

        // Status bar
        val statusPanel = JPanel(BorderLayout())
        statusPanel.border = JBUI.Borders.emptyTop(8)
        statusLabel.foreground = JBColor.GRAY
        statsLabel.foreground = JBColor.GRAY
        statusPanel.add(statusLabel, BorderLayout.WEST)
        statusPanel.add(statsLabel, BorderLayout.EAST)
        mainPanel.add(statusPanel, BorderLayout.SOUTH)

        setContent(mainPanel)
    }

    private fun createToolbar(): JComponent {
        val toolbar = JPanel(FlowLayout(FlowLayout.LEFT, 4, 4))

        val harvestButton = JButton("Harvest")
        harvestButton.addActionListener { onHarvest() }
        toolbar.add(harvestButton)

        val refreshButton = JButton("Refresh")
        refreshButton.addActionListener { refreshData() }
        toolbar.add(refreshButton)

        val syncButton = JButton("Sync")
        syncButton.addActionListener { onSync() }
        toolbar.add(syncButton)

        return toolbar
    }

    private fun refreshData() {
        ApplicationManager.getApplication().executeOnPooledThread {
            val health = service.checkHealth()
            val sessions = if (service.isConnected) service.getSessions() else null
            val stats = if (service.isConnected) service.getStats() else null

            SwingUtilities.invokeLater {
                // Update status
                statusLabel.text = if (service.isConnected) {
                    "Connected to ${service.serverUrl}"
                } else {
                    "Not connected - ${health.error ?: "Server unavailable"}"
                }
                statusLabel.foreground = if (service.isConnected) {
                    JBColor(0x2E7D32, 0x81C784) // Green
                } else {
                    JBColor(0xC62828, 0xE57373) // Red
                }

                // Update stats
                stats?.let {
                    statsLabel.text = "${it.totalSessions} sessions, ${it.totalMessages} messages"
                }

                // Update session list
                sessionListModel.clear()
                sessions?.sessions?.forEach { session ->
                    sessionListModel.addElement(session)
                }
            }
        }
    }

    private fun onSearchChanged() {
        val query = searchField.text.trim()
        if (query.isEmpty()) {
            refreshData()
            return
        }

        ApplicationManager.getApplication().executeOnPooledThread {
            val results = service.searchSessions(query)
            SwingUtilities.invokeLater {
                sessionListModel.clear()
                results.forEach { session ->
                    sessionListModel.addElement(session)
                }
                statusLabel.text = "Found ${results.size} sessions for \"$query\""
            }
        }
    }

    private fun onSessionSelected(session: Session?) {
        session?.let {
            // Could open a detail view or editor
            println("Selected session: ${it.title} (${it.id})")
        }
    }

    private fun onHarvest() {
        statusLabel.text = "Harvesting..."
        ApplicationManager.getApplication().executeOnPooledThread {
            val result = service.harvest()
            SwingUtilities.invokeLater {
                if (result.errors.isEmpty()) {
                    statusLabel.text = "Harvested ${result.sessionsCount} sessions, ${result.messagesCount} messages"
                    refreshData()
                } else {
                    statusLabel.text = "Harvest errors: ${result.errors.joinToString(", ")}"
                    statusLabel.foreground = JBColor(0xC62828, 0xE57373)
                }
            }
        }
    }

    private fun onSync() {
        statusLabel.text = "Syncing..."
        // TODO: Implement sync
        refreshData()
    }
}

/**
 * Custom renderer for session list items.
 */
class SessionListCellRenderer : DefaultListCellRenderer() {
    override fun getListCellRendererComponent(
        list: JList<*>?,
        value: Any?,
        index: Int,
        isSelected: Boolean,
        cellHasFocus: Boolean
    ): Component {
        val component = super.getListCellRendererComponent(list, value, index, isSelected, cellHasFocus)

        if (value is Session) {
            val label = component as JLabel
            label.text = buildString {
                append("<html><b>${escapeHtml(value.title)}</b>")
                append("<br><font color='gray' size='-2'>")
                append("${value.provider} • ${value.messageCount} messages")
                if (value.model != null) {
                    append(" • ${value.model}")
                }
                append("</font></html>")
            }
            border = JBUI.Borders.empty(4, 8)
        }

        return component
    }

    private fun escapeHtml(text: String): String {
        return text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
    }
}
