// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
package io.chasm.plugin.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.Messages
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBList
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.JBUI
import io.chasm.plugin.services.ChasmService
import io.chasm.plugin.services.Session
import java.awt.BorderLayout
import java.awt.Dimension
import javax.swing.*

/**
 * Action to search sessions.
 */
class SearchAction : AnAction("Search Sessions", "Search across all Chasm sessions", null) {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        val dialog = SearchDialog()
        if (dialog.showAndGet()) {
            val session = dialog.selectedSession
            if (session != null) {
                // Could open session in editor or show details
                Messages.showInfoMessage(
                    project,
                    "Session: ${session.title}\n" +
                            "Provider: ${session.provider}\n" +
                            "Messages: ${session.messageCount}\n" +
                            "Model: ${session.model ?: "Unknown"}",
                    "Session Details"
                )
            }
        }
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }
}

/**
 * Search dialog for finding sessions.
 */
class SearchDialog : DialogWrapper(null) {

    private val searchField = JBTextField()
    private val resultsListModel = DefaultListModel<Session>()
    private val resultsList = JBList(resultsListModel)
    private val statusLabel = JBLabel("Enter a search query")

    var selectedSession: Session? = null
        private set

    init {
        title = "Search Sessions"
        init()
    }

    override fun createCenterPanel(): JComponent {
        val panel = JPanel(BorderLayout(8, 8))
        panel.preferredSize = Dimension(500, 400)
        panel.border = JBUI.Borders.empty(8)

        // Search field
        val searchPanel = JPanel(BorderLayout(8, 0))
        searchPanel.add(JBLabel("Search:"), BorderLayout.WEST)
        searchPanel.add(searchField, BorderLayout.CENTER)

        val searchButton = JButton("Search")
        searchButton.addActionListener { performSearch() }
        searchPanel.add(searchButton, BorderLayout.EAST)

        searchField.addActionListener { performSearch() }
        panel.add(searchPanel, BorderLayout.NORTH)

        // Results list
        resultsList.cellRenderer = object : DefaultListCellRenderer() {
            override fun getListCellRendererComponent(
                list: JList<*>?,
                value: Any?,
                index: Int,
                isSelected: Boolean,
                cellHasFocus: Boolean
            ): java.awt.Component {
                val component = super.getListCellRendererComponent(list, value, index, isSelected, cellHasFocus)
                if (value is Session) {
                    (component as JLabel).text = "<html><b>${value.title}</b><br>" +
                            "<font size='-2' color='gray'>${value.provider} • ${value.messageCount} messages</font></html>"
                    border = JBUI.Borders.empty(4, 8)
                }
                return component
            }
        }
        resultsList.selectionMode = ListSelectionModel.SINGLE_SELECTION
        resultsList.addListSelectionListener {
            selectedSession = resultsList.selectedValue
        }

        val scrollPane = JBScrollPane(resultsList)
        panel.add(scrollPane, BorderLayout.CENTER)

        // Status
        panel.add(statusLabel, BorderLayout.SOUTH)

        return panel
    }

    private fun performSearch() {
        val query = searchField.text.trim()
        if (query.isEmpty()) {
            statusLabel.text = "Enter a search query"
            return
        }

        statusLabel.text = "Searching..."
        resultsListModel.clear()

        SwingUtilities.invokeLater {
            val results = ChasmService.getInstance().searchSessions(query)
            resultsListModel.clear()
            results.forEach { resultsListModel.addElement(it) }
            statusLabel.text = "Found ${results.size} sessions"
        }
    }

    override fun getPreferredFocusedComponent(): JComponent = searchField
}
