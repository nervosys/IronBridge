// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
package io.chasm.plugin.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage

/**
 * Persistent settings state for the Chasm plugin.
 */
@State(
    name = "io.chasm.plugin.settings.ChasmSettings",
    storages = [Storage("ChasmPlugin.xml")]
)
@Service(Service.Level.APP)
class ChasmSettings : PersistentStateComponent<ChasmSettings.State> {

    private var state = State()

    data class State(
        var serverUrl: String = "http://localhost:8787",
        var autoSync: Boolean = false,
        var syncIntervalMinutes: Int = 15,
        var showNotifications: Boolean = true,
        var harvestOnStartup: Boolean = false,
        var defaultProvider: String = "",
        var lastWorkspaceId: String = ""
    )

    var serverUrl: String
        get() = state.serverUrl
        set(value) { state.serverUrl = value }

    var autoSync: Boolean
        get() = state.autoSync
        set(value) { state.autoSync = value }

    var syncIntervalMinutes: Int
        get() = state.syncIntervalMinutes
        set(value) { state.syncIntervalMinutes = value }

    var showNotifications: Boolean
        get() = state.showNotifications
        set(value) { state.showNotifications = value }

    var harvestOnStartup: Boolean
        get() = state.harvestOnStartup
        set(value) { state.harvestOnStartup = value }

    var defaultProvider: String
        get() = state.defaultProvider
        set(value) { state.defaultProvider = value }

    var lastWorkspaceId: String
        get() = state.lastWorkspaceId
        set(value) { state.lastWorkspaceId = value }

    override fun getState(): State = state

    override fun loadState(state: State) {
        this.state = state
    }

    companion object {
        @JvmStatic
        fun getInstance(): ChasmSettings {
            return ApplicationManager.getApplication().getService(ChasmSettings::class.java)
        }
    }
}
