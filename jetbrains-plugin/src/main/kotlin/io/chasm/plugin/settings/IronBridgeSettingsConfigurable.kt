// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
package io.ironbridge.plugin.settings

import com.intellij.openapi.options.Configurable
import com.intellij.openapi.options.ConfigurationException
import com.intellij.openapi.ui.Messages
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import com.intellij.util.ui.JBUI
import io.ironbridge.plugin.services.IronBridgeService
import java.awt.BorderLayout
import javax.swing.JButton
import javax.swing.JComponent
import javax.swing.JPanel

/**
 * Settings page for the IronBridge plugin.
 */
class IronBridgeSettingsConfigurable : Configurable {

    private var settingsPanel: JPanel? = null
    private var serverUrlField: JBTextField? = null
    private var autoSyncCheckbox: JBCheckBox? = null
    private var syncIntervalField: JBTextField? = null
    private var showNotificationsCheckbox: JBCheckBox? = null
    private var harvestOnStartupCheckbox: JBCheckBox? = null

    override fun getDisplayName(): String = "IronBridge"

    override fun createComponent(): JComponent {
        // Server URL
        serverUrlField = JBTextField(IronBridgeSettings.getInstance().serverUrl)
        serverUrlField!!.columns = 30

        val testConnectionButton = JButton("Test Connection")
        testConnectionButton.addActionListener { testConnection() }

        val serverPanel = JPanel(BorderLayout(8, 0))
        serverPanel.add(serverUrlField, BorderLayout.CENTER)
        serverPanel.add(testConnectionButton, BorderLayout.EAST)

        // Sync options
        autoSyncCheckbox = JBCheckBox("Auto-sync sessions", IronBridgeSettings.getInstance().autoSync)
        syncIntervalField = JBTextField(IronBridgeSettings.getInstance().syncIntervalMinutes.toString())
        syncIntervalField!!.columns = 5

        // Notifications
        showNotificationsCheckbox = JBCheckBox(
            "Show notifications",
            IronBridgeSettings.getInstance().showNotifications
        )

        // Harvest on startup
        harvestOnStartupCheckbox = JBCheckBox(
            "Harvest sessions on project open",
            IronBridgeSettings.getInstance().harvestOnStartup
        )

        // Build form
        settingsPanel = FormBuilder.createFormBuilder()
            .addLabeledComponent(JBLabel("Server URL:"), serverPanel, 1, false)
            .addSeparator()
            .addComponent(JBLabel("Synchronization"))
            .addComponent(autoSyncCheckbox!!)
            .addLabeledComponent(JBLabel("Sync interval (minutes):"), syncIntervalField!!, 1, false)
            .addSeparator()
            .addComponent(JBLabel("Behavior"))
            .addComponent(harvestOnStartupCheckbox!!)
            .addComponent(showNotificationsCheckbox!!)
            .addComponentFillVertically(JPanel(), 0)
            .panel

        settingsPanel!!.border = JBUI.Borders.empty(16)
        return settingsPanel!!
    }

    override fun isModified(): Boolean {
        val settings = IronBridgeSettings.getInstance()
        return serverUrlField?.text != settings.serverUrl ||
                autoSyncCheckbox?.isSelected != settings.autoSync ||
                syncIntervalField?.text != settings.syncIntervalMinutes.toString() ||
                showNotificationsCheckbox?.isSelected != settings.showNotifications ||
                harvestOnStartupCheckbox?.isSelected != settings.harvestOnStartup
    }

    @Throws(ConfigurationException::class)
    override fun apply() {
        val settings = IronBridgeSettings.getInstance()

        // Validate sync interval
        val syncInterval = syncIntervalField?.text?.toIntOrNull()
        if (syncInterval == null || syncInterval < 1) {
            throw ConfigurationException("Sync interval must be a positive number")
        }

        // Validate server URL
        val serverUrl = serverUrlField?.text?.trim()
        if (serverUrl.isNullOrEmpty()) {
            throw ConfigurationException("Server URL cannot be empty")
        }

        // Apply settings
        settings.serverUrl = serverUrl
        settings.autoSync = autoSyncCheckbox?.isSelected ?: false
        settings.syncIntervalMinutes = syncInterval
        settings.showNotifications = showNotificationsCheckbox?.isSelected ?: true
        settings.harvestOnStartup = harvestOnStartupCheckbox?.isSelected ?: false

        // Update service
        IronBridgeService.getInstance().serverUrl = serverUrl
    }

    override fun reset() {
        val settings = IronBridgeSettings.getInstance()
        serverUrlField?.text = settings.serverUrl
        autoSyncCheckbox?.isSelected = settings.autoSync
        syncIntervalField?.text = settings.syncIntervalMinutes.toString()
        showNotificationsCheckbox?.isSelected = settings.showNotifications
        harvestOnStartupCheckbox?.isSelected = settings.harvestOnStartup
    }

    override fun disposeUIResources() {
        settingsPanel = null
        serverUrlField = null
        autoSyncCheckbox = null
        syncIntervalField = null
        showNotificationsCheckbox = null
        harvestOnStartupCheckbox = null
    }

    private fun testConnection() {
        val url = serverUrlField?.text?.trim() ?: return
        val originalUrl = IronBridgeService.getInstance().serverUrl

        try {
            IronBridgeService.getInstance().serverUrl = url
            val health = IronBridgeService.getInstance().checkHealth()

            if (health.healthy) {
                Messages.showInfoMessage(
                    "Connection successful!\n\nVersion: ${health.version}",
                    "IronBridge Connection"
                )
            } else {
                Messages.showErrorDialog(
                    "Connection failed: ${health.error}",
                    "IronBridge Connection"
                )
            }
        } finally {
            IronBridgeService.getInstance().serverUrl = originalUrl
        }
    }
}
