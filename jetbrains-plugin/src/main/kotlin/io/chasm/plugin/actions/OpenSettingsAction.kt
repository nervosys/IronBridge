// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
package io.chasm.plugin.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.options.ShowSettingsUtil

/**
 * Action to open Chasm settings.
 */
class OpenSettingsAction : AnAction("Chasm Settings", "Open Chasm plugin settings", null) {

    override fun actionPerformed(e: AnActionEvent) {
        ShowSettingsUtil.getInstance().showSettingsDialog(e.project, "Chasm")
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = true
    }
}
